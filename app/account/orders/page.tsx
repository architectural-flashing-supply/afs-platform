import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ReorderButton from '@/components/account/ReorderButton';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/components/account/ProductionTimeline';

const PAGE_SIZE = 20;

type FilterTab = 'all' | 'active' | 'completed';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  submitted: 'info',
  received: 'chrome',
  in_queue: 'warning',
  cutting: 'warning',
  bending: 'warning',
  qc: 'warning',
  ready: 'success',
  shipped: 'success',
  delivered: 'chrome',
  cancelled: 'error',
};

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  order_line_items: { description: string }[] | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function summarizeLineItems(items: { description: string }[] | null): string {
  if (!items || items.length === 0) return 'Custom specification';
  if (items.length === 1) return items[0].description;
  return `${items[0].description} + ${items.length - 1} more`;
}

function buildTabHref(tab: FilterTab): string {
  return tab === 'all' ? '/account/orders' : `/account/orders?filter=${tab}`;
}

function buildPageHref(tab: FilterTab, page: number): string {
  const params = new URLSearchParams();
  if (tab !== 'all') params.set('filter', tab);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/account/orders?${qs}` : '/account/orders';
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: { filter?: string; page?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeTab: FilterTab =
    searchParams.filter === 'active' || searchParams.filter === 'completed' ? searchParams.filter : 'all';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('orders')
    .select('id, order_number, status, created_at, order_line_items(description)', { count: 'exact' })
    .eq('user_id', user.id);

  if (activeTab === 'active') {
    query = query.not('status', 'in', '(delivered,cancelled)');
  } else if (activeTab === 'completed') {
    query = query.eq('status', 'delivered');
  }

  const { data: ordersRaw, count } = await query.order('created_at', { ascending: false }).range(from, to);
  const orders = (ordersRaw ?? []) as OrderRow[];
  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-ink-900">My Orders</h1>
        <p className="font-body text-sm text-afs-ink-700 mt-1">
          Track fabrication and delivery for every order you&apos;ve placed with AFS.
        </p>
      </div>

      <div className="flex gap-2 mb-6" data-testid="order-filter-tabs">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={buildTabHref(tab.key)}
            className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
              activeTab === tab.key
                ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
                : 'border-afs-chrome-dim text-afs-ink-700 hover:bg-afs-bg-surface'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once AFS sends you a formal quote and you approve it, your orders will appear here."
          actionLabel="Request a Quote"
          actionHref="/quote"
          secondaryLabel="Upload a Drawing"
          secondaryHref="/upload"
        />
      ) : (
        <>
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                    Order #
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                    Date
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                    Items
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                    Status
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="font-data text-sm text-afs-crimson hover:text-afs-crimson-hover"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="font-data text-sm text-afs-ink-700 px-4 py-3">{formatDate(order.created_at)}</td>
                    <td className="font-body text-sm text-afs-ink-900 px-4 py-3">
                      {summarizeLineItems(order.order_line_items)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'chrome'}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-4">
                        <Link
                          href={`/account/orders/${order.id}`}
                          className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson transition-colors"
                        >
                          View Details
                        </Link>
                        <ReorderButton orderId={order.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Link
                href={buildPageHref(activeTab, page - 1)}
                aria-disabled={page <= 1}
                className={`font-label text-sm px-4 py-2 rounded border border-afs-chrome-dim ${
                  page <= 1
                    ? 'opacity-40 pointer-events-none'
                    : 'text-afs-ink-700 hover:bg-afs-bg-surface transition-colors'
                }`}
              >
                ← Previous
              </Link>
              <span className="font-body text-xs text-afs-ink-700">
                Page {page} of {totalPages}
              </span>
              <Link
                href={buildPageHref(activeTab, page + 1)}
                aria-disabled={page >= totalPages}
                className={`font-label text-sm px-4 py-2 rounded border border-afs-chrome-dim ${
                  page >= totalPages
                    ? 'opacity-40 pointer-events-none'
                    : 'text-afs-ink-700 hover:bg-afs-bg-surface transition-colors'
                }`}
              >
                Next →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
