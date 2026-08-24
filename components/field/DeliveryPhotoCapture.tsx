'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

type PhotoState = 'idle' | 'uploading' | 'queuing' | 'done' | 'failed';

interface ApiErrorResponse {
  error: string;
}

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null && 'error' in data && typeof (data as ApiErrorResponse).error === 'string';
}

// Exact literal the prompt requires. Posting stays gated behind the same
// review-then-post flow Employee PWA photos already go through
// (app/employee/photos/page.tsx -> app/api/gbp/post/[id]/route.ts) — this
// button only adds a second way to QUEUE a photo, not a second way to post
// one, and postPhotoToGbp() is never called from here.
const QUEUED_MESSAGE =
  'Photo saved and added to the Google Business Profile review queue. Will post once reviewed and API access is approved.';

/**
 * Delivery Photo capture for a /field/shop job (afs-fl-004), independent
 * from ShopJobCompletionList's Mark Complete action — a job can get a
 * delivery photo without being marked complete and vice versa.
 *
 * Reuses the SAME 'gbp-photos' Storage bucket + gbp_photo_queue pipeline
 * already in production for the Employee PWA (components/employee/
 * EmployeePhotoUploader.tsx -> app/api/gbp/queue/route.ts): this upload
 * mechanism (client-side upload to 'gbp-photos' with the operator's own
 * session, then POST /api/gbp/queue) is mirrored exactly from that
 * component, not reinvented. The only addition is passing this job's
 * shopProfileLibraryId through to the queue route, which sets the new
 * nullable gbp_photo_queue.shop_profile_library_id column (migration 021).
 * The photo enters the SAME review queue Steve/admin already uses at
 * /employee/photos — there is no separate review UI here.
 */
export default function DeliveryPhotoCapture({ shopProfileLibraryId }: { shopProfileLibraryId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PhotoState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;

    setError(null);
    setState('uploading');

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Your session expired. Please sign in again.');
        setState('failed');
        return;
      }

      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const storageKey = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('gbp-photos')
        .upload(storageKey, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) {
        console.error('[Delivery Photo Upload Error]', uploadError);
        setError('Upload failed. Please try again.');
        setState('failed');
        return;
      }

      setState('queuing');
      const res = await fetch('/api/gbp/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, shopProfileLibraryId }),
      });
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok || !data || isApiError(data)) {
        setError(isApiError(data) ? data.error : 'Could not queue this photo. Please try again.');
        setState('failed');
        return;
      }

      setState('done');
    } catch {
      setError('Could not queue this photo. Please try again.');
      setState('failed');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {state === 'done' ? (
        <p className="font-body text-sm text-afs-chrome-high">{QUEUED_MESSAGE}</p>
      ) : (
        <>
          {error && <p className="font-body text-sm text-afs-crimson">{error}</p>}
          <Button
            variant="secondary"
            className="w-full py-4 text-lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={state === 'uploading' || state === 'queuing'}
          >
            {state === 'uploading' ? 'Uploading…' : state === 'queuing' ? 'Queuing…' : 'Delivery Photo'}
          </Button>
        </>
      )}
    </div>
  );
}
