import { STOCK_TYPE_LABEL, type StockType } from '@/lib/data/catalog';

const DOT_CLASS: Record<StockType, string> = {
  stock: 'bg-afs-success',
  fabricated: 'bg-afs-amber',
  special_order: 'bg-afs-chrome-base',
};

export default function StockBadge({ stockType, size = 'sm' }: { stockType: StockType; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 border border-afs-chrome-dim rounded font-label ${
        size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-1'
      } text-afs-chrome-mid`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[stockType]}`} />
      {STOCK_TYPE_LABEL[stockType]}
    </span>
  );
}
