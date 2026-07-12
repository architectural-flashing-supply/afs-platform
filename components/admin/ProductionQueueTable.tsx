'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import QuickAdvanceButton from './QuickAdvanceButton';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/admin/orderStages';
import type { ProductionQueueRow } from '@/lib/data/orders';

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface ProductionQueueTableProps {
  rows: ProductionQueueRow[];
}

export default function ProductionQueueTable({ rows }: ProductionQueueTableProps) {
  const [localRows, setLocalRows] = useState(rows);
  const [toast, setToast] = useState<string | null>(null);

  // Server re-renders (including ones triggered by ProductionQueueRealtime)
  // pass a fresh `rows` prop — sync local optimistic state back to it.
  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleAdvanced(id: string, orderNumber: string, newStatus: string) {
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    setToast(`Order ${orderNumber} → ${STATUS_LABEL[newStatus] ?? newStatus}`);
  }

  return (
    <div className="relative">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-afs-bg-raised border border-afs-crimson rounded px-5 py-3 shadow-raised">
          <p className="font-body text-sm text-afs-chrome-high">{toast}</p>
        </div>
      )}
      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Order #
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Customer
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Profiles
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Created
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Rush
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Status
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Advance
              </th>
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, index) => (
              <tr
                key={row.id}
                data-testid={`queue-row-${index}`}
                className={`border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors ${
                  row.isRush ? 'bg-[var(--afs-crimson-ghost)]' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${row.id}`}
                    className="font-data text-sm text-afs-chrome-high hover:text-afs-crimson"
                  >
                    {row.orderNumber}
                  </Link>
                </td>
                <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.customerName}</td>
                <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{row.profileSummary}</td>
                <td className="font-data text-xs text-afs-chrome-dim px-4 py-3">{formatTimeAgo(row.createdAt)}</td>
                <td className="px-4 py-3">
                  {row.isRush && (
                    <span className="bg-afs-crimson text-white font-label text-xs font-bold px-2 py-1 rounded">
                      RUSH
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" data-testid={`order-status-${index}`}>
                  <Badge variant={STATUS_VARIANT[row.status] ?? 'chrome'}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <QuickAdvanceButton
                    orderId={row.id}
                    status={row.status}
                    testId={`quick-advance-${index}`}
                    onAdvanced={(newStatus) => handleAdvanced(row.id, row.orderNumber, newStatus)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
