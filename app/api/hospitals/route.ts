import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHealthSystemAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createHospitalSchema } from '@/lib/validation/schemas';

/**
 * GET /api/hospitals
 * List hospitals based on user's access level
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, role, healthSystemId, hospitalId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    let query = supabaseAdmin
      .from('hospitals')
      .select('*, health_systems(name)')
      .eq('is_active', true);

    // Filter based on role
    if (role === 'health_system_admin' && healthSystemId) {
      query = query.eq('health_system_id', healthSystemId);
    } else if ((role === 'hospital_admin' || role === 'departmental_admin') && hospitalId) {
      query = query.eq('id', hospitalId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-hospitals');
  }
}

/**
 * POST /api/hospitals
 * Create a new hospital (Super Admin or Health System Admin)
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole(['super_admin', 'health_system_admin']);

    const body = await request.json();
    const validation = validateRequest(createHospitalSchema, body);
    if (!validation.success) return validation.response;

    // Check health system access
    const hasAccess = await checkHealthSystemAccess(userId, validation.data.health_system_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to health system' }, { status: 403 });
    }

    // Get health system admin ID for created_by
    const { data: adminData } = await supabaseAdmin
      .from('health_system_admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .insert({
        health_system_id: validation.data.health_system_id,
        name: validation.data.name,
        short_code: validation.data.short_code,
        address: validation.data.address,
        city: validation.data.city,
        state: validation.data.state,
        zip_code: validation.data.zip_code,
        created_by: adminData?.id || userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'CREATE',
      resourceType: 'HOSPITAL',
      resourceId: data.id,
      changes: { name: data.name, short_code: data.short_code },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-hospital');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));
