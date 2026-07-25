'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/admin/orderStages';
import type { CustomerDetail, CustomerOrderRow } from '@/lib/data/customers';

interface CustomerDetailDrawerProps {
  customerId: string;
  onClose: () => void;
}

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  admin: 'error',
  architect: 'info',
  contractor: 'chrome',
  customer: 'chrome',
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomerDetailDrawer({ customerId, onClose }: CustomerDetailDrawerProps) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/admin/customers/${customerId}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          customer?: CustomerDetail;
          orders?: CustomerOrderRow[];
        };
        if (!res.ok || !data.customer) throw new Error(data.error ?? 'Could not load this customer.');
        if (cancelled) return;
        setCustomer(data.customer);
        setOrders(data.orders ?? []);
        setNotesText(data.customer.internalNotes ?? '');
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesError(null);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: notesText }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotesError(data.error ?? 'Could not save this note.');
        return;
      }
      setNotesSaved(true);
    } catch {
      setNotesError('Could not save this note.');
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-afs-bg-raised border-l border-afs-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-afs-border sticky top-0 bg-afs-bg-raised z-10">
          <h2 className="font-heading text-lg text-afs-chrome-high">Customer Detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-label text-sm text-afs-chrome-mid hover:text-afs-crimson transition-colors"
          >
            Close ✕
          </button>
        </div>

        <div className="p-6">
          {loading && <p className="font-body text-sm text-afs-chrome-mid">Loading…</p>}
          {loadError && <p className="font-body text-sm text-afs-crimson">{loadError}</p>}

          {customer && !loading && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="font-heading text-xl text-afs-chrome-high">{customer.fullName}</h3>
                  <Badge variant={ROLE_VARIANT[customer.role] ?? 'chrome'}>{customer.role}</Badge>
                </div>
                <div className="font-body text-sm text-afs-chrome-mid space-y-1">
                  <p>{customer.company || 'No company on file'}</p>
                  <p className="font-data text-xs">{customer.email}</p>
                  {customer.phone && <p className="font-data text-xs">{customer.phone}</p>}
                  <p className="text-xs text-afs-chrome-dim">Customer since {formatDate(customer.createdAt)}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2">Order History</p>
                {orders.length === 0 ? (
                  <p className="font-body text-sm text-afs-chrome-mid">No orders yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-3 bg-afs-bg-surface border border-afs-border rounded px-3 py-2"
                      >
                        <div>
                          <p className="font-data text-xs text-afs-chrome-high">{order.orderNumber}</p>
                          <p className="font-body text-xs text-afs-chrome-dim">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_VARIANT[order.status] ?? 'chrome'}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </Badge>
                          <span className="font-data text-xs text-afs-chrome-high">{currency.format(order.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2">Internal Notes</p>
                <textarea
                  value={notesText}
                  onChange={(e) => {
                    setNotesText(e.target.value);
                    setNotesSaved(false);
                  }}
                  rows={4}
                  placeholder="Internal note about this customer — not visible to them"
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body resize-y mb-2"
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    {notesError && <p className="font-body text-xs text-afs-crimson">{notesError}</p>}
                    {notesSaved && !notesError && <p className="font-body text-xs text-afs-success">Saved.</p>}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>

              <Link
                href={`/admin/customers/${customer.id}`}
                className="block text-center border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
              >
                View Full Account
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
