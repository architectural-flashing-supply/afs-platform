'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { findMetalColorByName } from '@/lib/data/metal-colors';
import { sourceToolLabel } from '@/lib/data/quote-request-source-tool';
import {
  compareShopProfileLibraryQueueOrder,
  nextShopProfileLibraryStatus,
  shopProfileLibraryStatusLabel,
  type ShopProfileLibraryFullRow,
} from '@/lib/data/shop-profile-library';

interface ShopViewBoardProps {
  initialRows: ShopProfileLibraryFullRow[];
}

const POLL_INTERVAL_MS = 30_000;

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function daysUntil(dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return daysUntil(dueDate) < 0;
}

function isCompletedToday(completedAt: string | null): boolean {
  if (!completedAt) return false;
  return new Date(completedAt).toDateString() === new Date().toDateString();
}

function dueDateTone(dueDate: string | null): { textClass: string; label: string } {
  if (!dueDate) return { textClass: 'text-afs-chrome-dim', label: 'No due date' };
  const days = daysUntil(dueDate);
  if (days < 0) return { textClass: 'text-afs-crimson', label: `OVERDUE — ${formatDate(dueDate)}` };
  if (days === 0) return { textClass: 'text-afs-crimson', label: `DUE TODAY — ${formatDate(dueDate)}` };
  if (days <= 3) return { textClass: 'text-afs-warning', label: `Due ${formatDate(dueDate)}` };
  return { textClass: 'text-afs-chrome-high', label: `Due ${formatDate(dueDate)}` };
}

export default function ShopViewBoard({ initialRows }: ShopViewBoardProps) {
  const [rows, setRows] = useState(initialRows);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [showCompletedToday, setShowCompletedToday] = useState(false);

  // Polling, not Realtime — this task's explicit requirement, carried over
  // from afs-sv-010. A 30s interval is plenty for a shop-floor reference
  // display; nothing here needs sub-second latency the way the
  // customer-facing order Realtime subscriptions (ARCHITECTURE.md §5) do.
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

  const activeRows = useMemo(
    () => rows.filter((r) => r.status !== 'complete').sort(compareShopProfileLibraryQueueOrder),
    [rows]
  );

  const completedTodayRows = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'complete' && isCompletedToday(r.completedAt))
        .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()),
    [rows]
  );

  // Position 1 defaults to the top of the queue; focus can move away from
  // it via chip clicks or a completion (which drops the finished job out of
  // activeRows entirely). If the focused row disappears from the active
  // queue — completed here, completed/deleted by another admin, or the
  // very first render — fall back to whatever is now first in queue order.
  useEffect(() => {
    if (activeRows.length === 0) {
      if (focusedId !== null) setFocusedId(null);
      return;
    }
    if (!focusedId || !activeRows.some((r) => r.id === focusedId)) {
      setFocusedId(activeRows[0].id);
    }
  }, [activeRows, focusedId]);

  const focusedRow = activeRows.find((r) => r.id === focusedId) ?? null;

  const advanceStatus = async () => {
    if (!focusedRow) return;
    const next = nextShopProfileLibraryStatus(focusedRow.status);
    if (!next) return;

    setAdvanceError(null);
    setAdvancing(true);
    const rowId = focusedRow.id;
    const previousStatus = focusedRow.status;
    const previousCompletedAt = focusedRow.completedAt;
    // Marking a job complete here (via the queued -> in_progress -> complete
    // lifecycle's final step) sets status AND completed_at together — see
    // app/api/admin/profile-library/[id]/route.ts's PATCH handler, which is
    // where that write actually happens. completed_at is purely an event
    // record for a future automation chain (delivery/invoice/email) to
    // consume later; this action itself fires none of those side effects.
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, status: next, completedAt: next === 'complete' ? new Date().toISOString() : r.completedAt }
          : r
      )
    );

    try {
      const res = await fetch(`/api/admin/profile-library/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, status: previousStatus, completedAt: previousCompletedAt } : r))
        );
        setAdvanceError(data.error ?? `Could not update "${focusedRow.profileName}". Please try again.`);
      } else {
        const data = (await res.json().catch(() => ({}))) as { completedAt?: string | null };
        if (data.completedAt) {
          setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, completedAt: data.completedAt ?? null } : r)));
        }
      }
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, status: previousStatus, completedAt: previousCompletedAt } : r))
      );
      setAdvanceError(`Network error updating "${focusedRow.profileName}". Please try again.`);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        {activeRows.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
            {activeRows.map((row, idx) => {
              const isFocused = row.id === focusedId;
              const overdue = isOverdue(row.dueDate);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setFocusedId(row.id)}
                  title={`${row.profileName} — ${row.customerName ?? 'No customer'}`}
                  aria-current={isFocused ? 'true' : undefined}
                  className={[
                    'shrink-0 flex items-center justify-center rounded-full font-label font-semibold transition-colors border-2',
                    isFocused
                      ? 'w-12 h-12 text-base bg-afs-crimson border-afs-crimson text-white'
                      : overdue
                        ? 'w-10 h-10 text-sm bg-afs-crimson-dim/20 border-afs-crimson text-afs-crimson hover:bg-afs-crimson-dim/40'
                        : 'w-10 h-10 text-sm bg-afs-bg-overlay border-afs-border text-afs-chrome-mid hover:border-afs-chrome-dim hover:text-afs-chrome-high',
                  ].join(' ')}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() => setShowCompletedToday((v) => !v)}
          className="shrink-0 border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2.5 rounded transition-colors"
        >
          {showCompletedToday ? 'Hide' : 'Show'} Completed Today ({completedTodayRows.length})
        </button>
      </div>

      {advanceError && (
        <div className="bg-afs-crimson-dim/20 border border-afs-crimson rounded px-4 py-3 mb-6">
          <p className="font-body text-sm text-afs-chrome-high">{advanceError}</p>
        </div>
      )}

      {showCompletedToday && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-5 mb-6">
          <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-3">
            Completed Today — review only, not part of the active queue
          </p>
          {completedTodayRows.length === 0 ? (
            <p className="font-body text-sm text-afs-chrome-mid">No jobs completed yet today.</p>
          ) : (
            <ul className="divide-y divide-afs-border">
              {completedTodayRows.map((row) => (
                <li key={row.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-heading text-base text-afs-chrome-high">{row.profileName}</p>
                    <p className="font-body text-sm text-afs-chrome-mid">
                      {row.customerName ?? '—'} {row.company ? `· ${row.company}` : ''}
                    </p>
                  </div>
                  <p className="font-data text-sm text-afs-chrome-dim">
                    {row.completedAt ? formatDateTime(row.completedAt) : '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {focusedRow ? (
        <FocusPanel row={focusedRow} advancing={advancing} onAdvance={advanceStatus} />
      ) : (
        <EmptyState
          title="No active jobs in the queue"
          description="Every job in the shop profile library is complete. Shop View refreshes automatically every 30 seconds."
        />
      )}
    </div>
  );
}

interface FocusPanelProps {
  row: ShopProfileLibraryFullRow;
  advancing: boolean;
  onAdvance: () => void;
}

function FocusPanel({ row, advancing, onAdvance }: FocusPanelProps) {
  const due = dueDateTone(row.dueDate);
  const next = nextShopProfileLibraryStatus(row.status);
  const isComplete = next === null;
  const colorMatch = row.color ? findMetalColorByName(row.color) : null;

  return (
    <div className="bg-afs-bg-raised border-2 border-afs-border rounded overflow-hidden">
      <div className={`px-6 py-4 border-b-2 border-afs-border bg-afs-bg-surface font-heading text-3xl ${due.textClass}`}>
        {due.label}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 p-6">
        {/* Geometry — as large as the viewport allows, for a direct visual side-by-side against the physical machine screen */}
        <div className="flex-1 min-w-0 bg-afs-bg-surface border-2 border-afs-chrome-dim rounded flex items-center justify-center h-[45vh] lg:h-[calc(100vh-280px)] lg:min-h-[420px]">
          {row.geometrySvg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.geometrySvg}
              alt={`${row.profileName} designed geometry`}
              className="w-full h-full object-contain p-6"
            />
          ) : (
            <p className="font-label text-sm text-afs-chrome-dim uppercase tracking-widest">No Geometry Captured</p>
          )}
        </div>

        {/* Job fields — arranged around the geometry, not inside it */}
        <div className="w-full lg:w-[440px] shrink-0 space-y-5 overflow-y-auto lg:max-h-[calc(100vh-280px)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
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

          {row.accountNotes && (
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Account Notes</p>
              <p className="font-body text-sm text-afs-chrome-high whitespace-pre-line">{row.accountNotes}</p>
            </div>
          )}

          {(row.clientBusinessName || row.clientName || row.poNumber || row.requestedBy) && (
            <div className="grid grid-cols-2 gap-4">
              {row.clientBusinessName && (
                <div>
                  <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Business Name</p>
                  <p className="font-body text-sm text-afs-chrome-high">{row.clientBusinessName}</p>
                </div>
              )}
              {row.clientName && (
                <div>
                  <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Client Name</p>
                  <p className="font-body text-sm text-afs-chrome-high">{row.clientName}</p>
                </div>
              )}
              {row.poNumber && (
                <div>
                  <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">PO Number</p>
                  <p className="font-data text-sm text-afs-chrome-high">{row.poNumber}</p>
                </div>
              )}
              {row.requestedBy && (
                <div>
                  <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Requested By</p>
                  <p className="font-body text-sm text-afs-chrome-high">{row.requestedBy}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Material / Gauge</p>
              <p className="font-heading text-lg text-afs-chrome-high">
                {row.material ?? '—'} {row.gauge ? `· ${row.gauge}` : ''}
              </p>
            </div>
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Qty / Length</p>
              <p className="font-heading text-lg text-afs-chrome-high">
                {row.quantity ?? '—'} pc{row.quantity === 1 ? '' : 's'} · {row.lengthFt ?? '—'} LF
              </p>
            </div>
          </div>

          {row.finish && (
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Finish</p>
              <p className="font-heading text-lg text-afs-chrome-high">{row.finish}</p>
            </div>
          )}

          {row.color && (
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim mb-1">Color</p>
              <div className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded shrink-0 border-2 border-afs-chrome-dim"
                  // Literal hex fill — same CANVAS_COLORS-style exception
                  // ColorSwatchChip.tsx already documents (CLAUDE.md rule
                  // #4): a color swatch needs the actual color value, which
                  // no afs-* token can represent since it's arbitrary data.
                  style={colorMatch ? { backgroundColor: colorMatch.hex } : undefined}
                  aria-hidden="true"
                />
                <p className="font-heading text-lg text-afs-chrome-high">{row.color}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
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
            <div className="bg-afs-amber-dim/20 border-2 border-afs-warning rounded px-4 py-3">
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
    </div>
  );
}
