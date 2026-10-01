'use client';

import { useRef, useState } from 'react';

/**
 * "LOG A SUPPLIER PRICE CHANGE" — Settings.
 *
 * Supplier, material, old cost, new cost, effective date, a note, and an
 * optional attached file. It writes one row into the append-only pricing
 * ledger — the same row Phase 4's deferred mail parser will write
 * automatically when it reads a supplier's emailed notice, which is why the
 * fields are exactly these and not more.
 *
 * multipart/form-data, because of the attachment. The dark gunmetal surface
 * here is the rest of Settings, not the light working area — placeholder text
 * is therefore afs-chrome-silver, never afs-chrome-dim, which fails WCAG AA on
 * every gunmetal surface in the palette (CLAUDE.md rule #18).
 */
export default function SupplierPriceChangeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/supplier-price-change', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : 'Recorded.' });
        formRef.current?.reset();
      } else {
        setMessage({
          tone: 'error',
          text: typeof data.error === 'string' ? data.error : 'That did not save.',
        });
      }
    } catch {
      setMessage({ tone: 'error', text: 'The connection dropped, so nothing was recorded.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      data-testid="supplier-price-change-form"
      className="bg-afs-bg-raised border border-afs-border rounded p-5 flex flex-col gap-4"
    >
      <p className="font-body text-sm text-afs-chrome-mid">
        When a supplier tells you a price is going up, record it here. It never changes a price on
        its own — it is the history the pricing engine will learn from.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="supplierName" label="Supplier" placeholder="e.g. Metal Sales" required />
        <Field id="material" label="Material" placeholder="e.g. Galvalume" required />
        <Field id="gauge" label="Gauge (optional)" placeholder="e.g. 24 GA" />
        <Field id="effectiveDate" label="Effective date" type="date" />
        <Field id="oldCost" label="Old cost" placeholder="240.00" inputMode="decimal" />
        <Field id="newCost" label="New cost" placeholder="268.50" inputMode="decimal" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="font-label text-xs font-bold text-afs-chrome-high">
          Note
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          placeholder="What they said, and anything worth remembering."
          className="font-body text-sm rounded border border-afs-chrome-base bg-afs-bg-base text-afs-chrome-high p-3 placeholder:text-afs-chrome-silver"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="attachment" className="font-label text-xs font-bold text-afs-chrome-high">
          Attach their letter or email (optional)
        </label>
        <input
          id="attachment"
          name="attachment"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.eml"
          className="font-body text-sm text-afs-chrome-silver min-h-11 file:mr-3 file:min-h-11 file:px-4 file:rounded file:border-0 file:bg-afs-btn-secondary file:text-afs-chrome-high file:font-label"
        />
        <p className="font-body text-xs text-afs-chrome-mid">
          PDF, image, plain text or a saved email, up to 10 MB. If the file will not upload, the
          figures are still recorded.
        </p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="min-h-12 px-5 rounded font-label font-bold bg-afs-crimson text-afs-chrome-high hover:bg-afs-crimson-hover disabled:opacity-70 self-start"
      >
        {busy ? 'Recording…' : 'Log this price change'}
      </button>

      {message && (
        <p
          role="status"
          data-testid="supplier-price-change-result"
          className={`font-body text-sm rounded p-3 ${
            message.tone === 'error'
              ? 'bg-afs-bg-base text-afs-danger-on-dark'
              : 'bg-afs-bg-base text-afs-chrome-high'
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  placeholder,
  type = 'text',
  required,
  inputMode,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  inputMode?: 'decimal' | 'text';
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-label text-xs font-bold text-afs-chrome-high">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        className="min-h-11 font-body text-sm rounded border border-afs-chrome-base bg-afs-bg-base text-afs-chrome-high px-3 placeholder:text-afs-chrome-silver"
      />
    </div>
  );
}
