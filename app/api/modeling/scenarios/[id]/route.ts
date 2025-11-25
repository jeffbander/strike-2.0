import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

/**
 * GET /api/modeling/scenarios/[id]
 * Get a single scenario by ID
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

    const { data: scenario, error } = await supabaseAdmin
      .from('staffing_scenarios')
      .select(`
        *,
        hospitals(name, short_code),
        departments(name)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: scenario });
  } catch (error) {
    return handleApiError(error, 'get-scenario');
  }
}

/**
 * DELETE /api/modeling/scenarios/[id]
 * Soft delete a scenario
 */
async function deleteHandler(
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

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('staffing_scenarios')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    // Also delete related configs and results
    await supabaseAdmin
      .from('scenario_service_configs')
      .delete()
      .eq('scenario_id', id);

    await supabaseAdmin
      .from('scenario_staffing_results')
      .delete()
      .eq('scenario_id', id);

    await logAudit({
      action: 'DELETE',
      resourceType: 'STAFFING_SCENARIO',
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'delete-scenario');
  }
}

export const DELETE = withRateLimit(withCsrf(deleteHandler));
