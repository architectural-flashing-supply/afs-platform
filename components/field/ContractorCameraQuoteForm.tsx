'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FIELD_PHOTO_MAX_SIZE_BYTES } from '@/lib/field/field-photo-limits';
import type { FieldPhotoSignResponse } from '@/app/api/field/photo-upload/route';

type UploadState = 'idle' | 'uploading' | 'ready' | 'failed';
type SubmitState = 'idle' | 'submitting' | 'submitted' | 'failed';

interface ApiErrorResponse {
  error: string;
}

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null && 'error' in data && typeof (data as ApiErrorResponse).error === 'string';
}

// Resolves to the confirmed uploadId once the photo has actually landed in
// Storage, or null if the upload failed — the Send button (handleSubmit
// below) awaits this instead of requiring a separate "wait for upload" tap,
// so the golden path stays exactly two taps (camera, then Send) even if the
// upload is still in flight when Send is pressed.
async function uploadPhoto(file: File, onError: (message: string) => void): Promise<string | null> {
  try {
    const signRes = await fetch('/api/field/photo-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, fileSize: file.size }),
    });
    const signData = (await signRes.json().catch(() => null)) as FieldPhotoSignResponse | ApiErrorResponse | null;
    if (!signRes.ok || !signData || isApiError(signData)) {
      onError(signData && isApiError(signData) ? signData.error : 'Could not prepare photo upload.');
      return null;
    }

    const supabase = createClient();
    const { error: storageError } = await supabase.storage
      .from('documents')
      .uploadToSignedUrl(signData.storageKey, signData.token, file);
    if (storageError) {
      onError(`Photo upload failed: ${storageError.message}`);
      return null;
    }

    return signData.uploadId;
  } catch {
    onError('Photo upload failed. Check your connection and try again.');
    return null;
  }
}

export default function ContractorCameraQuoteForm() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [clientBusinessName, setClientBusinessName] = useState('');
  const [jobName, setJobName] = useState('');
  const [clientName, setClientName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const handleFileChange = useCallback((file: File) => {
    if (file.size > FIELD_PHOTO_MAX_SIZE_BYTES) {
      setUploadError(`Photo exceeds ${FIELD_PHOTO_MAX_SIZE_BYTES / 1024 / 1024}MB.`);
      setUploadState('failed');
      return;
    }

    setPhoto(file);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setUploadError(null);
    setSubmitError(null);
    setUploadState('uploading');

    const promise = uploadPhoto(file, (message) => {
      setUploadError(message);
      setUploadState('failed');
    }).then((uploadId) => {
      if (uploadId) setUploadState('ready');
      return uploadId;
    });
    uploadPromiseRef.current = promise;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!photo) return;
    setSubmitError(null);
    setSubmitState('submitting');

    const uploadId = await uploadPromiseRef.current;
    if (!uploadId) {
      setSubmitState('idle');
      setSubmitError(uploadError ?? 'Photo upload failed. Retake the photo and try again.');
      return;
    }

    try {
      const res = await fetch('/api/field/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          clientBusinessName: clientBusinessName.trim() || null,
          jobName: jobName.trim() || null,
          clientName: clientName.trim() || null,
          poNumber: poNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { requestNumber: string } | ApiErrorResponse | null;
      if (!res.ok || !data || isApiError(data)) {
        setSubmitError(data && isApiError(data) ? data.error : 'Submission failed. Please try again.');
        setSubmitState('failed');
        return;
      }
      setRequestNumber(data.requestNumber);
      setSubmitState('submitted');
    } catch {
      setSubmitError('Submission failed. Please try again.');
      setSubmitState('failed');
    }
  };

  const resetToIdle = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhoto(null);
    setPhotoPreviewUrl(null);
    setUploadState('idle');
    setUploadError(null);
    uploadPromiseRef.current = null;
    setClientBusinessName('');
    setJobName('');
    setClientName('');
    setPoNumber('');
    setNotes('');
    setSubmitState('idle');
    setSubmitError(null);
    setRequestNumber(null);
  };

  if (submitState === 'submitted') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-3xl uppercase tracking-wide text-afs-chrome-high">
          Request Sent
        </h1>
        <p className="font-body text-base text-afs-chrome-mid">
          Quote request <span className="text-afs-chrome-high">{requestNumber}</span> is on its
          way to AFS. An estimator will follow up with a formal quote.
        </p>
        <Button className="mt-4 w-full max-w-xs" onClick={resetToIdle}>
          Send Another Photo
        </Button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-center font-heading text-3xl uppercase tracking-wide text-afs-chrome-high">
        Field — Contractor
      </h1>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />

      {!photo ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-afs-border bg-afs-bg-overlay px-6 py-16 font-label text-lg uppercase tracking-wide text-afs-chrome-high transition-colors hover:border-afs-crimson"
        >
          <span aria-hidden className="text-5xl">📷</span>
          Take a Photo
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {photoPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not a next/image-eligible remote asset
            <img
              src={photoPreviewUrl}
              alt="Jobsite photo to submit with this quote request"
              className="w-full rounded-lg border border-afs-border object-cover"
            />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-label text-sm uppercase tracking-wide text-afs-chrome-mid underline"
          >
            Retake Photo
          </button>
          {uploadState === 'uploading' && (
            <p className="font-body text-sm text-afs-chrome-mid">Uploading photo…</p>
          )}
          {uploadState === 'failed' && uploadError && (
            <p className="font-body text-sm text-afs-crimson">{uploadError}</p>
          )}
        </div>
      )}

      {photo && (
        <div className="flex flex-col gap-4">
          <Input
            label="Business Name"
            placeholder="Optional"
            value={clientBusinessName}
            onChange={(e) => setClientBusinessName(e.target.value)}
          />
          <Input
            label="Job Name"
            placeholder="Optional"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
          />
          <Input
            label="Client Name"
            placeholder="Optional"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <Input
            label="PO Number"
            placeholder="Optional"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
          <div>
            <label className="mb-1.5 block font-label text-xs uppercase tracking-wide text-afs-chrome-mid" htmlFor="field-notes">
              Notes
            </label>
            <textarea
              id="field-notes"
              placeholder="Optional"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-afs-border bg-afs-bg-overlay px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:border-afs-crimson focus:outline-none"
            />
          </div>

          {submitError && <p className="font-body text-sm text-afs-crimson">{submitError}</p>}

          <Button
            className="w-full py-4 text-lg"
            onClick={handleSubmit}
            disabled={submitState === 'submitting' || uploadState === 'failed'}
          >
            {submitState === 'submitting' ? 'Sending…' : 'Send'}
          </Button>
        </div>
      )}
    </main>
  );
}
