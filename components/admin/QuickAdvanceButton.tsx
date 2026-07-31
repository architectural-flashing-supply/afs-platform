'use client';

import { useState } from 'react';
import { getNextStage, STATUS_LABEL } from '@/lib/admin/orderStages';

interface QuickAdvanceButtonProps {
  orderId: string;
  status: string;
  testId?: string;
  onAdvanced: (newStatus: string) => void;
}

/**
 * Forward movement needs no confirmation (SPEC_PRODUCTION_QUEUE.md §1) — click
 * and done. The parent owns the row's displayed status so it can update
 * optimistically without waiting on a full page refresh.
 */
export default function QuickAdvanceButton({ orderId, status, testId, onAdvanced }: QuickAdvanceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = getNextStage(status);

  if (status === 'cancelled') {
    return <span className="font-label text-xs text-afs-chrome-dim">Cancelled</span>;
  }

  if (!next) {
    // No entry in ORDER_STAGES has a "next" past this status — true for
    // 'delivered' and also for the three Employee PWA / delivery-tracking
    // statuses (in_production/packaged/out_for_delivery), which sit outside
    // the fabrication sequence entirely (PRODUCTION_QUEUE_AUDIT.md §2a). The
    // label used to be hardcoded "Delivered" regardless of which of these
    // it actually was.
    return (
      <button
        type="button"
        disabled
        className="font-label text-xs text-afs-chrome-dim px-3 py-1.5 rounded border border-afs-border cursor-not-allowed"
      >
        {STATUS_LABEL[status] ?? status}
      </button>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next!.key }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not advance this order.');
        return;
      }
      onAdvanced(next!.key);
    } catch {
      setError('Could not advance this order.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        data-testid={testId}
        onClick={handleClick}
        disabled={loading}
        className="font-label text-xs font-semibold text-white bg-afs-crimson hover:bg-afs-crimson-hover px-3 py-1.5 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? 'Advancing…' : `→ ${next.adminLabel}`}
      </button>
      {error && <span className="font-body text-[11px] text-afs-crimson">{error}</span>}
    </div>
  );
}
