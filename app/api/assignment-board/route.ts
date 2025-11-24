import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  AssignmentBoardData,
  BoardHospital,
  BoardShift,
  ShiftStatus,
} from '@/types/assignment-board';

// Type for the complex Supabase query result
interface JobPositionResult {
  id: string;
  job_code: string;
  position_number: number;
  status: string;
  assigned_provider_id: string | null;
  shifts: {
    id: string;
    name: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    service_id: string;
    services: {
      id: string;
      name: string;
      department_id: string;
      hospital_id: string;
      departments: { id: string; name: string } | null;
      hospitals: { id: string; name: string; short_code: string } | null;
    } | null;
  } | null;
  service_job_types: {
    id: string;
    job_type_id: string;
    job_types: { name: string; code: string } | null;
    service_job_type_skills: Array<{
      skill_id: string;
      is_required: boolean;
      skills: { id: string; name: string } | null;
    }> | null;
  } | null;
}

/**
 * GET /api/assignment-board
 * Get hierarchical data for the assignment board (hospitals > services > shifts)
 */
export async function GET() {
  try {
    const { departmentId, hospitalId, role } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    // Fetch all job positions with full details
    const { data, error } = await supabaseAdmin
      .from('job_positions')
      .select(`
        id,
        job_code,
        position_number,
        status,
        assigned_provider_id,
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
            departments(id, name),
            hospitals(id, name, short_code)
          )
        ),
        service_job_types(
          id,
          job_type_id,
          job_types(name, code),
          service_job_type_skills(
            skill_id,
            is_required,
            skills(id, name)
          )
        )
      `)
      .order('job_code');

    if (error) throw error;

    // Cast to expected type
    const jobPositions = (data || []) as unknown as JobPositionResult[];

    // Filter based on user's access level
    let filteredData = jobPositions;
    if (role === 'departmental_admin' && departmentId) {
      filteredData = filteredData.filter((jp) => {
        return jp.shifts?.services?.department_id === departmentId;
      });
    } else if (role === 'hospital_admin' && hospitalId) {
      filteredData = filteredData.filter((jp) => {
        return jp.shifts?.services?.hospital_id === hospitalId;
      });
    }

    // Transform flat data into hierarchical structure
    const hospitalsMap = new Map<string, BoardHospital>();

    for (const jp of filteredData) {
      const hospital = jp.shifts?.services?.hospitals;
      const service = jp.shifts?.services;
      const shift = jp.shifts;
      const jobType = jp.service_job_types?.job_types;

      if (!hospital || !service || !shift) continue;

      // Get or create hospital
      if (!hospitalsMap.has(hospital.id)) {
        hospitalsMap.set(hospital.id, {
          id: hospital.id,
          name: hospital.name,
          shortCode: hospital.short_code,
          unfilledCount: 0,
          services: [],
        });
      }
      const boardHospital = hospitalsMap.get(hospital.id)!;

      // Get or create service within hospital
      let boardService = boardHospital.services.find((s) => s.id === service.id);
      if (!boardService) {
        boardService = {
          id: service.id,
          name: service.name,
          unfilledCount: 0,
          shifts: [],
        };
        boardHospital.services.push(boardService);
      }

      // Map status
      let status: ShiftStatus = 'Open';
      if (jp.status === 'Assigned' || jp.status === 'Confirmed') {
        status = 'Filled';
      }

      // Get required skills
      const skills = (jp.service_job_types?.service_job_type_skills || [])
        .filter((s) => s.is_required)
        .map((s) => s.skills?.name)
        .filter((name): name is string => Boolean(name));

      // Create shift entry
      const boardShift: BoardShift = {
        id: shift.id + '-' + jp.position_number,
        name: `${shift.name} #${jp.position_number}`,
        role: jobType?.code || 'STAFF',
        time: `${shift.start_time?.slice(0, 5)} - ${shift.end_time?.slice(0, 5)}`,
        status,
        jobCode: jp.job_code,
        skills: skills,
        jobPositionId: jp.id,
      };

      boardService.shifts.push(boardShift);

      // Update unfilled counts
      if (status === 'Open') {
        boardService.unfilledCount++;
        boardHospital.unfilledCount++;
      }
    }

    // Convert map to array and sort
    const hospitals = Array.from(hospitalsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Sort services and shifts within each hospital
    for (const hospital of hospitals) {
      hospital.services.sort((a, b) => a.name.localeCompare(b.name));
      for (const service of hospital.services) {
        service.shifts.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Calculate stats
    const totalPositions = filteredData.length;
    const openPositions = filteredData.filter((jp) => jp.status === 'Open').length;
    const assignedPositions = filteredData.filter(
      (jp) => jp.status === 'Assigned' || jp.status === 'Confirmed'
    ).length;
    const pendingPositions = filteredData.filter((jp) => jp.status === 'Assigned').length;

    const response: AssignmentBoardData = {
      hospitals,
      stats: {
        totalPositions,
        openPositions,
        assignedPositions,
        pendingPositions,
        coveragePercent:
          totalPositions > 0 ? Math.round((assignedPositions / totalPositions) * 100) : 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return handleApiError(error, 'get-assignment-board');
  }
}
