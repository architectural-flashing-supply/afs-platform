import Link from 'next/link';
import type { RecentOrderRow, TopCustomerRow } from '@/lib/data/command-center-dashboard';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface CustomerHealthSectionProps {
  topCustomers: TopCustomerRow[];
  recentOrders: RecentOrderRow[];
}

export default function CustomerHealthSection({ topCustomers, recentOrders }: CustomerHealthSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 className="font-heading text-base text-afs-chrome-high mb-3">Top Customers (YTD)</h3>
        {topCustomers.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No orders placed yet this year.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim border-b border-afs-border">
                <th className="pb-2 pr-3 font-normal">Name</th>
                <th className="pb-2 pr-3 font-normal">Orders</th>
                <th className="pb-2 pr-3 font-normal">Value</th>
                <th className="pb-2 pr-3 font-normal">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.id} className="border-b border-afs-border last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors">
                      {c.company || c.name}
                    </Link>
                    {c.company && <p className="font-body text-xs text-afs-chrome-dim">{c.name}</p>}
                  </td>
                  <td className="py-2.5 pr-3 font-data text-sm text-afs-chrome-mid">{c.orderCount}</td>
                  <td className="py-2.5 pr-3 font-data text-sm text-afs-chrome-high">{currency.format(c.valueYtd)}</td>
                  <td className="py-2.5 pr-3 font-data text-xs text-afs-chrome-dim">{formatDate(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 className="font-heading text-base text-afs-chrome-high mb-3">Recent Orders</h3>
        {recentOrders.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No orders yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim border-b border-afs-border">
                <th className="pb-2 pr-3 font-normal">Order</th>
                <th className="pb-2 pr-3 font-normal">Customer</th>
                <th className="pb-2 pr-3 font-normal">Date</th>
                <th className="pb-2 pr-3 font-normal">Amount</th>
                <th className="pb-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-afs-border last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-data text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 font-body text-sm text-afs-chrome-mid">{o.customerName}</td>
                  <td className="py-2.5 pr-3 font-data text-xs text-afs-chrome-dim">{formatDate(o.createdAt)}</td>
                  <td className="py-2.5 pr-3 font-data text-sm text-afs-chrome-high">{currency.format(o.total)}</td>
                  <td className="py-2.5 font-body text-xs text-afs-chrome-mid">{o.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
