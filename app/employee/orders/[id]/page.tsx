import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminOrderDetail } from '@/lib/data/orders';
import Badge from '@/components/ui/Badge';
import EmployeeOrderActions from '@/components/employee/EmployeeOrderActions';
import { EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_VARIANT } from '@/lib/employee/orderStatus';

function formatAddress(address: Record<string, unknown> | null): string {
  if (!address) return 'No delivery address on file';
  const line1 = typeof address.line1 === 'string' ? address.line1 : '';
  const line2 = typeof address.line2 === 'string' ? address.line2 : '';
  const city = typeof address.city === 'string' ? address.city : '';
  const state = typeof address.state === 'string' ? address.state : '';
  const zip = typeof address.zip === 'string' ? address.zip : '';
  const cityState = [city, state].filter(Boolean).join(', ');
  return [line1, line2, cityState, zip].filter(Boolean).join(', ') || 'No delivery address on file';
}

export default async function EmployeeOrderDetailPage({ params }: { params: { id: string } }) {
  // orders has no operator SELECT RLS policy (007_delivery_tracking.sql §1) —
  // the service-role client is required here, same as getEmployeeOrderQueue.
  const admin = createAdminClient();
  const order = await getAdminOrderDetail(admin, params.id);
  if (!order) notFound();

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className="font-heading text-2xl text-afs-chrome-high">#{order.orderNumber}</h1>
        <Badge variant={EMPLOYEE_STATUS_VARIANT[order.status] ?? 'chrome'} size="md">
          {EMPLOYEE_STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </div>

      <section className="bg-afs-bg-raised border border-afs-border rounded p-4 mb-4">
        <h2 className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-2">Customer</h2>
        <p className="font-body text-base text-afs-chrome-high">{order.customer?.company || order.customer?.fullName || 'Unknown'}</p>
        {order.customer?.phone && (
          <a href={`tel:${order.customer.phone}`} className="font-body text-sm text-afs-crimson block mt-1">
            {order.customer.phone}
          </a>
        )}
        <p className="font-body text-sm text-afs-chrome-mid mt-2">{formatAddress(order.deliveryAddress)}</p>
      </section>

      <section className="bg-afs-bg-raised border border-afs-border rounded p-4 mb-4">
        <h2 className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-2">Items</h2>
        <div className="flex flex-col divide-y divide-afs-border">
          {order.lineItems.map((item) => (
            <div key={item.id} className="py-2 flex items-center justify-between gap-3">
              <span className="font-body text-sm text-afs-chrome-high">{item.description}</span>
              <span className="font-data text-xs text-afs-chrome-mid whitespace-nowrap">
                {item.quantity} {item.unit} · {item.lengthFt}ft
              </span>
            </div>
          ))}
        </div>
      </section>

      <EmployeeOrderActions orderId={order.id} initialStatus={order.status} />
    </div>
  );
}
