import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * GET /api/modeling/scenarios/[id]/configs
 * Get all service configurations for a scenario
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const { id } = await params;

    const { data: configs, error } = await supabaseAdmin
      .from('scenario_service_configs')
      .select(`
        *,
        services(
          name,
          operates_days,
          operates_nights,
          operates_weekends,
          day_capacity,
          night_capacity,
          weekend_capacity,
          departments(name)
        )
      `)
      .eq('scenario_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    return handleApiError(error, 'get-scenario-configs');
  }
}

/**
 * PUT /api/modeling/scenarios/[id]/configs
 * Update all service configurations for a scenario
 */
const configSchema = z.object({
  service_id: z.string().uuid(),
  volume_percentage: z.number().min(0).max(100),
  operates_days: z.boolean().nullable(),
  operates_nights: z.boolean().nullable(),
  operates_weekends: z.boolean().nullable(),
  day_capacity_override: z.number().optional().nullable(),
  night_capacity_override: z.number().optional().nullable(),
  weekend_capacity_override: z.number().optional().nullable(),
  is_enabled: z.boolean(),
});

const updateConfigsSchema = z.object({
  configs: z.array(configSchema),
});

async function updateHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const { id: scenarioId } = await params;
    const body = await request.json();
    const validation = updateConfigsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Delete existing configs
    await supabaseAdmin
      .from('scenario_service_configs')
      .delete()
      .eq('scenario_id', scenarioId);

    // Insert new configs
    const configsToInsert = validation.data.configs.map((config) => ({
      scenario_id: scenarioId,
      service_id: config.service_id,
      volume_percentage: config.volume_percentage,
      operates_days: config.operates_days,
      operates_nights: config.operates_nights,
      operates_weekends: config.operates_weekends,
      day_capacity_override: config.day_capacity_override,
      night_capacity_override: config.night_capacity_override,
      weekend_capacity_override: config.weekend_capacity_override,
      is_enabled: config.is_enabled,
    }));

    if (configsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('scenario_service_configs')
        .insert(configsToInsert);

      if (insertError) throw insertError;
    }

    // Update scenario last_modified_at
    await supabaseAdmin
      .from('staffing_scenarios')
      .update({ last_modified_at: new Date().toISOString() })
      .eq('id', scenarioId);

    // Trigger staffing calculation
    await calculateAndStoreStaffing(scenarioId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'update-scenario-configs');
  }
}

/**
 * Calculate staffing needs based on scenario configuration
 */
async function calculateAndStoreStaffing(scenarioId: string) {
  // Get scenario and configs
  const { data: configs } = await supabaseAdmin
    .from('scenario_service_configs')
    .select(`
      *,
      services(
        id,
        name,
        operates_days,
        operates_nights,
        operates_weekends
      )
    `)
    .eq('scenario_id', scenarioId);

  if (!configs || configs.length === 0) return;

  // Clear existing results
  await supabaseAdmin
    .from('scenario_staffing_results')
    .delete()
    .eq('scenario_id', scenarioId);

  const results: Array<{
    scenario_id: string;
    service_id: string;
    job_type_id: string;
    shift_type: string;
    original_positions: number;
    adjusted_positions: number;
  }> = [];

  // For each enabled service config, calculate staffing
  for (const config of configs) {
    if (!config.is_enabled) continue;

    const service = config.services;
    if (!service) continue;

    // Get shifts for this service
    const { data: shifts } = await supabaseAdmin
      .from('shifts')
      .select(`
        id,
        shift_type,
        positions_needed,
        service_job_types(job_type_id)
      `)
      .eq('service_id', service.id);

    if (!shifts) continue;

    for (const shift of shifts) {
      // Check if this shift type is enabled
      const shiftEnabled = isShiftEnabled(shift.shift_type, config, service);

      const originalPositions = shift.positions_needed;
      let adjustedPositions = 0;

      if (shiftEnabled) {
        // Apply volume percentage
        adjustedPositions = Math.ceil(
          originalPositions * (config.volume_percentage / 100)
        );
      }

      results.push({
        scenario_id: scenarioId,
        service_id: service.id,
        job_type_id: shift.service_job_types?.job_type_id || '',
        shift_type: shift.shift_type,
        original_positions: originalPositions,
        adjusted_positions: adjustedPositions,
      });
    }
  }

  // Store results
  if (results.length > 0) {
    await supabaseAdmin.from('scenario_staffing_results').insert(results);
  }
}

function isShiftEnabled(
  shiftType: string,
  config: {
    operates_days: boolean | null;
    operates_nights: boolean | null;
    operates_weekends: boolean | null;
  },
  service: {
    operates_days: boolean;
    operates_nights: boolean;
    operates_weekends: boolean;
  }
): boolean {
  // Use config override if set, otherwise use service default
  if (shiftType === 'Weekday_AM') {
    return config.operates_days ?? service.operates_days;
  }
  if (shiftType === 'Weekday_PM') {
    return config.operates_nights ?? service.operates_nights;
  }
  if (shiftType === 'Weekend_AM' || shiftType === 'Weekend_PM') {
    return config.operates_weekends ?? service.operates_weekends;
  }
  return true; // Custom shifts always enabled
}

export const PUT = withRateLimit(withCsrf(updateHandler));
