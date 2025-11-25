import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { z } from 'zod';

/**
 * GET /api/modeling/scenarios
 * List all staffing scenarios the user has access to
 */
export async function GET() {
  try {
    const { hospitalId, role } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    let query = supabaseAdmin
      .from('staffing_scenarios')
      .select(`
        *,
        hospitals(name, short_code),
        departments(name)
      `)
      .eq('is_active', true);

    // Filter by hospital for hospital admins
    if (role === 'hospital_admin' && hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }

    const { data: scenarios, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch service configs and calculate stats for each scenario
    const enrichedScenarios = await Promise.all(
      (scenarios || []).map(async (scenario) => {
        const { data: configs } = await supabaseAdmin
          .from('scenario_service_configs')
          .select('service_id, is_enabled, volume_percentage')
          .eq('scenario_id', scenario.id);

        const { data: results } = await supabaseAdmin
          .from('scenario_staffing_results')
          .select('original_positions, adjusted_positions')
          .eq('scenario_id', scenario.id);

        const serviceCount = configs?.length || 0;
        const enabledServiceCount = configs?.filter((c) => c.is_enabled).length || 0;
        const totalOriginal = results?.reduce((sum, r) => sum + r.original_positions, 0) || 0;
        const totalAdjusted = results?.reduce((sum, r) => sum + r.adjusted_positions, 0) || 0;

        return {
          ...scenario,
          service_count: serviceCount,
          enabled_service_count: enabledServiceCount,
          total_original_positions: totalOriginal,
          total_adjusted_positions: totalAdjusted,
        };
      })
    );

    return NextResponse.json({ success: true, data: enrichedScenarios });
  } catch (error) {
    return handleApiError(error, 'get-scenarios');
  }
}

/**
 * POST /api/modeling/scenarios
 * Create a new staffing scenario
 */
const createScenarioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  hospital_id: z.string().uuid(),
  department_id: z.string().uuid().optional(),
});

async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const body = await request.json();
    const validation = createScenarioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, hospital_id, department_id } = validation.data;

    // Create the scenario
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('staffing_scenarios')
      .insert({
        name,
        description,
        hospital_id,
        department_id,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (scenarioError) throw scenarioError;

    // Auto-populate with all services from the hospital
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('hospital_id', hospital_id)
      .eq('is_active', true);

    if (services && services.length > 0) {
      const configs = services.map((service) => ({
        scenario_id: scenario.id,
        service_id: service.id,
        volume_percentage: 100,
        operates_days: null,
        operates_nights: null,
        operates_weekends: null,
        is_enabled: true,
      }));

      await supabaseAdmin.from('scenario_service_configs').insert(configs);
    }

    await logAudit({
      action: 'CREATE',
      resourceType: 'STAFFING_SCENARIO',
      resourceId: scenario.id,
      changes: { name, hospital_id },
    });

    return NextResponse.json({ success: true, data: scenario }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-scenario');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));
