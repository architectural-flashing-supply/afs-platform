'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';

export interface EmployeeQueuedPhoto {
  id: string;
  caption: string | null;
  status: string;
  thumbnailUrl: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  posted: 'Posted',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending_review: 'warning',
  approved: 'success',
  rejected: 'error',
  posted: 'chrome',
};

interface EmployeePhotoUploaderProps {
  initialPhotos: EmployeeQueuedPhoto[];
}

export default function EmployeePhotoUploader({ initialPhotos }: EmployeePhotoUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    setFile(null);
    setCaption('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    setSuccessMessage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleQueue() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const storageKey = `${user.id}/${crypto.randomUUID()}.${ext}`;

      // Uploads with the operator's own session (not the service-role
      // client) per SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §3/§8's
      // client-uploads-then-POSTs-storageKey flow. This requires a
      // storage.objects RLS policy on the 'gbp-photos' bucket granting
      // authenticated operators INSERT — no migration in this repo creates
      // that bucket or its policies yet (unlike the 'orders' bucket's
      // server-side-only upload route), so the bucket + policy need to be
      // provisioned in Supabase before this upload will succeed.
      const { error: uploadError } = await supabase.storage
        .from('gbp-photos')
        .upload(storageKey, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) {
        console.error('[GBP Photo Upload Error]', uploadError);
        setError('Upload failed. Please try again.');
        return;
      }

      const res = await fetch('/api/gbp/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, caption }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not queue this photo.');
        return;
      }

      setSuccessMessage('Photo queued for review');
      resetForm();
      router.refresh();
    } catch {
      setError('Could not queue this photo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-4 rounded bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-base transition-colors"
      >
        Take Photo
      </button>

      {previewUrl && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-4 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not an optimizable remote asset */}
          <img src={previewUrl} alt="Photo preview" className="w-full rounded object-cover max-h-64" />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption for this job photo…"
            rows={3}
            className="bg-afs-bg-overlay border border-afs-border rounded p-3 text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:border-afs-crimson outline-none resize-none"
          />
          <button
            type="button"
            onClick={handleQueue}
            disabled={uploading}
            className="w-full py-4 rounded bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-base transition-colors disabled:opacity-50"
          >
            {uploading ? 'Queuing…' : 'Queue for Upload'}
          </button>
        </div>
      )}

      {successMessage && <p className="font-body text-sm text-afs-success text-center">{successMessage}</p>}
      {error && <p className="font-body text-sm text-afs-crimson text-center">{error}</p>}

      <div className="flex flex-col gap-3 mt-2">
        {initialPhotos.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid text-center py-6">No photos queued yet.</p>
        ) : (
          initialPhotos.map((photo) => (
            <div key={photo.id} className="bg-afs-bg-raised border border-afs-border rounded p-3 flex items-center gap-3">
              {photo.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not worth next/image's remote-pattern config
                <img src={photo.thumbnailUrl} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded bg-afs-bg-overlay shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-afs-chrome-high truncate">{photo.caption || 'No caption'}</p>
                <Badge variant={STATUS_VARIANT[photo.status] ?? 'chrome'}>{STATUS_LABEL[photo.status] ?? photo.status}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
