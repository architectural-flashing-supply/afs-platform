import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import {
  getDashboardKPIs,
  getDashboardAlerts,
  getQuoteRequestQueue,
  getRecentOrderActivity,
  type KPIStat,
} from '@/lib/data/admin';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import AlertsRow from '@/components/admin/AlertsRow';

const ORDER_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  received: 'Received',
  in_queue: 'In Queue',
  cutting: 'Cutting',
  bending: 'Bending',
  qc: 'Quality Check',
  ready: 'Ready',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
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

interface KPICardProps {
  testId: string;
  label: string;
  stat: KPIStat;
}

function KPICard({ testId, label, stat }: KPICardProps) {
  return (
    <div data-testid={testId} className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-5xl text-afs-chrome-high leading-none">{stat.count}</span>
        {stat.rush > 0 && <Badge variant="error">{stat.rush} rush</Badge>}
      </div>
      <p className="font-label text-sm text-afs-chrome-base uppercase tracking-wide mt-2">{label}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const [kpis, alerts, quoteQueue, recentActivity] = await Promise.all([
    getDashboardKPIs(supabase),
    getDashboardAlerts(supabase),
    getQuoteRequestQueue(supabase, 5),
    getRecentOrderActivity(supabase, 10),
  ]);

  const alertItems = [
    ...(alerts.marginRiskCount > 0
      ? [
          {
            id: 'margin-risk',
            message: `${alerts.marginRiskCount} material${alerts.marginRiskCount === 1 ? '' : 's'} flagged for margin risk`,
            href: '/admin/pricing',
          },
        ]
      : []),
    ...(alerts.overdueInvoicesCount > 0
      ? [
          {
            id: 'overdue-invoices',
            message: `${alerts.overdueInvoicesCount} net-terms order${alerts.overdueInvoicesCount === 1 ? '' : 's'} past due`,
            href: '/admin/orders',
          },
        ]
      : []),
    ...(alerts.pendingCreditApps > 0
      ? [
          {
            id: 'pending-credit',
            message: `${alerts.pendingCreditApps} credit application${alerts.pendingCreditApps === 1 ? '' : 's'} awaiting review`,
            href: '/admin/credit-applications',
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Dashboard</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Operational overview across quote requests, production, and business alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard testId="kpi-today-orders" label="Today's New Orders" stat={kpis.todayOrders} />
        <KPICard testId="kpi-in-production" label="In Production" stat={kpis.inProduction} />
        <KPICard testId="kpi-ready-to-ship" label="Ready to Ship" stat={kpis.readyToShip} />
        <KPICard testId="kpi-pending-quotes" label="Pending Quote Requests" stat={kpis.pendingQuotes} />
      </div>

      <AlertsRow alerts={alertItems} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote Request Queue */}
        <section className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg text-afs-chrome-high">Quote Request Queue</h2>
            <Link href="/admin/quote-requests" className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
              View all →
            </Link>
          </div>

          {quoteQueue.length === 0 ? (
            <EmptyState title="Nothing pending" description="No quote requests are waiting for review." />
          ) : (
            <ul className="flex flex-col gap-3">
              {quoteQueue.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/quote-requests/${row.id}`}
                    className="flex items-center justify-between gap-4 bg-afs-bg-surface border border-afs-border rounded px-4 py-3 hover:border-afs-crimson transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-data text-sm text-afs-chrome-high truncate">{row.requestNumber}</p>
                      <p className="font-body text-xs text-afs-chrome-mid truncate">
                        {row.customerName} · {row.profileSummary}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {row.isRush && <Badge variant="error">Rush</Badge>}
                      <span className="font-data text-xs text-afs-chrome-dim">{formatTimeAgo(row.submittedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Order Activity */}
        <section className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg text-afs-chrome-high">Recent Order Activity</h2>
            <Link href="/admin/orders" className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
              View all →
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" description="Status changes will appear here as orders move through production." />
          ) : (
            <ul className="flex flex-col gap-3">
              {recentActivity.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 bg-afs-bg-surface border border-afs-border rounded px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-data text-sm text-afs-chrome-high truncate">
                      {row.orderNumber} <span className="text-afs-chrome-dim">→</span>{' '}
                      {ORDER_STATUS_LABEL[row.status] ?? row.status}
                    </p>
                    {row.changedByName && (
                      <p className="font-body text-xs text-afs-chrome-mid truncate">by {row.changedByName}</p>
                    )}
                  </div>
                  <span className="font-data text-xs text-afs-chrome-dim shrink-0">{formatTimeAgo(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
