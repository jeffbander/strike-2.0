import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/modeling/scenarios/[id]/calculate
 * Get calculated staffing results for a scenario
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

    const { id: scenarioId } = await params;

    // Get stored results with service and job type info
    const { data: results, error } = await supabaseAdmin
      .from('scenario_staffing_results')
      .select(`
        *,
        services(name),
        job_types(name, code)
      `)
      .eq('scenario_id', scenarioId);

    if (error) throw error;

    // Transform for frontend
    const transformedResults = (results || []).map((r) => ({
      service_id: r.service_id,
      service_name: r.services?.name || 'Unknown Service',
      job_type_name: r.job_types?.name || 'Unknown Job Type',
      job_type_code: r.job_types?.code || '',
      shift_type: r.shift_type,
      original_positions: r.original_positions,
      adjusted_positions: r.adjusted_positions,
    }));

    return NextResponse.json({ success: true, data: transformedResults });
  } catch (error) {
    return handleApiError(error, 'calculate-scenario-staffing');
  }
}
