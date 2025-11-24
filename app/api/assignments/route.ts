import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createAssignmentSchema } from '@/lib/validation/schemas';

/**
 * GET /api/assignments
 * List assignments based on user's access level
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
    const filterServiceId = searchParams.get('service_id');
    const filterStatus = searchParams.get('status');

    let query = supabaseAdmin
      .from('assignments')
      .select(`
        *,
        providers(
          name, email,
          job_types(name, code),
          departments(name)
        ),
        job_positions(
          job_code, position_number, status,
          shifts(name, shift_type, start_time, end_time,
            services(name, department_id, hospital_id,
              departments(name),
              hospitals(name, short_code)
            )
          )
        ),
        departmental_admins(name, email)
      `);

    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query.order('assigned_at', { ascending: false });

    if (error) throw error;

    // Filter based on user's access
    let filteredData = data;
    if (role === 'departmental_admin' && departmentId) {
      filteredData = data?.filter((a) => {
        const dept = a.job_positions?.shifts?.services?.department_id;
        return dept === departmentId;
      });
    } else if (role === 'hospital_admin' && hospitalId) {
      filteredData = data?.filter((a) => {
        const hosp = a.job_positions?.shifts?.services?.hospital_id;
        return hosp === hospitalId;
      });
    }

    if (filterServiceId) {
      filteredData = filteredData?.filter((a) => {
        return a.job_positions?.shifts?.services?.id === filterServiceId;
      });
    }

    return NextResponse.json({ success: true, data: filteredData });
  } catch (error) {
    return handleApiError(error, 'get-assignments');
  }
}

/**
 * POST /api/assignments
 * Create a new assignment (assign provider to job position)
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
    const validation = validateRequest(createAssignmentSchema, body);
    if (!validation.success) return validation.response;

    // Check if provider is already assigned
    const { data: existingAssignment } = await supabaseAdmin
      .from('assignments')
      .select('id')
      .eq('provider_id', validation.data.provider_id)
      .neq('status', 'Cancelled')
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Provider is already assigned to another job' },
        { status: 400 }
      );
    }

    // Check if job position is already assigned
    const { data: existingPosition } = await supabaseAdmin
      .from('assignments')
      .select('id')
      .eq('job_position_id', validation.data.job_position_id)
      .neq('status', 'Cancelled')
      .single();

    if (existingPosition) {
      return NextResponse.json(
        { error: 'Job position is already assigned' },
        { status: 400 }
      );
    }

    // Get departmental admin ID
    const { data: adminData } = await supabaseAdmin
      .from('departmental_admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Create the assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .insert({
        job_position_id: validation.data.job_position_id,
        provider_id: validation.data.provider_id,
        assigned_by: adminData?.id || userId,
        status: 'Pending',
        notes: validation.data.notes,
      })
      .select()
      .single();

    if (assignmentError) throw assignmentError;

    // Update job position status
    const { error: updateError } = await supabaseAdmin
      .from('job_positions')
      .update({
        status: 'Assigned',
        assigned_provider_id: validation.data.provider_id,
        assigned_at: new Date().toISOString(),
        assigned_by: adminData?.id || userId,
      })
      .eq('id', validation.data.job_position_id);

    if (updateError) throw updateError;

    // Get provider and job info for audit
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('name')
      .eq('id', validation.data.provider_id)
      .single();

    const { data: jobPosition } = await supabaseAdmin
      .from('job_positions')
      .select('job_code')
      .eq('id', validation.data.job_position_id)
      .single();

    await logAudit({
      action: 'CREATE',
      resourceType: 'ASSIGNMENT',
      resourceId: assignment.id,
      changes: {
        provider_name: provider?.name,
        job_code: jobPosition?.job_code,
        status: 'Pending',
      },
    });

    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-assignment');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));

/**
 * DELETE /api/assignments
 * Cancel an assignment (unassign provider from job position)
 */
async function deleteHandler(request: NextRequest) {
  try {
    await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const searchParams = request.nextUrl.searchParams;
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
    }

    // Get the assignment first
    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from('assignments')
      .select('*, job_positions(job_code), providers(name)')
      .eq('id', assignmentId)
      .single();

    if (fetchError) throw fetchError;
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Update assignment status to cancelled
    const { error: updateAssignmentError } = await supabaseAdmin
      .from('assignments')
      .update({ status: 'Cancelled' })
      .eq('id', assignmentId);

    if (updateAssignmentError) throw updateAssignmentError;

    // Update job position status back to Open
    const { error: updatePositionError } = await supabaseAdmin
      .from('job_positions')
      .update({
        status: 'Open',
        assigned_provider_id: null,
        assigned_at: null,
        assigned_by: null,
      })
      .eq('id', assignment.job_position_id);

    if (updatePositionError) throw updatePositionError;

    await logAudit({
      action: 'DELETE',
      resourceType: 'ASSIGNMENT',
      resourceId: assignmentId,
      changes: {
        provider_name: assignment.providers?.name,
        job_code: assignment.job_positions?.job_code,
        previous_status: assignment.status,
        new_status: 'Cancelled',
      },
    });

    return NextResponse.json({ success: true, message: 'Assignment cancelled' });
  } catch (error) {
    return handleApiError(error, 'delete-assignment');
  }
}

export const DELETE = withRateLimit(withCsrf(deleteHandler));
