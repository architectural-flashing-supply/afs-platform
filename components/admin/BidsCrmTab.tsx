'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import {
  isClaimActive,
  formatClaimAge,
  type BidDocumentRow,
  type BidDocumentStatus,
} from '@/lib/data/bid-documents';

interface BidsCrmTabProps {
  bids: BidDocumentRow[];
  currentUserId: string;
}

const STATUS_VARIANT: Record<BidDocumentStatus, BadgeVariant> = {
  draft: 'chrome',
  sent: 'info',
  awarded: 'success',
  lost: 'error',
  expired: 'error',
  withdrawn: 'chrome',
};

const STATUS_LABEL: Record<BidDocumentStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  awarded: 'Awarded',
  lost: 'Lost',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function claimLabel(bid: BidDocumentRow, currentUserId: string): string {
  if (!isClaimActive(bid.claimedBy, bid.lastActivityAt)) return 'Unclaimed';
  if (bid.claimedBy === currentUserId) return 'Claimed by you';
  return `Claimed by ${bid.claimedByName ?? 'someone'} · ${formatClaimAge(bid.claimedAt as string)}`;
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-chrome-base rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

export default function BidsCrmTab({ bids, currentUserId }: BidsCrmTabProps) {
  const router = useRouter();
  const [showNewBid, setShowNewBid] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [gcName, setGcName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!projectName.trim() || !gcName.trim()) {
      setError('Project name and GC name are both required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/bid-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: projectName.trim(), gcName: gcName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; bidId?: string };
      if (!res.ok || !data.bidId) {
        setError(data.error ?? 'Could not create this bid.');
        setSubmitting(false);
        return;
      }
      router.push(`/admin/command-center/bids/${data.bidId}`);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="font-body text-sm text-afs-chrome-mid">Project-level bid documents priced by hand for GCs.</p>
        <button
          type="button"
          onClick={() => setShowNewBid(true)}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors"
        >
          + New Bid
        </button>
      </div>

      {bids.length === 0 ? (
        <EmptyState title="No bid documents yet" description="Create a bid to start pricing it for a GC." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Bid #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Project
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  GC
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Status
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Claim
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr
                  key={bid.id}
                  onClick={() => router.push(`/admin/command-center/bids/${bid.id}`)}
                  className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors cursor-pointer"
                >
                  <td className="font-data text-xs text-afs-danger-on-dark px-4 py-3">{bid.bidNumber}</td>
                  <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{bid.projectName}</td>
                  <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{bid.gcName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[bid.status]}>{STATUS_LABEL[bid.status]}</Badge>
                  </td>
                  <td className="font-body text-xs text-afs-chrome-mid px-4 py-3">{claimLabel(bid, currentUserId)}</td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                    {bid.subtotal != null ? currency.format(bid.subtotal) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewBid && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => !submitting && setShowNewBid(false)}
        >
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg text-afs-chrome-high mb-4">New Bid</h3>

            <div className="mb-4">
              <label className={labelClass} htmlFor="new-bid-project">
                Project Name
              </label>
              <input
                id="new-bid-project"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="NBISD Long Creek Ph 1"
                className={inputClass}
              />
            </div>

            <div className="mb-4">
              <label className={labelClass} htmlFor="new-bid-gc">
                GC Name
              </label>
              <input
                id="new-bid-gc"
                type="text"
                value={gcName}
                onChange={(e) => setGcName(e.target.value)}
                placeholder="Omega Waterproofing"
                className={inputClass}
              />
            </div>

            {error && <p className="font-body text-xs text-afs-danger-on-dark mb-3">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowNewBid(false)}
                className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreate}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create Bid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
