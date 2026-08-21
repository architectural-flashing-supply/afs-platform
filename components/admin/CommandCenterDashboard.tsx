'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import MachineBridgeStatusDot from '@/components/admin/MachineBridgeStatusDot';
import type { CustomerListRow } from '@/lib/data/customers';
import type { CrmInvoiceRow } from '@/lib/data/command-center-crm';
import type { RecentQuoteRequestRow } from '@/lib/data/command-center-dashboard';
import { sourceToolLabel } from '@/lib/data/quote-request-source-tool';

// A pending quote request and a sent machine_jobs row share the same
// "Machine Queue" list on this dashboard — normalized to one shape here
// rather than duplicating the two full card components
// (PendingQuoteRequestCard / CommandCenterJobCard, which carry their own
// approve/reject/mark-delivered actions and stay exactly as-is on the
// Pending Approval / Sent to Machine tabs). This is a compact, read-only
// preview; "Review" links out to the real actionable tab.
export interface QueueItem {
  id: string;
  kind: 'pending' | 'sent';
  requestNumber: string;
  customerName: string;
  profileName: string;
  status: string;
  submittedAt: string;
  isRush: boolean;
}

interface StatusStripCounts {
  pendingApproval: number;
  sentToMachine: number;
  inProduction: number;
  readyForPickup: number;
  outForDelivery: number;
}

interface CommandCenterDashboardProps {
  statusStrip: StatusStripCounts;
  recentQuoteRequests: RecentQuoteRequestRow[];
  queueItems: QueueItem[];
  outstandingTotal: number;
  outstandingInvoices: CrmInvoiceRow[];
  recentCustomers: CustomerListRow[];
  gbpPendingCount: number;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const QR_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  quoted: 'Quoted',
  expired: 'Expired',
  cancelled: 'Cancelled',
};
const QR_STATUS_VARIANT: Record<string, BadgeVariant> = {
  submitted: 'info',
  reviewing: 'warning',
  quoted: 'success',
  expired: 'chrome',
  cancelled: 'error',
};

const QUEUE_STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved_for_machine: 'Approved — Queued',
  staged_for_review: 'Staged for Review',
  sent_to_machine: 'Sent to Machine',
  machine_error: 'Machine Error',
};
const QUEUE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending_approval: 'warning',
  approved_for_machine: 'info',
  staged_for_review: 'info',
  sent_to_machine: 'success',
  machine_error: 'error',
};

interface StatusCardDef {
  key: 'pending' | 'sent' | 'inProduction' | 'ready' | 'outForDelivery';
  label: string;
  count: number;
}

export default function CommandCenterDashboard({
  statusStrip,
  recentQuoteRequests,
  queueItems,
  outstandingTotal,
  outstandingInvoices,
  recentCustomers,
  gbpPendingCount,
}: CommandCenterDashboardProps) {
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'sent'>('all');

  const filteredQueue = useMemo(
    () => (queueFilter === 'all' ? queueItems : queueItems.filter((item) => item.kind === queueFilter)),
    [queueItems, queueFilter]
  );

  const statusCards: StatusCardDef[] = [
    { key: 'pending', label: 'Pending Approval', count: statusStrip.pendingApproval },
    { key: 'sent', label: 'Sent to Machine', count: statusStrip.sentToMachine },
    { key: 'inProduction', label: 'In Production', count: statusStrip.inProduction },
    { key: 'ready', label: 'Ready for Pickup/Delivery', count: statusStrip.readyForPickup },
    { key: 'outForDelivery', label: 'Out for Delivery', count: statusStrip.outForDelivery },
  ];

  const cardClass =
    'bg-afs-bg-raised border border-afs-border rounded p-4 text-center cursor-pointer hover:bg-afs-bg-surface transition-colors block';

  return (
    <div className="flex flex-col gap-8">
      {/* SECTION 1 — STATUS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statusCards.map((card) => {
          const content = (
            <>
              <p className="font-heading text-3xl text-afs-crimson">{card.count}</p>
              <p className="font-label text-xs text-afs-chrome-mid uppercase mt-1">{card.label}</p>
            </>
          );

          const key = card.key;
          if (key === 'pending' || key === 'sent') {
            const active = queueFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setQueueFilter(active ? 'all' : key)}
                className={`${cardClass} ${active ? 'border-afs-crimson' : ''}`}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={card.key} href="/admin/command-center?tab=orders" className={cardClass}>
              {content}
            </Link>
          );
        })}
      </div>

      {/* SECTION 2 — TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — 60% */}
        <div className="lg:col-span-3 flex flex-col gap-8">
          <div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Quote Requests</h2>
            {recentQuoteRequests.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">No quote requests yet.</p>
            ) : (
              <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
                {recentQuoteRequests.map((req, idx) => (
                  <div
                    key={req.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      idx > 0 ? 'border-t border-afs-border' : ''
                    } ${req.isRush ? 'bg-[var(--afs-crimson-ghost)]' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-afs-chrome-high truncate">
                        {req.customerName}{' '}
                        <span className="font-data text-xs text-afs-chrome-dim">#{req.requestNumber}</span>
                      </p>
                      <p className="font-body text-xs text-afs-chrome-mid truncate">
                        {req.profileType} · {formatDate(req.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {req.isRush && <Badge variant="warning">RUSH</Badge>}
                      <Badge variant="chrome">{sourceToolLabel(req.sourceTool)}</Badge>
                      <Badge variant={QR_STATUS_VARIANT[req.status] ?? 'chrome'}>
                        {QR_STATUS_LABEL[req.status] ?? req.status}
                      </Badge>
                      <Link
                        href={`/admin/quote-requests/${req.id}`}
                        className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-lg text-afs-chrome-high">Machine Queue</h2>
              {queueFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setQueueFilter('all')}
                  className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
            {filteredQueue.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">Nothing in the queue right now.</p>
            ) : (
              <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
                {filteredQueue.map((item, idx) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      idx > 0 ? 'border-t border-afs-border' : ''
                    } ${item.isRush ? 'bg-[var(--afs-crimson-ghost)]' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-afs-chrome-high truncate">
                        {item.customerName}{' '}
                        <span className="font-data text-xs text-afs-chrome-dim">#{item.requestNumber}</span>
                      </p>
                      <p className="font-body text-xs text-afs-chrome-mid truncate">
                        {item.profileName} · {formatDate(item.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.isRush && <Badge variant="warning">RUSH</Badge>}
                      <Badge variant={QUEUE_STATUS_VARIANT[item.status] ?? 'chrome'}>
                        {QUEUE_STATUS_LABEL[item.status] ?? item.status}
                      </Badge>
                      <Link
                        href={`/admin/command-center?tab=${item.kind === 'pending' ? 'pending' : 'sent'}`}
                        className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — 40% */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Outstanding Invoices</h2>
            <div className="bg-afs-bg-raised border border-afs-border rounded p-4 mb-3">
              <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Total Outstanding</p>
              <p className="font-data text-2xl text-afs-chrome-high">{currency.format(outstandingTotal)}</p>
            </div>
            {outstandingInvoices.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">No outstanding invoices.</p>
            ) : (
              <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
                {outstandingInvoices.map((inv, idx) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      idx > 0 ? 'border-t border-afs-border' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-afs-chrome-high truncate">{inv.customerName}</p>
                      <p className="font-data text-xs text-afs-chrome-dim">{inv.invoiceNumber}</p>
                    </div>
                    <p className="font-data text-sm text-afs-chrome-high shrink-0">{currency.format(inv.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Recent Customers</h2>
            {recentCustomers.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">No customers yet.</p>
            ) : (
              <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
                {recentCustomers.map((customer, idx) => (
                  <div
                    key={customer.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      idx > 0 ? 'border-t border-afs-border' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-afs-chrome-high truncate">{customer.fullName}</p>
                      {customer.company && (
                        <p className="font-body text-xs text-afs-chrome-mid truncate">{customer.company}</p>
                      )}
                    </div>
                    <p className="font-data text-xs text-afs-chrome-dim shrink-0">
                      {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : 'No orders yet'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3 — BOTTOM STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-4 flex items-center justify-center">
          <MachineBridgeStatusDot />
        </div>
        <Link
          href="/admin/command-center?tab=gbp"
          className="bg-afs-bg-raised border border-afs-border rounded p-4 text-center hover:bg-afs-bg-surface transition-colors"
        >
          <p className="font-heading text-2xl text-afs-crimson">{gbpPendingCount}</p>
          <p className="font-label text-xs text-afs-chrome-mid uppercase mt-1">GBP Photo Queue</p>
        </Link>
        <Link
          href="/admin/command-center?tab=orders"
          className="bg-afs-bg-raised border border-afs-border rounded p-4 text-center hover:bg-afs-bg-surface transition-colors"
        >
          <p className="font-heading text-2xl text-afs-crimson">{statusStrip.outForDelivery}</p>
          <p className="font-label text-xs text-afs-chrome-mid uppercase mt-1">Active Deliveries</p>
        </Link>
      </div>
    </div>
  );
}
