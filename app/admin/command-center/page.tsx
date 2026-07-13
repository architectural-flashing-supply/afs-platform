import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getMachineJobs, getMachineJobCounts, type CommandCenterTab } from '@/lib/data/machine-jobs';
import { getPendingQuoteRequests } from '@/lib/data/pending-quote-requests';
import EmptyState from '@/components/ui/EmptyState';
import CommandCenterJobCard from '@/components/admin/CommandCenterJobCard';
import PendingQuoteRequestCard from '@/components/admin/PendingQuoteRequestCard';
import MachineBridgeStatusDot from '@/components/admin/MachineBridgeStatusDot';

const TABS: { value: CommandCenterTab; label: string }[] = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'sent', label: 'Sent to Machine' },
  { value: 'completed', label: 'Completed' },
];

function isTab(value: string | undefined): value is CommandCenterTab {
  return TABS.some((tab) => tab.value === value);
}

export default async function CommandCenterPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const activeTab: CommandCenterTab = isTab(searchParams.tab) ? searchParams.tab : 'pending';

  // Pending Approval reads from quote_requests directly — nothing creates a
  // machine_jobs row until this page's own "Approve & Send to Machine"
  // action does. Sent/Completed continue to read real machine_jobs rows.
  const [pendingRequests, jobs, counts] = await Promise.all([
    activeTab === 'pending' ? getPendingQuoteRequests(supabase) : Promise.resolve([]),
    activeTab === 'sent' || activeTab === 'completed' ? getMachineJobs(supabase, activeTab) : Promise.resolve([]),
    getMachineJobCounts(supabase),
  ]);

  const isEmpty = activeTab === 'pending' ? pendingRequests.length === 0 : jobs.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Machine Queue</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            Review and approve fabrication jobs before they go to the Thalmann.
          </p>
        </div>
        <MachineBridgeStatusDot />
      </div>

      <div className="flex items-center gap-1 border-b border-afs-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
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
      </div>

      {isEmpty ? (
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
      )}
    </div>
  );
}
