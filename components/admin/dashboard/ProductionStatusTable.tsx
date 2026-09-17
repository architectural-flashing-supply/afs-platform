'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import type { ProductionHealth, ProductionStatusRow } from '@/lib/data/command-center-dashboard';

const HEALTH_ROW_CLASS: Record<ProductionHealth, string> = {
  on_track: 'border-l-2 border-l-afs-success',
  at_risk: 'border-l-2 border-l-afs-warning',
  overdue: 'border-l-2 border-l-afs-crimson bg-[var(--afs-crimson-ghost)]',
};

const HEALTH_DOT_CLASS: Record<ProductionHealth, string> = {
  on_track: 'bg-afs-success',
  at_risk: 'bg-afs-warning',
  overdue: 'bg-afs-crimson',
};

const HEALTH_LABEL: Record<ProductionHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  overdue: 'Overdue',
};

function formatEta(iso: string | null): string {
  if (!iso) return 'Not set';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ProductionStatusTableProps {
  rows: ProductionStatusRow[];
}

export default function ProductionStatusTable({ rows }: ProductionStatusTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="font-body text-sm text-afs-chrome-mid">Nothing in production right now.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim border-b border-afs-border">
            <th className="pb-2 pr-3 font-normal">Order</th>
            <th className="pb-2 pr-3 font-normal">Client</th>
            <th className="pb-2 pr-3 font-normal">Status</th>
            <th className="pb-2 pr-3 font-normal">% Complete</th>
            <th className="pb-2 pr-3 font-normal">ETA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <Fragment key={row.id}>
                <tr
                  className={`${HEALTH_ROW_CLASS[row.health]} cursor-pointer hover:bg-afs-bg-surface transition-colors`}
                  onClick={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                >
                  <td className="py-2.5 pl-3 pr-3">
                    <span className="font-data text-sm text-afs-chrome-high">{row.orderNumber}</span>
                    {row.isRush && <span className="ml-2 font-label text-[10px] font-bold text-afs-crimson">RUSH</span>}
                  </td>
                  <td className="py-2.5 pr-3 font-body text-sm text-afs-chrome-high">{row.customerName}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 font-body text-sm text-afs-chrome-mid">
                      <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT_CLASS[row.health]}`} />
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2 w-28">
                      <div className="h-1.5 flex-1 bg-afs-bg-surface rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${HEALTH_DOT_CLASS[row.health]}`} style={{ width: `${row.percentComplete}%` }} />
                      </div>
                      <span className="font-data text-xs text-afs-chrome-dim shrink-0">{row.percentComplete}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 font-data text-xs text-afs-chrome-mid">{formatEta(row.eta)}</td>
                </tr>
                {expanded && (
                  <tr className="bg-afs-bg-surface">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-body text-xs text-afs-chrome-mid">
                          <span className={`font-semibold ${row.health === 'overdue' ? 'text-afs-crimson' : row.health === 'at_risk' ? 'text-afs-warning' : 'text-afs-success'}`}>
                            {HEALTH_LABEL[row.health]}
                          </span>{' '}
                          — view full order history and notes for {row.orderNumber}.
                        </p>
                        <Link
                          href={`/admin/orders/${row.id}`}
                          className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover transition-colors shrink-0"
                        >
                          Open order →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
