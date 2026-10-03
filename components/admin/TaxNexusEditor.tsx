'use client';

/**
 * SETTINGS → TAX NEXUS. Where AFS records the states it collects sales tax in.
 *
 * ================== THE EMPTY STATE IS THE IMPORTANT ONE ==================
 *
 * This screen ships showing nothing, and the empty state has to say three things
 * rather than one: that no states are configured, WHY (AFS's accountant has not
 * supplied the list — checklist #31), and what that means in plain words —
 * **no tax is calculated and no tax is collected**.
 *
 * The third sentence is the one that matters. A tax screen showing an empty table
 * reads as "no tax is owed anywhere", and that is a legal claim AFS has not made.
 * Saying "nothing is configured" instead is the difference between a blank screen
 * that looks finished and one that tells Steve there is a job to do.
 *
 * ================== COLOURS ==================
 *
 * Light working area, so the placeholder is `afs-ink-700` and NOT
 * `afs-chrome-silver` — CLAUDE.md rule #23: chrome-silver is correct on gunmetal
 * and measures 1.55:1 on `afs-bg-card`, worse than the failure rule #18 exists to
 * fix. Every class here is copied from components/admin/PriceBookEditor.tsx,
 * which is the same kind of screen on the same surface and already passes the
 * contrast build gate (rule #28).
 */

import { useState } from 'react';
import type { NexusBasis, NexusState } from '@/lib/tax/types';
import { NEXUS_BASES, NEXUS_BASIS_LABELS } from '@/lib/tax/types';
import type { TaxCalculationRecord } from '@/lib/tax/db';
import type { TaxConfigSummary } from '@/lib/tax/service';

interface PreviewResult {
  kind: string;
  label: string;
  reason: string;
  amountCents: number | null;
  rate: number | null;
  isAuthoritative: boolean;
  provider: string;
  requiresAdminReview: boolean;
  problems: string[];
  fromCache: boolean;
}

interface TaxNexusEditorProps {
  states: NexusState[];
  review: TaxCalculationRecord[];
  summary: TaxConfigSummary;
  /** The shop's today, resolved on the server so the default start date is the shop's date. */
  today: string;
}

type Message = { tone: 'ok' | 'error'; text: string };

/** Cents to "$1,234.56". Local, because this screen is the only consumer. */
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const INPUT_CLASS =
  'min-h-11 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body px-3 placeholder:text-afs-ink-700';

const PRIMARY_BUTTON_CLASS =
  'min-h-11 px-5 rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-70';

const SECONDARY_BUTTON_CLASS =
  'min-h-11 px-4 rounded-lg font-label font-bold bg-afs-bg-card border-2 border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised disabled:opacity-60';

export default function TaxNexusEditor({ states, review, summary, today }: TaxNexusEditorProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // Add-a-state form
  const [newState, setNewState] = useState('');
  const [newBasis, setNewBasis] = useState<NexusBasis>('physical_presence');
  const [newFrom, setNewFrom] = useState(today);
  const [newRegistration, setNewRegistration] = useState('');
  const [newNote, setNewNote] = useState('');

  // Test-a-calculation form
  const [previewState, setPreviewState] = useState('');
  const [previewZip, setPreviewZip] = useState('');
  const [previewAmount, setPreviewAmount] = useState('');
  const [previewFreight, setPreviewFreight] = useState('');
  const [previewExempt, setPreviewExempt] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  async function post(
    url: string,
    body: Record<string, unknown>,
    busyKey: string
  ): Promise<Record<string, unknown> | null> {
    setBusy(busyKey);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setMessage({
          tone: 'error',
          text: typeof data.error === 'string' ? data.error : 'That did not work. Nothing was changed.',
        });
        return null;
      }
      return data;
    } catch {
      // Rule #30's wording: say what did NOT happen.
      setMessage({ tone: 'error', text: 'The connection dropped, so nothing was changed.' });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function addState(): Promise<void> {
    const data = await post(
      '/api/admin/tax-nexus',
      {
        action: 'add-state',
        stateCode: newState,
        basis: newBasis,
        effectiveFrom: newFrom,
        registrationId: newRegistration,
        note: newNote,
        collecting: true,
      },
      'add'
    );
    if (!data) return;
    setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : 'Added.' });
    setNewState('');
    setNewRegistration('');
    setNewNote('');
    window.location.reload();
  }

  async function changeState(id: string, action: string, label: string): Promise<void> {
    const data = await post('/api/admin/tax-nexus', { action, id }, `${action}:${id}`);
    if (!data) return;
    setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : label });
    window.location.reload();
  }

  async function resolveReviewRow(id: string): Promise<void> {
    const data = await post('/api/admin/tax-nexus', { action: 'resolve-review', id }, `review:${id}`);
    if (!data) return;
    setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : 'Marked as reviewed.' });
    window.location.reload();
  }

  async function runPreview(): Promise<void> {
    setPreview(null);
    const data = await post(
      '/api/admin/tax-nexus/preview',
      {
        toState: previewState,
        toZip: previewZip,
        subtotal: previewAmount,
        shipping: previewFreight,
        customerTaxExempt: previewExempt,
      },
      'preview'
    );
    if (!data) return;
    setPreview(data as unknown as PreviewResult);
  }

  const inForce = (row: NexusState): boolean =>
    row.effectiveFrom <= today && (row.effectiveTo === null || row.effectiveTo >= today);

  return (
    <div className="flex flex-col gap-8">
      {/* ---- What is configured right now ---------------------------------- */}
      <section className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5">
        <h2 className="font-heading text-lg text-afs-ink-900">Tax calculation status</h2>
        <p
          data-testid="tax-provider-status"
          className={`font-body text-[15px] mt-2 rounded-lg p-3 ${
            summary.readyToCalculate
              ? 'bg-afs-green-soft text-afs-green-ink'
              : 'bg-afs-amber-bg text-afs-amber-ink'
          }`}
        >
          {summary.readyToCalculate
            ? 'Tax calculation is switched on and configured.'
            : 'No tax is being calculated and none is being collected.'}
        </p>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <dt className="font-label text-sm font-bold text-afs-ink-900">Tax service</dt>
            <dd className="font-body text-[15px] text-afs-ink-700">{summary.providerReason}</dd>
          </div>
          <div>
            <dt className="font-label text-sm font-bold text-afs-ink-900">Shipping from</dt>
            <dd className="font-body text-[15px] text-afs-ink-700">{summary.originReason}</dd>
          </div>
          <div>
            <dt className="font-label text-sm font-bold text-afs-ink-900">TaxJar key</dt>
            {/* PRESENCE ONLY. The key's value never reaches this page. */}
            <dd className="font-body text-[15px] text-afs-ink-700">
              {summary.hasApiKey ? 'A key is set.' : 'No key is set.'}
            </dd>
          </div>
          <div>
            <dt className="font-label text-sm font-bold text-afs-ink-900">States on file</dt>
            <dd className="font-body text-[15px] text-afs-ink-700">
              {summary.nexusCount === 0
                ? 'None yet.'
                : `${summary.nexusCount} recorded, ${summary.collectingCount} collecting today.`}
            </dd>
          </div>
        </dl>
      </section>

      {message && (
        <p
          role="status"
          data-testid="tax-nexus-message"
          className={`font-body text-[15px] rounded-lg p-3 ${
            message.tone === 'error'
              ? 'bg-afs-bg-light-raised text-afs-crimson'
              : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* ---- The states --------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg text-afs-ink-900">States AFS collects sales tax in</h2>

        {states.length === 0 ? (
          // THE EMPTY STATE. See the file header: three sentences, not one.
          <div
            data-testid="tax-nexus-empty"
            className="bg-afs-amber-bg text-afs-amber-ink rounded-xl p-5 flex flex-col gap-2"
          >
            <p className="font-heading text-base">No tax nexus states are configured.</p>
            <p className="font-body text-[15px]">
              <strong>No tax is calculated and no tax is collected.</strong> That is not the same as
              AFS owing no tax — it means nobody has told this system where AFS has nexus yet.
            </p>
            <p className="font-body text-[15px]">
              AFS&apos;s accountant has to supply every state where AFS has sales tax nexus, and why:
              physical presence, an economic nexus threshold, employee presence, or a voluntary
              registration. That list is an outstanding item (checklist&nbsp;#31). Add each state
              below as it arrives.
            </p>
          </div>
        ) : (
          <div className="bg-afs-bg-card border border-afs-border-light rounded-xl overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <caption className="sr-only">
                Sales tax nexus states, one row per state
              </caption>
              <thead>
                <tr className="border-b border-afs-line-strong">
                  {['State', 'Collecting', 'Why', 'Registration', 'In force', ''].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="font-label text-sm font-bold text-afs-ink-900 text-left p-3 whitespace-nowrap"
                    >
                      {heading === '' ? <span className="sr-only">Actions</span> : heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {states.map((row) => {
                  const active = inForce(row);
                  const collectingNow = active && row.collecting;
                  return (
                    <tr key={row.id} className="border-b border-afs-border-light last:border-b-0">
                      <td className="p-3 font-data text-afs-ink-900">{row.stateCode}</td>
                      <td className="p-3">
                        <span
                          className={`font-label text-xs font-bold rounded px-2 py-1 ${
                            collectingNow
                              ? 'bg-afs-green-soft text-afs-green-ink'
                              : 'bg-afs-amber-bg text-afs-amber-ink'
                          }`}
                        >
                          {collectingNow
                            ? 'Collecting'
                            : row.collecting
                              ? 'Not in force'
                              : 'Recorded, not collecting'}
                        </span>
                      </td>
                      <td className="p-3 font-body text-[15px] text-afs-ink-700">
                        {NEXUS_BASIS_LABELS[row.basis]}
                      </td>
                      <td className="p-3 font-body text-[15px] text-afs-ink-700">
                        {/* A blank is marked as not supplied, never rendered as an empty cell. */}
                        {row.registrationId ?? 'Not supplied'}
                      </td>
                      <td className="p-3 font-data text-[15px] text-afs-ink-700 whitespace-nowrap">
                        {row.effectiveFrom} → {row.effectiveTo ?? 'ongoing'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            row.collecting
                              ? changeState(row.id, 'retire-state', 'Retired.')
                              : changeState(row.id, 'restore-state', 'Restored.')
                          }
                          className={SECONDARY_BUTTON_CLASS}
                        >
                          {row.collecting ? 'Retire' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Add a state ----------------------------------------------- */}
        <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-4">
          <h3 className="font-heading text-base text-afs-ink-900">Add a state</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="font-label text-sm font-bold text-afs-ink-900">State</span>
              <input
                type="text"
                value={newState}
                maxLength={2}
                onChange={(e) => setNewState(e.target.value.toUpperCase())}
                placeholder="TX"
                className={`${INPUT_CLASS} w-24 font-data`}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-label text-sm font-bold text-afs-ink-900">Why AFS has nexus</span>
              <select
                value={newBasis}
                onChange={(e) => setNewBasis(e.target.value as NexusBasis)}
                className={`${INPUT_CLASS} w-64`}
              >
                {NEXUS_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {NEXUS_BASIS_LABELS[basis]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-label text-sm font-bold text-afs-ink-900">Collecting from</span>
              <input
                type="date"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value)}
                className={`${INPUT_CLASS} w-44 font-data`}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-label text-sm font-bold text-afs-ink-900">
                Registration number
              </span>
              <input
                type="text"
                value={newRegistration}
                onChange={(e) => setNewRegistration(e.target.value)}
                placeholder="Optional"
                className={`${INPUT_CLASS} w-56`}
              />
            </label>

            <button
              type="button"
              data-testid="tax-nexus-add"
              disabled={busy !== null || newState.trim().length !== 2 || newFrom.trim() === ''}
              onClick={addState}
              className={PRIMARY_BUTTON_CLASS}
            >
              {busy === 'add' ? 'Adding…' : 'Add state'}
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-label text-sm font-bold text-afs-ink-900">Note</span>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Who told us, and when"
              className={`${INPUT_CLASS} w-full`}
            />
          </label>
        </div>
      </section>

      {/* ---- Test a calculation ------------------------------------------- */}
      <section className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg text-afs-ink-900">Test a calculation</h2>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            Asks the real tax engine a question. No customer, no quote and no charge is involved, and
            nothing is saved to anybody&apos;s order.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="font-label text-sm font-bold text-afs-ink-900">Ship to state</span>
            <input
              type="text"
              value={previewState}
              maxLength={2}
              onChange={(e) => setPreviewState(e.target.value.toUpperCase())}
              placeholder="TX"
              className={`${INPUT_CLASS} w-24 font-data`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-sm font-bold text-afs-ink-900">ZIP</span>
            <input
              type="text"
              value={previewZip}
              onChange={(e) => setPreviewZip(e.target.value)}
              placeholder="78701"
              className={`${INPUT_CLASS} w-32 font-data`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-sm font-bold text-afs-ink-900">Amount</span>
            <input
              type="text"
              value={previewAmount}
              onChange={(e) => setPreviewAmount(e.target.value)}
              placeholder="1000.00"
              className={`${INPUT_CLASS} w-36 text-right font-data`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-sm font-bold text-afs-ink-900">Freight</span>
            <input
              type="text"
              value={previewFreight}
              onChange={(e) => setPreviewFreight(e.target.value)}
              placeholder="0.00"
              className={`${INPUT_CLASS} w-32 text-right font-data`}
            />
          </label>

          <label className="flex items-center gap-2 min-h-11">
            <input
              type="checkbox"
              checked={previewExempt}
              onChange={(e) => setPreviewExempt(e.target.checked)}
              className="w-5 h-5 rounded border-afs-line-strong"
            />
            <span className="font-label text-sm font-bold text-afs-ink-900">
              Treat as tax exempt
            </span>
          </label>

          <button
            type="button"
            data-testid="tax-preview-run"
            disabled={
              busy !== null || previewState.trim().length !== 2 || previewZip.trim() === ''
            }
            onClick={runPreview}
            className={PRIMARY_BUTTON_CLASS}
          >
            {busy === 'preview' ? 'Calculating…' : 'Calculate'}
          </button>
        </div>

        {preview && (
          <div data-testid="tax-preview-result" className="flex flex-col gap-2">
            {/* A MOCK FIGURE IS MARKED AS ONE. INV-06: a development number must
                never be mistaken for a collectable tax. */}
            {preview.kind === 'calculated' && !preview.isAuthoritative && (
              <p className="font-body text-[15px] bg-afs-amber-bg text-afs-amber-ink rounded-lg p-3">
                <strong>This is not a real tax figure.</strong> It came from the development mock, not
                from a tax service. Do not bill it.
              </p>
            )}

            <p className="font-heading text-base text-afs-ink-900">{preview.label}</p>

            <p className="font-body text-[15px] text-afs-ink-700">{preview.reason}</p>

            {/* NULL IS RENDERED AS A SENTENCE, NEVER AS $0.00. */}
            <p className="font-data text-lg text-afs-ink-900">
              {preview.amountCents === null
                ? 'No tax amount — nothing was calculated.'
                : formatCents(preview.amountCents)}
            </p>

            {preview.fromCache && (
              <p className="font-body text-sm text-afs-ink-700">
                Reused from an earlier identical calculation.
              </p>
            )}

            {preview.problems.length > 0 && (
              <ul className="font-body text-[15px] text-afs-crimson bg-afs-bg-light-raised rounded-lg p-3 list-disc pl-6">
                {preview.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ---- Needs review ------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg text-afs-ink-900">Calculations that need a look</h2>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            A tax calculation that failed is never treated as zero. It is recorded here until somebody
            has seen it.
          </p>
        </div>

        {review.length === 0 ? (
          <p
            data-testid="tax-review-empty"
            className="font-body text-[15px] text-afs-ink-700 bg-afs-bg-card border border-afs-border-light rounded-xl p-5"
          >
            Nothing needs reviewing.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {review.map((row) => (
              <li
                key={row.id}
                className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-wrap items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-heading text-base text-afs-ink-900">
                    {row.toState ?? 'Unknown state'} {row.toZip ?? ''} —{' '}
                    {formatCents(row.subtotalCents)}
                  </p>
                  <p className="font-body text-sm text-afs-ink-700">
                    {new Date(row.createdAt).toLocaleString('en-US')} · {row.provider}
                  </p>
                  {row.problems.length > 0 && (
                    <ul className="font-body text-[15px] text-afs-ink-700 list-disc pl-6 mt-2">
                      {row.problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => resolveReviewRow(row.id)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {busy === `review:${row.id}` ? 'Saving…' : 'Mark as reviewed'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
