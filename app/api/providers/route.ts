import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkDepartmentAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createProviderSchema } from '@/lib/validation/schemas';

/**
 * GET /api/providers
 * List providers based on user's access level
 */
export async function GET(request: NextRequest) {
  try {
    const { departmentId, hospitalId, role } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const searchParams = request.nextUrl.searchParams;
    const filterDepartmentId = searchParams.get('department_id');
    const filterHospitalId = searchParams.get('hospital_id');
    const filterJobTypeId = searchParams.get('job_type_id');
    const includeAssigned = searchParams.get('include_assigned') === 'true';

    let query = supabaseAdmin
      .from('providers')
      .select(`
        *,
        departments(name),
        hospitals(name, short_code),
        job_types(name, code),
        provider_skills(skill_id, skills(name, category)),
        provider_hospital_access(hospital_id, hospitals(name, short_code)),
        assignments(id, status, job_positions(job_code))
      `)
      .eq('is_active', true);

    // Apply filters
    if (filterDepartmentId) {
      query = query.eq('department_id', filterDepartmentId);
    } else if (role === 'departmental_admin' && departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (filterHospitalId) {
      query = query.eq('hospital_id', filterHospitalId);
    } else if (role === 'hospital_admin' && hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }

    if (filterJobTypeId) {
      query = query.eq('job_type_id', filterJobTypeId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    // Filter out assigned providers if requested
    let filteredData = data;
    if (!includeAssigned) {
      filteredData = data?.filter((provider) => {
        const activeAssignments = provider.assignments?.filter(
          (a: { status: string }) => a.status !== 'Cancelled'
        );
        return !activeAssignments || activeAssignments.length === 0;
      });
    }

    return NextResponse.json({ success: true, data: filteredData });
  } catch (error) {
    return handleApiError(error, 'get-providers');
  }
}

/**
 * POST /api/providers
 * Create a new provider
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const body = await request.json();
    const validation = validateRequest(createProviderSchema, body);
    if (!validation.success) return validation.response;

    // Check department access only if department_id is provided
    if (validation.data.department_id) {
      const hasAccess = await checkDepartmentAccess(userId, validation.data.department_id);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to department' }, { status: 403 });
      }
    }

    // Get departmental admin ID for created_by
    const { data: adminData } = await supabaseAdmin
      .from('departmental_admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Create the provider
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .insert({
        department_id: validation.data.department_id || null,
        hospital_id: validation.data.hospital_id || null,
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        job_type_id: validation.data.job_type_id,
        availability_comments: validation.data.availability_comments || null,
        created_by: adminData?.id || userId,
        is_active: true,
      })
      .select()
      .single();

    if (providerError) throw providerError;

    // Create provider skills (if any)
    const skillIds = validation.data.skill_ids || [];
    if (skillIds.length > 0) {
      const skillInserts = skillIds.map((skillId) => ({
        provider_id: provider.id,
        skill_id: skillId,
      }));

      const { error: skillError } = await supabaseAdmin
        .from('provider_skills')
        .insert(skillInserts);

      if (skillError) throw skillError;
    }

    // Create hospital access
    const hospitalAccessIds = new Set(validation.data.hospital_access_ids || []);
    // Include home hospital if provided
    if (validation.data.hospital_id) {
      hospitalAccessIds.add(validation.data.hospital_id);
    }

    if (hospitalAccessIds.size > 0) {
      const accessInserts = Array.from(hospitalAccessIds).map((hospitalId) => ({
        provider_id: provider.id,
        hospital_id: hospitalId,
        can_work_here: true,
      }));

      const { error: accessError } = await supabaseAdmin
        .from('provider_hospital_access')
        .insert(accessInserts);

      if (accessError) throw accessError;
    }

    await logAudit({
      action: 'CREATE',
      resourceType: 'PROVIDER',
      resourceId: provider.id,
      changes: {
        name: provider.name,
        email: provider.email,
        skills: skillIds.length,
        hospitals: hospitalAccessIds.size,
      },
    });

    return NextResponse.json({ success: true, data: provider }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-provider');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));
