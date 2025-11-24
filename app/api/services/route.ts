import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkDepartmentAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createServiceSchema, generateJobCode } from '@/lib/validation/schemas';
import { z } from 'zod';

/**
 * GET /api/services
 * List services based on user's access level
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

    let query = supabaseAdmin
      .from('services')
      .select(`
        *,
        departments(name),
        hospitals(name, short_code),
        units(name)
      `)
      .eq('is_active', true);

    // Filter based on params or user role
    if (filterDepartmentId) {
      query = query.eq('department_id', filterDepartmentId);
    } else if (filterHospitalId) {
      query = query.eq('hospital_id', filterHospitalId);
    } else if (role === 'departmental_admin' && departmentId) {
      query = query.eq('department_id', departmentId);
    } else if (role === 'hospital_admin' && hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-services');
  }
}

/**
 * Extended schema for full service creation with job types and shifts
 */
const fullServiceSchema = createServiceSchema.extend({
  job_types: z.array(z.object({
    job_type_id: z.string().uuid(),
    skill_ids: z.array(z.string().uuid()),
  })).min(1, 'At least one job type required'),
  shifts: z.array(z.object({
    job_type_id: z.string().uuid(),
    name: z.string(),
    shift_type: z.enum(['Weekday_AM', 'Weekday_PM', 'Weekend_AM', 'Weekend_PM', 'Custom']),
    start_time: z.string(),
    end_time: z.string(),
    positions_needed: z.number().int().min(1),
  })).optional(),
});

/**
 * POST /api/services
 * Create a new service with job types, skills, and shifts
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
    const validation = validateRequest(fullServiceSchema, body);
    if (!validation.success) return validation.response;

    // Check department access
    const hasAccess = await checkDepartmentAccess(userId, validation.data.department_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to department' }, { status: 403 });
    }

    // Get departmental admin ID for created_by
    const { data: adminData } = await supabaseAdmin
      .from('departmental_admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Create the service
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .insert({
        department_id: validation.data.department_id,
        hospital_id: validation.data.hospital_id,
        name: validation.data.name,
        unit_id: validation.data.unit_id,
        day_capacity: validation.data.day_capacity,
        night_capacity: validation.data.night_capacity,
        weekend_capacity: validation.data.weekend_capacity,
        operates_days: validation.data.operates_days,
        operates_nights: validation.data.operates_nights,
        operates_weekends: validation.data.operates_weekends,
        created_by: adminData?.id || userId,
        is_active: true,
      })
      .select()
      .single();

    if (serviceError) throw serviceError;

    // Create service job types
    const serviceJobTypes: { service_id: string; job_type_id: string }[] = [];
    for (const jt of validation.data.job_types) {
      const { data: sjt, error: sjtError } = await supabaseAdmin
        .from('service_job_types')
        .insert({
          service_id: service.id,
          job_type_id: jt.job_type_id,
        })
        .select()
        .single();

      if (sjtError) throw sjtError;
      serviceJobTypes.push(sjt);

      // Create service job type skills
      if (jt.skill_ids.length > 0) {
        const skillInserts = jt.skill_ids.map((skillId) => ({
          service_job_type_id: sjt.id,
          skill_id: skillId,
          is_required: true,
        }));

        const { error: skillError } = await supabaseAdmin
          .from('service_job_type_skills')
          .insert(skillInserts);

        if (skillError) throw skillError;
      }
    }

    // Auto-generate shifts if not provided
    let shifts = validation.data.shifts || [];
    if (shifts.length === 0) {
      shifts = [];
      for (const jt of validation.data.job_types) {
        if (validation.data.operates_days) {
          shifts.push({
            job_type_id: jt.job_type_id,
            name: 'Weekday AM',
            shift_type: 'Weekday_AM' as const,
            start_time: '07:00',
            end_time: '19:00',
            positions_needed: 1,
          });
        }
        if (validation.data.operates_nights) {
          shifts.push({
            job_type_id: jt.job_type_id,
            name: 'Weekday PM',
            shift_type: 'Weekday_PM' as const,
            start_time: '19:00',
            end_time: '07:00',
            positions_needed: 1,
          });
        }
        if (validation.data.operates_weekends) {
          shifts.push({
            job_type_id: jt.job_type_id,
            name: 'Weekend AM',
            shift_type: 'Weekend_AM' as const,
            start_time: '07:00',
            end_time: '19:00',
            positions_needed: 1,
          });
          shifts.push({
            job_type_id: jt.job_type_id,
            name: 'Weekend PM',
            shift_type: 'Weekend_PM' as const,
            start_time: '19:00',
            end_time: '07:00',
            positions_needed: 1,
          });
        }
      }
    }

    // Get department and hospital info for job codes
    const { data: deptData } = await supabaseAdmin
      .from('departments')
      .select('name')
      .eq('id', validation.data.department_id)
      .single();

    const { data: hospData } = await supabaseAdmin
      .from('hospitals')
      .select('short_code')
      .eq('id', validation.data.hospital_id)
      .single();

    // Create shifts and job positions
    for (const shift of shifts) {
      const sjt = serviceJobTypes.find((s) => s.job_type_id === shift.job_type_id);
      if (!sjt) continue;

      // Get job type code
      const { data: jtData } = await supabaseAdmin
        .from('job_types')
        .select('code')
        .eq('id', shift.job_type_id)
        .single();

      const { data: shiftData, error: shiftError } = await supabaseAdmin
        .from('shifts')
        .insert({
          service_id: service.id,
          service_job_type_id: sjt.id,
          name: shift.name,
          shift_type: shift.shift_type,
          start_time: shift.start_time,
          end_time: shift.end_time,
          positions_needed: shift.positions_needed,
          is_auto_generated: true,
          created_by: adminData?.id || userId,
        })
        .select()
        .single();

      if (shiftError) throw shiftError;

      // Create job positions
      const positions = [];
      for (let i = 1; i <= shift.positions_needed; i++) {
        const jobCode = generateJobCode(
          deptData?.name || 'DEPT',
          hospData?.short_code || 'HOSP',
          service.name,
          jtData?.code || 'JOB',
          shift.shift_type,
          i
        );

        positions.push({
          shift_id: shiftData.id,
          service_job_type_id: sjt.id,
          job_code: jobCode,
          position_number: i,
          status: 'Open' as const,
        });
      }

      const { error: posError } = await supabaseAdmin
        .from('job_positions')
        .insert(positions);

      if (posError) throw posError;
    }

    await logAudit({
      action: 'CREATE',
      resourceType: 'SERVICE',
      resourceId: service.id,
      changes: {
        name: service.name,
        job_types: validation.data.job_types.length,
        shifts: shifts.length,
      },
    });

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-service');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));
