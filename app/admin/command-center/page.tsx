import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getMachineJobs, getMachineJobCounts, type CommandCenterTab } from '@/lib/data/machine-jobs';
import { getPendingQuoteRequests } from '@/lib/data/pending-quote-requests';
import { getBidDocuments } from '@/lib/data/bid-documents';
import {
  getQuoteToOrderConversion,
  getAverageOrderValue,
  getProductionCycleTime,
  getRevenueThisMonth,
  getOrderPipeline,
  getProductionStatusRows,
  getPendingActions,
  getTopCustomersYtd,
  getRecentOrders,
} from '@/lib/data/command-center-dashboard';
import EmptyState from '@/components/ui/EmptyState';
import CommandCenterJobCard from '@/components/admin/CommandCenterJobCard';
import PendingQuoteRequestCard from '@/components/admin/PendingQuoteRequestCard';
import BidsCrmTab from '@/components/admin/BidsCrmTab';
import CommandCenterDashboard from '@/components/admin/CommandCenterDashboard';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import WorkbenchLanes from '@/components/admin/WorkbenchLanes';
import { getWorkbench, DONE_ARCHIVE_DAYS } from '@/lib/data/workbench';

// Phase 2 (Command Center redesign, afs-cc-001) — this page previously also
// hosted `?tab=customers`/`?tab=orders` CRM views. Those had real dedicated
// homes already or gained one in this pass (`/admin/customers`,
// `/admin/orders-crm`) per the redesign's simplified nav, so their code
// moved rather than staying duplicated here. `?tab=bids` has no equivalent
// destination in the new nav (the spec this pass builds to doesn't mention
// a Bids view at all) — kept exactly as it was, reachable by direct URL
// only, matching this codebase's existing pattern for admin tools not
// linked from nav (see app/admin/geometry-test/page.tsx's own comment).
// `?tab=pending/sent/completed` (approve-and-send-to-the-Thalmann workflow,
// real machine_jobs rows) is UNCHANGED — it's the one thing in the old tab
// set the new spec doesn't mention anywhere either, but it's live
// day-to-day shop-floor functionality, not a duplicate of anything else, so
// deleting it was never on the table. It's reachable from the new
// Dashboard's "Quotes Awaiting Approval" pending-action pill.
//
// COMMAND CENTER V2, prompt v2-02 — /admin/command-center with NO ?tab is now
// THE WORKBENCH: five lanes, one Job card per request, newest arrival at the
// top. It replaces the KPI dashboard that v2-01 left on this route as a
// placeholder.
//
// NOTHING WAS DELETED TO MAKE ROOM. The dashboard moved to `?tab=dashboard`
// and the three machine tabs and the bids view are untouched, all four
// reachable by direct URL only — the same pattern this page already used for
// `?tab=bids` and that /admin/geometry-test uses. They are live day-to-day
// functionality that the Workbench is intended to replace once it has been
// used in anger, and deleting them on the strength of a first build of their
// replacement was not on the table. Settings' "Other tools" list is where they
// are written down.
//
// The ?tab views keep the GUNMETAL body; only the Workbench is wrapped in
// LightWorkingArea. See lib/data/admin-working-area.ts for why that decision
// lives here in the page and not in AdminShell.
type CrmTab = 'bids';
type DashboardTab = 'dashboard';
type PageTab = CommandCenterTab | CrmTab | DashboardTab;

const MACHINE_TABS: { value: CommandCenterTab; label: string }[] = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'sent', label: 'Sent to Machine' },
  { value: 'completed', label: 'Completed' },
];

const ALL_TAB_VALUES: PageTab[] = [...MACHINE_TABS.map((t) => t.value), 'bids', 'dashboard'];

function isTab(value: string | undefined): value is PageTab {
  return ALL_TAB_VALUES.some((tab) => tab === value);
}

export default async function CommandCenterPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = await createClient();
  const adminUser = await requireAdminUser(supabase);

  // Landing on /admin/command-center with no ?tab at all is THE WORKBENCH.
  // Any explicit ?tab=... value falls through to the pre-existing
  // dashboard/machine-queue/bids behavior further down, unchanged.
  const rawTab = searchParams.tab;
  const showWorkbench = rawTab === undefined;
  const activeTab: PageTab = isTab(rawTab) ? rawTab : 'pending';
  const isMachineTab = activeTab === 'pending' || activeTab === 'sent' || activeTab === 'completed';

  if (showWorkbench) {
    // First name only. "Good morning, Steve." is how the approved prototype
    // greets, and a full legal name there reads like a form letter.
    const firstName = adminUser.fullName.trim().split(/\s+/)[0] || 'there';
    const workbench = await getWorkbench(supabase, firstName);

    return (
      <LightWorkingArea>
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3.5 flex-wrap mb-4">
            <h1 className="font-heading text-3xl text-afs-ink-900">{workbench.summary.greeting}</h1>
            <span className="font-label text-[15px] font-semibold rounded-full px-3.5 py-1.5 bg-afs-bg-card border border-afs-border-light text-afs-ink-900">
              {workbench.summary.quotesToWrite === 1
                ? '1 quote to write'
                : `${workbench.summary.quotesToWrite} quotes to write`}
            </span>
            {workbench.summary.approvalsReady > 0 && (
              <span className="font-label text-[15px] font-semibold rounded-full px-3.5 py-1.5 bg-afs-green-deep text-afs-chrome-high">
                {workbench.summary.approvalsReady === 1
                  ? '1 approval ready for the machine'
                  : `${workbench.summary.approvalsReady} approvals ready for the machine`}
              </span>
            )}
            <span className="font-label text-[15px] font-semibold rounded-full px-3.5 py-1.5 bg-afs-bg-card border border-afs-border-light text-afs-ink-900">
              {workbench.summary.inTheShop === 1
                ? '1 job in the shop'
                : `${workbench.summary.inTheShop} jobs in the shop`}
            </span>
          </div>

          <WorkbenchLanes lanes={workbench.lanes} />

          {workbench.archivedFromDone > 0 && (
            // Never a silent truncation: if the 14-day rule hid something, it
            // says so and says where the job still is.
            <p className="font-body text-sm text-afs-ink-700 mt-4">
              {workbench.archivedFromDone === 1 ? '1 finished job has' : `${workbench.archivedFromDone} finished jobs have`}{' '}
              left the Workbench after {DONE_ARCHIVE_DAYS} days. Search still finds them.
            </p>
          )}
        </div>
      </LightWorkingArea>
    );
  }

  if (activeTab === 'dashboard') {
    const [
      conversion,
      averageOrderValue,
      productionCycleTime,
      revenue,
      pipeline,
      productionStatusRows,
      pendingActions,
      topCustomers,
      recentOrders,
    ] = await Promise.all([
      getQuoteToOrderConversion(supabase),
      getAverageOrderValue(supabase),
      getProductionCycleTime(supabase),
      getRevenueThisMonth(supabase),
      getOrderPipeline(supabase),
      getProductionStatusRows(supabase),
      getPendingActions(supabase),
      getTopCustomersYtd(supabase),
      getRecentOrders(supabase),
    ]);

    return (
      <div>
        <div className="mb-8">
          <Link href="/admin/command-center" className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high">
            ← Back to the Workbench
          </Link>
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2 mt-3">Command Center</p>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Dashboard</h1>
        </div>

        <CommandCenterDashboard
          conversion={conversion}
          averageOrderValue={averageOrderValue}
          productionCycleTime={productionCycleTime}
          revenue={revenue}
          pipeline={pipeline}
          productionStatusRows={productionStatusRows}
          pendingActions={pendingActions}
          topCustomers={topCustomers}
          recentOrders={recentOrders}
        />
      </div>
    );
  }

  const counts = await getMachineJobCounts(supabase);

  // Pending Approval reads from quote_requests directly — nothing creates a
  // machine_jobs row until this page's own "Approve & Send to Machine"
  // action does. Sent/Completed continue to read real machine_jobs rows.
  const [pendingRequests, jobs, crmBids] = await Promise.all([
    activeTab === 'pending' ? getPendingQuoteRequests(supabase) : Promise.resolve([]),
    activeTab === 'sent' || activeTab === 'completed' ? getMachineJobs(supabase, activeTab) : Promise.resolve([]),
    activeTab === 'bids' ? getBidDocuments(supabase) : Promise.resolve([]),
  ]);

  const isEmpty = activeTab === 'pending' ? pendingRequests.length === 0 : jobs.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
          <h1 className="font-heading text-3xl text-afs-chrome-high">{activeTab === 'bids' ? 'GC Bid Pricing' : 'Machine Queue'}</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            {activeTab === 'bids'
              ? 'General contractor bid documents and pricing notes.'
              : 'Review and approve fabrication jobs before they go to the Thalmann.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-afs-border mb-6 overflow-x-auto">
        <Link
          href="/admin/command-center"
          className="font-label text-sm px-4 py-2.5 border-b-2 border-transparent text-afs-chrome-mid hover:text-afs-chrome-high transition-colors whitespace-nowrap"
        >
          ← Workbench
        </Link>
        <Link
          href="/admin/command-center?tab=dashboard"
          className="font-label text-sm px-4 py-2.5 border-b-2 border-transparent text-afs-chrome-mid hover:text-afs-chrome-high transition-colors whitespace-nowrap"
        >
          Dashboard
        </Link>
        {MACHINE_TABS.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <Link
              key={tab.value}
              href={`/admin/command-center?tab=${tab.value}`}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                active ? 'border-afs-crimson text-afs-chrome-high' : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {tab.label} <span className="font-data text-xs text-afs-chrome-dim">({counts[tab.value]})</span>
            </Link>
          );
        })}
      </div>

      {activeTab === 'bids' && <BidsCrmTab bids={crmBids} currentUserId={adminUser.id} />}

      {isMachineTab &&
        (isEmpty ? (
          <EmptyState
            title="Nothing here."
            description={
              activeTab === 'pending'
                ? 'No quote requests are waiting for approval right now.'
                : activeTab === 'sent'
                  ? 'No jobs are currently approved, staged, or sent to the machine.'
                  : 'No jobs have been completed yet.'
            }
          />
        ) : activeTab === 'pending' ? (
          <div className="flex flex-col gap-4">
            {pendingRequests.map((request) => (
              <PendingQuoteRequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map((job) => (
              <CommandCenterJobCard key={job.id} job={job} />
            ))}
          </div>
        ))}
    </div>
  );
}
