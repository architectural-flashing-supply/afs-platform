import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCustomerDetail, getCustomerOrders, getCustomerNotes } from '@/lib/data/customers';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/admin/orderStages';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import CustomerAccountSettingsForm from '@/components/admin/CustomerAccountSettingsForm';
import CustomerNotesLog from '@/components/admin/CustomerNotesLog';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  admin: 'error',
  architect: 'info',
  contractor: 'chrome',
  customer: 'chrome',
};

const TIER_VARIANT: Record<string, BadgeVariant> = {
  wholesale: 'success',
  preferred: 'info',
  contractor: 'chrome',
  standard: 'chrome',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminCustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const customer = await getCustomerDetail(supabase, params.id);
  if (!customer) notFound();

  const [orders, notes] = await Promise.all([
    getCustomerOrders(supabase, customer.id),
    getCustomerNotes(supabase, customer.id),
  ]);

  return (
    <div>
      <Link href="/admin/customers" className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson">
        ← Back to Customers
      </Link>

      <div className="flex items-start justify-between gap-6 my-6 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-ink-900">{customer.fullName}</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">
            {customer.company || 'No company on file'} · {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </p>
          <p className="font-body text-xs text-afs-ink-700 mt-1">Customer since {formatDate(customer.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ROLE_VARIANT[customer.role] ?? 'chrome'} size="md">
            {customer.role}
          </Badge>
          <Badge variant={TIER_VARIANT[customer.pricingTier] ?? 'chrome'} size="md">
            {customer.pricingTier}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <CustomerAccountSettingsForm
          customerId={customer.id}
          initial={{
            role: customer.role,
            pricingTier: customer.pricingTier,
            netTerms: customer.netTerms,
            creditLimit: customer.creditLimit,
            taxExempt: customer.taxExempt,
          }}
        />
        <CustomerNotesLog customerId={customer.id} notes={notes} />
      </div>

      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-afs-border">
          <span className="font-heading text-sm text-afs-ink-700 uppercase tracking-wide">Order History</span>
        </div>
        {orders.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No orders yet" description="This customer has not placed any orders." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Order #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Status
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">
                  Total
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-data text-sm text-afs-ink-900 hover:text-afs-crimson">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'chrome'}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                  </td>
                  <td className="font-data text-sm text-afs-ink-900 text-right px-4 py-3">{currency.format(order.total)}</td>
                  <td className="font-data text-xs text-afs-ink-700 px-4 py-3">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
