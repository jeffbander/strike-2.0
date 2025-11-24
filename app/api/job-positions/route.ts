import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/job-positions
 * List job positions with full details
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
    const filterShiftType = searchParams.get('shift_type');

    let query = supabaseAdmin
      .from('job_positions')
      .select(`
        id,
        job_code,
        position_number,
        status,
        assigned_provider_id,
        assigned_at,
        shifts(
          id,
          name,
          shift_type,
          start_time,
          end_time,
          service_id,
          services(
            id,
            name,
            department_id,
            hospital_id,
            departments(name),
            hospitals(name, short_code)
          )
        ),
        service_job_types(
          id,
          job_type_id,
          job_types(name, code),
          service_job_type_skills(
            skill_id,
            skills(id, name, category)
          )
        ),
        providers(name, email)
      `);

    // Apply filters
    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query.order('job_code');

    if (error) throw error;

    // Filter based on user's access
    let filteredData = data;
    if (role === 'departmental_admin' && departmentId) {
      filteredData = data?.filter((jp) => {
        return jp.shifts?.services?.department_id === departmentId;
      });
    } else if (role === 'hospital_admin' && hospitalId) {
      filteredData = data?.filter((jp) => {
        return jp.shifts?.services?.hospital_id === hospitalId;
      });
    }

    // Filter by service if provided
    if (filterServiceId) {
      filteredData = filteredData?.filter((jp) => {
        return jp.shifts?.service_id === filterServiceId;
      });
    }

    // Filter by shift type if provided
    if (filterShiftType) {
      filteredData = filteredData?.filter((jp) => {
        return jp.shifts?.shift_type === filterShiftType;
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      summary: {
        total: filteredData?.length || 0,
        open: filteredData?.filter((jp) => jp.status === 'Open').length || 0,
        assigned: filteredData?.filter((jp) => jp.status === 'Assigned').length || 0,
        confirmed: filteredData?.filter((jp) => jp.status === 'Confirmed').length || 0,
      },
    });
  } catch (error) {
    return handleApiError(error, 'get-job-positions');
  }
}
