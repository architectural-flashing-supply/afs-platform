'use client';

import { useState } from 'react';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import type { GbpPhotoRow, GbpPhotoStatus } from '@/lib/data/command-center-crm';

interface GbpPhotosTabProps {
  photos: GbpPhotoRow[];
  gbpConfigured: boolean;
}

const STATUS_VARIANT: Record<GbpPhotoStatus, BadgeVariant> = {
  pending_review: 'warning',
  approved: 'success',
  rejected: 'error',
  posted: 'info',
};

const STATUS_LABEL: Record<GbpPhotoStatus, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  posted: 'Posted',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GbpPhotosTab({ photos: initialPhotos, gbpConfigured }: GbpPhotosTabProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [postConfirmId, setPostConfirmId] = useState<string | null>(null);

  async function callAction(id: string, path: string, nextStatus: GbpPhotoStatus): Promise<void> {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(path, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: data.error ?? 'Something went wrong.' }));
        return;
      }
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)));
    } catch {
      setRowError((prev) => ({ ...prev, [id]: 'Network error.' }));
    } finally {
      setBusyId(null);
      setPostConfirmId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        title="No photos queued"
        description="Photos queued from the Employee PWA for Google Business Profile posting will appear here."
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => {
          const busy = busyId === photo.id;
          return (
            <div key={photo.id} className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
              <div className="aspect-video bg-afs-bg-overlay">
                {photo.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.signedUrl} alt={photo.caption ?? 'Queued photo'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-body text-xs text-afs-chrome-dim px-2 text-center">
                    Image unavailable
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-body text-sm text-afs-chrome-high">{photo.caption || 'No caption'}</p>
                  <Badge variant={STATUS_VARIANT[photo.status]}>{STATUS_LABEL[photo.status]}</Badge>
                </div>
                <p className="font-data text-xs text-afs-chrome-dim mb-3">
                  Queued by {photo.queuedByName ?? 'Unknown'} · {formatDate(photo.queuedAt)}
                </p>

                {rowError[photo.id] && <p className="font-body text-xs text-afs-crimson mb-2">{rowError[photo.id]}</p>}

                {photo.status === 'pending_review' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => callAction(photo.id, `/api/admin/gbp/${photo.id}/approve`, 'approved')}
                      className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => callAction(photo.id, `/api/admin/gbp/${photo.id}/reject`, 'rejected')}
                      className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {photo.status === 'approved' && (
                  <button
                    type="button"
                    disabled={!gbpConfigured}
                    title={gbpConfigured ? undefined : 'Configure Google OAuth in Settings before posting'}
                    onClick={() => setPostConfirmId(photo.id)}
                    className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  >
                    Post to Google Business
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {postConfirmId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setPostConfirmId(null)}
        >
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg text-afs-chrome-high mb-3">Post to Google Business</h3>
            <p className="font-body text-sm text-afs-chrome-mid mb-4">
              Post this photo to AFS Google Business Profile?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPostConfirmId(null)}
                className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === postConfirmId}
                onClick={() => callAction(postConfirmId, `/api/gbp/post/${postConfirmId}`, 'posted')}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
