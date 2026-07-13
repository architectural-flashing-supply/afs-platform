import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import AdminShell from '@/components/layout/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const admin = await requireAdminUser(supabase);

  // The Command Center's Pending Approval tab reads quote_requests directly
  // (nothing creates a machine_jobs row until an admin approves one there),
  // so the nav badge counts the same thing the tab actually shows.
  const { count } = await supabase
    .from('quote_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted');

  return (
    <AdminShell adminName={admin.fullName} pendingMachineJobs={count ?? 0}>
      {children}
    </AdminShell>
  );
}
