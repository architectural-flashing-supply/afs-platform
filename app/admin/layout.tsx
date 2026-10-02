import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import AdminShell from '@/components/layout/AdminShell';

// The Command Center's look is a port of prototype v7, and this is where its
// stylesheet enters the app. Imported HERE rather than in the root layout so it
// ships only with /admin routes, and generated rather than written — see
// scripts/design/scope-v7-css.mjs. Every selector in it is scoped to `.cc-v7`,
// which AdminShell sets, so it cannot reach the public marketing site.
import '@/app/styles/command-center-v7.generated.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const admin = await requireAdminUser(supabase);

  // The Workbench badge counts the NEW lane — the jobs that need a quote
  // written. v2-02: this was `status='submitted'`, which counted the pre-V2
  // Pending Approval tab. That is no longer what the badge sits next to: the
  // Workbench's first lane is `job_stage='new'`, and status stays 'submitted'
  // all the way to the machine (the single door requires it), so the old count
  // would have kept counting jobs that are already quoted or approved.
  const { count } = await supabase
    .from('quote_requests')
    .select('id', { count: 'exact', head: true })
    .eq('job_stage', 'new');

  return (
    <AdminShell adminName={admin.fullName} pendingMachineJobs={count ?? 0}>
      {children}
    </AdminShell>
  );
}
