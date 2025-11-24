import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireRole, type UserRole } from '@/lib/auth/authorization';
import { createInvitationSchema } from '@/lib/validation/schemas';
import { logAudit } from '@/lib/audit/logger';
import crypto from 'crypto';

/**
 * GET /api/invitations - List invitations
 *
 * Query params:
 * - status: 'pending' | 'accepted' | 'expired' | 'revoked'
 * - role: 'health_system_admin' | 'hospital_admin' | 'departmental_admin'
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    let query = supabaseAdmin
      .from('user_invitations')
      .select(`
        *,
        health_systems:health_system_id(id, name),
        hospitals:hospital_id(id, name, short_code),
        departments:department_id(id, name)
      `)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by role if provided
    if (role) {
      query = query.eq('role', role);
    }

    // Apply role-based filtering
    if (user.role === 'health_system_admin' && user.healthSystemId) {
      // HS admins can only see invitations for their health system or its hospitals
      const { data: hospitals } = await supabaseAdmin
        .from('hospitals')
        .select('id')
        .eq('health_system_id', user.healthSystemId);

      const hospitalIds = hospitals?.map(h => h.id) || [];

      query = query.or(`health_system_id.eq.${user.healthSystemId},hospital_id.in.(${hospitalIds.join(',')})`);
    } else if (user.role === 'hospital_admin' && user.hospitalId) {
      // Hospital admins can only see invitations for their hospital's departments
      const { data: departments } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('hospital_id', user.hospitalId);

      const departmentIds = departments?.map(d => d.id) || [];

      query = query.or(`hospital_id.eq.${user.hospitalId},department_id.in.(${departmentIds.join(',')})`);
    } else if (user.role === 'departmental_admin' && user.departmentId) {
      // Dept admins can only see invitations for their department
      query = query.eq('department_id', user.departmentId);
    }

    const { data: invitations, error } = await query;

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({ invitations });

  } catch (error) {
    console.error('Error in GET /api/invitations:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/invitations - Create a new invitation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const body = await request.json();
    const validation = createInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, role, health_system_id, hospital_id, department_id } = validation.data;

    // Authorization: Check if user can create this type of invitation
    const canCreateInvitation = await checkInvitationPermission(
      user.role,
      user.healthSystemId,
      user.hospitalId,
      user.departmentId,
      role,
      health_system_id,
      hospital_id,
      department_id
    );

    if (!canCreateInvitation) {
      return NextResponse.json(
        { error: 'You do not have permission to create this invitation' },
        { status: 403 }
      );
    }

    // Check for existing pending invitation
    const { data: existing } = await supabaseAdmin
      .from('user_invitations')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 409 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const { data: invitation, error } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        email,
        name,
        role,
        health_system_id: health_system_id || null,
        hospital_id: hospital_id || null,
        department_id: department_id || null,
        token,
        invited_by: user.userId,
        invited_by_role: user.role,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Log the action
    await logAudit({
      userId: user.userId,
      action: 'CREATE',
      resourceType: 'INVITATION',
      resourceId: invitation.id,
      changes: { email, role, health_system_id, hospital_id, department_id },
    });

    return NextResponse.json({
      success: true,
      invitation: {
        ...invitation,
        signupUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/sign-up?token=${token}`,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/invitations:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Check if user has permission to create an invitation for the given role/org
 */
async function checkInvitationPermission(
  userRole: UserRole,
  userHealthSystemId: string | undefined,
  userHospitalId: string | undefined,
  userDepartmentId: string | undefined,
  targetRole: string,
  targetHealthSystemId: string | undefined,
  targetHospitalId: string | undefined,
  targetDepartmentId: string | undefined
): Promise<boolean> {
  // Super admin can create any invitation
  if (userRole === 'super_admin') {
    return true;
  }

  // Health System Admin can create Hospital Admins for their health system
  if (userRole === 'health_system_admin') {
    if (targetRole === 'hospital_admin' && targetHospitalId) {
      // Verify hospital belongs to their health system
      const { data: hospital } = await supabaseAdmin
        .from('hospitals')
        .select('health_system_id')
        .eq('id', targetHospitalId)
        .single();

      return hospital?.health_system_id === userHealthSystemId;
    }
    return false;
  }

  // Hospital Admin can create Departmental Admins for their hospital
  if (userRole === 'hospital_admin') {
    if (targetRole === 'departmental_admin' && targetDepartmentId) {
      // Verify department belongs to their hospital
      const { data: department } = await supabaseAdmin
        .from('departments')
        .select('hospital_id')
        .eq('id', targetDepartmentId)
        .single();

      return department?.hospital_id === userHospitalId;
    }
    return false;
  }

  // Departmental Admin can create other Departmental Admins for their department
  if (userRole === 'departmental_admin') {
    if (targetRole === 'departmental_admin' && targetDepartmentId === userDepartmentId) {
      return true;
    }
    return false;
  }

  return false;
}
