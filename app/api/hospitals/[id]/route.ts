import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHealthSystemAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/hospitals/[id]
 * Get a single hospital by ID
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
      .from('hospitals')
      .select('*, health_systems(name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-hospital');
  }
}

/**
 * PATCH /api/hospitals/[id]
 * Update a hospital
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify CSRF token inline - wrappers don't pass params!
    const token = request.headers.get('X-CSRF-Token');
    const validCsrf = await verifyCsrfToken(token);
    if (!validCsrf) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { userId } = await requireRole(['super_admin', 'health_system_admin']);

    // First get the hospital to check access
    const { data: hospital, error: fetchError } = await supabaseAdmin
      .from('hospitals')
      .select('*, health_systems(name)')
      .eq('id', id)
      .single();

    if (fetchError || !hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    // Check health system access
    const hasAccess = await checkHealthSystemAccess(userId, hospital.health_system_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this health system' }, { status: 403 });
    }

    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = ['name', 'short_code', 'city', 'state', 'address', 'zip_code'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .update(updates)
      .eq('id', id)
      .select('*, health_systems(name)')
      .single();

    if (error) throw error;

    await logAudit({
      action: 'UPDATE',
      resourceType: 'HOSPITAL',
      resourceId: id,
      changes: updates,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'update-hospital');
  }
}

/**
 * DELETE /api/hospitals/[id]
 * Soft delete a hospital (set is_active to false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Verify CSRF token inline - wrappers don't pass params!
    const token = request.headers.get('X-CSRF-Token');
    const validCsrf = await verifyCsrfToken(token);
    if (!validCsrf) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { userId } = await requireRole(['super_admin', 'health_system_admin']);

    // First get the hospital to check access
    const { data: hospital, error: fetchError } = await supabaseAdmin
      .from('hospitals')
      .select('*, health_systems(name)')
      .eq('id', id)
      .single();

    if (fetchError || !hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    // Check health system access
    const hasAccess = await checkHealthSystemAccess(userId, hospital.health_system_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this health system' }, { status: 403 });
    }

    // Check if hospital has any active departments
    const { count: deptCount } = await supabaseAdmin
      .from('departments')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', id)
      .eq('is_active', true);

    if (deptCount && deptCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete hospital with ${deptCount} active department(s). Remove or deactivate departments first.` },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'DELETE',
      resourceType: 'HOSPITAL',
      resourceId: id,
      changes: { name: hospital.name, deactivated: true },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'delete-hospital');
  }
}
