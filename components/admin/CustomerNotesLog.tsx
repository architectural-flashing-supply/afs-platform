'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerNote } from '@/lib/data/customers';

interface CustomerNotesLogProps {
  customerId: string;
  notes: CustomerNote[];
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Append-only per SPEC_CUSTOMER_MANAGEMENT.md §2 — notes are never editable after saved. */
export default function CustomerNotesLog({ customerId, notes }: CustomerNotesLogProps) {
  const router = useRouter();
  const [localNotes, setLocalNotes] = useState(notes);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddNote() {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: text.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; notes?: CustomerNote[] };
      if (!res.ok) {
        setError(data.error ?? 'Could not save this note.');
        return;
      }
      setLocalNotes(data.notes ?? []);
      setText('');
      router.refresh();
    } catch {
      setError('Could not save this note.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Admin Notes</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Internal note about this customer — not visible to them"
        className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body resize-y mb-3"
      />
      <div className="flex items-center justify-between mb-4 gap-4">
        {error && <p className="font-body text-xs text-afs-danger-on-dark">{error}</p>}
        <button
          type="button"
          onClick={handleAddNote}
          disabled={submitting || !text.trim()}
          className="ml-auto bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2 rounded text-sm transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Add Note'}
        </button>
      </div>

      {localNotes.length === 0 ? (
        <p className="font-body text-sm text-afs-chrome-mid">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {localNotes.map((note, i) => (
            <li key={i} className="border-t border-afs-border pt-3 first:border-t-0 first:pt-0">
              <p className="font-body text-sm text-afs-chrome-high whitespace-pre-line">{note.text}</p>
              <p className="font-data text-xs text-afs-chrome-silver mt-1">
                {note.author}
                {note.at ? ` · ${formatTimestamp(note.at)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
