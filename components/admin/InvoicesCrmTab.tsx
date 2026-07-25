'use client';

import { useMemo, useState } from 'react';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { CRM_INVOICE_STATUS_LABEL, type CrmInvoiceRow, type CrmInvoiceStatus } from '@/lib/data/command-center-crm';

interface InvoicesCrmTabProps {
  invoices: CrmInvoiceRow[];
}

const STATUS_VARIANT: Record<CrmInvoiceStatus, BadgeVariant> = {
  draft: 'chrome',
  sent: 'info',
  paid: 'success',
  overdue: 'error',
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvoicesCrmTab({ invoices: initialInvoices }: InvoicesCrmTabProps) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  // "Total paid this month" reads each row's `date` (order created_at) — the
  // real payment moment isn't separately tracked for card/ACH orders (paid
  // at checkout, so created_at is accurate for those), only for net-terms
  // orders manually marked paid via invoice_paid_at. Good enough as a
  // monthly trend signal, not a reconciled accounting figure.
  const summary = useMemo(() => {
    const now = new Date();
    let outstanding = 0;
    let overdue = 0;
    let paidThisMonth = 0;
    for (const inv of invoices) {
      if (inv.status === 'draft' || inv.status === 'sent' || inv.status === 'overdue') outstanding += inv.amount;
      if (inv.status === 'overdue') overdue += inv.amount;
      if (inv.status === 'paid') {
        const d = new Date(inv.date);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) paidThisMonth += inv.amount;
      }
    }
    return { outstanding, overdue, paidThisMonth };
  }, [invoices]);

  async function handleSend(id: string) {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: data.error ?? 'Could not send invoice.' }));
        return;
      }
      setSentIds((prev) => ({ ...prev, [id]: true }));
      setInvoices((prev) => prev.map((inv) => (inv.id === id && inv.status === 'draft' ? { ...inv, status: 'sent' } : inv)));
    } catch {
      setRowError((prev) => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(id: string) {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/admin/invoices/${id}/mark-paid`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: data.error ?? 'Could not mark this invoice paid.' }));
        return;
      }
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: 'paid' } : inv)));
    } catch {
      setRowError((prev) => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Total Outstanding</p>
          <p className="font-data text-2xl text-afs-chrome-high">{currency.format(summary.outstanding)}</p>
        </div>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Total Overdue</p>
          <p className="font-data text-2xl text-afs-crimson">{currency.format(summary.overdue)}</p>
        </div>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Paid This Month</p>
          <p className="font-data text-2xl text-afs-success">{currency.format(summary.paidThisMonth)}</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Invoices are generated automatically from orders." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Invoice #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Order #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Customer
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                  Amount
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Status
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Date</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const busy = busyId === inv.id;
                return (
                  <tr key={inv.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors align-top">
                    <td className="font-data text-sm text-afs-chrome-high px-4 py-3">{inv.invoiceNumber}</td>
                    <td className="font-data text-sm text-afs-chrome-mid px-4 py-3">{inv.orderNumber}</td>
                    <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{inv.customerName}</td>
                    <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">{currency.format(inv.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status]}>{CRM_INVOICE_STATUS_LABEL[inv.status]}</Badge>
                    </td>
                    <td className="font-data text-xs text-afs-chrome-dim px-4 py-3">{formatDate(inv.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSend(inv.id)}
                          className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          {sentIds[inv.id] ? 'Resend Invoice' : 'Send Invoice'}
                        </button>
                        {inv.status !== 'paid' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMarkPaid(inv.id)}
                            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        )}
                        {rowError[inv.id] && <p className="font-body text-xs text-afs-crimson">{rowError[inv.id]}</p>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
