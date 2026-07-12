'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STAGES, STATUS_LABEL, getNextStage, isBackwardMove } from '@/lib/admin/orderStages';

interface StatusAdvancerProps {
  orderId: string;
  orderNumber: string;
  currentStatus: string;
}

const ALL_STATUS_OPTIONS = [...ORDER_STAGES.map((s) => s.key), 'cancelled'];

export default function StatusAdvancer({ orderId, orderNumber, currentStatus }: StatusAdvancerProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // The server component re-fetches currentStatus after router.refresh() —
  // resync local form state whenever the canonical status changes.
  useEffect(() => {
    setSelectedStatus(currentStatus);
    setNote('');
    setError(null);
  }, [currentStatus]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const nextStage = getNextStage(currentStatus);

  async function submitStatusChange(status: string, noteText: string | null): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: noteText }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not update status.');
        return false;
      }
      setToast(`Order ${orderNumber} → ${STATUS_LABEL[status] ?? status}`);
      router.refresh();
      return true;
    } catch {
      setError('Could not update status.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickAdvance() {
    if (!nextStage) return;
    await submitStatusChange(nextStage.key, null);
  }

  function handleApplyClick() {
    if (selectedStatus === currentStatus) {
      setError('Select a different status to apply a change.');
      return;
    }
    if (isBackwardMove(currentStatus, selectedStatus)) {
      setError(null);
      setConfirmOpen(true);
      return;
    }
    void submitStatusChange(selectedStatus, note.trim() || null);
  }

  async function handleConfirmBackward() {
    if (!note.trim()) {
      setError('Add a note to explain why this order is moving backward.');
      return;
    }
    const ok = await submitStatusChange(selectedStatus, note.trim());
    if (ok) setConfirmOpen(false);
  }

  return (
    <div
      data-testid="status-advancer"
      className="bg-afs-bg-raised border border-afs-border rounded p-6 flex flex-col gap-5 w-full md:w-[360px] shrink-0"
    >
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-afs-bg-raised border border-afs-crimson rounded px-5 py-3 shadow-raised">
          <p className="font-body text-sm text-afs-ink-900">{toast}</p>
        </div>
      )}

      <div>
        <p className="font-label text-xs uppercase tracking-wide text-afs-ink-700 mb-1">Currently</p>
        <p className="font-heading text-xl text-afs-ink-900">{STATUS_LABEL[currentStatus] ?? currentStatus}</p>
      </div>

      {currentStatus === 'cancelled' ? (
        <p className="font-body text-sm text-afs-ink-700">This order is cancelled.</p>
      ) : nextStage ? (
        <button
          type="button"
          onClick={handleQuickAdvance}
          disabled={submitting}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-3 rounded text-sm transition-colors disabled:opacity-50"
        >
          {submitting ? 'Advancing…' : `→ Advance to: ${nextStage.adminLabel}`}
        </button>
      ) : (
        <p className="font-body text-sm text-afs-ink-700">This order is delivered — production is complete.</p>
      )}

      <div className="border-t border-afs-border pt-4 flex flex-col gap-3">
        <p className="font-label text-xs uppercase tracking-wide text-afs-ink-700">Manual Override</p>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
        >
          {ALL_STATUS_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {STATUS_LABEL[key] ?? key}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for manual change"
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
        />
        <button
          type="button"
          onClick={handleApplyClick}
          disabled={submitting}
          className="border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
        >
          Apply Status Change
        </button>
        {error && !confirmOpen && <p className="font-body text-xs text-afs-crimson">{error}</p>}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-afs-bg-modal flex items-center justify-center px-4">
          <div className="bg-afs-bg-raised border border-afs-crimson rounded p-6 max-w-sm w-full">
            <h3 className="font-heading text-lg text-afs-ink-900 mb-2">Confirm Backward Move</h3>
            <p className="font-body text-sm text-afs-ink-700 mb-4">
              Moving this order from {STATUS_LABEL[currentStatus] ?? currentStatus} back to{' '}
              {STATUS_LABEL[selectedStatus] ?? selectedStatus} is unusual. Add a note to explain.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Reason for the backward move"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body resize-y mb-4"
            />
            {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setError(null);
                }}
                className="font-label text-sm text-afs-ink-700 hover:text-afs-ink-900 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBackward}
                disabled={submitting}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Applying…' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
