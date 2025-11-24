import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export type UserRole =
  | 'super_admin'
  | 'health_system_admin'
  | 'hospital_admin'
  | 'departmental_admin';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  healthSystemId?: string;
  hospitalId?: string;
  departmentId?: string;
}

/**
 * Require authentication - throws if not authenticated
 * @returns The Clerk user ID
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

/**
 * Require a specific role (or higher in hierarchy)
 * Role hierarchy: super_admin > health_system_admin > hospital_admin > departmental_admin
 *
 * @param allowedRoles - Array of roles that are allowed access
 * @returns The authenticated user info
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthenticatedUser> {
  const userId = await requireAuth();

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const userRole = user.publicMetadata?.role as UserRole | undefined;

  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error('Insufficient permissions');
  }

  return {
    userId,
    role: userRole,
    healthSystemId: user.publicMetadata?.healthSystemId as string | undefined,
    hospitalId: user.publicMetadata?.hospitalId as string | undefined,
    departmentId: user.publicMetadata?.departmentId as string | undefined,
  };
}

/**
 * Check if user has access to a specific health system
 */
export async function checkHealthSystemAccess(
  userId: string,
  healthSystemId: string
): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = user.publicMetadata?.role as UserRole;
  const userHealthSystemId = user.publicMetadata?.healthSystemId as string;

  // Super admins have access to all health systems
  if (role === 'super_admin') return true;

  // Health system admins have access to their own health system
  if (role === 'health_system_admin' && userHealthSystemId === healthSystemId) {
    return true;
  }

  // Check if user's hospital belongs to this health system
  if (role === 'hospital_admin' || role === 'departmental_admin') {
    const { data: hospital } = await supabaseAdmin
      .from('hospitals')
      .select('health_system_id')
      .eq('id', user.publicMetadata?.hospitalId)
      .single();

    return hospital?.health_system_id === healthSystemId;
  }

  return false;
}

/**
 * Check if user has access to a specific hospital
 */
export async function checkHospitalAccess(
  userId: string,
  hospitalId: string
): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = user.publicMetadata?.role as UserRole;
  const userHospitalId = user.publicMetadata?.hospitalId as string;

  // Super admins have access to all hospitals
  if (role === 'super_admin') return true;

  // Health system admins can access hospitals in their health system
  if (role === 'health_system_admin') {
    const { data: hospital } = await supabaseAdmin
      .from('hospitals')
      .select('health_system_id')
      .eq('id', hospitalId)
      .single();

    return hospital?.health_system_id === user.publicMetadata?.healthSystemId;
  }

  // Hospital admins and departmental admins have access to their assigned hospital
  if (
    (role === 'hospital_admin' || role === 'departmental_admin') &&
    userHospitalId === hospitalId
  ) {
    return true;
  }

  return false;
}

/**
 * Check if user has access to a specific department
 */
export async function checkDepartmentAccess(
  userId: string,
  departmentId: string
): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = user.publicMetadata?.role as UserRole;

  // Super admins have access to all departments
  if (role === 'super_admin') return true;

  // Health system admins can access departments in their health system's hospitals
  if (role === 'health_system_admin') {
    const { data: department } = await supabaseAdmin
      .from('departments')
      .select('hospital_id, hospitals!inner(health_system_id)')
      .eq('id', departmentId)
      .single();

    return (
      (department?.hospitals as { health_system_id: string })?.health_system_id ===
      user.publicMetadata?.healthSystemId
    );
  }

  // Hospital admins can access all departments in their hospital
  if (role === 'hospital_admin') {
    const { data: department } = await supabaseAdmin
      .from('departments')
      .select('hospital_id')
      .eq('id', departmentId)
      .single();

    return department?.hospital_id === user.publicMetadata?.hospitalId;
  }

  // Departmental admins can only access their assigned department
  if (role === 'departmental_admin') {
    return user.publicMetadata?.departmentId === departmentId;
  }

  return false;
}

/**
 * Get user's role from Clerk metadata
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return (user.publicMetadata?.role as UserRole) || null;
}

/**
 * Role hierarchy check - is role1 >= role2 in hierarchy?
 */
export function isRoleHigherOrEqual(role1: UserRole, role2: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    super_admin: 4,
    health_system_admin: 3,
    hospital_admin: 2,
    departmental_admin: 1,
  };

  return hierarchy[role1] >= hierarchy[role2];
}
