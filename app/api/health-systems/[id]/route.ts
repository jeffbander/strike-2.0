import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireRole, checkHealthSystemAccess } from '@/lib/auth/authorization';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/health-systems/[id]
 * Get a specific health system
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { userId } = await requireRole([
      'super_admin',
      'health_system_admin',
      'hospital_admin',
    ]);

    // Check access
    const hasAccess = await checkHealthSystemAccess(userId, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('health_systems')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Health system not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'get-health-system');
  }
}

/**
 * DELETE /api/health-systems/[id]
 * Soft delete a health system (Super Admin only)
 */
async function deleteHandler(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await requireRole(['super_admin']);

    const { data, error } = await supabaseAdmin
      .from('health_systems')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      action: 'DELETE',
      resourceType: 'HEALTH_SYSTEM',
      resourceId: id,
      changes: { is_active: false },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'delete-health-system');
  }
}

export const DELETE = withRateLimit(withCsrf(deleteHandler));
