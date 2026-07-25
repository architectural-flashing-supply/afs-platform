import type { SupabaseClient } from '@supabase/supabase-js';

export type OperatorAuthResult =
  | { ok: true; userId: string; role: 'operator' | 'admin' }
  | { ok: false; status: 401 | 403 };

/**
 * For API route handlers only. lib/admin/auth.ts's requireAdminUser() calls
 * next/navigation's redirect(), which only works inside a page/layout render
 * — a route handler needs a plain 401/403 JSON response instead (the same
 * issue afs-026 already worked around for app/api/admin/quickbooks/status).
 * Matches is_operator()'s own definition (supabase/migrations/
 * 007_delivery_tracking.sql — role IN ('operator','admin')) and the inline
 * check already shipped in app/api/driver/location/route.ts.
 */
export async function requireOperatorApi(supabase: SupabaseClient): Promise<OperatorAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'operator' && profile?.role !== 'admin') {
    return { ok: false, status: 403 };
  }

  return { ok: true, userId: user.id, role: profile.role as 'operator' | 'admin' };
}
