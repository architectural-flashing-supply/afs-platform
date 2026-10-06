'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Outcome { status: string; quoteRequestId?: string; itemCount?: number; reason?: string; error?: string }

/** Drop or choose a .eml (Outlook: drag the message to the desktop, or File > Save As > .msg is NOT supported - use .eml). */
export default function EmlUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [over, setOver] = useState(false);

  async function send(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/email-intake/ingest', { method: 'POST', body: form });
      const j = (await r.json()) as Outcome;
      setResult(r.ok ? j : { status: 'failed', error: j.error ?? 'Failed' });
      router.refresh();
    } catch {
      setResult({ status: 'failed', error: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  const message = (o: Outcome) => {
    switch (o.status) {
      case 'drafted': return `Drafted a quote request with ${o.itemCount} AI-read item${o.itemCount === 1 ? '' : 's'}.`;
      case 'needs_manual_takeoff': return 'Created a job, but the AI could not read any items. Needs a manual takeoff.';
      case 'duplicate': return 'Already received: this exact email was processed before. Nothing new was created.';
      case 'attached_to_thread': return 'Attached to the existing job for this email thread.';
      case 'ignored': return `Not an order, so no job was created (${o.reason ?? 'classified as non-order'}). Use "Treat as order" in the list below if that is wrong.`;
      default: return o.error ?? 'Could not process that email.';
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void send(f); }}
      className={`rounded border-2 border-dashed p-6 text-center ${over ? 'border-blue-600 bg-blue-50' : 'border-neutral-400 bg-white'}`}
    >
      <p className="mb-2 text-sm text-neutral-700">Drop an email file (.eml) here to run it through the AI quote pipeline.</p>
      <label className="inline-block cursor-pointer rounded bg-neutral-900 px-4 py-2 text-sm text-white">
        {busy ? 'Reading the email…' : 'Choose .eml file'}
        <input data-testid="eml-input" type="file" accept=".eml,message/rfc822" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); e.target.value = ''; }} />
      </label>
      {result && (
        <p role="status" data-testid="eml-result" className={`mt-3 text-sm ${result.status === 'failed' ? 'text-red-700' : 'text-neutral-900'}`}>
          {message(result)}{' '}
          {result.quoteRequestId && <a className="underline" href={`/admin/quote-requests/${result.quoteRequestId}/source`}>View Source</a>}
        </p>
      )}
    </div>
  );
}
