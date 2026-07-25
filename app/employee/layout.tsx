import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EmployeeBottomNav from '@/components/employee/EmployeeBottomNav';

export const metadata: Metadata = {
  title: 'AFS Ops',
  manifest: '/employee-manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#C0001A',
};

/**
 * Operator role required (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §3).
 * Redirects unauthenticated or wrong-role sessions straight to /login rather
 * than /account — there is no customer-facing fallback for this portal.
 * role !== 'operator' && role !== 'admin' matches is_operator()'s own
 * definition (007_delivery_tracking.sql) and every other operator gate
 * already in this codebase (lib/auth/require-operator.ts,
 * app/api/driver/location) — an admin covering for Steve/Christian isn't
 * locked out.
 */
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'operator' && profile?.role !== 'admin') redirect('/login');

  return (
    <div className="min-h-screen bg-afs-bg-dim pb-16">
      {children}
      <EmployeeBottomNav />
    </div>
  );
}
