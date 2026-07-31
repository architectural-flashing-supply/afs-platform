'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { ProductionQueueSort } from '@/lib/data/orders';

const SORT_OPTIONS: { value: ProductionQueueSort; label: string }[] = [
  { value: 'default', label: 'Rush, then oldest first' },
  { value: 'expected', label: 'Expected ship date' },
  { value: 'status', label: 'Status' },
];

interface SortControlsProps {
  sort: ProductionQueueSort;
}

/**
 * SPEC_PRODUCTION_QUEUE.md §1's SortControls — re-sorts the same filtered
 * row set getProductionQueue() already returned (PRODUCTION_QUEUE_AUDIT.md
 * §2d). Preserves the active status tab (`?status=`) while updating `?sort=`.
 */
export default function SortControls({ sort }: SortControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === 'default') {
      params.delete('sort');
    } else {
      params.set('sort', e.target.value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 font-label text-xs text-afs-chrome-mid">
      Sort by
      <select
        data-testid="sort-controls"
        value={sort}
        onChange={handleChange}
        className="bg-afs-bg-overlay border border-afs-border rounded px-2 py-1.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
