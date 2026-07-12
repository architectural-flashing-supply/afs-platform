import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import ReorderButton from '@/components/account/ReorderButton';
import OrderRealtimeListener from '@/components/account/OrderRealtimeListener';
import ProductionTimeline, {
  ORDER_STATUS_LABEL,
  type OrderStatus,
  type StatusHistoryItem,
} from '@/components/account/ProductionTimeline';

interface OrderDetailRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  freight: number | null;
  tax: number | null;
  rush_surcharge: number;
  total: number;
  payment_method: string | null;
  net_terms: number;
  delivery_method: 'ship' | 'pickup';
  delivery_address: { line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
  delivery_scheduled_at: string | null;
  delivery_window: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shop_photo_url: string | null;
  created_at: string;
}

interface OrderLineItemRow {
  id: string;
  description: string;
  width_in: number | null;
  height_in: number | null;
  leg_a_in: number | null;
  leg_b_in: number | null;
  length_ft: number;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

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

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDimensions(
  w: number | null,
  h: number | null,
  a: number | null,
  b: number | null
): string {
  const parts: string[] = [];
  if (w) parts.push(`W: ${w}"`);
  if (h) parts.push(`H: ${h}"`);
  if (a) parts.push(`Leg A: ${a}"`);
  if (b) parts.push(`Leg B: ${b}"`);
  return parts.length ? parts.join('   ·   ') : '—';
}

function formatAddress(address: OrderDetailRow['delivery_address']): string {
  if (!address) return 'No delivery address on file.';
  return [address.line1, address.line2, [address.city, address.state, address.zip].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join('\n');
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orderRaw } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, subtotal, freight, tax, rush_surcharge, total, payment_method, net_terms, delivery_method, delivery_address, delivery_scheduled_at, delivery_window, tracking_number, carrier, shop_photo_url, created_at'
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!orderRaw) notFound();
  const order = orderRaw as OrderDetailRow;

  const { data: lineItemsRaw } = await supabase
    .from('order_line_items')
    .select('id, description, width_in, height_in, leg_a_in, leg_b_in, length_ft, quantity, unit, unit_price, line_total')
    .eq('order_id', order.id)
    .order('sort_order', { ascending: true });
  const lineItems = (lineItemsRaw ?? []) as OrderLineItemRow[];

  const { data: historyRaw } = await supabase
    .from('order_status_history')
    .select('status, note, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });
  const statusHistory: StatusHistoryItem[] = (historyRaw ?? []).map(
    (h: { status: string; note: string | null; created_at: string }) => ({
      status: h.status,
      changedAt: h.created_at,
      note: h.note,
    })
  );

  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="max-w-[1000px] mx-auto">
      <OrderRealtimeListener orderId={order.id} />

      <Link href="/account/orders" className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson">
        ← Back to My Orders
      </Link>

      <div data-testid="order-detail-header" className="flex items-start justify-between gap-6 mt-2 mb-8 flex-wrap">
        <div>
          <h1 className="font-data text-3xl text-afs-chrome-high">{order.order_number}</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            Ordered {formatDate(order.created_at)} ·{' '}
            {order.delivery_scheduled_at
              ? `Expected ship: ${formatDate(order.delivery_scheduled_at)}`
              : 'Expected ship: will be confirmed by AFS'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'chrome'} size="md" pulse={!isDelivered && !isCancelled}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </Badge>
          <div className="flex items-center gap-4">
            <Link
              href={`/contact?order=${order.id}`}
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
            >
              Get Help with This Order
            </Link>
            <ReorderButton
              orderId={order.id}
              label="Reorder"
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Description
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Dimensions
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Length
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Qty
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                Unit Price
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id} className="border-b border-afs-chrome-dim last:border-b-0">
                <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{item.description}</td>
                <td className="font-data text-xs text-afs-chrome-mid px-4 py-3">
                  {formatDimensions(item.width_in, item.height_in, item.leg_a_in, item.leg_b_in)}
                </td>
                <td className="font-data text-sm text-afs-chrome-high px-4 py-3">{item.length_ft} ft</td>
                <td className="font-data text-sm text-afs-chrome-high px-4 py-3">
                  {item.quantity} {item.unit}
                </td>
                <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                  {currency.format(item.unit_price)}
                </td>
                <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                  {currency.format(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-afs-chrome-dim">
              <td colSpan={4} />
              <td className="font-label text-xs uppercase text-afs-chrome-mid text-right px-4 py-2">Subtotal</td>
              <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-2">
                {currency.format(order.subtotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} />
              <td className="font-label text-xs uppercase text-afs-chrome-mid text-right px-4 py-2">Freight</td>
              <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-2">
                {order.freight != null ? currency.format(order.freight) : '—'}
              </td>
            </tr>
            {order.rush_surcharge > 0 && (
              <tr>
                <td colSpan={4} />
                <td className="font-label text-xs uppercase text-afs-chrome-mid text-right px-4 py-2">Rush Surcharge</td>
                <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-2">
                  {currency.format(order.rush_surcharge)}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={4} />
              <td className="font-label text-xs uppercase text-afs-chrome-mid text-right px-4 py-2">Tax</td>
              <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-2">
                {order.tax != null ? currency.format(order.tax) : '—'}
              </td>
            </tr>
            <tr className="border-t border-afs-chrome-dim">
              <td colSpan={4} />
              <td className="font-label text-sm text-afs-chrome-high font-semibold text-right px-4 py-3">Total</td>
              <td className="font-data text-lg text-afs-crimson text-right px-4 py-3">{currency.format(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Production Status</h2>
        <ProductionTimeline
          currentStatus={order.status}
          statusHistory={statusHistory}
          trackingNumber={order.tracking_number}
          carrier={order.carrier}
          shopPhotoUrl={order.shop_photo_url}
          variant="customer"
        />
      </div>

      <div data-testid="delivery-section" className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">
          {order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}
        </h2>
        {order.delivery_method === 'pickup' ? (
          <dl className="flex flex-col gap-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Pickup Date</dt>
              <dd className="font-data text-afs-chrome-high">
                {order.delivery_scheduled_at ? formatDate(order.delivery_scheduled_at) : 'Not yet scheduled'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Window</dt>
              <dd className="font-data text-afs-chrome-high">{order.delivery_window ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Facility</dt>
              <dd className="font-body text-afs-chrome-high text-right">Contact AFS for pickup address.</dd>
            </div>
          </dl>
        ) : (
          <dl className="flex flex-col gap-2 font-body text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-afs-chrome-mid shrink-0">Delivery Address</dt>
              <dd className="font-body text-afs-chrome-high whitespace-pre-line text-right">
                {formatAddress(order.delivery_address)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Scheduled Date</dt>
              <dd className="font-data text-afs-chrome-high">
                {order.delivery_scheduled_at ? formatDate(order.delivery_scheduled_at) : 'Not yet scheduled'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Window</dt>
              <dd className="font-data text-afs-chrome-high">{order.delivery_window ?? '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h2 className="font-heading text-lg text-afs-chrome-high mb-1">Order These Items Again</h2>
          <p className="font-body text-sm text-afs-chrome-mid">
            Quantities and specifications are loaded from this order. Edit anything before submitting a new request.
          </p>
        </div>
        <ReorderButton
          orderId={order.id}
          label="Reorder"
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors whitespace-nowrap disabled:opacity-50"
        />
      </div>
    </div>
  );
}
