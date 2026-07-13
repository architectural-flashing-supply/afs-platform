'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import type { PendingQuoteRequestRow } from '@/lib/data/pending-quote-requests';

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
        {request.isRush && <Badge variant="warning">RUSH</Badge>}
      </div>

      <div className="mb-4">
        <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5">Requested Profiles</p>
        <ul className="font-data text-xs text-afs-chrome-high space-y-1 list-disc list-inside">
          {request.lineItemDescriptions.length > 0 ? (
            request.lineItemDescriptions.map((desc, i) => <li key={i}>{desc}</li>)
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

      {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}

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
