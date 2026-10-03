'use client';

import { useMemo } from 'react';
import { formatCents } from '@/lib/pricing/quote-math';
import { estimateFreight } from '@/lib/freight/estimate';
import type { FreightInput, FreightRateTable } from '@/lib/freight/types';

/**
 * THE FREIGHT PANEL ON THE QUOTE SCREEN. ADMIN ONLY.
 *
 * ================== WHAT THE CUSTOMER SEES OF THIS: NOTHING ==================
 *
 * Not the zone, not the band, not the weight, not the freight class, not the
 * estimate, not the override, not the fact that an override happened. They see
 * ONE freight line on their formal quote, which is what CLAUDE.md's business
 * model allows and all it allows. This component is mounted only from
 * `/admin/quote-requests/[id]`, which `middleware.ts` and `requireAdminUser`
 * both gate.
 *
 * ================== MANUAL ENTRY FIRST, NOT MANUAL ENTRY INSTEAD ==================
 *
 * The "Freight Amount ($)" box is the same box that has always been here, and
 * it is still the thing that decides what goes on the quote. Everything else on
 * this panel exists to help an estimator put a better number in it:
 *
 *  - With no rate table (today, on every deployment — migration 039 is written
 *    and not applied) the panel says so in one sentence and the box is the whole
 *    feature. That is `SPEC_FREIGHT_ESTIMATOR.md` §3's own documented interim
 *    behaviour, not a shortfall against it.
 *  - With a rate table, the estimate appears beside the box with its working
 *    shown, and "Use this estimate" copies it in. It never types into the box by
 *    itself: a figure that appeared without somebody choosing it is a figure
 *    nobody checked.
 *  - When the table cannot price the job, every reason is printed in plain
 *    English and NO figure is shown. An estimator who sees a number has a number
 *    they can trust.
 *
 * ================== THE SERVER DOES NOT BELIEVE ANY OF THIS ==================
 *
 * The estimate computed here is for DISPLAY. On send, the route re-reads the
 * rate table and re-computes it server-side, and records its own figure as the
 * computed one — see `app/api/admin/quote-requests/[id]/send/route.ts`. What
 * this component sends is the INPUTS and the amount in the box, never a
 * computed total. A client-supplied estimate accepted as fact would let a
 * crafted request record a rate the table never contained, in the append-only
 * table a future pricing engine is meant to learn from.
 *
 * ================== CONTRAST ==================
 *
 * This screen is GUNMETAL, not the light working area — so the tokens here are
 * the light-on-dark `afs-chrome-*` set, and every status colour is the
 * `*-on-dark` variant per CLAUDE.md rule #29. `afs-crimson` as TEXT on gunmetal
 * measures 1.42:1 and `afs-warning` 3.67:1; `afs-danger-on-dark` and
 * `afs-warning-on-dark` are the ones that clear AA on all five gunmetal
 * surfaces. Placeholders are `afs-chrome-silver` (rule #18) — which is correct
 * HERE and would be 1.55:1 on the light card, which is why the rate editor uses
 * `afs-ink-700` instead.
 */

export interface FreightPanelInputs {
  zoneId: string | null;
  /** As typed, in pounds. A string so a half-typed box is not a 0. */
  weightLbs: string;
  /** As typed, in feet. */
  longestPieceFt: string;
  isResidential: boolean;
  requiresLiftgate: boolean;
}

interface FreightEstimatePanelProps {
  jobsiteAddress: string | null;
  /** `null` when migration 039 has not been applied on this deployment. */
  table: FreightRateTable | null;
  notInstalledReason: string | null;
  inputs: FreightPanelInputs;
  onInputsChange: (next: FreightPanelInputs) => void;
  /** The override box. Controlled by the parent, which owns the quote total. */
  freight: string;
  onFreightChange: (next: string) => void;
  /** Live from the line-item prices above, for the free-freight threshold only. */
  merchandiseSubtotalCents: number;
  /** The caveat from `estimateShipmentWeight`, shown verbatim beside the weight. */
  weightMatchedItems: number;
  weightTotalItems: number;
  /** Fallback freight class when there is no estimate to report one. */
  freightClassFallback: string;
}

const inputClass =
  'bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data placeholder:text-afs-chrome-silver';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

/** A number from a typed box, or NaN — which the estimator reports as a bad weight. */
function numberFrom(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed);
}

export default function FreightEstimatePanel({
  jobsiteAddress,
  table,
  notInstalledReason,
  inputs,
  onInputsChange,
  freight,
  onFreightChange,
  merchandiseSubtotalCents,
  weightMatchedItems,
  weightTotalItems,
  freightClassFallback,
}: FreightEstimatePanelProps) {
  const estimateInput: FreightInput = useMemo(
    () => ({
      zoneId: inputs.zoneId,
      weightLbs: numberFrom(inputs.weightLbs),
      weightMatchedItems,
      weightTotalItems,
      longestPieceFt: numberFrom(inputs.longestPieceFt),
      isResidential: inputs.isResidential,
      requiresLiftgate: inputs.requiresLiftgate,
      merchandiseSubtotalCents,
    }),
    [inputs, merchandiseSubtotalCents, weightMatchedItems, weightTotalItems]
  );

  const result = useMemo(
    () => (table === null ? null : estimateFreight(estimateInput, table)),
    [estimateInput, table]
  );

  const liveZones = table === null ? [] : table.zones.filter((zone) => zone.retiredAt === null);

  // The class is reported even with no table at all: it comes from the longest
  // piece and SPEC §4's own table, so it needs no rate data.
  const freightClass = result?.freightClass ?? freightClassFallback;

  function update(patch: Partial<FreightPanelInputs>) {
    onInputsChange({ ...inputs, ...patch });
  }

  return (
    <div data-testid="freight-panel" className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h3 className="font-heading text-lg text-afs-chrome-high mb-4">Freight</h3>

      {/* The jobsite address stays READ-ONLY display text. SPEC §2 asks for a
          destination ZIP, but quote_requests.jobsite_address is one opaque
          free-text string, and regex-extracting a ZIP from it to drive a lane
          lookup would be a guess wearing a lookup's clothes. The zone below is
          chosen, never inferred. */}
      <div className="mb-4">
        <span className={labelClass}>Destination</span>
        <p className="font-body text-sm text-afs-chrome-high whitespace-pre-line">{jobsiteAddress || '—'}</p>
      </div>

      {table === null ? (
        <p
          data-testid="freight-panel-not-installed"
          className="font-body text-xs text-afs-warning-on-dark border border-afs-border rounded p-3 mb-4"
        >
          {notInstalledReason ??
            'The freight rate table is not available on this deployment.'}{' '}
          Type the freight amount below, exactly as you do today.
        </p>
      ) : liveZones.length === 0 ? (
        <p
          data-testid="freight-panel-no-zones"
          className="font-body text-xs text-afs-warning-on-dark border border-afs-border rounded p-3 mb-4"
        >
          No freight zones have been set up yet, so there is nothing to estimate from. Type the amount
          below, or set the zones and rates up under Settings → Freight rates.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass} htmlFor="freight-zone">
                Zone
              </label>
              <select
                id="freight-zone"
                data-testid="freight-zone-select"
                value={inputs.zoneId ?? ''}
                onChange={(e) => update({ zoneId: e.target.value === '' ? null : e.target.value })}
                className={`${inputClass} w-full`}
              >
                <option value="">Not selected</option>
                {liveZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="freight-weight">
                Estimated weight (lb)
              </label>
              <input
                id="freight-weight"
                data-testid="freight-weight-input"
                type="text"
                inputMode="decimal"
                value={inputs.weightLbs}
                onChange={(e) => update({ weightLbs: e.target.value })}
                placeholder="0"
                className={`${inputClass} w-full text-right`}
              />
              <p className="font-body text-[11px] text-afs-chrome-silver mt-1">
                {weightMatchedItems} of {weightTotalItems} line items matched a known material and
                gauge. Edit it if you know better.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="freight-longest">
                Longest piece (ft)
              </label>
              <input
                id="freight-longest"
                data-testid="freight-longest-input"
                type="text"
                inputMode="decimal"
                value={inputs.longestPieceFt}
                onChange={(e) => update({ longestPieceFt: e.target.value })}
                placeholder="0"
                className={`${inputClass} w-full text-right`}
              />
            </div>
            <fieldset className="flex flex-col gap-2 justify-end">
              <legend className={labelClass}>Delivery</legend>
              <label className="flex items-center gap-2 font-body text-sm text-afs-chrome-high">
                <input
                  type="checkbox"
                  data-testid="freight-residential"
                  checked={inputs.isResidential}
                  onChange={(e) => update({ isResidential: e.target.checked })}
                  className="w-4 h-4 accent-afs-crimson"
                />
                Residential delivery
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-afs-chrome-high">
                <input
                  type="checkbox"
                  data-testid="freight-liftgate"
                  checked={inputs.requiresLiftgate}
                  onChange={(e) => update({ requiresLiftgate: e.target.checked })}
                  className="w-4 h-4 accent-afs-crimson"
                />
                Liftgate required
              </label>
            </fieldset>
          </div>

          {/* ---- the estimate, or every reason there isn't one ------------- */}
          {result !== null && result.ok && (
            <div
              data-testid="freight-estimate"
              data-total-cents={result.estimate.breakdown.totalCents}
              className="border border-afs-border rounded p-3 mb-4 flex flex-col gap-1.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">
                  Estimated freight
                </span>
                <span className="font-data text-lg text-afs-chrome-high">
                  {formatCents(result.estimate.breakdown.totalCents)}
                </span>
              </div>
              <dl className="flex flex-col gap-1 font-body text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-afs-chrome-mid">
                    {result.estimate.zoneName} · {result.estimate.weightLbsUsed.toLocaleString('en-US')} lb
                  </dt>
                  <dd className="font-data text-afs-chrome-high">
                    {formatCents(result.estimate.breakdown.baseRateCents)}
                  </dd>
                </div>
                {result.estimate.breakdown.residentialCents > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-afs-chrome-mid">Residential delivery</dt>
                    <dd className="font-data text-afs-chrome-high">
                      {formatCents(result.estimate.breakdown.residentialCents)}
                    </dd>
                  </div>
                )}
                {result.estimate.breakdown.liftgateCents > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-afs-chrome-mid">Liftgate service</dt>
                    <dd className="font-data text-afs-chrome-high">
                      {formatCents(result.estimate.breakdown.liftgateCents)}
                    </dd>
                  </div>
                )}
                {result.estimate.breakdown.freeFreightApplied && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-afs-success-on-dark">Free freight applied</dt>
                    <dd className="font-data text-afs-success-on-dark">{formatCents(0)}</dd>
                  </div>
                )}
              </dl>
              {result.estimate.notes.map((note, index) => (
                <p key={index} className="font-body text-[11px] text-afs-warning-on-dark">
                  {note}
                </p>
              ))}
              <button
                type="button"
                data-testid="freight-use-estimate"
                onClick={() => onFreightChange((result.estimate.breakdown.totalCents / 100).toFixed(2))}
                className="self-start mt-1 font-label text-xs font-bold text-afs-chrome-high border border-afs-chrome-base rounded px-3 min-h-11 inline-flex items-center hover:bg-afs-bg-surface"
              >
                Use this estimate
              </button>
            </div>
          )}

          {result !== null && !result.ok && (
            <div
              data-testid="freight-refusals"
              className="border border-afs-border rounded p-3 mb-4 flex flex-col gap-1.5"
            >
              <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">
                No estimate — type the amount below
              </span>
              <ul className="flex flex-col gap-1.5 list-disc pl-5">
                {result.refusals.map((refusal) => (
                  <li
                    key={refusal.kind}
                    data-refusal={refusal.kind}
                    className="font-body text-xs text-afs-warning-on-dark"
                  >
                    {refusal.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ---- THE BOX. Unchanged, and still what decides the quote. -------- */}
      <div>
        <label className={labelClass} htmlFor="freight-amount">
          Freight Amount ($)
        </label>
        <input
          id="freight-amount"
          type="number"
          min="0"
          step="0.01"
          value={freight}
          onChange={(e) => onFreightChange(e.target.value)}
          placeholder="0.00"
          className={`${inputClass} w-full py-2.5`}
        />
        <p className="font-body text-[11px] text-afs-chrome-silver mt-1">
          This is what the customer sees — one freight line on their formal quote. Nothing above is
          shown to them.
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-afs-border flex flex-col gap-1.5">
        <div className="flex justify-between font-body text-xs">
          <span className="text-afs-chrome-mid">Longest piece</span>
          <span className="font-data text-afs-chrome-high">
            {Number.isFinite(numberFrom(inputs.longestPieceFt)) && numberFrom(inputs.longestPieceFt) > 0
              ? `${numberFrom(inputs.longestPieceFt)} ft → Class ${freightClass}`
              : '—'}
          </span>
        </div>
        <div className="flex justify-between font-body text-xs">
          <span className="text-afs-chrome-mid">Estimated weight</span>
          <span className="font-data text-afs-chrome-high">
            {weightMatchedItems > 0 && Number.isFinite(numberFrom(inputs.weightLbs))
              ? `~${Math.round(numberFrom(inputs.weightLbs)).toLocaleString('en-US')} lb`
              : '—'}{' '}
            ({weightMatchedItems} of {weightTotalItems} items matched)
          </span>
        </div>
      </div>
    </div>
  );
}
