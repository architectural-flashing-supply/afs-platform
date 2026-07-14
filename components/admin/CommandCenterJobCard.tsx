'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';
import type { MachineJobRow } from '@/lib/data/machine-jobs';

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved_for_machine: 'Approved — Queued for Bridge',
  staged_for_review: 'Staged for Human Review',
  sent_to_machine: 'Sent to Machine',
  machine_error: 'Machine Error',
  completed: 'Completed',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mmToIn(mm: number | null): string {
  if (mm === null) return '—';
  return (mm / 25.4).toFixed(4);
}

export default function CommandCenterJobCard({ job }: { job: MachineJobRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'reject' | 'request-changes' | null>(null);
  const [reason, setReason] = useState('');

  const call = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setBusy(false);
        return;
      }
      setModal(null);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-data text-sm text-afs-crimson">{job.requestNumber}</p>
          <p className="font-heading text-lg text-afs-chrome-high">{job.customerName}</p>
          {job.customerCompany && <p className="font-body text-xs text-afs-chrome-mid">{job.customerCompany}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={job.status === 'machine_error' || job.status === 'rejected' ? 'error' : 'chrome'}>
            {STATUS_LABEL[job.status] ?? job.status}
          </Badge>
          {job.isRush && <Badge variant="warning">RUSH</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="font-heading text-base text-afs-chrome-high mb-1">{job.profileName}</p>
          <BendSequenceDiagram bends={job.bends} />
        </div>
        <div className="font-data text-xs text-afs-chrome-mid space-y-1">
          <p>Material: <span className="text-afs-chrome-high">{job.material ?? '—'}</span></p>
          <p>Gauge: <span className="text-afs-chrome-high">{job.gauge ?? '—'}</span></p>
          <p>Quantity: <span className="text-afs-chrome-high">{job.quantity}</span></p>
          <p>
            Blank width: <span className="text-afs-chrome-high">{mmToIn(job.blankWidthMm)}&quot;</span>{' '}
            (<span className="text-afs-chrome-high">{job.blankWidthMm ?? '—'} mm</span>)
          </p>
          <p>Submitted: <span className="text-afs-chrome-high">{formatDateTime(job.submittedAt)}</span></p>
          {job.approvedAt && <p>Approved: <span className="text-afs-chrome-high">{formatDateTime(job.approvedAt)}</span></p>}
          {job.stagedAt && <p>Staged for review: <span className="text-afs-chrome-high">{formatDateTime(job.stagedAt)}</span></p>}
          {job.deliveredAt && <p>Delivered: <span className="text-afs-chrome-high">{formatDateTime(job.deliveredAt)}</span></p>}
        </div>
      </div>

      {job.notes && (
        <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3 mb-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Customer Notes</p>
          <p className="font-body text-xs text-afs-chrome-high whitespace-pre-line">{job.notes}</p>
        </div>
      )}

      {job.rejectionReason && (
        <p className="font-body text-xs text-afs-crimson mb-4">Rejected: {job.rejectionReason}</p>
      )}

      {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}

      {job.status === 'pending_approval' && (
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={() => call('/api/admin/command-center/approve', { jobId: job.id })}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            Approve &amp; Send to Machine
          </button>
          <button
            type="button"
            onClick={() => setModal('request-changes')}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2 rounded transition-colors"
          >
            Request Changes
          </button>
          <button
            type="button"
            onClick={() => setModal('reject')}
            className="font-label text-sm text-afs-chrome-mid hover:text-afs-crimson transition-colors px-4 py-2"
          >
            Reject
          </button>
        </div>
      )}

      {job.status === 'staged_for_review' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => call('/api/admin/command-center/mark-delivered', { jobId: job.id })}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
        >
          Confirm: File Verified &amp; Copied to Machine
        </button>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6" onClick={() => setModal(null)}>
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg text-afs-chrome-high mb-3">
              {modal === 'reject' ? 'Reject Job' : 'Request Changes'}
            </h3>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">
              {modal === 'reject' ? 'Reason (required)' : 'Message to customer (required)'}
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors mb-4"
              placeholder={modal === 'reject' ? 'Why is this job being rejected?' : 'What needs to change?'}
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  modal === 'reject'
                    ? call('/api/admin/command-center/reject', { jobId: job.id, reason })
                    : call('/api/admin/command-center/request-changes', { jobId: job.id, message: reason })
                }
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {modal === 'reject' ? 'Reject Job' : 'Send to Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
