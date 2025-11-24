import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHospitalAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createDepartmentSchema } from '@/lib/validation/schemas';
import { DEFAULT_DEPARTMENTS } from '@/types/database';

/**
 * GET /api/departments
 * List departments based on user's access level
 */
export async function GET(request: NextRequest) {
  try {
    const { hospitalId, departmentId, role } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const searchParams = request.nextUrl.searchParams;
    const filterHospitalId = searchParams.get('hospital_id');

    let query = supabaseAdmin
      .from('departments')
      .select('*, hospitals(name, short_code)')
      .eq('is_active', true);

    // Filter by hospital if provided or by user's assigned hospital
    if (filterHospitalId) {
      query = query.eq('hospital_id', filterHospitalId);
    } else if (role === 'hospital_admin' && hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    } else if (role === 'departmental_admin' && departmentId) {
      query = query.eq('id', departmentId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-departments');
  }
}

/**
 * POST /api/departments
 * Create a new department or activate a default one
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
    ]);

    const body = await request.json();
    const validation = validateRequest(createDepartmentSchema, body);
    if (!validation.success) return validation.response;

    // Check hospital access
    const hasAccess = await checkHospitalAccess(userId, validation.data.hospital_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to hospital' }, { status: 403 });
    }

    const isDefault = DEFAULT_DEPARTMENTS.includes(validation.data.name as typeof DEFAULT_DEPARTMENTS[number]);

    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert({
        hospital_id: validation.data.hospital_id,
        name: validation.data.name,
        is_default: isDefault,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'CREATE',
      resourceType: 'DEPARTMENT',
      resourceId: data.id,
      changes: { name: data.name, hospital_id: data.hospital_id },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-department');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));

/**
 * POST /api/departments/initialize-defaults
 * Create all default departments for a hospital
 */
export async function initializeDefaults(hospitalId: string) {
  const departments = DEFAULT_DEPARTMENTS.map((name) => ({
    hospital_id: hospitalId,
    name,
    is_default: true,
    is_active: true,
  }));

  const { data, error } = await supabaseAdmin
    .from('departments')
    .insert(departments)
    .select();

  if (error) throw error;
  return data;
}
