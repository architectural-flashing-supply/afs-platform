'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreditApplicationRow } from '@/lib/data/credit';

interface CreditApplicationReviewModalProps {
  application: CreditApplicationRow;
  onClose: () => void;
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

export default function CreditApplicationReviewModal({ application, onClose }: CreditApplicationReviewModalProps) {
  const router = useRouter();
  const [approvedLimit, setApprovedLimit] = useState(
    application.requestedLimit != null ? String(application.requestedLimit) : ''
  );
  const [approvedTerms, setApprovedTerms] = useState(String(application.requestedTerms ?? 30));
  const [reviewerNotes, setReviewerNotes] = useState(application.reviewerNotes ?? '');
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: 'approve' | 'deny') {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/credit-applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          decision === 'approve'
            ? {
                status: 'approved',
                approvedLimit: Number(approvedLimit),
                approvedTerms: Number(approvedTerms),
                reviewerNotes: reviewerNotes.trim() || null,
              }
            : { status: 'denied', reviewerNotes: reviewerNotes.trim() || null }
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save this decision.');
        setSubmitting(null);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError('Could not save this decision.');
      setSubmitting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-afs-bg-modal" onClick={onClose} />
      <div className="relative bg-afs-bg-raised border border-afs-border rounded max-w-md w-full p-6">
        <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Review Credit Application</h2>
        <p className="font-body text-sm text-afs-chrome-mid mb-6">{application.companyName}</p>

        <dl className="grid grid-cols-2 gap-3 mb-6 font-body text-sm">
          <div>
            <dt className="text-afs-chrome-mid">Requested Limit</dt>
            <dd className="font-data text-afs-chrome-high">
              {application.requestedLimit != null ? `$${application.requestedLimit.toLocaleString()}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-afs-chrome-mid">Requested Terms</dt>
            <dd className="font-data text-afs-chrome-high">
              {application.requestedTerms != null ? `Net ${application.requestedTerms}` : '—'}
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="approved-limit">
              Approved Limit ($)
            </label>
            <input
              id="approved-limit"
              type="number"
              min="0"
              step="0.01"
              value={approvedLimit}
              onChange={(e) => setApprovedLimit(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="approved-terms">
              Approved Terms
            </label>
            <select
              id="approved-terms"
              value={approvedTerms}
              onChange={(e) => setApprovedTerms(e.target.value)}
              className={inputClass}
            >
              <option value="15">Net 15</option>
              <option value="30">Net 30</option>
              <option value="60">Net 60</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className={labelClass} htmlFor="reviewer-notes">
            Reviewer Notes
          </label>
          <textarea
            id="reviewer-notes"
            rows={3}
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Internal notes — reason for the decision"
            className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body resize-y"
          />
        </div>

        {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high px-3 py-2"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => submit('deny')}
              disabled={submitting !== null}
              className="bg-afs-crimson-dim hover:bg-afs-crimson text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {submitting === 'deny' ? 'Denying…' : 'Deny'}
            </button>
            <button
              type="button"
              onClick={() => submit('approve')}
              disabled={submitting !== null || approvedLimit.trim() === ''}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {submitting === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
