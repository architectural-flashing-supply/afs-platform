import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import AdminShell from '@/components/layout/AdminShell';
import { fixtureAllowedByEnvironment } from '@/lib/fixtures/mode';

// The Command Center's look is a port of prototype v7, and this is where its
// stylesheet enters the app. Imported HERE rather than in the root layout so it
// ships only with /admin routes, and generated rather than written — see
// scripts/design/scope-v7-css.mjs. Every selector in it is scoped to `.cc-v7`,
// which AdminShell sets, so it cannot reach the public marketing site.
import '@/app/styles/command-center-v7.generated.css';
// V8's stylesheet, derived from the frozen mockups by scripts/design/scope-v8-css.mjs
// and scoped to `.cc-v8`, which only a V8 screen sets. Loading it alongside v7's
// is safe precisely because of that scoping: no rule here can reach a v7 screen,
// and none can reach the public site, which does not use this layout at all.
import '@/app/styles/command-center-v8.generated.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const admin = await requireAdminUser(supabase);

  // THE BADGE COUNTS WHAT v7 COUNTS. v7's `header()` puts `ap + nin` beside
  // Workbench — approvals waiting for the machine, plus unread email. That is
  // the number Steve acts on: work that is ready to go out, not work that has
  // arrived. This used to count `job_stage='new'` (the first lane), which is
  // the "to quote" chip's number and already on the screen below.
  //
  // The email half is 0 and says so on the Workbench: there is no Microsoft
  // Graph connection (docs/COMMAND_CENTER_V2_SPEC.md §2.4), so nothing is being
  // read and a count would be a claim about an inbox nobody has opened.
  const { count } = await supabase
    .from('quote_requests')
    .select('id', { count: 'exact', head: true })
    .eq('job_stage', 'approved');

  return (
    // `fixtureAllowed` is the ENVIRONMENT half of the fixture gate — the two
    // locks a layout can see without a URL. The header checks the third
    // (`?fixture=v7`) itself. See lib/fixtures/mode.ts.
    <AdminShell
      adminName={admin.fullName}
      pendingMachineJobs={count ?? 0}
      fixtureAllowed={fixtureAllowedByEnvironment()}
    >
      {children}
    </AdminShell>
  );
}
