import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

/**
 * POST /api/invitations/accept - Accept an invitation after signup
 *
 * This endpoint is called after a user signs up with an invitation token.
 * It assigns the role to the user based on the invitation.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token required' }, { status: 400 });
    }

    // Find the invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    // Check invitation status
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await supabaseAdmin
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Get user from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    // Verify email matches (optional - can be removed for flexibility)
    const userEmail = clerkUser.emailAddresses.find(
      e => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (userEmail?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match invitation' },
        { status: 400 }
      );
    }

    // Build metadata based on role
    const publicMetadata: Record<string, string | null> = {
      role: invitation.role,
      healthSystemId: null,
      hospitalId: null,
      departmentId: null,
    };

    // Set appropriate organization ID based on role
    if (invitation.role === 'health_system_admin') {
      publicMetadata.healthSystemId = invitation.health_system_id;
    } else if (invitation.role === 'hospital_admin') {
      publicMetadata.hospitalId = invitation.hospital_id;
      // Also get and set the health system ID
      const { data: hospital } = await supabaseAdmin
        .from('hospitals')
        .select('health_system_id')
        .eq('id', invitation.hospital_id)
        .single();
      if (hospital) {
        publicMetadata.healthSystemId = hospital.health_system_id;
      }
    } else if (invitation.role === 'departmental_admin') {
      publicMetadata.departmentId = invitation.department_id;
      // Get hospital and health system IDs
      const { data: department } = await supabaseAdmin
        .from('departments')
        .select('hospital_id, hospitals!inner(health_system_id)')
        .eq('id', invitation.department_id)
        .single();
      if (department) {
        publicMetadata.hospitalId = department.hospital_id;
        publicMetadata.healthSystemId = (department.hospitals as { health_system_id: string }).health_system_id;
      }
    }

    // Update Clerk user metadata
    await client.users.updateUser(userId, { publicMetadata });

    // Create admin record in appropriate table
    const userName = invitation.name ||
      `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
      'Unknown';

    if (invitation.role === 'health_system_admin' && invitation.health_system_id) {
      await supabaseAdmin.from('health_system_admins').insert({
        health_system_id: invitation.health_system_id,
        user_id: userId,
        email: invitation.email,
        name: userName,
        is_active: true,
      });
    } else if (invitation.role === 'hospital_admin' && invitation.hospital_id) {
      await supabaseAdmin.from('hospital_admins').insert({
        hospital_id: invitation.hospital_id,
        user_id: userId,
        email: invitation.email,
        name: userName,
        can_manage_multiple_hospitals: false,
        is_active: true,
      });
    } else if (invitation.role === 'departmental_admin' && invitation.department_id) {
      await supabaseAdmin.from('departmental_admins').insert({
        department_id: invitation.department_id,
        user_id: userId,
        email: invitation.email,
        name: userName,
        can_add_other_admins: true,
        assigned_by: invitation.invited_by,
        is_active: true,
      });
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from('user_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
      })
      .eq('id', invitation.id);

    // Log the action
    await logAudit({
      userId,
      action: 'UPDATE',
      resourceType: 'INVITATION',
      resourceId: invitation.id,
      changes: {
        status: 'accepted',
        role: invitation.role,
        accepted_user_id: userId,
      },
    });

    return NextResponse.json({
      success: true,
      role: invitation.role,
      message: `Welcome! You have been assigned the ${invitation.role.replace('_', ' ')} role.`,
    });

  } catch (error) {
    console.error('Error in POST /api/invitations/accept:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/invitations/accept?token=xxx - Validate invitation token (public)
 *
 * Used by signup page to validate token before signup
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const { data: invitation, error } = await supabaseAdmin
      .from('user_invitations')
      .select(`
        id,
        email,
        name,
        role,
        status,
        expires_at,
        health_systems:health_system_id(id, name),
        hospitals:hospital_id(id, name, short_code),
        departments:department_id(id, name)
      `)
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({
        valid: false,
        error: `Invitation has been ${invitation.status}`,
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({
        valid: false,
        error: 'Invitation has expired',
      });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        organization: invitation.health_systems || invitation.hospitals || invitation.departments,
      },
    });

  } catch (error) {
    console.error('Error in GET /api/invitations/accept:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
