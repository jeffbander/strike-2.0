import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHospitalAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createJobTypeSchema } from '@/lib/validation/schemas';
import { DEFAULT_JOB_TYPES } from '@/types/database';

/**
 * GET /api/job-types
 * List job types based on user's access level
 */
export async function GET(request: NextRequest) {
  try {
    const { hospitalId, role } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const searchParams = request.nextUrl.searchParams;
    const filterHospitalId = searchParams.get('hospital_id');

    let query = supabaseAdmin
      .from('job_types')
      .select('*, hospitals(name, short_code)')
      .eq('is_active', true);

    // Filter by hospital
    if (filterHospitalId) {
      query = query.eq('hospital_id', filterHospitalId);
    } else if ((role === 'hospital_admin' || role === 'departmental_admin') && hospitalId) {
      query = query.eq('hospital_id', hospitalId);
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
 * Create a new job type
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
    ]);

    const body = await request.json();
    const validation = validateRequest(createJobTypeSchema, body);
    if (!validation.success) return validation.response;

    // Check hospital access
    const hasAccess = await checkHospitalAccess(userId, validation.data.hospital_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to hospital' }, { status: 403 });
    }

    const isDefault = DEFAULT_JOB_TYPES.some((jt) => jt.code === validation.data.code);

    const { data, error } = await supabaseAdmin
      .from('job_types')
      .insert({
        hospital_id: validation.data.hospital_id,
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
 * Initialize default job types for a hospital
 */
export async function initializeDefaultJobTypes(hospitalId: string) {
  const jobTypes = DEFAULT_JOB_TYPES.map((jt) => ({
    hospital_id: hospitalId,
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
