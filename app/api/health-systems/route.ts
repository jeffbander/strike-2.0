import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { createHealthSystemSchema } from '@/lib/validation/schemas';

/**
 * GET /api/health-systems
 * List all health systems (Super Admin only)
 */
export async function GET() {
  try {
    await requireRole(['super_admin']);

    const { data, error } = await supabaseAdmin
      .from('health_systems')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-health-systems');
  }
}

/**
 * POST /api/health-systems
 * Create a new health system (Super Admin only)
 */
async function createHandler(request: NextRequest) {
  try {
    const { userId } = await requireRole(['super_admin']);

    const body = await request.json();
    const validation = validateRequest(createHealthSystemSchema, body);
    if (!validation.success) return validation.response;

    const { data, error } = await supabaseAdmin
      .from('health_systems')
      .insert({
        name: validation.data.name,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'CREATE',
      resourceType: 'HEALTH_SYSTEM',
      resourceId: data.id,
      changes: { name: data.name },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'create-health-system');
  }
}

export const POST = withRateLimit(withCsrf(createHandler));
