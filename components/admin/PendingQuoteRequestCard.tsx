'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { IMAGE_EXTENSIONS } from '@/components/admin/QuoteRequestAttachmentCard';
import type { PendingQuoteRequestRow } from '@/lib/data/pending-quote-requests';
import { sourceToolLabel } from '@/lib/data/quote-request-source-tool';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PendingQuoteRequestCard({ request }: { request: PendingQuoteRequestRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isImageAttachment = request.attachmentFileType
    ? IMAGE_EXTENSIONS.includes(request.attachmentFileType.toLowerCase())
    : false;

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/command-center/approve-quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteRequestId: request.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/command-center/cancel-quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteRequestId: request.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setCancelling(false);
        setConfirmingCancel(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setCancelling(false);
      setConfirmingCancel(false);
    }
  };

  return (
    <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-data text-sm text-afs-crimson">{request.requestNumber}</p>
          <p className="font-heading text-lg text-afs-chrome-high">{request.customerName}</p>
          {request.customerCompany && (
            <p className="font-body text-xs text-afs-chrome-mid">{request.customerCompany}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            disabled={busy || cancelling}
            aria-label="Cancel quote request"
            title="Cancel quote request"
            className="text-afs-chrome-mid hover:text-afs-crimson transition-colors disabled:opacity-50 mb-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16Z" />
            </svg>
          </button>
          {request.isRush && <Badge variant="warning">RUSH</Badge>}
          {request.willUseFallbackGeometry && <Badge variant="error">Placeholder Geometry</Badge>}
          <Badge variant="chrome">{sourceToolLabel(request.sourceTool)}</Badge>
        </div>
      </div>

      {confirmingCancel && (
        <div className="bg-afs-bg-surface border border-afs-crimson rounded p-3 mb-4 flex items-center justify-between gap-3">
          <p className="font-body text-xs text-afs-chrome-high">
            Cancel this quote request? It will be removed from Pending Approval.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={cancelling}
              className="font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              Never Mind
            </button>
          </div>
        </div>
      )}

      {request.attachmentUrl && (
        <div className="mb-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5">Attachment</p>
          {isImageAttachment ? (
            <>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block w-24 h-24 bg-afs-bg-overlay border border-afs-chrome-dim rounded overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={request.attachmentUrl}
                  alt={request.attachmentFileName ?? 'Attachment'}
                  className="w-full h-full object-cover"
                />
              </button>
              {lightboxOpen && (
                <ImageLightbox
                  src={request.attachmentUrl}
                  alt={request.attachmentFileName ?? 'Attachment'}
                  onClose={() => setLightboxOpen(false)}
                />
              )}
            </>
          ) : (
            <a
              href={request.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="font-body text-xs text-afs-crimson hover:text-afs-crimson-hover underline"
            >
              Download {request.attachmentFileName ?? 'attachment'}
            </a>
          )}
        </div>
      )}

      <div className="mb-4">
        <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5">Requested Profiles</p>
        <ul className="font-data text-xs text-afs-chrome-high space-y-2 list-disc list-inside">
          {request.lineItemDescriptions.length > 0 ? (
            request.lineItemDescriptions.map((item, i) => (
              <li key={i}>
                {item.label}
                {item.geometrySummary && (
                  <p className="font-body normal-case text-afs-chrome-mid pl-4 mt-0.5">{item.geometrySummary}</p>
                )}
              </li>
            ))
          ) : (
            <li className="text-afs-chrome-dim list-none">No line items on this request.</li>
          )}
        </ul>
      </div>

      <p className="font-data text-xs text-afs-chrome-mid mb-4">
        Submitted: <span className="text-afs-chrome-high">{formatDateTime(request.submittedAt)}</span>
      </p>

      {request.notes && (
        <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3 mb-4">
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">Customer Notes</p>
          <p className="font-body text-xs text-afs-chrome-high whitespace-pre-line">{request.notes}</p>
        </div>
      )}

      {request.willUseFallbackGeometry && (
        <div className="bg-afs-bg-surface border border-afs-crimson rounded p-3 mb-4">
          <p className="eyebrow-label text-xs tracking-wide mb-1">Placeholder Geometry</p>
          <p className="font-body text-xs text-afs-chrome-high">
            This request didn&apos;t capture real width/leg dimensions or a FlashDraft drawing. Approving will
            create a machine job with a fabricated 12&quot;/2&quot;/2&quot; placeholder shape, not a real
            measurement — verify or rebuild it in Design Studio / FlashDraft before this reaches the machine.
          </p>
        </div>
      )}

      {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}

      {request.hasMultipleLineItems && (
        <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3 mb-3">
          <p className="font-body text-xs text-afs-chrome-high">
            This request has {request.lineItemDescriptions.length} line items — approving creates{' '}
            {request.lineItemDescriptions.length} separate machine jobs, each pushed to PathfinderEdge
            individually.
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={handleApprove}
        className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Approve & Send to Machine'}
      </button>
    </div>
  );
}
