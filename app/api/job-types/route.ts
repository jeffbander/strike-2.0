import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHealthSystemAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createJobTypeSchema } from '@/lib/validation/schemas';
import { DEFAULT_JOB_TYPES } from '@/types/database';

/**
 * GET /api/job-types
 * List job types based on user's access level (scoped to health system)
 */
export async function GET(request: NextRequest) {
  try {
    const { healthSystemId, hospitalId, role } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const searchParams = request.nextUrl.searchParams;
    const filterHealthSystemId = searchParams.get('health_system_id');

    let query = supabaseAdmin
      .from('job_types')
      .select('*, health_systems(name)')
      .eq('is_active', true);

    // Filter by health system
    if (filterHealthSystemId) {
      query = query.eq('health_system_id', filterHealthSystemId);
    } else if (role === 'health_system_admin' && healthSystemId) {
      query = query.eq('health_system_id', healthSystemId);
    } else if ((role === 'hospital_admin' || role === 'departmental_admin') && hospitalId) {
      // Get health system from user's hospital
      const { data: hospital } = await supabaseAdmin
        .from('hospitals')
        .select('health_system_id')
        .eq('id', hospitalId)
        .single();

      if (hospital?.health_system_id) {
        query = query.eq('health_system_id', hospital.health_system_id);
      }
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-job-types');
  }
}

/**
 * POST /api/job-types
 * Create a new job type at the health system level
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
    ]);

    const body = await request.json();
    const validation = validateRequest(createJobTypeSchema, body);
    if (!validation.success) return validation.response;

    // Check health system access
    const hasAccess = await checkHealthSystemAccess(userId, validation.data.health_system_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to health system' }, { status: 403 });
    }

    const isDefault = DEFAULT_JOB_TYPES.some((jt) => jt.code === validation.data.code);

    const { data, error } = await supabaseAdmin
      .from('job_types')
      .insert({
        health_system_id: validation.data.health_system_id,
        name: validation.data.name,
        code: validation.data.code,
        description: validation.data.description,
        is_default: isDefault,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'CREATE',
      resourceType: 'JOB_TYPE',
      resourceId: data.id,
      changes: { name: data.name, code: data.code },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-job-type');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));

/**
 * Initialize default job types for a health system
 */
export async function initializeDefaultJobTypes(healthSystemId: string) {
  const jobTypes = DEFAULT_JOB_TYPES.map((jt) => ({
    health_system_id: healthSystemId,
    name: jt.name,
    code: jt.code,
    is_default: true,
    is_active: true,
  }));

  const { data, error } = await supabaseAdmin
    .from('job_types')
    .insert(jobTypes)
    .select();

  if (error) throw error;
  return data;
}
