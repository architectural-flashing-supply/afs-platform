import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getAdminOrderDetail, getOrderAttachments, getOrderStatusHistory } from '@/lib/data/orders';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/admin/orderStages';
import Badge from '@/components/ui/Badge';
import StatusAdvancer from '@/components/admin/StatusAdvancer';
import AdminNotesPanel from '@/components/admin/AdminNotesPanel';
import PreShipPhotoSection from '@/components/admin/PreShipPhotoSection';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDimensions(item: { widthIn: number | null; heightIn: number | null; legAIn: number | null; legBIn: number | null }): string {
  const parts: string[] = [];
  if (item.widthIn) parts.push(`W: ${item.widthIn}"`);
  if (item.heightIn) parts.push(`H: ${item.heightIn}"`);
  if (item.legAIn) parts.push(`Leg A: ${item.legAIn}"`);
  if (item.legBIn) parts.push(`Leg B: ${item.legBIn}"`);
  return parts.length ? parts.join('   ') : '—';
}

function formatDeliveryAddress(address: Record<string, unknown> | null): string {
  if (!address) return '—';
  if (typeof address.address === 'string') return address.address;
  if (typeof address.contactName === 'string') return `Pickup — ${address.contactName}`;
  return '—';
}

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const order = await getAdminOrderDetail(supabase, params.id);
  if (!order) notFound();

  const [statusHistory, attachments] = await Promise.all([
    getOrderStatusHistory(supabase, order.id),
    getOrderAttachments(supabase, order.id),
  ]);

  const preShipPhotos = attachments.filter((a) => a.attachmentType === 'pre_ship_photo');
  const customerAttachments = attachments.filter((a) => a.attachmentType !== 'pre_ship_photo');

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <Link href="/admin/orders" className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson">
            ← Back to Production Queue
          </Link>
          <h1 className="font-data text-3xl text-afs-chrome-high mt-2">{order.orderNumber}</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            {order.customer?.company || order.customer?.fullName || 'Unknown customer'} · Created {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {order.isRush && (
            <span className="bg-afs-crimson text-white font-label text-xs font-bold px-2 py-1 rounded">RUSH</span>
          )}
          <Badge variant={STATUS_VARIANT[order.status] ?? 'chrome'} size="md">
            {STATUS_LABEL[order.status] ?? order.status}
          </Badge>
          <p className="font-data text-2xl text-afs-chrome-high">{currency.format(order.total)}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-afs-border">
              <span className="font-heading text-sm text-afs-chrome-mid uppercase tracking-wide">Line Items</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-afs-bg-surface border-b border-afs-border">
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Description
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Dimensions
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                    Qty / Length
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
                {order.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-afs-border last:border-b-0">
                    <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{item.description}</td>
                    <td className="font-data text-xs text-afs-chrome-mid px-4 py-3">{formatDimensions(item)}</td>
                    <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                      {item.quantity} pc &middot; {item.lengthFt} ft
                    </td>
                    <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                      {currency.format(item.unitPrice)}/{item.unit}
                    </td>
                    <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                      {currency.format(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-afs-border">
                  <td colSpan={4} className="font-body text-sm text-afs-chrome-mid text-right px-4 py-3">
                    Subtotal
                  </td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">{currency.format(order.subtotal)}</td>
                </tr>
                {order.rushSurcharge > 0 && (
                  <tr>
                    <td colSpan={4} className="font-body text-sm text-afs-chrome-mid text-right px-4 py-3">
                      Rush Surcharge
                    </td>
                    <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                      {currency.format(order.rushSurcharge)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="font-body text-sm text-afs-chrome-mid text-right px-4 py-3">
                    Freight
                  </td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                    {order.freight != null ? currency.format(order.freight) : '—'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="font-body text-sm text-afs-chrome-mid text-right px-4 py-3">
                    Tax
                  </td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                    {order.tax != null ? currency.format(order.tax) : '—'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="font-heading text-sm text-afs-chrome-high text-right px-4 py-3">
                    Total
                  </td>
                  <td className="font-data text-lg text-afs-crimson text-right px-4 py-3">{currency.format(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Quote Reference</h2>
            <p className="font-body text-sm text-afs-chrome-mid">
              {order.quoteNumber ? (
                <>
                  Converted from{' '}
                  <Link href={`/admin/quote-requests`} className="text-afs-crimson hover:text-afs-crimson-hover font-data">
                    {order.quoteNumber}
                  </Link>
                </>
              ) : (
                'No linked quote.'
              )}
            </p>
          </div>
        </div>

        <StatusAdvancer orderId={order.id} orderNumber={order.orderNumber} currentStatus={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Customer</h2>
          <dl className="flex flex-col gap-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Name</dt>
              <dd className="text-afs-chrome-high">{order.customer?.fullName ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Company</dt>
              <dd className="text-afs-chrome-high">{order.customer?.company ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Email</dt>
              <dd className="text-afs-chrome-high">{order.customer?.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Phone</dt>
              <dd className="text-afs-chrome-high">{order.customer?.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between pt-1 border-t border-afs-border mt-1">
              <dt className="text-afs-chrome-mid">PO Number</dt>
              <dd className="text-afs-chrome-high">{order.poNumber ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Delivery &amp; Payment</h2>
          <dl className="flex flex-col gap-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Method</dt>
              <dd className="text-afs-chrome-high capitalize">{order.deliveryMethod}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Address</dt>
              <dd className="text-afs-chrome-high text-right">{formatDeliveryAddress(order.deliveryAddress)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Scheduled</dt>
              <dd className="text-afs-chrome-high">
                {formatDate(order.deliveryScheduledAt)}
                {order.deliveryWindow ? ` · ${order.deliveryWindow}` : ''}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Tracking</dt>
              <dd className="text-afs-chrome-high">
                {order.trackingNumber ? `${order.trackingNumber}${order.carrier ? ` (${order.carrier})` : ''}` : '—'}
              </dd>
            </div>
            <div className="flex justify-between pt-1 border-t border-afs-border mt-1">
              <dt className="text-afs-chrome-mid">Payment Method</dt>
              <dd className="text-afs-chrome-high capitalize">
                {order.paymentMethod === 'net_terms' ? `Net ${order.netTerms}` : order.paymentMethod ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Stripe PaymentIntent</dt>
              <dd className="font-data text-xs text-afs-chrome-high">{order.stripePaymentIntentId ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {order.notes && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6 mb-8">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-2">Customer Notes</h2>
          <p className="font-body text-sm text-afs-chrome-high whitespace-pre-line">{order.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <AdminNotesPanel orderId={order.id} notes={order.adminNotes} />
        <PreShipPhotoSection orderId={order.id} photos={preShipPhotos} />
      </div>

      <div className="bg-afs-bg-raised border border-afs-border rounded p-6 mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Order Attachments</h2>
        {customerAttachments.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No customer-uploaded attachments.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {customerAttachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between gap-4 border-b border-afs-border last:border-b-0 pb-2 last:pb-0">
                <span className="font-body text-sm text-afs-chrome-high">{att.filename}</span>
                {att.signedUrl ? (
                  <a href={att.signedUrl} target="_blank" rel="noreferrer" className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
                    View
                  </a>
                ) : (
                  <span className="font-label text-xs text-afs-chrome-dim">Unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Status History</h2>
        {statusHistory.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No status changes recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {statusHistory.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 border-b border-afs-border last:border-b-0 pb-3 last:pb-0">
                <div>
                  <p className="font-body text-sm text-afs-chrome-high">
                    {STATUS_LABEL[entry.status] ?? entry.status}
                    {entry.changedByName && <span className="text-afs-chrome-mid"> · by {entry.changedByName}</span>}
                  </p>
                  {entry.note && <p className="font-body text-xs text-afs-chrome-mid mt-1">{entry.note}</p>}
                </div>
                <span className="font-data text-xs text-afs-chrome-dim shrink-0">{formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
