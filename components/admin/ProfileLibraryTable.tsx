'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sourceToolLabel } from '@/lib/data/quote-request-source-tool';
import { compareShopProfileLibraryQueueOrder, type ShopProfileLibraryRow } from '@/lib/data/shop-profile-library';

interface ProfileLibraryTableProps {
  rows: ShopProfileLibraryRow[];
}

type SortKey =
  | 'customerName'
  | 'company'
  | 'profileName'
  | 'material'
  | 'quantity'
  | 'dueDate'
  | 'sourceTool'
  | 'status'
  | 'createdAt'
  | 'clientBusinessName'
  | 'clientName'
  | 'poNumber'
  | 'requestedBy'
  | 'finish';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function compare(a: ShopProfileLibraryRow, b: ShopProfileLibraryRow, key: SortKey): number {
  if (key === 'quantity') return (a.quantity ?? 0) - (b.quantity ?? 0);
  if (key === 'dueDate' || key === 'createdAt') {
    const aVal = a[key] ? new Date(a[key] as string).getTime() : 0;
    const bVal = b[key] ? new Date(b[key] as string).getTime() : 0;
    return aVal - bVal;
  }
  return (a[key] ?? '').toString().localeCompare((b[key] ?? '').toString());
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'customerName', label: 'Customer' },
  { key: 'company', label: 'Company' },
  { key: 'profileName', label: 'Profile' },
  { key: 'material', label: 'Material' },
  { key: 'quantity', label: 'Qty' },
  { key: 'dueDate', label: 'Due' },
  { key: 'clientBusinessName', label: 'Business Name' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'poNumber', label: 'PO Number' },
  { key: 'requestedBy', label: 'Requested By' },
  { key: 'finish', label: 'Finish' },
  { key: 'sourceTool', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
];

export default function ProfileLibraryTable({ rows: initialRows }: ProfileLibraryTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState('');
  const [businessNameFilter, setBusinessNameFilter] = useState('');
  const [poNumberFilter, setPoNumberFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const sourceOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.sourceTool).filter((v): v is string => !!v))),
    [rows]
  );
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const businessTerm = businessNameFilter.trim().toLowerCase();
    const poTerm = poNumberFilter.trim().toLowerCase();
    return rows
      .filter((r) => (sourceFilter === 'all' ? true : r.sourceTool === sourceFilter))
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => {
        if (!term) return true;
        return (
          (r.customerName ?? '').toLowerCase().includes(term) ||
          (r.company ?? '').toLowerCase().includes(term) ||
          r.profileName.toLowerCase().includes(term) ||
          (r.material ?? '').toLowerCase().includes(term)
        );
      })
      .filter((r) => !businessTerm || (r.clientBusinessName ?? '').toLowerCase().includes(businessTerm))
      .filter((r) => !poTerm || (r.poNumber ?? '').toLowerCase().includes(poTerm))
      .sort((a, b) => (sortDir === 'asc' ? compare(a, b, sortKey) : compare(b, a, sortKey)));
  }, [rows, search, businessNameFilter, poNumberFilter, sourceFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Shop-floor queue order (afs-cv-005) — always computed from the FULL row
  // set, independent of the table's search/filter/column-sort above, since
  // "shop priority" is a global ordering, not a property of whatever subset
  // is currently visible. Reuses the exact comparator Shop View's queue
  // strip sorts by (lib/data/shop-profile-library.ts), so the two surfaces
  // can never disagree about what order the shop should work jobs in.
  const queueOrder = useMemo(() => [...rows].sort(compareShopProfileLibraryQueueOrder), [rows]);
  const queueRank = useMemo(() => {
    const map = new Map<string, number>();
    queueOrder.forEach((r, idx) => map.set(r.id, idx + 1));
    return map;
  }, [queueOrder]);

  // Reordering approach: explicit up/down buttons per row, not drag-to-
  // reorder (afs-cv-005). This codebase has no drag-and-drop library in
  // package.json, and pulling one in solely for this single table would be
  // disproportionate — two buttons per row give Steve the same "set exact
  // shop priority" capability with zero new dependencies.
  const moveRow = async (id: string, direction: 'up' | 'down') => {
    const idx = queueOrder.findIndex((r) => r.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= queueOrder.length) return;

    const reordered = [...queueOrder];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    const newPositionById = new Map(reordered.map((r, i) => [r.id, i + 1]));

    const previousRows = rows;
    setReorderError(null);
    setReorderingId(id);
    setRows((prev) => prev.map((r) => ({ ...r, queuePosition: newPositionById.get(r.id) ?? r.queuePosition })));

    try {
      const res = await fetch('/api/admin/profile-library/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((r) => r.id) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRows(previousRows);
        setReorderError(data.error ?? 'Could not save the new queue order. Please try again.');
      } else {
        router.refresh();
      }
    } catch {
      setRows(previousRows);
      setReorderError('Network error saving the new queue order. Please try again.');
    } finally {
      setReorderingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/profile-library/${confirmDeleteId}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? 'Could not delete this row.');
        setDeleting(false);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== confirmDeleteId));
      setConfirmDeleteId(null);
      setDeleting(false);
      router.refresh();
    } catch {
      setDeleteError('Network error. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, company, profile, or material…"
          className="flex-1 min-w-[240px] bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        />
        <input
          type="text"
          value={businessNameFilter}
          onChange={(e) => setBusinessNameFilter(e.target.value)}
          placeholder="Filter by business name…"
          className="min-w-[180px] bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        />
        <input
          type="text"
          value={poNumberFilter}
          onChange={(e) => setPoNumberFilter(e.target.value)}
          placeholder="Filter by PO number…"
          className="min-w-[160px] bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        >
          <option value="all">All Sources</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {sourceToolLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        >
          <option value="all">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {reorderError && (
        <div className="bg-afs-crimson-dim/20 border border-afs-crimson rounded px-4 py-3 mb-4">
          <p className="font-body text-sm text-afs-chrome-high">{reorderError}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
          <h3 className="font-heading text-xl text-afs-chrome-high mb-2">No profiles match this filter</h3>
          <p className="font-body text-sm text-afs-chrome-mid">Try a different search term or filter combination.</p>
        </div>
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Queue
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Thumb
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3 cursor-pointer select-none hover:text-afs-chrome-high transition-colors whitespace-nowrap"
                  >
                    {col.label}
                    {sortKey === col.key && <span className="ml-1 text-afs-crimson">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const rank = queueRank.get(row.id) ?? null;
                const isFirst = rank === 1;
                const isLast = rank === queueOrder.length;
                const busy = reorderingId !== null;
                return (
                  <tr key={row.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-data text-sm text-afs-chrome-high w-5 text-right">{rank ?? '—'}</span>
                        <div className="flex flex-col leading-none">
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, 'up')}
                            disabled={busy || isFirst}
                            aria-label={`Move ${row.profileName} up in shop queue`}
                            className="text-afs-chrome-mid hover:text-afs-crimson disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-afs-chrome-mid transition-colors text-xs leading-none"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, 'down')}
                            disabled={busy || isLast}
                            aria-label={`Move ${row.profileName} down in shop queue`}
                            className="text-afs-chrome-mid hover:text-afs-crimson disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-afs-chrome-mid transition-colors text-xs leading-none"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.geometrySvg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.geometrySvg}
                          alt={`${row.profileName} thumbnail`}
                          className="w-12 h-12 object-contain bg-afs-bg-surface border border-afs-border rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-afs-bg-surface border border-afs-border rounded text-afs-chrome-dim text-[10px] font-label">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.customerName ?? '—'}</td>
                    <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{row.company ?? '—'}</td>
                    <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.profileName}</td>
                    <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{row.material ?? '—'}</td>
                    <td className="font-data text-sm text-afs-chrome-high px-4 py-3">{row.quantity ?? '—'}</td>
                    <td className="font-data text-xs text-afs-chrome-mid px-4 py-3 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                    <td className="font-body text-sm text-afs-chrome-mid px-4 py-3 whitespace-nowrap">{row.clientBusinessName ?? '—'}</td>
                    <td className="font-body text-sm text-afs-chrome-mid px-4 py-3 whitespace-nowrap">{row.clientName ?? '—'}</td>
                    <td className="font-data text-xs text-afs-chrome-mid px-4 py-3 whitespace-nowrap">{row.poNumber ?? '—'}</td>
                    <td className="font-body text-sm text-afs-chrome-mid px-4 py-3 whitespace-nowrap">{row.requestedBy ?? '—'}</td>
                    <td className="font-label text-xs text-afs-chrome-mid px-4 py-3 whitespace-nowrap">{row.finish ?? '—'}</td>
                    <td className="font-label text-xs text-afs-chrome-mid px-4 py-3 whitespace-nowrap">
                      {sourceToolLabel(row.sourceTool)}
                    </td>
                    <td className="font-label text-xs text-afs-chrome-high px-4 py-3 whitespace-nowrap">
                      {statusLabel(row.status)}
                    </td>
                    <td className="font-data text-xs text-afs-chrome-dim px-4 py-3 whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteId(row.id);
                        }}
                        aria-label="Delete profile library row"
                        className="text-afs-chrome-mid hover:text-afs-crimson transition-colors"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => !deleting && setConfirmDeleteId(null)}
        >
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg text-afs-chrome-high mb-3">Delete This Profile?</h3>
            <p className="font-body text-sm text-afs-chrome-mid mb-4">
              This removes it from the Profile Library and Shop View. The record is soft-deleted, not destroyed.
            </p>
            {deleteError && <p className="font-body text-xs text-afs-crimson mb-4">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteId(null)}
                className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
