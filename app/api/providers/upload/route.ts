import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

interface CSVRow {
  role: string;
  lastName: string;
  firstName: string;
  lifeNumber: string;
  cellPhone: string;
  scheduleDays: string;
  scheduleTime: string;
  homeSite: string;
  homeDepartment: string;
  supervisingMD: string;
  certification: string;
  previousExperience: string;
}

/**
 * POST /api/providers/upload
 * Upload providers via CSV
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
      'departmental_admin',
    ]);

    const body = await request.json();
    const { rows, hospitalId, departmentId } = body as {
      rows: CSVRow[];
      hospitalId: string;
      departmentId: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows provided' },
        { status: 400 }
      );
    }

    if (!hospitalId || !departmentId) {
      return NextResponse.json(
        { error: 'Hospital and department are required' },
        { status: 400 }
      );
    }

    // Get hospital's health system for job type lookup
    const { data: hospital } = await supabaseAdmin
      .from('hospitals')
      .select('health_system_id')
      .eq('id', hospitalId)
      .single();

    if (!hospital) {
      return NextResponse.json(
        { error: 'Hospital not found' },
        { status: 404 }
      );
    }

    // Get all job types for this health system
    const { data: jobTypes } = await supabaseAdmin
      .from('job_types')
      .select('id, name, code')
      .eq('health_system_id', hospital.health_system_id)
      .eq('is_active', true);

    // Get all skills
    const { data: skills } = await supabaseAdmin
      .from('skills')
      .select('id, name, category')
      .eq('is_active', true);

    // Map role names to job types
    const roleToJobType: Record<string, string> = {};
    if (jobTypes) {
      for (const jt of jobTypes) {
        // Map common variations
        const name = jt.name.toLowerCase();
        const code = jt.code.toLowerCase();

        if (name.includes('physician') || name.includes('doctor') || code === 'md') {
          roleToJobType['physician'] = jt.id;
          roleToJobType['md'] = jt.id;
          roleToJobType['doctor'] = jt.id;
        }
        if (name.includes('nurse practitioner') || code === 'np') {
          roleToJobType['np'] = jt.id;
          roleToJobType['nurse practitioner'] = jt.id;
        }
        if (name.includes('physician assistant') || code === 'pa') {
          roleToJobType['pa'] = jt.id;
          roleToJobType['physician assistant'] = jt.id;
        }
        if (name.includes('registered nurse') || code === 'rn') {
          roleToJobType['rn'] = jt.id;
          roleToJobType['registered nurse'] = jt.id;
        }
        if (name.includes('fellow') || code === 'fel') {
          roleToJobType['fellow'] = jt.id;
        }
        if (name.includes('resident') || code === 'res') {
          roleToJobType['resident'] = jt.id;
        }
      }
    }

    // Map skill names (case-insensitive)
    const skillNameToId: Record<string, string> = {};
    if (skills) {
      for (const skill of skills) {
        skillNameToId[skill.name.toLowerCase()] = skill.id;
      }
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Account for header row and 0-index

      // Skip empty rows
      if (!row.firstName && !row.lastName) {
        continue;
      }

      // Validate required fields
      if (!row.firstName || !row.lastName) {
        results.errors.push(`Row ${rowNum}: Missing first or last name`);
        results.skipped++;
        continue;
      }

      if (!row.role) {
        results.errors.push(`Row ${rowNum}: Missing role`);
        results.skipped++;
        continue;
      }

      // Map role to job type
      const jobTypeId = roleToJobType[row.role.toLowerCase()];
      if (!jobTypeId) {
        results.errors.push(`Row ${rowNum}: Unknown role "${row.role}"`);
        results.skipped++;
        continue;
      }

      const fullName = `${row.firstName} ${row.lastName}`.trim();

      // Check if provider already exists (by name and department)
      const { data: existingProvider } = await supabaseAdmin
        .from('providers')
        .select('id')
        .eq('name', fullName)
        .eq('department_id', departmentId)
        .single();

      const providerData = {
        name: fullName,
        department_id: departmentId,
        hospital_id: hospitalId,
        job_type_id: jobTypeId,
        phone: row.cellPhone || null,
        email: `${row.firstName.toLowerCase()}.${row.lastName.toLowerCase()}@placeholder.com`, // Placeholder email
        availability_comments: [
          row.scheduleDays ? `Schedule: ${row.scheduleDays}` : '',
          row.scheduleTime ? `Time: ${row.scheduleTime}` : '',
          row.supervisingMD ? `Supervising MD: ${row.supervisingMD}` : '',
          row.previousExperience ? `Experience: ${row.previousExperience}` : '',
        ].filter(Boolean).join('; ') || null,
        is_active: true,
      };

      let providerId: string;

      if (existingProvider) {
        // Update existing provider
        const { error: updateError } = await supabaseAdmin
          .from('providers')
          .update({
            ...providerData,
            last_modified_at: new Date().toISOString(),
          })
          .eq('id', existingProvider.id);

        if (updateError) {
          results.errors.push(`Row ${rowNum}: Update failed - ${updateError.message}`);
          results.skipped++;
          continue;
        }

        providerId = existingProvider.id;
        results.updated++;
      } else {
        // Create new provider
        const { data: newProvider, error: insertError } = await supabaseAdmin
          .from('providers')
          .insert({
            ...providerData,
            created_by: userId,
          })
          .select('id')
          .single();

        if (insertError) {
          results.errors.push(`Row ${rowNum}: Create failed - ${insertError.message}`);
          results.skipped++;
          continue;
        }

        providerId = newProvider.id;
        results.created++;
      }

      // Handle certifications/skills
      if (row.certification && providerId) {
        // Parse certification - could be comma-separated
        const certNames = row.certification.split(',').map(c => c.trim().toLowerCase());

        for (const certName of certNames) {
          if (!certName) continue;

          // Try to find matching skill
          const skillId = skillNameToId[certName] ||
                         skillNameToId[certName + ' basics'] ||
                         skillNameToId['medicine basics']; // Default fallback

          if (skillId) {
            // Check if already linked
            const { data: existingSkill } = await supabaseAdmin
              .from('provider_skills')
              .select('id')
              .eq('provider_id', providerId)
              .eq('skill_id', skillId)
              .single();

            if (!existingSkill) {
              await supabaseAdmin
                .from('provider_skills')
                .insert({
                  provider_id: providerId,
                  skill_id: skillId,
                });
            }
          }
        }
      }
    }

    await logAudit({
      action: 'CREATE',
      resourceType: 'PROVIDER_UPLOAD',
      resourceId: departmentId,
      changes: {
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        errorCount: results.errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    return handleApiError(error, 'provider-upload');
  }
}
