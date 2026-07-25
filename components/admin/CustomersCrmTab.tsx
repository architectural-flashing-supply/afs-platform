'use client';

import { useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import CustomerDetailDrawer from '@/components/admin/CustomerDetailDrawer';
import type { CustomerListRow } from '@/lib/data/customers';

interface CustomersCrmTabProps {
  customers: CustomerListRow[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomersCrmTab({ customers }: CustomersCrmTabProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(term) ||
        (c.company ?? '').toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }, [customers, search]);

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, company, or email…"
        className="w-full max-w-md bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body mb-4"
      />

      {filtered.length === 0 ? (
        <EmptyState title="No customers match this search" description="Try a different name, company, or email." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Name</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Company
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Email</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                  Orders
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Last Order
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors cursor-pointer"
                >
                  <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.fullName}</td>
                  <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{row.company ?? '—'}</td>
                  <td className="font-data text-xs text-afs-chrome-mid px-4 py-3">{row.email}</td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">{row.totalOrders}</td>
                  <td className="font-data text-xs text-afs-chrome-dim px-4 py-3">{formatDate(row.lastOrderAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(row.id);
                      }}
                      className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <CustomerDetailDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
