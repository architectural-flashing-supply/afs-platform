import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

export type FieldRole = 'contractor' | 'admin';

export interface FieldUser {
  id: string;
  role: FieldRole;
}

/**
 * middleware.ts already blocks unauthorized roles from /field/contractor
 * and /field/shop, but middleware can be bypassed by misconfiguration or
 * future route changes — every /field page calls this too, matching
 * lib/admin/auth.ts's requireAdminUser() precedent, so the role check
 * never depends on a single layer. Anyone not in `allowedRoles` (including
 * signed-out visitors, and the existing 'architect'/'customer'/'operator'
 * roles) lands on /field/no-access rather than the field routes themselves.
 */
export async function requireFieldRole(
  supabase: SupabaseClient,
  allowedRoles: FieldRole[]
): Promise<FieldUser> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/field/no-access');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role as FieldRole)) {
    redirect('/field/no-access');
  }

  return { id: user.id, role: profile.role as FieldRole };
}
