'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCents, parseDollarsToCents } from '@/lib/pricing/quote-math';
import { PRICE_BOOK_FIELD_LABELS, type PriceBookField, type ResolvedPriceBookRow } from '@/lib/pricing/types';

/**
 * THE PRICE BOOK, editable by Steve at any time.
 *
 * ================== A BLANK IS A BLANK ==================
 *
 * An unfilled price renders as the words "Not set" on an amber background, with
 * a screen-reader label that says so — NOT as "$0.00", not as an empty cell
 * somebody could read as free, and not as a placeholder number. Clearing a box
 * and saving stores NULL again. That is the whole reason the editor exists as
 * its own component rather than a generic form: "0" and "blank" are different
 * facts about money, and every generic form conflates them.
 *
 * ================== EVERY SAVE IS A NEW VERSION ==================
 *
 * Saving does not overwrite. It writes a new price with a START DATE — today by
 * default, or a date Steve picks, so next month's increase can be entered now
 * and start then. The old prices stay, and every quote already sent keeps the
 * ones it was built on. The panel says so above the button, because a
 * non-technical reader has no reason to assume it.
 *
 * ================== CONTRAST ==================
 *
 * Light working area. Body text is afs-ink-900 (18.9:1 on afs-bg-card) and
 * afs-ink-700 (10.3:1); control borders are afs-line-strong (3.1:1, the 3:1
 * rule for UI components); the "Not set" marker is afs-amber-ink on
 * afs-amber-bg (7.1:1).
 *
 * PLACEHOLDER TEXT HERE IS afs-ink-700, NOT afs-chrome-silver. CLAUDE.md rule
 * #18 names chrome-silver as the placeholder colour, and that is right ON
 * GUNMETAL — where it measures 4.80:1 at worst. On this WHITE card it measures
 * **1.55:1**, which is worse than the 1.94:1 failure v2-02 existed to fix. The
 * rule is "4.5:1 against the surface it is actually on", and the surface
 * decides the token: chrome-silver on dark, ink-700 (10.3:1) on light.
 * lib/design/placeholder-contrast.test.ts computes both from
 * tailwind.config.js and holds this file to it.
 */

const FIELDS: PriceBookField[] = ['sheetCostCents', 'perBendCents', 'perHemCents', 'extrasCents'];

type Draft = Record<PriceBookField, string> & { effectiveFrom: string; note: string };

function draftFrom(row: ResolvedPriceBookRow, today: string): Draft {
  const value = (field: PriceBookField): string => {
    const cents = row.version ? row.version[field] : null;
    return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
  };
  return {
    sheetCostCents: value('sheetCostCents'),
    perBendCents: value('perBendCents'),
    perHemCents: value('perHemCents'),
    extrasCents: value('extrasCents'),
    effectiveFrom: today,
    note: '',
  };
}

export default function PriceBookEditor({
  rows,
  today,
}: {
  rows: ResolvedPriceBookRow[];
  today: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [newMaterial, setNewMaterial] = useState('');
  const [newGauge, setNewGauge] = useState('');

  async function post(label: string, body: Record<string, unknown>) {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/price-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : 'Saved.' });
        setOpenId(null);
        setDraft(null);
        router.refresh();
        return true;
      }
      setMessage({ tone: 'error', text: typeof data.error === 'string' ? data.error : 'That did not save.' });
      return false;
    } catch {
      setMessage({ tone: 'error', text: 'The connection dropped, so nothing was changed.' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  function save(row: ResolvedPriceBookRow) {
    if (!draft) return;
    const body: Record<string, unknown> = {
      action: 'set-prices',
      itemId: row.item.id,
      effectiveFrom: draft.effectiveFrom,
      note: draft.note,
    };
    for (const field of FIELDS) {
      const parsed = parseDollarsToCents(draft[field]);
      if (parsed === 'invalid') {
        setMessage({
          tone: 'error',
          text: `${PRICE_BOOK_FIELD_LABELS[field]} needs to be a dollar amount like 240 or 240.50 — or left empty to keep it blank.`,
        });
        return;
      }
      // null goes to the server as null, and is stored as a blank. This is the
      // line that keeps "blank" from becoming "zero".
      body[field] = parsed;
    }
    void post(`save-${row.item.id}`, body);
  }

  const active = rows.filter((r) => r.item.retiredAt === null);
  const retired = rows.filter((r) => r.item.retiredAt !== null);
  const unpriced = active.filter((r) => !r.isComplete).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-2">
        <p className="font-body text-[15px] text-afs-ink-900">
          One row per material and gauge. Fill in what a 10 × 4 ft sheet costs you, what you charge
          for a bend and for a hem, and anything extra.
        </p>
        <p className="font-body text-[15px] text-afs-ink-700">
          Saving never overwrites an old price — it starts a new one from the date you choose.{' '}
          <strong className="text-afs-ink-900">Quotes you have already sent keep the prices they were built on.</strong>
        </p>
        {unpriced > 0 && (
          <p data-testid="price-book-unpriced-count" className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded-lg p-3">
            {unpriced} of {active.length} rows still have prices to fill in. A job using one of those
            cannot be quoted until it is filled in — a blank is never treated as zero.
          </p>
        )}
      </div>

      {message && (
        <p
          role="status"
          data-testid="price-book-message"
          className={`font-body text-[15px] rounded-lg p-3 ${
            message.tone === 'error' ? 'bg-afs-bg-light-raised text-afs-crimson' : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="bg-afs-bg-card border border-afs-border-light rounded-xl overflow-x-auto">
        <table className="w-full border-collapse min-w-[720px]">
          <caption className="sr-only">The price book, one row per material and gauge</caption>
          <thead>
            <tr className="border-b border-afs-line-strong">
              <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                Material
              </th>
              <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                Gauge
              </th>
              {/* nowrap so "Sheet cost (10 × 4 ft)" does not fold onto three
                  lines and squeeze the money columns into two-line chips. The
                  table already scrolls horizontally below 720px. */}
              {FIELDS.map((f) => (
                <th
                  key={f}
                  scope="col"
                  className="font-label text-sm font-bold text-afs-ink-900 text-right p-3 whitespace-nowrap"
                >
                  {PRICE_BOOK_FIELD_LABELS[f]}
                </th>
              ))}
              <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                In force from
              </th>
              <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {active.map((row) => {
              const isOpen = openId === row.item.id;
              return (
                <tr
                  key={row.item.id}
                  data-testid="price-book-row"
                  data-material={row.item.material}
                  data-gauge={row.item.gauge}
                  data-complete={row.isComplete ? 'true' : 'false'}
                  className="border-b border-afs-border-light align-top"
                >
                  <td className="font-body text-[15px] text-afs-ink-900 p-3">{row.item.material}</td>
                  <td className="font-body text-[15px] text-afs-ink-900 p-3">{row.item.gauge}</td>
                  {FIELDS.map((field) => (
                    <td key={field} className="p-3 text-right">
                      {isOpen && draft ? (
                        <>
                          <label className="sr-only" htmlFor={`${row.item.id}-${field}`}>
                            {PRICE_BOOK_FIELD_LABELS[field]} for {row.item.material} {row.item.gauge}
                          </label>
                          <input
                            id={`${row.item.id}-${field}`}
                            data-testid={`price-input-${field}`}
                            type="text"
                            inputMode="decimal"
                            value={draft[field]}
                            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                            placeholder="Leave blank"
                            className="w-28 min-h-11 text-right rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-data px-2 placeholder:text-afs-ink-700"
                          />
                        </>
                      ) : (
                        <PriceCell
                          cents={row.version ? row.version[field] : null}
                          field={field}
                          material={row.item.material}
                          gauge={row.item.gauge}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-3 text-right font-data text-[15px] text-afs-ink-700 whitespace-nowrap">
                    {isOpen && draft ? (
                      <>
                        <label className="sr-only" htmlFor={`${row.item.id}-from`}>
                          These prices start on
                        </label>
                        <input
                          id={`${row.item.id}-from`}
                          data-testid="price-effective-from"
                          type="date"
                          value={draft.effectiveFrom}
                          onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
                          className="min-h-11 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-data px-2"
                        />
                      </>
                    ) : (
                      row.version?.effectiveFrom ?? '—'
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {isOpen ? (
                      <span className="inline-flex gap-2">
                        <button
                          type="button"
                          data-testid="price-save"
                          disabled={busy !== null}
                          onClick={() => save(row)}
                          className="min-h-11 px-4 rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-70"
                        >
                          {busy === `save-${row.item.id}` ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            setOpenId(null);
                            setDraft(null);
                          }}
                          className="min-h-11 px-4 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-2">
                        <button
                          type="button"
                          data-testid="price-edit"
                          onClick={() => {
                            setOpenId(row.item.id);
                            setDraft(draftFrom(row, today));
                            setMessage(null);
                          }}
                          className="min-h-11 px-4 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void post(`retire-${row.item.id}`, { action: 'retire', itemId: row.item.id, retired: true })}
                          className="min-h-11 px-4 rounded-lg font-label text-afs-ink-700 hover:text-afs-ink-900 underline"
                        >
                          Retire
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3">
        <h3 className="font-heading text-xl text-afs-ink-900">Add a row</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-material" className="font-label text-sm font-bold text-afs-ink-900">
              Material
            </label>
            <input
              id="new-material"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              placeholder="Copper"
              className="min-h-11 w-56 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body px-3 placeholder:text-afs-ink-700"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-gauge" className="font-label text-sm font-bold text-afs-ink-900">
              Gauge
            </label>
            <input
              id="new-gauge"
              value={newGauge}
              onChange={(e) => setNewGauge(e.target.value)}
              placeholder="20 oz"
              className="min-h-11 w-40 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body px-3 placeholder:text-afs-ink-700"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null || newMaterial.trim() === '' || newGauge.trim() === ''}
            onClick={async () => {
              const added = await post('add', {
                action: 'add-row',
                material: newMaterial.trim(),
                gauge: newGauge.trim(),
              });
              if (added) {
                setNewMaterial('');
                setNewGauge('');
              }
            }}
            className="min-h-11 px-5 rounded-lg font-label font-bold bg-afs-bg-card border-2 border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised disabled:opacity-60"
          >
            {busy === 'add' ? 'Adding…' : 'Add to the price book'}
          </button>
        </div>
        <p className="font-body text-[13px] text-afs-ink-700">
          A new row starts with every price blank, ready for you to fill in.
        </p>
      </div>

      {retired.length > 0 && (
        <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3">
          <h3 className="font-heading text-xl text-afs-ink-900">Retired</h3>
          <p className="font-body text-[15px] text-afs-ink-700">
            These cannot start a new quote. Nothing was deleted — every quote that used them is
            untouched, and bringing one back restores its old prices.
          </p>
          <ul className="flex flex-col gap-2">
            {retired.map((row) => (
              <li key={row.item.id} className="flex items-center justify-between gap-4">
                <span className="font-body text-[15px] text-afs-ink-900">
                  {row.item.material} {row.item.gauge}
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void post(`unretire-${row.item.id}`, { action: 'retire', itemId: row.item.id, retired: false })}
                  className="min-h-11 px-4 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
                >
                  Bring it back
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A filled price, or a clearly marked blank. Never "$0.00" for an empty cell. */
function PriceCell({
  cents,
  field,
  material,
  gauge,
}: {
  cents: number | null;
  field: PriceBookField;
  material: string;
  gauge: string;
}) {
  if (cents === null) {
    return (
      <span
        data-testid="price-blank"
        data-field={field}
        className="inline-block font-label text-sm font-bold text-afs-amber-ink bg-afs-amber-bg rounded px-2 py-1 whitespace-nowrap"
      >
        <span aria-hidden="true">Not set</span>
        <span className="sr-only">
          {PRICE_BOOK_FIELD_LABELS[field]} for {material} {gauge} is not set yet
        </span>
      </span>
    );
  }
  return <span className="font-data text-[15px] text-afs-ink-900">{formatCents(cents)}</span>;
}
