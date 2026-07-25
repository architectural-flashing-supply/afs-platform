import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getMachineJobs, getMachineJobCounts, type CommandCenterTab } from '@/lib/data/machine-jobs';
import { getPendingQuoteRequests } from '@/lib/data/pending-quote-requests';
import {
  getCrmCustomers,
  getCrmOrders,
  getOperators,
  getCrmInvoices,
  getGbpPhotos,
  type CrmOrderRow,
  type OperatorRow,
} from '@/lib/data/command-center-crm';
import { isGbpConfigured } from '@/lib/integrations/google-business';
import EmptyState from '@/components/ui/EmptyState';
import CommandCenterJobCard from '@/components/admin/CommandCenterJobCard';
import PendingQuoteRequestCard from '@/components/admin/PendingQuoteRequestCard';
import MachineBridgeStatusDot from '@/components/admin/MachineBridgeStatusDot';
import CustomersCrmTab from '@/components/admin/CustomersCrmTab';
import OrdersCrmTab from '@/components/admin/OrdersCrmTab';
import InvoicesCrmTab from '@/components/admin/InvoicesCrmTab';
import GbpPhotosTab from '@/components/admin/GbpPhotosTab';

// Machine-queue tabs (pending/sent/completed) come from CommandCenterTab
// (lib/data/machine-jobs.ts) — the 4 new CRM tabs below are a distinct,
// wider set of admin tools sharing this same page/URL per d-005, so the
// page's own tab union extends that type rather than editing it.
type CrmTab = 'customers' | 'orders' | 'invoices' | 'gbp';
type PageTab = CommandCenterTab | CrmTab;

const MACHINE_TABS: { value: CommandCenterTab; label: string }[] = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'sent', label: 'Sent to Machine' },
  { value: 'completed', label: 'Completed' },
];

const CRM_TABS: { value: CrmTab; label: string }[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'orders', label: 'Orders' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'gbp', label: 'GBP Photos' },
];

const ALL_TABS = [...MACHINE_TABS, ...CRM_TABS];

function isCrmTab(value: string | undefined): value is CrmTab {
  return CRM_TABS.some((tab) => tab.value === value);
}

function isTab(value: string | undefined): value is PageTab {
  return ALL_TABS.some((tab) => tab.value === value);
}

export default async function CommandCenterPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const activeTab: PageTab = isTab(searchParams.tab) ? searchParams.tab : 'pending';
  const isMachineTab = activeTab === 'pending' || activeTab === 'sent' || activeTab === 'completed';

  // Pending Approval reads from quote_requests directly — nothing creates a
  // machine_jobs row until this page's own "Approve & Send to Machine"
  // action does. Sent/Completed continue to read real machine_jobs rows.
  const [pendingRequests, jobs, counts] = await Promise.all([
    activeTab === 'pending' ? getPendingQuoteRequests(supabase) : Promise.resolve([]),
    activeTab === 'sent' || activeTab === 'completed' ? getMachineJobs(supabase, activeTab) : Promise.resolve([]),
    getMachineJobCounts(supabase),
  ]);

  const emptyCrmOrdersData: [CrmOrderRow[], OperatorRow[]] = [[], []];
  const [crmCustomers, crmOrdersData, crmInvoices, crmGbpPhotos] = await Promise.all([
    activeTab === 'customers' ? getCrmCustomers(supabase) : Promise.resolve([]),
    activeTab === 'orders'
      ? Promise.all([getCrmOrders(supabase), getOperators(supabase)])
      : Promise.resolve(emptyCrmOrdersData),
    activeTab === 'invoices' ? getCrmInvoices(supabase) : Promise.resolve([]),
    activeTab === 'gbp' ? getGbpPhotos(supabase) : Promise.resolve([]),
  ]);
  const [crmOrders, crmOperators] = crmOrdersData;

  const isEmpty = activeTab === 'pending' ? pendingRequests.length === 0 : jobs.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
          <h1 className="font-heading text-3xl text-afs-chrome-high">
            {isCrmTab(activeTab) ? 'Operations CRM' : 'Machine Queue'}
          </h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            {isCrmTab(activeTab)
              ? 'Customers, orders, invoices, and Google Business photos in one place.'
              : 'Review and approve fabrication jobs before they go to the Thalmann.'}
          </p>
        </div>
        <MachineBridgeStatusDot />
      </div>

      <div className="flex items-center gap-1 border-b border-afs-border mb-6 overflow-x-auto">
        {MACHINE_TABS.map((tab) => {
          const active = tab.value === activeTab;
          const href = tab.value === 'pending' ? '/admin/command-center' : `/admin/command-center?tab=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-afs-crimson text-afs-chrome-high'
                  : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {tab.label} <span className="font-data text-xs text-afs-chrome-dim">({counts[tab.value]})</span>
            </Link>
          );
        })}
        <span className="w-px h-5 bg-afs-border mx-2" />
        {CRM_TABS.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <Link
              key={tab.value}
              href={`/admin/command-center?tab=${tab.value}`}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-afs-crimson text-afs-chrome-high'
                  : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {activeTab === 'customers' && <CustomersCrmTab customers={crmCustomers} />}
      {activeTab === 'orders' && <OrdersCrmTab orders={crmOrders} operators={crmOperators} />}
      {activeTab === 'invoices' && <InvoicesCrmTab invoices={crmInvoices} />}
      {activeTab === 'gbp' && <GbpPhotosTab photos={crmGbpPhotos} gbpConfigured={isGbpConfigured()} />}

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
