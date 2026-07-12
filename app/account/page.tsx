import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getQuoteRows, QUOTE_STATUS_LABEL, type QuoteRowStatus } from '@/lib/data/quotes';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

interface ActiveOrderRow {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  delivery_scheduled_at: string | null;
  order_line_items: { description: string }[] | null;
}

const ORDER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  submitted: 'info',
  received: 'chrome',
  in_queue: 'warning',
  cutting: 'warning',
  bending: 'warning',
  qc: 'warning',
  ready: 'success',
  shipped: 'success',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  received: 'Received',
  in_queue: 'In Queue',
  cutting: 'Cutting',
  bending: 'Bending',
  qc: 'Quality Check',
  ready: 'Ready',
  shipped: 'Shipped',
};

const QUOTE_STATUS_VARIANT: Record<QuoteRowStatus, BadgeVariant> = {
  pending: 'warning',
  ready: 'success',
  quoted: 'chrome',
  expired: 'chrome',
  cancelled: 'error',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function summarizeLineItems(items: { description: string }[] | null): string {
  if (!items || items.length === 0) return 'Custom specification';
  if (items.length === 1) return items[0].description;
  return `${items[0].description} + ${items.length - 1} more`;
}

export default async function AccountDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const firstName = (profile?.full_name as string | undefined)?.split(' ')[0] ?? 'there';

  const { data: activeOrdersRaw } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, delivery_scheduled_at, order_line_items(description)')
    .eq('user_id', user.id)
    .not('status', 'in', '(delivered,cancelled)')
    .order('created_at', { ascending: true })
    .limit(3);
  const activeOrders = (activeOrdersRaw ?? []) as ActiveOrderRow[];

  const quoteRows = await getQuoteRows(supabase, user.id, 3);

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-10">
        <h1 className="font-heading text-3xl text-afs-ink-900">
          {getGreeting()}, {firstName}
        </h1>
        <p className="font-body text-sm text-afs-ink-700 mt-1">
          Here&apos;s what&apos;s happening with your AFS account.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Active Orders */}
        <section
          data-testid="active-orders-card"
          className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg text-afs-ink-900">Active Orders</h2>
            {activeOrders.length > 0 && (
              <Link href="/account/orders" className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
                View all orders →
              </Link>
            )}
          </div>

          {activeOrders.length === 0 ? (
            <EmptyState
              title="No active orders"
              description="Ready to submit a request?"
              actionLabel="Upload a Drawing"
              actionHref="/upload"
              secondaryLabel="Request a Quote"
              secondaryHref="/quote"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {activeOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 bg-afs-bg-surface border border-afs-chrome-dim rounded px-4 py-3 hover:border-afs-crimson transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-data text-sm text-afs-ink-900 truncate">{order.order_number}</p>
                      <p className="font-body text-xs text-afs-ink-700 truncate">
                        {summarizeLineItems(order.order_line_items)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'chrome'}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                      <span className="font-data text-xs text-afs-ink-700">
                        {order.delivery_scheduled_at ? formatDate(order.delivery_scheduled_at) : 'Ship date pending'}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Quotes */}
        <section className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg text-afs-ink-900">Recent Quotes</h2>
            {quoteRows.length > 0 && (
              <Link href="/account/quotes" className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
                View all quotes →
              </Link>
            )}
          </div>

          {quoteRows.length === 0 ? (
            <EmptyState
              title="No quote requests yet"
              description="Submit a drawing or build a quote request to get started."
              actionLabel="Request a Quote"
              actionHref="/quote"
              secondaryLabel="Upload a Drawing"
              secondaryHref="/upload"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {quoteRows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/account/quotes/${row.id}`}
                    className="flex items-center justify-between gap-4 bg-afs-bg-surface border border-afs-chrome-dim rounded px-4 py-3 hover:border-afs-crimson transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-data text-sm text-afs-ink-900 truncate">
                        {row.quoteNumber ?? row.requestNumber}
                      </p>
                      <p className="font-body text-xs text-afs-ink-700 truncate">{row.profilesSummary}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={QUOTE_STATUS_VARIANT[row.status]} pulse={row.status === 'ready'}>
                        {QUOTE_STATUS_LABEL[row.status]}
                      </Badge>
                      <span className="font-data text-xs text-afs-ink-700">{formatDate(row.submittedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick Actions */}
      <section className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
        <h2 className="font-heading text-lg text-afs-ink-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/upload"
            className="flex items-center justify-center text-center bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm rounded px-4 py-5 transition-colors"
          >
            Upload a Drawing
          </Link>
          <Link
            href="/quote"
            className="flex items-center justify-center text-center bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm rounded px-4 py-5 transition-colors"
          >
            Request a Quote
          </Link>
          <Link
            href="/account/orders"
            className="flex items-center justify-center text-center border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold text-sm rounded px-4 py-5 transition-colors"
          >
            Track an Order
          </Link>
          <Link
            href="/account/invoices"
            className="flex items-center justify-center text-center border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold text-sm rounded px-4 py-5 transition-colors"
          >
            Download an Invoice
          </Link>
        </div>
      </section>
    </div>
  );
}
