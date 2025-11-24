import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { findMatchesForJob, type ProviderData, type JobRequirements } from '@/lib/matching/algorithm';

/**
 * GET /api/matching?job_position_id=xxx
 * Find matching providers for a specific job position
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const searchParams = request.nextUrl.searchParams;
    const jobPositionId = searchParams.get('job_position_id');

    if (!jobPositionId) {
      return NextResponse.json(
        { error: 'job_position_id is required' },
        { status: 400 }
      );
    }

    // Get job position with all required info
    const { data: jobPosition, error: jobError } = await supabaseAdmin
      .from('job_positions')
      .select(`
        id,
        job_code,
        service_job_type_id,
        shifts(
          service_id,
          services(
            department_id,
            hospital_id
          )
        ),
        service_job_types(
          job_type_id,
          service_job_type_skills(
            skill_id,
            skills(id, name)
          )
        )
      `)
      .eq('id', jobPositionId)
      .single();

    if (jobError) throw jobError;
    if (!jobPosition) {
      return NextResponse.json({ error: 'Job position not found' }, { status: 404 });
    }

    // Extract job requirements
    const jobRequirements: JobRequirements = {
      jobPositionId: jobPosition.id,
      jobCode: jobPosition.job_code,
      hospitalId: jobPosition.shifts?.services?.hospital_id || '',
      departmentId: jobPosition.shifts?.services?.department_id || '',
      requiredSkills: jobPosition.service_job_types?.service_job_type_skills?.map(
        (s: { skills: { id: string; name: string } }) => ({
          id: s.skills.id,
          name: s.skills.name,
        })
      ) || [],
    };

    // Get all providers that could potentially match
    const { data: providers, error: providerError } = await supabaseAdmin
      .from('providers')
      .select(`
        id,
        name,
        email,
        department_id,
        hospital_id,
        availability_comments,
        departments(name),
        hospitals(name, short_code),
        job_types(name, code),
        provider_skills(
          skill_id,
          skills(id, name)
        ),
        provider_hospital_access(
          hospital_id,
          hospitals(name, short_code)
        ),
        assignments(id, status)
      `)
      .eq('is_active', true);

    if (providerError) throw providerError;

    // Transform to ProviderData format
    const providerData: ProviderData[] = (providers || []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      job_type_name: p.job_types?.name || '',
      job_type_code: p.job_types?.code || '',
      home_department_id: p.department_id,
      home_department_name: p.departments?.name || '',
      home_hospital_id: p.hospital_id,
      home_hospital_name: p.hospitals?.name || '',
      skills: (p.provider_skills || []).map((ps: { skills: { id: string; name: string } }) => ({
        id: ps.skills?.id || '',
        name: ps.skills?.name || '',
      })),
      can_work_at_hospital_ids: (p.provider_hospital_access || []).map(
        (a: { hospital_id: string }) => a.hospital_id
      ),
      can_work_at_hospitals: (p.provider_hospital_access || []).map(
        (a: { hospitals: { short_code: string } }) => a.hospitals?.short_code || ''
      ),
      has_current_assignment: (p.assignments || []).some(
        (a: { status: string }) => a.status !== 'Cancelled'
      ),
      availability_comments: p.availability_comments,
    }));

    // Run matching algorithm
    const matches = findMatchesForJob(jobRequirements, providerData);

    return NextResponse.json({
      success: true,
      job: {
        id: jobPosition.id,
        job_code: jobPosition.job_code,
        required_skills: jobRequirements.requiredSkills.map((s) => s.name),
      },
      matches,
      total_matches: matches.length,
      perfect_matches: matches.filter((m) => m.matchQuality === 'Perfect').length,
      good_matches: matches.filter((m) => m.matchQuality === 'Good').length,
      partial_matches: matches.filter((m) => m.matchQuality === 'Partial').length,
    });
  } catch (error) {
    return handleApiError(error, 'get-matches');
  }
}
