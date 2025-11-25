import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkDepartmentAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/providers/[id]
 * Get a single provider by ID
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
      .from('providers')
      .select(`
        *,
        departments(name),
        hospitals(name, short_code),
        job_types(name, code),
        provider_skills(skill_id, skills(id, name, category)),
        provider_hospital_access(hospital_id, hospitals(id, name, short_code))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-provider');
  }
}

/**
 * PATCH /api/providers/[id]
 * Update a provider
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
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    // First get the provider to check access
    const { data: provider, error: fetchError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Check department access if provider has a department
    if (provider.department_id) {
      const hasAccess = await checkDepartmentAccess(userId, provider.department_id);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this provider' }, { status: 403 });
      }
    }

    const body = await request.json();

    // Handle basic field updates
    const allowedFields = ['name', 'email', 'phone', 'job_type_id', 'department_id', 'hospital_id', 'availability_comments'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Update provider basic info
    if (Object.keys(updates).length > 0) {
      updates.last_modified_at = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from('providers')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
    }

    // Update skills if provided
    if (body.skill_ids !== undefined) {
      // Delete existing skills
      await supabaseAdmin
        .from('provider_skills')
        .delete()
        .eq('provider_id', id);

      // Insert new skills
      if (body.skill_ids.length > 0) {
        const skillInserts = body.skill_ids.map((skillId: string) => ({
          provider_id: id,
          skill_id: skillId,
        }));

        const { error: skillError } = await supabaseAdmin
          .from('provider_skills')
          .insert(skillInserts);

        if (skillError) throw skillError;
      }
    }

    // Update hospital access if provided
    if (body.hospital_access_ids !== undefined) {
      // Delete existing access
      await supabaseAdmin
        .from('provider_hospital_access')
        .delete()
        .eq('provider_id', id);

      // Insert new access
      const hospitalIds = new Set(body.hospital_access_ids);
      // Include home hospital if provided
      if (body.hospital_id || updates.hospital_id || provider.hospital_id) {
        hospitalIds.add(body.hospital_id || updates.hospital_id || provider.hospital_id);
      }

      if (hospitalIds.size > 0) {
        const accessInserts = Array.from(hospitalIds).map((hospitalId) => ({
          provider_id: id,
          hospital_id: hospitalId,
          can_work_here: true,
        }));

        const { error: accessError } = await supabaseAdmin
          .from('provider_hospital_access')
          .insert(accessInserts);

        if (accessError) throw accessError;
      }
    }

    // Fetch updated provider
    const { data: updatedProvider, error: refetchError } = await supabaseAdmin
      .from('providers')
      .select(`
        *,
        departments(name),
        hospitals(name, short_code),
        job_types(name, code),
        provider_skills(skill_id, skills(id, name, category)),
        provider_hospital_access(hospital_id, hospitals(id, name, short_code))
      `)
      .eq('id', id)
      .single();

    if (refetchError) throw refetchError;

    await logAudit({
      action: 'UPDATE',
      resourceType: 'PROVIDER',
      resourceId: id,
      changes: updates,
    });

    return NextResponse.json({ success: true, data: updatedProvider });
  } catch (error) {
    return handleApiError(error, 'update-provider');
  }
}

/**
 * DELETE /api/providers/[id]
 * Soft delete a provider (set is_active to false)
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
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    // First get the provider to check access
    const { data: provider, error: fetchError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Check department access if provider has a department
    if (provider.department_id) {
      const hasAccess = await checkDepartmentAccess(userId, provider.department_id);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this provider' }, { status: 403 });
      }
    }

    // Check if provider has any active assignments
    const { count: assignmentCount } = await supabaseAdmin
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('provider_id', id)
      .neq('status', 'Cancelled');

    if (assignmentCount && assignmentCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete provider with ${assignmentCount} active assignment(s). Cancel assignments first.` },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data, error } = await supabaseAdmin
      .from('providers')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'DELETE',
      resourceType: 'PROVIDER',
      resourceId: id,
      changes: { name: provider.name, deactivated: true },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'delete-provider');
  }
}
