'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/admin/orderStages';
import type { CrmOrderRow, OperatorRow } from '@/lib/data/command-center-crm';

interface OrdersCrmTabProps {
  orders: CrmOrderRow[];
  operators: OperatorRow[];
}

const STATUS_FILTERS = ['all', 'packaged', 'out_for_delivery', 'delivered'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// orderStages.ts's STATUS_LABEL/STATUS_VARIANT predate migration 007's status
// widening (packaged/out_for_delivery/in_production) — filled in locally
// rather than editing that shared map, since it drives the production-queue
// stage sequence elsewhere and those three aren't real production stages.
const EXTRA_STATUS_LABEL: Record<string, string> = {
  packaged: 'Packaged',
  out_for_delivery: 'Out for Delivery',
  in_production: 'In Production',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function OrdersCrmTab({ orders: initialOrders, operators }: OrdersCrmTabProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [dispatchConfirmId, setDispatchConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (driverFilter !== 'all' && o.assignedDriverId !== driverFilter) return false;
      return true;
    });
  }, [orders, statusFilter, driverFilter]);

  function patchOrderLocal(id: string, patch: Partial<CrmOrderRow>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function saveCrmField(id: string, body: Record<string, unknown>, patch: Partial<CrmOrderRow>) {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/orders/${id}/crm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: data.error ?? 'Could not save.' }));
        return;
      }
      patchOrderLocal(id, patch);
    } catch {
      setRowError((prev) => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setBusyId(null);
    }
  }

  async function callAction(id: string, path: string): Promise<boolean> {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(path, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: data.error ?? 'Could not complete this action.' }));
        return false;
      }
      return true;
    } catch {
      setRowError((prev) => ({ ...prev, [id]: 'Network error.' }));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleDispatch(id: string) {
    const ok = await callAction(id, `/api/orders/${id}/dispatch`);
    setDispatchConfirmId(null);
    if (ok) {
      patchOrderLocal(id, { status: 'out_for_delivery' });
      router.refresh();
    }
  }

  async function handleMarkDelivered(id: string) {
    const ok = await callAction(id, `/api/orders/${id}/delivered`);
    if (ok) {
      patchOrderLocal(id, { status: 'delivered' });
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : (EXTRA_STATUS_LABEL[s] ?? STATUS_LABEL[s] ?? s)}
            </option>
          ))}
        </select>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        >
          <option value="all">All Drivers</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.fullName}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No orders match this filter" description="Try a different status or driver filter." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-x-auto">
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
                  Status
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Driver
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Delivery Date
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const busy = busyId === order.id;
                const isOutForDelivery = order.status === 'out_for_delivery';
                return (
                  <tr key={order.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="font-data text-sm text-afs-chrome-high">{order.orderNumber}</p>
                      <p className="font-data text-xs text-afs-chrome-dim">{currency.format(order.total)}</p>
                      {order.isRush && <Badge variant="warning">RUSH</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-body text-sm text-afs-chrome-high">{order.customerName}</p>
                      {order.customerCompany && <p className="font-body text-xs text-afs-chrome-mid">{order.customerCompany}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOutForDelivery && (
                          <span className="w-2 h-2 rounded-full bg-afs-success animate-pulse" title="Out for delivery" />
                        )}
                        <Badge variant={STATUS_VARIANT[order.status] ?? 'chrome'}>
                          {EXTRA_STATUS_LABEL[order.status] ?? STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.assignedDriverId ?? ''}
                        disabled={busy}
                        onChange={(e) =>
                          saveCrmField(
                            order.id,
                            { assignedDriverId: e.target.value || null },
                            {
                              assignedDriverId: e.target.value || null,
                              assignedDriverName: operators.find((o) => o.id === e.target.value)?.fullName ?? null,
                            }
                          )
                        }
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2 py-1.5 text-xs text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                      >
                        <option value="">Unassigned</option>
                        {operators.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.fullName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        defaultValue={toDateInputValue(order.deliveryScheduledAt)}
                        disabled={busy}
                        onChange={(e) =>
                          saveCrmField(
                            order.id,
                            { deliveryScheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null },
                            { deliveryScheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null }
                          )
                        }
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2 py-1.5 text-xs text-afs-chrome-high focus:border-afs-crimson outline-none font-data"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 min-w-[140px]">
                        {order.status !== 'out_for_delivery' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDispatchConfirmId(order.id)}
                            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                          >
                            Dispatch
                          </button>
                        )}
                        {order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMarkDelivered(order.id)}
                            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {order.trackingToken && (
                          <a
                            href={`/track/${order.trackingToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors"
                          >
                            Track ↗
                          </a>
                        )}
                        {rowError[order.id] && <p className="font-body text-xs text-afs-crimson">{rowError[order.id]}</p>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dispatchConfirmId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setDispatchConfirmId(null)}
        >
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg text-afs-chrome-high mb-3">Dispatch This Order?</h3>
            <p className="font-body text-sm text-afs-chrome-mid mb-4">
              This marks the order out for delivery and sends the customer an SMS, a tracking email, and the final invoice.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDispatchConfirmId(null)}
                className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === dispatchConfirmId}
                onClick={() => handleDispatch(dispatchConfirmId)}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                Dispatch Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
