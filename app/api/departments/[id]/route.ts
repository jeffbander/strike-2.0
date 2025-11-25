import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHospitalAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/departments/[id]
 * Get a single department by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('*, hospitals(name, short_code)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-department');
  }
}

/**
 * DELETE /api/departments/[id]
 * Soft delete a department (set is_active to false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify CSRF token
    const token = request.headers.get('X-CSRF-Token');
    const validCsrf = await verifyCsrfToken(token);
    if (!validCsrf) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
    ]);

    // First get the department to check access
    const { data: department, error: fetchError } = await supabaseAdmin
      .from('departments')
      .select('*, hospitals(name)')
      .eq('id', id)
      .single();

    if (fetchError || !department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Check hospital access
    const hasAccess = await checkHospitalAccess(userId, department.hospital_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this hospital' }, { status: 403 });
    }

    // Check if department has any services associated
    const { count: serviceCount } = await supabaseAdmin
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', id)
      .eq('is_active', true);

    if (serviceCount && serviceCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete department with ${serviceCount} active service(s). Remove or deactivate services first.` },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await supabaseAdmin
      .from('departments')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'DELETE',
      resourceType: 'DEPARTMENT',
      resourceId: id,
      changes: { name: department.name, deactivated: true },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'delete-department');
  }
}
