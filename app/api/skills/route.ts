import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/skills
 * List all skills (system-wide, read-only)
 * Skills are seeded in the database and managed centrally
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
    const category = searchParams.get('category');

    let query = supabaseAdmin
      .from('skills')
      .select('*')
      .eq('is_active', true);

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('category').order('name');

    if (error) throw error;

    // Group by category for easier frontend use
    const grouped = data.reduce(
      (acc, skill) => {
        if (!acc[skill.category]) {
          acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
      },
      {} as Record<string, typeof data>
    );

    return NextResponse.json({
      success: true,
      data,
      grouped,
    });
  } catch (error) {
    return handleApiError(error, 'get-skills');
  }
}
