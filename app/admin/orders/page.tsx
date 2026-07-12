import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getProductionQueue, getProductionQueueCounts, type ProductionQueueFilter } from '@/lib/data/orders';
import EmptyState from '@/components/ui/EmptyState';
import ProductionQueueTable from '@/components/admin/ProductionQueueTable';
import ProductionQueueRealtime from '@/components/admin/ProductionQueueRealtime';

const TABS: { value: ProductionQueueFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'rush', label: 'Rush' },
  { value: 'in_queue', label: 'In Queue' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'bending', label: 'Forming' },
  { value: 'qc', label: 'QC' },
  { value: 'ready', label: 'Ready' },
  { value: 'shipped', label: 'Shipped' },
];

function isQueueFilter(value: string | undefined): value is ProductionQueueFilter {
  return TABS.some((tab) => tab.value === value);
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const activeTab: ProductionQueueFilter = isQueueFilter(searchParams.status) ? searchParams.status : 'all';
  const [rows, counts] = await Promise.all([
    getProductionQueue(supabase, activeTab),
    getProductionQueueCounts(supabase),
  ]);

  return (
    <div>
      <ProductionQueueRealtime />

      <div className="mb-6">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Production Queue</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Active orders in fabrication — rush orders first, then oldest first.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-afs-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.value === activeTab;
          const href = tab.value === 'all' ? '/admin/orders' : `/admin/orders?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-afs-crimson text-afs-chrome-high'
                  : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {tab.label} <span className="font-data text-xs text-afs-chrome-dim">({counts[tab.value]})</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No orders in this stage." description="Nothing is currently in this part of the production queue." />
      ) : (
        <ProductionQueueTable rows={rows} />
      )}
    </div>
  );
}
