import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHospitalAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createUnitSchema } from '@/lib/validation/schemas';

/**
 * GET /api/units
 * List units/floors based on user's access level
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
      .from('units')
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
    return handleApiError(error, 'get-units');
  }
}

/**
 * POST /api/units
 * Create a new unit/floor
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
    ]);

    const body = await request.json();
    const validation = validateRequest(createUnitSchema, body);
    if (!validation.success) return validation.response;

    // Check hospital access
    const hasAccess = await checkHospitalAccess(userId, validation.data.hospital_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to hospital' }, { status: 403 });
    }

    // Get hospital admin ID for created_by
    const { data: adminData } = await supabaseAdmin
      .from('hospital_admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    const { data, error } = await supabaseAdmin
      .from('units')
      .insert({
        hospital_id: validation.data.hospital_id,
        name: validation.data.name,
        description: validation.data.description,
        floor_number: validation.data.floor_number,
        created_by: adminData?.id || userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'CREATE',
      resourceType: 'UNIT',
      resourceId: data.id,
      changes: { name: data.name, hospital_id: data.hospital_id },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-unit');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));
