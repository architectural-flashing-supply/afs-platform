'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { sourceToolLabel } from '@/lib/data/quote-request-source-tool';
import {
  nextShopProfileLibraryStatus,
  shopProfileLibraryStatusLabel,
  type ShopProfileLibraryFullRow,
} from '@/lib/data/shop-profile-library';

interface ShopViewBoardProps {
  initialRows: ShopProfileLibraryFullRow[];
}

const POLL_INTERVAL_MS = 30_000;

type SortKey = 'customerName' | 'profileName' | 'material' | 'status' | 'dueDate';
type SortDir = 'asc' | 'desc';
type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'dueDate', label: 'Due Date' },
  { key: 'customerName', label: 'Customer' },
  { key: 'profileName', label: 'Profile' },
  { key: 'material', label: 'Material' },
  { key: 'status', label: 'Status' },
];

const DUE_FILTER_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'All Due Dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'week', label: 'Due This Week' },
  { value: 'none', label: 'No Due Date' },
];

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function daysUntil(dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function matchesDueFilter(dueDate: string | null, filter: DueFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return !dueDate;
  if (!dueDate) return false;
  const days = daysUntil(dueDate);
  if (filter === 'overdue') return days < 0;
  if (filter === 'today') return days === 0;
  return days >= 0 && days <= 7; // week
}

function compare(a: ShopProfileLibraryFullRow, b: ShopProfileLibraryFullRow, key: SortKey): number {
  if (key === 'dueDate') {
    // Rows with no due date sort last regardless of direction, since an
    // operator scanning by due date cares about dated jobs first.
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  }
  return (a[key] ?? '').toString().localeCompare((b[key] ?? '').toString());
}

export default function ShopViewBoard({ initialRows }: ShopViewBoardProps) {
  const [rows, setRows] = useState(initialRows);
  const [customerFilter, setCustomerFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  // Polling, not Realtime — this task's explicit requirement. A 30s
  // interval is plenty for a shop-floor reference display; nothing here
  // needs sub-second latency the way the customer-facing order Realtime
  // subscriptions (ARCHITECTURE.md §5) do.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/shop-profile-library', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { rows?: ShopProfileLibraryFullRow[] };
        if (Array.isArray(data.rows)) setRows(data.rows);
      } catch {
        // Silent — a missed poll just means the next one 30s later retries.
      }
    };
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const customerOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.customerName).filter((v): v is string => !!v))).sort(),
    [rows]
  );
  const profileOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.profileName))).sort(), [rows]);
  const materialOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.material).filter((v): v is string => !!v))).sort(),
    [rows]
  );
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))), [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => (customerFilter === 'all' ? true : r.customerName === customerFilter))
      .filter((r) => (profileFilter === 'all' ? true : r.profileName === profileFilter))
      .filter((r) => (materialFilter === 'all' ? true : r.material === materialFilter))
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => matchesDueFilter(r.dueDate, dueFilter))
      .sort((a, b) => (sortDir === 'asc' ? compare(a, b, sortKey) : compare(b, a, sortKey)));
  }, [rows, customerFilter, profileFilter, materialFilter, statusFilter, dueFilter, sortKey, sortDir]);

  const advanceStatus = async (row: ShopProfileLibraryFullRow) => {
    const next = nextShopProfileLibraryStatus(row.status);
    if (!next) return;

    setAdvanceError(null);
    setAdvancingId(row.id);
    const previousStatus = row.status;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));

    try {
      const res = await fetch(`/api/admin/profile-library/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: previousStatus } : r)));
        setAdvanceError(data.error ?? `Could not update "${row.profileName}". Please try again.`);
      }
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: previousStatus } : r)));
      setAdvanceError(`Network error updating "${row.profileName}". Please try again.`);
    } finally {
      setAdvancingId(null);
    }
  };

  const selectClass =
    'bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body';

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={selectClass}>
          <option value="all">All Customers</option>
          {customerOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)} className={selectClass}>
          <option value="all">All Profiles</option>
          {profileOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} className={selectClass}>
          <option value="all">All Materials</option>
          {materialOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {shopProfileLibraryStatusLabel(s)}
            </option>
          ))}
        </select>
        <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as DueFilter)} className={selectClass}>
          {DUE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="w-px h-6 bg-afs-border mx-1" />

        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectClass}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className={`${selectClass} hover:bg-afs-bg-surface transition-colors`}
        >
          {sortDir === 'asc' ? '▲ Ascending' : '▼ Descending'}
        </button>
      </div>

      {advanceError && (
        <div className="bg-afs-crimson-dim/20 border border-afs-crimson rounded px-4 py-3 mb-6">
          <p className="font-body text-sm text-afs-chrome-high">{advanceError}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="No jobs match this filter"
          description="Try a different filter combination, or check back — Shop View refreshes automatically every 30 seconds."
        />
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
          {filtered.map((row) => (
            <ShopViewCard
              key={row.id}
              row={row}
              advancing={advancingId === row.id}
              onAdvance={() => advanceStatus(row)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function dueDateTone(dueDate: string | null): { textClass: string; label: string } {
  if (!dueDate) return { textClass: 'text-afs-chrome-dim', label: 'No due date' };
  const days = daysUntil(dueDate);
  if (days < 0) return { textClass: 'text-afs-crimson', label: `OVERDUE — ${formatDate(dueDate)}` };
  if (days === 0) return { textClass: 'text-afs-crimson', label: `DUE TODAY — ${formatDate(dueDate)}` };
  if (days <= 3) return { textClass: 'text-afs-warning', label: `Due ${formatDate(dueDate)}` };
  return { textClass: 'text-afs-chrome-high', label: `Due ${formatDate(dueDate)}` };
}

interface ShopViewCardProps {
  row: ShopProfileLibraryFullRow;
  advancing: boolean;
  onAdvance: () => void;
}

function ShopViewCard({ row, advancing, onAdvance }: ShopViewCardProps) {
  const due = dueDateTone(row.dueDate);
  const next = nextShopProfileLibraryStatus(row.status);
  const isComplete = next === null;

  return (
    <div className="bg-afs-bg-raised border-2 border-afs-border rounded overflow-hidden">
      {/* Due date banner — the single most glanceable element on the card */}
      <div className={`px-6 py-3 border-b-2 border-afs-border bg-afs-bg-surface font-heading text-2xl ${due.textClass}`}>
        {due.label}
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-heading text-3xl text-afs-chrome-high leading-tight">{row.profileName}</h2>
            <p className="font-body text-base text-afs-chrome-mid mt-1">
              Order {row.orderNumber ?? '—'} · PathfinderEdge ID {row.pathfinderProfileId ?? '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="chrome" size="md">
              {sourceToolLabel(row.sourceTool)}
            </Badge>
            <Badge variant={isComplete ? 'success' : row.status === 'in_progress' ? 'info' : 'chrome'} size="md">
              {shopProfileLibraryStatusLabel(row.status)}
            </Badge>
          </div>
        </div>

        {/* Geometry — rendered LARGE for a direct visual side-by-side against the physical machine screen */}
        <div className="bg-afs-bg-surface border-2 border-afs-chrome-dim rounded mb-5 flex items-center justify-center h-72 sm:h-96">
          {row.geometrySvg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.geometrySvg}
              alt={`${row.profileName} designed geometry`}
              className="w-full h-full object-contain p-4"
            />
          ) : (
            <p className="font-label text-sm text-afs-chrome-dim uppercase tracking-widest">No Geometry Captured</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Customer</p>
            <p className="font-heading text-xl text-afs-chrome-high">{row.customerName ?? '—'}</p>
            <p className="font-body text-sm text-afs-chrome-mid">{row.company ?? '—'}</p>
          </div>
          <div>
            <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Contact</p>
            <p className="font-body text-sm text-afs-chrome-high">{row.customerEmail ?? '—'}</p>
            <p className="font-data text-sm text-afs-chrome-mid">{row.customerPhone ?? '—'}</p>
          </div>
          <div>
            <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Material / Gauge</p>
            <p className="font-heading text-xl text-afs-chrome-high">
              {row.material ?? '—'} {row.gauge ? `· ${row.gauge}` : ''}
            </p>
          </div>
          <div>
            <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Qty / Length</p>
            <p className="font-heading text-xl text-afs-chrome-high">
              {row.quantity ?? '—'} pc{row.quantity === 1 ? '' : 's'} · {row.lengthFt ?? '—'} LF
            </p>
          </div>
        </div>

        {row.accountNotes && (
          <div className="mb-4">
            <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Account Notes</p>
            <p className="font-body text-sm text-afs-chrome-high">{row.accountNotes}</p>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap mb-4">
          <Badge variant={row.paintedEdge ? 'warning' : 'chrome'} size="md">
            Painted Edge: {row.paintedEdge ? 'YES' : 'No'}
          </Badge>
          {row.hemInstructions && (
            <span className="font-body text-sm text-afs-chrome-mid">
              <span className="font-label text-afs-chrome-dim uppercase tracking-widest text-xs mr-1">Hem:</span>
              {row.hemInstructions}
            </span>
          )}
        </div>

        {row.specialInstructions && (
          <div className="bg-afs-amber-dim/20 border-2 border-afs-warning rounded px-4 py-3 mb-5">
            <p className="font-label text-xs uppercase tracking-widest text-afs-warning mb-1">Special Instructions</p>
            <p className="font-body text-base text-afs-chrome-high">{row.specialInstructions}</p>
          </div>
        )}

        {next ? (
          <button
            type="button"
            onClick={onAdvance}
            disabled={advancing}
            className="w-full bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-lg px-6 py-4 rounded transition-colors disabled:opacity-50"
          >
            {advancing
              ? 'Updating…'
              : next === 'in_progress'
                ? 'Start Job — Mark In Progress'
                : 'Mark Complete'}
          </button>
        ) : (
          <div className="w-full bg-afs-bg-surface border-2 border-afs-success text-afs-success font-label font-semibold text-lg text-center px-6 py-4 rounded">
            ✓ Job Complete
          </div>
        )}
      </div>
    </div>
  );
}
