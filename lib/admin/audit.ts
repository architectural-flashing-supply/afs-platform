import { createAdminClient } from '@/lib/supabase/admin';

export interface LogAdminActionInput {
  /** null for automated/system actions (e.g. the Machine Bridge service) — no logged-in admin session to attribute the entry to. */
  adminId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
}

/**
 * admin_audit_log has no RLS write policy for regular admin sessions (SCHEMA.md
 * only grants SELECT), so writes go through the service-role client — same
 * reasoning as SPEC_ADMIN_PORTAL.md §5. Never throws; an audit failure must
 * not block the underlying admin action.
 */
export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('admin_audit_log').insert({
      admin_id: input.adminId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      before_value: input.beforeValue ?? null,
      after_value: input.afterValue ?? null,
    });
  } catch (error) {
    console.error('[Admin Audit Log Error]', error);
  }
}
