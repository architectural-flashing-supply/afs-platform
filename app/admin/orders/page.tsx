import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import {
  getProductionQueue,
  getProductionQueueCounts,
  type ProductionQueueFilter,
  type ProductionQueueSort,
} from '@/lib/data/orders';
import EmptyState from '@/components/ui/EmptyState';
import ProductionQueueTable from '@/components/admin/ProductionQueueTable';
import ProductionQueueRealtime from '@/components/admin/ProductionQueueRealtime';
import SortControls from '@/components/admin/SortControls';

const SORT_VALUES: ProductionQueueSort[] = ['default', 'expected', 'status'];

function isQueueSort(value: string | undefined): value is ProductionQueueSort {
  return SORT_VALUES.some((v) => v === value);
}

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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; sort?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const activeTab: ProductionQueueFilter = isQueueFilter(searchParams.status) ? searchParams.status : 'all';
  const activeSort: ProductionQueueSort = isQueueSort(searchParams.sort) ? searchParams.sort : 'default';
  const [rows, counts] = await Promise.all([
    getProductionQueue(supabase, activeTab, activeSort),
    getProductionQueueCounts(supabase),
  ]);

  return (
    <div>
      <ProductionQueueRealtime />

      <div className="mb-6 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Production Queue</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            Active orders in fabrication — rush orders first, then oldest first.
          </p>
        </div>
        <SortControls sort={activeSort} />
      </div>

      <div className="flex items-center gap-1 border-b border-afs-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.value === activeTab;
          const params = new URLSearchParams();
          if (tab.value !== 'all') params.set('status', tab.value);
          if (activeSort !== 'default') params.set('sort', activeSort);
          const qs = params.toString();
          const href = qs ? `/admin/orders?${qs}` : '/admin/orders';
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
