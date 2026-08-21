import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getQuoteRequestsQueue, type QuoteRequestStatusFilter } from '@/lib/data/admin';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ColorSwatchChip from '@/components/quote/ColorSwatchChip';

const TABS: { value: QuoteRequestStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'quoted', label: 'Quoted' },
];

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  quoted: 'Quoted',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  submitted: 'warning',
  reviewing: 'info',
  quoted: 'success',
  expired: 'chrome',
  cancelled: 'chrome',
};

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function isStatusFilter(value: string | undefined): value is QuoteRequestStatusFilter {
  return value === 'all' || value === 'submitted' || value === 'reviewing' || value === 'quoted';
}

export default async function AdminQuoteRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const activeTab: QuoteRequestStatusFilter = isStatusFilter(searchParams.status) ? searchParams.status : 'all';
  const rows = await getQuoteRequestsQueue(supabase, activeTab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Quote Requests</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Incoming customer submissions awaiting a formal AFS quote.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-afs-border mb-6">
        {TABS.map((tab) => {
          const active = tab.value === activeTab;
          const href = tab.value === 'all' ? '/admin/quote-requests' : `/admin/quote-requests?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors ${
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

      {rows.length === 0 ? (
        <EmptyState title="No requests in this view" description="No quote requests match this filter right now." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Request #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Customer
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Profiles
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Submitted
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Rush
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  data-testid={`queue-row-${index}`}
                  className={`border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors ${
                    row.isRush ? 'bg-[var(--afs-crimson-ghost)]' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/quote-requests/${row.id}`}
                      className="font-data text-sm text-afs-chrome-high hover:text-afs-crimson"
                    >
                      {row.requestNumber}
                    </Link>
                  </td>
                  <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-afs-chrome-mid">{row.profileSummary}</span>
                      {row.finish && <Badge variant="chrome">{row.finish}</Badge>}
                      {row.color && <ColorSwatchChip color={row.color} />}
                    </div>
                  </td>
                  <td className="font-data text-xs text-afs-chrome-dim px-4 py-3">{formatTimeAgo(row.submittedAt)}</td>
                  <td className="px-4 py-3">
                    {row.isRush && (
                      <span className="bg-afs-crimson text-white font-label text-xs font-bold px-2 py-1 rounded">
                        RUSH
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'chrome'}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
