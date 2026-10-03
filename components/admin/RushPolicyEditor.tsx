'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseDollarsToCents } from '@/lib/pricing/quote-math';
import {
  MAX_RUSH_LEAD_TIME_DAYS,
  MAX_RUSH_PERCENT_BP,
  RUSH_SURCHARGE_TYPES,
  RUSH_SURCHARGE_TYPE_LABELS,
  formatRushPolicySentence,
  formatShortDate,
  parseLeadDays,
  parsePercentToBasisPoints,
  type RushPolicy,
  type RushSurchargeType,
} from '@/lib/pricing/rush-policy';

/**
 * SETTINGS → RUSH POLICY. What a rush job costs, and how much notice the shop
 * needs for one.
 *
 * ================== IT SHIPS EMPTY, AND SAYS SO ==================
 *
 * The surcharge and the lead time are Steve's decisions and are not in the data
 * (SPEC_RUSH_ORDER.md marks checklist #36 and #32 BLOCKED), so `rush_policies`
 * arrives with nothing in it and this screen's FIRST job is to make that state
 * legible. It renders exactly one of THREE states, and they are three because
 * they are three different facts somebody could act on:
 *
 *   1. THE TABLE IS NOT THERE  — migration 039 has not been applied. Names the
 *      file, states that no surcharge is reaching any quote, and DISABLES the
 *      form: a form that cannot possibly save is worse than no form.
 *   2. THE TABLE IS EMPTY      — the shipped state. Nobody has decided yet.
 *      Explains what rush DOES do today (flagged, badged, pinned to the top of
 *      the shop queue) so "no policy" does not read as "rush does nothing", and
 *      states plainly that no surcharge is added until a policy is set here.
 *   3. A POLICY IS IN FORCE    — in words, with its start date, the full
 *      history, and the form for the NEXT one.
 *
 * ================== EVERY SAVE IS A NEW POLICY ==================
 *
 * Saving never edits. It writes a new policy with a START DATE, so next
 * quarter's rush fee can be entered now and start then — and a quote already
 * sent keeps the surcharge it was built on. The database refuses an edit
 * anyway: migration 039 puts migration 035's append-only trigger on this table.
 * The caption above the button says so, because a non-technical reader has no
 * reason to assume it.
 *
 * ================== A BLANK IS NOT A ZERO ==================
 *
 * Choosing "a percentage of the job" and leaving the percentage empty is
 * REFUSED, not stored. A policy that looks set on this screen and is unpriced
 * on every quote forever is the worst of the available outcomes, so the route
 * (`parseRushPolicyInput`) will not create one and this form says which box to
 * fill in.
 *
 * ================== CONTRAST ==================
 *
 * Light working area, same palette as PriceBookEditor and for the same measured
 * reasons: body text afs-ink-900 (18.9:1 on afs-bg-card) and afs-ink-700
 * (10.3:1), control borders afs-line-strong (3.1:1 against the 3:1 rule for UI
 * components), the not-set/unavailable notices afs-amber-ink on afs-amber-bg
 * (7.1:1).
 *
 * PLACEHOLDER TEXT IS afs-ink-700, NOT afs-chrome-silver. CLAUDE.md rule #18
 * names chrome-silver and that is right ON GUNMETAL, where it measures 4.80:1
 * at worst. On this white card it measures 1.55:1 — worse than the failure that
 * rule exists to fix. The surface decides the token (rule #23), and
 * lib/design/placeholder-contrast.test.ts computes both numbers from
 * tailwind.config.js rather than trusting this comment.
 */

const CARD = 'bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-2';
const FIELD_INPUT =
  'min-h-11 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body px-3 placeholder:text-afs-ink-700';
const FIELD_LABEL = 'font-label text-sm font-bold text-afs-ink-900';
const FIELD_HINT = 'font-body text-[13px] text-afs-ink-700';

interface Draft {
  name: string;
  surchargeType: RushSurchargeType;
  /** As typed: "2.5" means two and a half percent. Converted on save. */
  percent: string;
  /** As typed: "150" or "150.00" dollars. Converted on save. */
  dollars: string;
  /** As typed. '' means "no minimum", which is NOT nought days. */
  leadDays: string;
  effectiveFrom: string;
  note: string;
}

function emptyDraft(today: string): Draft {
  return {
    name: '',
    // No default charge type is pre-selected as a VALUE Steve did not choose —
    // 'percent' is first in the list because it is the shape SPEC_RUSH_ORDER.md
    // describes, and the percentage box beside it starts empty, so nothing is
    // saved that nobody typed.
    surchargeType: 'percent',
    percent: '',
    dollars: '',
    leadDays: '',
    effectiveFrom: today,
    note: '',
  };
}

export default function RushPolicyEditor({
  policies,
  unavailable,
  inForce,
  today,
}: {
  /** Every policy ever entered, newest start date first. */
  policies: RushPolicy[];
  /** Non-null when the table could not be read at all — state 1 above. */
  unavailable: string | null;
  /** The one in force today, resolved on the server. */
  inForce: RushPolicy | null;
  /** The shop's own date, so a start date defaults to the shop's today. */
  today: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(today));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const disabled = unavailable !== null;
  const needsPercent = draft.surchargeType === 'percent';
  const needsDollars = draft.surchargeType === 'flat' || draft.surchargeType === 'per_piece';

  async function save() {
    const body: Record<string, unknown> = {
      action: 'set-policy',
      name: draft.name,
      surchargeType: draft.surchargeType,
      effectiveFrom: draft.effectiveFrom,
      note: draft.note,
    };

    if (needsPercent) {
      const bp = parsePercentToBasisPoints(draft.percent);
      if (bp === 'invalid') {
        setMessage({
          tone: 'error',
          text: `The percentage needs to be a number like 2.5 or 10, up to ${MAX_RUSH_PERCENT_BP / 100}.`,
        });
        return;
      }
      if (bp === null) {
        setMessage({ tone: 'error', text: 'Fill in the percentage. A blank is never treated as zero.' });
        return;
      }
      body.surchargePercentBp = bp;
    }

    if (needsDollars) {
      const cents = parseDollarsToCents(draft.dollars);
      if (cents === 'invalid') {
        setMessage({ tone: 'error', text: 'The amount needs to be a dollar figure like 150 or 150.50.' });
        return;
      }
      if (cents === null) {
        setMessage({ tone: 'error', text: 'Fill in the amount. A blank is never treated as zero.' });
        return;
      }
      body.surchargeCents = cents;
    }

    const lead = parseLeadDays(draft.leadDays);
    if (lead === 'invalid') {
      setMessage({
        tone: 'error',
        text: `The minimum notice needs to be a whole number of working days, up to ${MAX_RUSH_LEAD_TIME_DAYS}.`,
      });
      return;
    }
    // `null` travels as null and is stored as a blank. This is the line that
    // keeps "no minimum set" from becoming "nought days of notice needed".
    body.minimumLeadTimeDays = lead;

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/rush-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : 'Saved.' });
        setDraft(emptyDraft(today));
        router.refresh();
      } else {
        setMessage({ tone: 'error', text: typeof data.error === 'string' ? data.error : 'That did not save.' });
      }
    } catch {
      setMessage({ tone: 'error', text: 'The connection dropped, so nothing was changed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- STATE 1: the table is not in the database yet ---------------- */}
      {disabled && (
        <p
          role="status"
          data-testid="rush-policy-unavailable"
          className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded-lg p-4"
        >
          {unavailable}{' '}
          <span className="text-afs-ink-900">
            Nothing is broken and no quote is wrong — rush jobs are still flagged, badged and pinned
            to the top of the shop queue. There is simply no surcharge to add yet.
          </span>
        </p>
      )}

      {/* ---- STATE 2: the table is there and empty — the shipped state ---- */}
      {!disabled && policies.length === 0 && (
        <div className={CARD} data-testid="rush-policy-empty">
          <p className="font-heading text-lg text-afs-ink-900">No rush policy has been set yet</p>
          <p className="font-body text-[15px] text-afs-ink-700">
            <strong className="text-afs-ink-900">No rush surcharge is added to any quote</strong>{' '}
            until you set one here. Nothing is being guessed at in the meantime — a blank is never
            treated as a zero, so a rush job is quoted at the ordinary price and the Job screen tells
            the estimator that no policy is set.
          </p>
          <p className="font-body text-[15px] text-afs-ink-700">
            What rush already does, with or without a policy: the customer can ask for it when they
            submit, you can turn it on yourself from the Job screen, every list shows a RUSH badge,
            and rush work sits at the top of the shop queue.
          </p>
        </div>
      )}

      {/* ---- STATE 3: a policy is in force -------------------------------- */}
      {!disabled && policies.length > 0 && (
        <div className={CARD} data-testid="rush-policy-in-force">
          <p className="font-heading text-lg text-afs-ink-900">
            {inForce === null ? 'Nothing is in force today' : 'In force today'}
          </p>
          <p className="font-body text-[15px] text-afs-ink-900">
            {formatRushPolicySentence(inForce, null)}
          </p>
          {inForce !== null && (
            <p className={FIELD_HINT}>Started {formatShortDate(inForce.effectiveFrom)}.</p>
          )}
          {inForce === null && (
            <p className={FIELD_HINT}>
              Every policy below starts on a future date, so no surcharge is being added to quotes
              today.
            </p>
          )}
        </div>
      )}

      {message && (
        <p
          role="status"
          data-testid="rush-policy-message"
          className={`font-body text-[15px] rounded-lg p-3 ${
            message.tone === 'error'
              ? 'bg-afs-bg-light-raised text-afs-crimson'
              : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* ---- The form ----------------------------------------------------- */}
      <div className={CARD}>
        <p className="font-heading text-lg text-afs-ink-900">
          {policies.length === 0 ? 'Set the rush policy' : 'Change the rush policy'}
        </p>
        <p className="font-body text-[15px] text-afs-ink-700">
          Saving never edits an old policy — it starts a new one from the date you choose.{' '}
          <strong className="text-afs-ink-900">
            Quotes you have already sent keep the surcharge they were built on.
          </strong>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL} htmlFor="rush-policy-name">
              What to call it
            </label>
            <input
              id="rush-policy-name"
              data-testid="rush-policy-name"
              type="text"
              value={draft.name}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Standard rush"
              className={FIELD_INPUT}
            />
            <span className={FIELD_HINT}>Just so you can tell it apart from the next one.</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL} htmlFor="rush-policy-type">
              How the rush charge works
            </label>
            <select
              id="rush-policy-type"
              data-testid="rush-policy-type"
              value={draft.surchargeType}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, surchargeType: e.target.value as RushSurchargeType })}
              className={FIELD_INPUT}
            >
              {RUSH_SURCHARGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {RUSH_SURCHARGE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <span className={FIELD_HINT}>
              &ldquo;No extra charge&rdquo; is a real answer — it means rush is free, which is not the
              same as not having decided.
            </span>
          </div>

          {needsPercent && (
            <div className="flex flex-col gap-1">
              <label className={FIELD_LABEL} htmlFor="rush-policy-percent">
                How much, as a percentage
              </label>
              <input
                id="rush-policy-percent"
                data-testid="rush-policy-percent"
                type="text"
                inputMode="decimal"
                value={draft.percent}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
                placeholder="2.5"
                className={FIELD_INPUT}
              />
              <span className={FIELD_HINT}>
                Of the job total, before freight and tax. Type 2.5 for two and a half percent.
              </span>
            </div>
          )}

          {needsDollars && (
            <div className="flex flex-col gap-1">
              <label className={FIELD_LABEL} htmlFor="rush-policy-dollars">
                {draft.surchargeType === 'flat' ? 'How much, per job' : 'How much, per piece'}
              </label>
              <input
                id="rush-policy-dollars"
                data-testid="rush-policy-dollars"
                type="text"
                inputMode="decimal"
                value={draft.dollars}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, dollars: e.target.value })}
                placeholder="150.00"
                className={FIELD_INPUT}
              />
              <span className={FIELD_HINT}>Dollars. Type 150 or 150.50.</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL} htmlFor="rush-policy-lead">
              Shortest notice you will take (optional)
            </label>
            <input
              id="rush-policy-lead"
              data-testid="rush-policy-lead"
              type="text"
              inputMode="numeric"
              value={draft.leadDays}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, leadDays: e.target.value })}
              placeholder="5"
              className={FIELD_INPUT}
            />
            <span className={FIELD_HINT}>
              Working days, so the weekend does not count. Leave it empty if you would rather judge
              each one. The Job screen compares it against the date the customer asked for and tells
              you if it is too soon — it never refuses the quote.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL} htmlFor="rush-policy-from">
              Starts on
            </label>
            <input
              id="rush-policy-from"
              data-testid="rush-policy-from"
              type="date"
              value={draft.effectiveFrom}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
              className={`${FIELD_INPUT} font-data`}
            />
            <span className={FIELD_HINT}>
              A date in the future is fine — it does nothing until then.
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className={FIELD_LABEL} htmlFor="rush-policy-note">
              Note (optional)
            </label>
            <input
              id="rush-policy-note"
              data-testid="rush-policy-note"
              type="text"
              value={draft.note}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Why this changed"
              className={FIELD_INPUT}
            />
          </div>
        </div>

        <div className="mt-2">
          <button
            type="button"
            data-testid="rush-policy-save"
            disabled={disabled || busy}
            onClick={() => void save()}
            className="min-h-11 px-4 rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-70"
          >
            {busy ? 'Saving…' : 'Save this policy'}
          </button>
        </div>
      </div>

      {/* ---- The history --------------------------------------------------- */}
      {policies.length > 0 && (
        <div className="bg-afs-bg-card border border-afs-border-light rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <caption className="sr-only">Every rush policy that has been set, newest first</caption>
            <thead>
              <tr className="border-b border-afs-line-strong">
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  Starts
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  Name
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  What it says
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr
                  key={p.id}
                  data-testid="rush-policy-history-row"
                  className="border-b border-afs-border-light last:border-b-0"
                >
                  <td className="font-data text-sm text-afs-ink-900 p-3 whitespace-nowrap">
                    {formatShortDate(p.effectiveFrom)}
                    {p.id === inForce?.id && (
                      <span className="font-label text-[11px] text-afs-green-ink bg-afs-green-soft rounded px-1.5 py-0.5 ml-2">
                        In force
                      </span>
                    )}
                  </td>
                  <td className="font-body text-sm text-afs-ink-900 p-3">{p.name}</td>
                  <td className="font-body text-sm text-afs-ink-700 p-3">
                    {formatRushPolicySentence(p, null)}
                  </td>
                  <td className="font-body text-sm text-afs-ink-700 p-3">{p.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
