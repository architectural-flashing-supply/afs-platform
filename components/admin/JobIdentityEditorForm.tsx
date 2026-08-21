'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JobIdentityEditorFormProps {
  requestId: string;
  initial: {
    clientBusinessName: string | null;
    clientName: string | null;
    poNumber: string | null;
    requestedBy: string | null;
  };
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

// Matches CustomerAccountSettingsForm.tsx's pattern (local state, dirty
// tracking, PATCH on save, router.refresh()) — reused here rather than
// invented fresh, per this task's instruction to follow an existing
// admin-page editable-field convention. app/admin/quote-requests/[id]/page.tsx
// was entirely read-only before this component (afs-jf-003).
export default function JobIdentityEditorForm({ requestId, initial }: JobIdentityEditorFormProps) {
  const router = useRouter();
  const [clientBusinessName, setClientBusinessName] = useState(initial.clientBusinessName ?? '');
  const [clientName, setClientName] = useState(initial.clientName ?? '');
  const [poNumber, setPoNumber] = useState(initial.poNumber ?? '');
  const [requestedBy, setRequestedBy] = useState(initial.requestedBy ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    clientBusinessName !== (initial.clientBusinessName ?? '') ||
    clientName !== (initial.clientName ?? '') ||
    poNumber !== (initial.poNumber ?? '') ||
    requestedBy !== (initial.requestedBy ?? '');

  async function handleSave() {
    if (!dirty) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/quote-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientBusinessName, clientName, poNumber, requestedBy }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save these fields.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not save these fields.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Job Identity</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass} htmlFor="clientBusinessName">
            Business Name
          </label>
          <input
            id="clientBusinessName"
            type="text"
            value={clientBusinessName}
            onChange={(e) => setClientBusinessName(e.target.value)}
            placeholder="—"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientName">
            Client Name
          </label>
          <input
            id="clientName"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="—"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="poNumber">
            PO Number
          </label>
          <input
            id="poNumber"
            type="text"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="—"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="requestedBy">
            Requested By
          </label>
          <input
            id="requestedBy"
            type="text"
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value)}
            placeholder="—"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
          {saved && !error && <p className="font-body text-xs text-afs-success">Saved.</p>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || !dirty}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save Job Identity'}
        </button>
      </div>
    </div>
  );
}
