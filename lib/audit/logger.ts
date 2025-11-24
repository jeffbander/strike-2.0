import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'VIEW';

export type ResourceType =
  | 'HEALTH_SYSTEM'
  | 'HOSPITAL'
  | 'DEPARTMENT'
  | 'UNIT'
  | 'SERVICE'
  | 'SHIFT'
  | 'JOB_POSITION'
  | 'PROVIDER'
  | 'ASSIGNMENT'
  | 'SKILL'
  | 'JOB_TYPE'
  | 'ADMIN_USER';

export interface AuditEntry {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit entry for a user action
 * Captures user info from Clerk and writes to audit_logs table
 *
 * @param entry - The audit entry to log
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.warn('[AUDIT] Attempted to log audit without authenticated user');
      return;
    }

    let userEmail: string | undefined;
    let userRole: string | undefined;

    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      userEmail = user.emailAddresses[0]?.emailAddress;
      userRole = user.publicMetadata?.role as string;
    } catch (error) {
      console.warn('[AUDIT] Could not fetch user details:', error);
    }

    const { error } = await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      user_email: userEmail,
      user_role: userRole,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      changes: entry.changes,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[AUDIT] Failed to write audit log:', error);
    }

    // Also log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', {
        userId,
        userEmail,
        userRole,
        ...entry,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Never throw from audit logging - it shouldn't break the main operation
    console.error('[AUDIT] Error in audit logging:', error);
  }
}

/**
 * Log audit entry with before/after changes
 * Useful for UPDATE operations
 */
export async function logAuditWithChanges<T extends Record<string, unknown>>(
  action: AuditAction,
  resourceType: ResourceType,
  resourceId: string,
  before: T,
  after: T
): Promise<void> {
  const changes: Record<string, unknown> = {
    before: {},
    after: {},
  };

  // Only capture fields that actually changed
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      (changes.before as Record<string, unknown>)[key] = before[key];
      (changes.after as Record<string, unknown>)[key] = after[key];
    }
  }

  await logAudit({
    action,
    resourceType,
    resourceId,
    changes,
  });
}

/**
 * Log a bulk operation (e.g., CSV import)
 */
export async function logBulkAudit(
  action: AuditAction,
  resourceType: ResourceType,
  count: number,
  resourceIds: string[]
): Promise<void> {
  await logAudit({
    action,
    resourceType,
    changes: {
      count,
      resourceIds: resourceIds.slice(0, 100), // Limit stored IDs
    },
    metadata: {
      bulkOperation: true,
      totalCount: count,
    },
  });
}

/**
 * Log an export operation
 */
export async function logExport(
  resourceType: ResourceType,
  exportFormat: string,
  recordCount: number
): Promise<void> {
  await logAudit({
    action: 'EXPORT',
    resourceType,
    changes: {
      format: exportFormat,
      recordCount,
    },
  });
}
