import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Middleware already blocks non-admins from /admin/**, but middleware can be
 * bypassed by misconfiguration or future route changes — every admin page
 * calls this too so the role check never depends on a single layer.
 */
export async function requireAdminUser(supabase: SupabaseClient): Promise<AdminUser> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') redirect('/account');

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: (profile.full_name as string | undefined) ?? user.email ?? 'Admin',
  };
}
