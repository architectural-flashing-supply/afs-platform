'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminOrderAttachment } from '@/lib/data/orders';

interface PreShipPhotoSectionProps {
  orderId: string;
  photos: AdminOrderAttachment[];
}

export default function PreShipPhotoSection({ orderId, photos }: PreShipPhotoSectionProps) {
  const router = useRouter();
  const [localPhotos, setLocalPhotos] = useState(photos);
  const [file, setFile] = useState<File | null>(null);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('notifyCustomer', String(notifyCustomer));
      const res = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string; attachment?: AdminOrderAttachment };
      if (!res.ok || !data.attachment) {
        setError(data.error ?? 'Upload failed.');
        return;
      }
      setLocalPhotos((prev) => [data.attachment as AdminOrderAttachment, ...prev]);
      setFile(null);
      router.refresh();
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Pre-Ship Photos</h2>

      <div className="flex flex-col gap-3 mb-6">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="font-body text-sm text-afs-chrome-mid file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:font-label file:text-sm file:font-semibold file:bg-afs-bg-overlay file:text-afs-chrome-high hover:file:bg-afs-bg-surface"
        />
        <label className="flex items-center gap-2 font-body text-sm text-afs-chrome-mid">
          <input
            type="checkbox"
            checked={notifyCustomer}
            onChange={(e) => setNotifyCustomer(e.target.checked)}
            className="accent-afs-crimson"
          />
          Notify customer
        </label>
        {error && <p className="font-body text-xs text-afs-danger-on-dark">{error}</p>}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="self-start bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload Photos'}
        </button>
      </div>

      {localPhotos.length === 0 ? (
        <p className="font-body text-sm text-afs-chrome-mid">No pre-ship photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {localPhotos.map((photo) => (
            <a
              key={photo.id}
              href={photo.signedUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="block aspect-square bg-afs-bg-overlay border border-afs-border rounded overflow-hidden"
            >
              {photo.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.signedUrl} alt={photo.filename} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-body text-xs text-afs-chrome-silver px-2 text-center">
                  {photo.filename}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
