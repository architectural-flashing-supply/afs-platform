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
type CrmTab = 'bids';
type PageTab = CommandCenterTab | CrmTab;

const MACHINE_TABS: { value: CommandCenterTab; label: string }[] = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'sent', label: 'Sent to Machine' },
  { value: 'completed', label: 'Completed' },
];

const ALL_TAB_VALUES: PageTab[] = [...MACHINE_TABS.map((t) => t.value), 'bids'];

function isTab(value: string | undefined): value is PageTab {
  return ALL_TAB_VALUES.some((tab) => tab === value);
}

export default async function CommandCenterPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = await createClient();
  const adminUser = await requireAdminUser(supabase);

  // Landing on /admin/command-center with no ?tab at all shows the elite
  // Dashboard. Any explicit ?tab=... value falls through to the exact
  // pre-existing machine-queue/bids behavior further down, unchanged.
  const rawTab = searchParams.tab;
  const showDashboard = rawTab === undefined;
  const activeTab: PageTab = isTab(rawTab) ? rawTab : 'pending';
  const isMachineTab = activeTab === 'pending' || activeTab === 'sent' || activeTab === 'completed';

  if (showDashboard) {
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
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
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
