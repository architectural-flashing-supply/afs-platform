import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import AdminShell from '@/components/layout/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const admin = await requireAdminUser(supabase);

  const { count } = await supabase
    .from('machine_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_approval');

  return (
    <AdminShell adminName={admin.fullName} pendingMachineJobs={count ?? 0}>
      {children}
    </AdminShell>
  );
}
