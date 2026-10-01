'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';
import type { MachineJobRow } from '@/lib/data/machine-jobs';
import { ADMIN_JOB_HANDOFF_KEY, type AdminJobHandoffPayload } from '@/lib/flashdraft/admin-job-handoff';

// approved_for_machine has no single fixed label — it now means one of
// two real, different things depending on delivery_method (machine_jobs
// row it was overloaded onto before migration 015 added that column:
// queued for the Machine Bridge's own .ds1/human-review poll, or already
// pushed to PathfinderEdge's catalog). See statusLabel() below.
const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending Approval',
  staged_for_review: 'Staged for Human Review',
  sent_to_machine: 'Sent to Machine',
  machine_error: 'Machine Error',
  completed: 'Completed',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
};

const DELIVERY_METHOD_LABEL: Record<MachineJobRow['deliveryMethod'], string> = {
  machine_bridge: 'Approved — Queued for Bridge',
  pathfinder_edge: 'Approved — Sent to PathfinderEdge',
};

function statusLabel(job: MachineJobRow): string {
  if (job.status === 'approved_for_machine') return DELIVERY_METHOD_LABEL[job.deliveryMethod];
  return STATUS_LABEL[job.status] ?? job.status;
}

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

  // Phase 3b: hands this job's bends + identity fields to FlashDraft via
  // localStorage (same pattern as the draft page's own
  // loadCanonicalFromHandoff) rather than a new API route, since this
  // component already has the full job as a prop. ?admin=1&loadJob=1
  // together are what reveal FlashDraft's "Send to PathfinderEdge" button
  // for this session (see app/studio/draft/page.tsx's adminContext).
  const openInFlashDraft = () => {
    const payload: AdminJobHandoffPayload = {
      jobId: job.id,
      profileName: job.profileName,
      material: job.material,
      gauge: job.gauge,
      quantity: job.quantity,
      bends: job.bends,
    };
    window.localStorage.setItem(ADMIN_JOB_HANDOFF_KEY, JSON.stringify(payload));
    router.push('/studio/draft?admin=1&loadJob=1');
  };

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
          <p className="font-data text-sm text-afs-danger-on-dark">{job.requestNumber}</p>
          <p className="font-heading text-lg text-afs-chrome-high">{job.customerName}</p>
          {job.customerCompany && <p className="font-body text-xs text-afs-chrome-mid">{job.customerCompany}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={job.status === 'machine_error' || job.status === 'rejected' ? 'error' : 'chrome'}>
            {statusLabel(job)}
          </Badge>
          {job.isRush && <Badge variant="warning">RUSH</Badge>}
          {job.usedFallbackGeometry && <Badge variant="error">Placeholder Geometry</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="font-heading text-base text-afs-chrome-high mb-1">{job.profileName}</p>
          <BendSequenceDiagram bends={job.bends} />
          {job.bends.length > 0 && (
            <button
              type="button"
              onClick={openInFlashDraft}
              className="mt-2 font-label text-xs font-semibold text-afs-danger-on-dark hover:text-afs-danger-on-dark transition-colors"
            >
              Open in FlashDraft →
            </button>
          )}
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

      {job.usedFallbackGeometry && (
        <div className="bg-afs-bg-surface border border-afs-crimson rounded p-3 mb-4">
          <p className="eyebrow-label text-xs tracking-wide mb-1">Placeholder Geometry</p>
          <p className="font-body text-xs text-afs-chrome-high">
            This job&apos;s bend program is a fabricated 12&quot;/2&quot;/2&quot; placeholder shape, not a real
            measurement — the source request didn&apos;t capture real dimensions or a FlashDraft drawing. Do not
            send this to the machine as-is.
          </p>
        </div>
      )}

      {job.notes && (
        <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3 mb-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Customer Notes</p>
          <p className="font-body text-xs text-afs-chrome-high whitespace-pre-line">{job.notes}</p>
        </div>
      )}

      {job.rejectionReason && (
        <p className="font-body text-xs text-afs-danger-on-dark mb-4">Rejected: {job.rejectionReason}</p>
      )}

      {error && <p className="font-body text-xs text-afs-danger-on-dark mb-3">{error}</p>}

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
            className="font-label text-sm text-afs-chrome-mid hover:text-afs-danger-on-dark transition-colors px-4 py-2"
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
            {/* Placeholder is afs-chrome-silver, not afs-chrome-dim: measured on
                this textarea's own afs-bg-overlay (#4E5568), chrome-dim
                (#7A8299) is 1.94:1 and misses the 4.5:1 body-text rule badly,
                while chrome-silver (#C8D0E0) is 4.80:1 and still reads dimmer
                than the white typed text at 7.44:1. The same swap is wanted in
                the other 22 files still using chrome-dim as a placeholder — see
                STATE_OF_THE_BUILD.md's v2-02 entry. */}
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-silver focus:outline-none focus:border-afs-crimson transition-colors mb-4"
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
