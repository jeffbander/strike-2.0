import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/authorization';
import { logAudit } from '@/lib/audit/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invitations/[id] - Get a single invitation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const { data: invitation, error } = await supabaseAdmin
      .from('user_invitations')
      .select(`
        *,
        health_systems:health_system_id(id, name),
        hospitals:hospital_id(id, name, short_code),
        departments:department_id(id, name)
      `)
      .eq('id', id)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check permission to view this invitation
    const canView = await checkViewPermission(user, invitation);
    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ invitation });

  } catch (error) {
    console.error('Error in GET /api/invitations/[id]:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/invitations/[id] - Update invitation (revoke)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const body = await request.json();
    const { status } = body;

    if (status !== 'revoked') {
      return NextResponse.json(
        { error: 'Only revoking invitations is allowed' },
        { status: 400 }
      );
    }

    // Get existing invitation
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invitations can be revoked' },
        { status: 400 }
      );
    }

    // Check permission
    const canView = await checkViewPermission(user, existing);
    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Revoke the invitation
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('user_invitations')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error revoking invitation:', updateError);
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
    }

    await logAudit({
      userId: user.userId,
      action: 'UPDATE',
      resourceType: 'INVITATION',
      resourceId: id,
      changes: { status: 'revoked', previousStatus: existing.status },
    });

    return NextResponse.json({ success: true, invitation: updated });

  } catch (error) {
    console.error('Error in PATCH /api/invitations/[id]:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/invitations/[id] - Delete invitation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireRole(['super_admin']);

    const { error } = await supabaseAdmin
      .from('user_invitations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invitation:', error);
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
    }

    await logAudit({
      userId: user.userId,
      action: 'DELETE',
      resourceType: 'INVITATION',
      resourceId: id,
      changes: {},
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in DELETE /api/invitations/[id]:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Only super admins can delete invitations' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Check if user can view/manage this invitation
 */
async function checkViewPermission(
  user: { role: string; healthSystemId?: string; hospitalId?: string; departmentId?: string },
  invitation: { health_system_id?: string; hospital_id?: string; department_id?: string }
): Promise<boolean> {
  if (user.role === 'super_admin') return true;

  if (user.role === 'health_system_admin' && user.healthSystemId) {
    if (invitation.health_system_id === user.healthSystemId) return true;
    if (invitation.hospital_id) {
      const { data: hospital } = await supabaseAdmin
        .from('hospitals')
        .select('health_system_id')
        .eq('id', invitation.hospital_id)
        .single();
      return hospital?.health_system_id === user.healthSystemId;
    }
  }

  if (user.role === 'hospital_admin' && user.hospitalId) {
    if (invitation.hospital_id === user.hospitalId) return true;
    if (invitation.department_id) {
      const { data: department } = await supabaseAdmin
        .from('departments')
        .select('hospital_id')
        .eq('id', invitation.department_id)
        .single();
      return department?.hospital_id === user.hospitalId;
    }
  }

  if (user.role === 'departmental_admin' && user.departmentId) {
    return invitation.department_id === user.departmentId;
  }

  return false;
}
