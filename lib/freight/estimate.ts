/**
 * THE FREIGHT ESTIMATE. Pure — no database, no network, no clock beyond the
 * `asOf` already baked into the resolved table — so it can be unit-tested
 * exhaustively and checked by hand against a carrier tariff.
 *
 * ================== WHAT IT REFUSES TO GUESS, AND WHY ==================
 *
 * This function's output becomes a dollar figure on a customer's formal AFS
 * quote. Six of its inputs are open client-data blockers — the carrier and its
 * rate structures (#27-28), own-truck-vs-third-party (#80), the residential
 * surcharge (#29), the free-freight threshold (#30), the liftgate upcharge
 * (#88) and the origin (#5). So the one thing it must never do is produce a
 * plausible number from data it does not have. Every missing piece is a
 * REFUSAL that names what to go and fill in:
 *
 *  - A band whose rate was never typed in is `band-rate-blank`, never 0.
 *  - A toggle switched ON whose adder is blank is `*-adder-blank`, never 0.
 *    A toggle switched OFF is simply not applied, set or not.
 *  - A weight no band covers is `no-band-for-weight` naming the weight, never
 *    the nearest band's rate.
 *  - A self-contradicting band table is `band-coverage`, never first-match-wins.
 *  - A piece over 24 ft is `oversize-manual-entry`, because
 *    SPEC_FREIGHT_ESTIMATOR.md §4 says so in as many words: "Admin manual entry
 *    required — no auto-calculation for extreme lengths."
 *
 * ================== EVERY REASON, NOT THE FIRST ONE ==================
 *
 * Refusals accumulate. An estimator whose zone has a blank rate, whose
 * residential adder is unset and whose longest piece is 30 ft gets told all
 * three at once, because being sent back to Settings three times for one quote
 * is how a tool stops being used.
 *
 * ================== A REFUSAL OUTRANKS FREE FREIGHT ==================
 *
 * If the order qualifies for free freight AND something is unpriced, the answer
 * is the refusal — not "free". "Free" would be a figure, and a figure this
 * function could not actually compute must never be dressed up as one, least of
 * all as the most attractive possible answer.
 *
 * ================== THE CLASS IS ALWAYS KNOWN ==================
 *
 * `freightClass` is returned on BOTH branches. It comes from the longest piece
 * and the NMFC-style table the spec states in full, so it needs no rate data at
 * all and the estimator should see it even when not one rate has been entered.
 */
import { getFreightClass } from '@/lib/admin/pricing';
import { bandForWeight, describeBand, roundToWholePounds, validateBandCoverage } from './bands';
import type {
  BandCoverageProblem,
  FreightBreakdown,
  FreightEstimateResult,
  FreightInput,
  FreightRateTable,
  FreightRefusal,
  ResolvedFreightBand,
} from './types';

/**
 * The length above which no freight figure is auto-calculated, in feet.
 *
 * SPEC_FREIGHT_ESTIMATOR.md §4, verbatim:
 *
 *   // Pieces > 24 ft may require:
 *   //   Flatbed service (not LTL)
 *   //   Oversize permit
 *   //   Admin manual entry required — no auto-calculation for extreme lengths
 *
 * This is a LENGTH the specification supplies, not a price somebody has to
 * supply, which is why it is a constant here rather than a configurable row —
 * the same standing as the freight class table in `getFreightClass`. Refusing
 * to calculate invents nothing.
 */
export const OVERSIZE_MANUAL_ENTRY_FT = 24;

/** Only bands that can price new work. */
function liveBandsOf(bands: readonly ResolvedFreightBand[]): ResolvedFreightBand[] {
  return bands.filter((entry) => entry.band.retiredAt === null);
}

/**
 * Does this table have anything to look a shipment up in at all?
 *
 * STRUCTURAL emptiness, deliberately — no live zone, or no live zone with a
 * live band. A zone whose bands exist but have no rates typed in is NOT
 * "empty": each of those bands gets its own `band-rate-blank` refusal naming
 * it, which tells the estimator which row to go and fill in. A blanket "the
 * table is empty" there would be true in spirit and useless in practice.
 */
function tableIsStructurallyEmpty(table: FreightRateTable): boolean {
  const liveZones = table.zones.filter((zone) => zone.retiredAt === null);
  if (liveZones.length === 0) return true;
  return liveZones.every((zone) => liveBandsOf(table.bandsByZone[zone.id] ?? []).length === 0);
}

/**
 * A freight figure, or every reason there isn't one.
 *
 * `table` must already be resolved as of the quote's date (see
 * `lib/freight/db.ts`'s `getFreightRateTable`), so this function has no opinion
 * about what day it is and a quote re-estimated as of its own issue date
 * reproduces the figure it was sent with.
 */
export function estimateFreight(
  input: FreightInput,
  table: FreightRateTable
): FreightEstimateResult {
  const freightClass = getFreightClass(input.longestPieceFt);
  const refusals: FreightRefusal[] = [];
  const coverageProblems: BandCoverageProblem[] = [];

  // ---- the oversize rule, independent of everything else -----------------
  // Checked first and never skipped: a 30 ft piece needs a human whatever the
  // rate table says, so a fully-priced table must not talk anybody out of it.
  const requiresManualEntry = input.longestPieceFt > OVERSIZE_MANUAL_ENTRY_FT;
  if (requiresManualEntry) {
    refusals.push({
      kind: 'oversize-manual-entry',
      message:
        `The longest piece is ${input.longestPieceFt} ft. Anything over ${OVERSIZE_MANUAL_ENTRY_FT} ft may need ` +
        `flatbed service rather than LTL, and possibly an oversize permit, so freight on this job is ` +
        `priced by hand — enter the amount below.`,
    });
  }

  // ---- is there a table at all ------------------------------------------
  if (tableIsStructurallyEmpty(table)) {
    refusals.push({
      kind: 'rate-table-empty',
      message:
        'No freight zones and weight bands have been set up yet, so there is nothing to look this ' +
        'shipment up in. Enter the amount below, or set the table up under Settings → Freight rates.',
    });
    // Nothing below this point can say anything useful about a table that does
    // not exist, and a blank adder is not the actionable problem when there is
    // no rate to add it to.
    return { ok: false, refusals, freightClass, requiresManualEntry, coverageProblems };
  }

  // ---- the zone -----------------------------------------------------------
  let zoneName: string | null = null;
  let zoneBands: ResolvedFreightBand[] | null = null;

  if (input.zoneId === null) {
    refusals.push({
      kind: 'no-zone-selected',
      message: 'Pick the freight zone this job is delivering to, and the estimate will fill itself in.',
    });
  } else {
    const zone = table.zones.find((candidate) => candidate.id === input.zoneId) ?? null;
    if (zone === null) {
      refusals.push({
        kind: 'zone-not-found',
        message:
          'That freight zone no longer exists. Pick one from the list, or enter the amount by hand.',
      });
    } else if (zone.retiredAt !== null) {
      refusals.push({
        kind: 'zone-retired',
        message:
          `"${zone.name}" has been retired, so it cannot price new work. Pick a current zone, or bring ` +
          `it back under Settings → Freight rates.`,
      });
    } else {
      zoneName = zone.name;
      const live = liveBandsOf(table.bandsByZone[zone.id] ?? []);
      if (live.length === 0) {
        refusals.push({
          kind: 'zone-has-no-bands',
          message:
            `"${zone.name}" has no weight bands, so there is nothing to look this shipment up in. ` +
            `Add its bands under Settings → Freight rates.`,
        });
      } else {
        const problems = validateBandCoverage(live.map((entry) => entry.band));
        if (problems.length > 0) {
          coverageProblems.push(...problems);
          refusals.push({
            kind: 'band-coverage',
            message:
              `The weight bands for "${zone.name}" do not fit together, so there is no single right rate ` +
              `for this shipment: ${problems.map((problem) => problem.message).join(' ')}`,
          });
        } else {
          zoneBands = live;
        }
      }
    }
  }

  // ---- the weight ---------------------------------------------------------
  // A shipment that weighs nothing is a different problem from one no band
  // covers, and the estimator needs to be told which it is.
  const weightIsUsable = Number.isFinite(input.weightLbs) && input.weightLbs > 0;
  if (!weightIsUsable) {
    refusals.push({
      kind: 'bad-weight',
      message:
        'There is no estimated shipment weight to look up. Either no line item matched a known ' +
        'material and gauge, or the weight box is empty — type a weight, or enter the freight amount ' +
        'by hand.',
    });
  }

  // ---- the band and its rate ---------------------------------------------
  let matchedBand: ResolvedFreightBand | null = null;
  if (zoneBands !== null && weightIsUsable) {
    matchedBand = bandForWeight(zoneBands, input.weightLbs);
    if (matchedBand === null) {
      refusals.push({
        kind: 'no-band-for-weight',
        message:
          `No weight band covers ${roundToWholePounds(input.weightLbs).toLocaleString('en-US')} lb in ` +
          `"${zoneName ?? 'this zone'}". Add a band that does, or enter the freight amount by hand — ` +
          `the nearest band's rate is not this shipment's rate.`,
      });
    } else if (matchedBand.version === null || matchedBand.version.rateCents === null) {
      refusals.push({
        kind: 'band-rate-blank',
        message:
          `${describeBand(matchedBand.band)} in "${zoneName ?? 'this zone'}" has no rate filled in, so ` +
          `this shipment cannot be priced from the table. A blank is never treated as zero — fill it in ` +
          `under Settings → Freight rates, or enter the amount by hand.`,
      });
    }
  }

  // ---- the adders ---------------------------------------------------------
  // A toggle switched ON whose adder is blank is a question nobody has
  // answered. Answering it with zero would under-charge every residential
  // delivery and every liftgate call AFS ever makes, silently, forever.
  const surcharges = table.surcharges;
  if (input.isResidential && (surcharges === null || surcharges.residentialCents === null)) {
    refusals.push({
      kind: 'residential-adder-blank',
      message:
        'This is marked as a residential delivery, but no residential surcharge has been set, so the ' +
        'estimate would be missing it. Set it under Settings → Freight rates, untick residential, or ' +
        'enter the freight amount by hand.',
    });
  }
  if (input.requiresLiftgate && (surcharges === null || surcharges.liftgateCents === null)) {
    refusals.push({
      kind: 'liftgate-adder-blank',
      message:
        'This job needs a liftgate, but no liftgate upcharge has been set, so the estimate would be ' +
        'missing it. Set it under Settings → Freight rates, untick liftgate, or enter the freight ' +
        'amount by hand.',
    });
  }

  if (refusals.length > 0) {
    return { ok: false, refusals, freightClass, requiresManualEntry, coverageProblems };
  }

  // ---- the figure ---------------------------------------------------------
  // Every value below is re-read through an explicit guard rather than asserted
  // non-null. The guards cannot fire if the checks above are complete, and if a
  // future edit ever makes one incomplete this returns an honest refusal rather
  // than a wrong number or a thrown error inside a React render.
  if (matchedBand === null || matchedBand.version === null || matchedBand.version.rateCents === null) {
    return {
      ok: false,
      freightClass,
      requiresManualEntry,
      coverageProblems,
      refusals: [
        {
          kind: 'band-rate-blank',
          message:
            'No freight rate could be resolved for this shipment. Enter the amount by hand, or check ' +
            'the bands and rates under Settings → Freight rates.',
        },
      ],
    };
  }

  const baseRateCents = matchedBand.version.rateCents;
  const residentialCents = input.isResidential ? (surcharges?.residentialCents ?? 0) : 0;
  const liftgateCents = input.requiresLiftgate ? (surcharges?.liftgateCents ?? 0) : 0;

  const threshold = surcharges?.freeFreightThresholdCents ?? null;
  // `>=` — an order landing exactly on the threshold qualifies. A threshold is
  // a promise ("free freight over $5,000"), and a promise that excludes the
  // number in it is the kind of thing customers notice.
  const freeFreightApplied = threshold !== null && input.merchandiseSubtotalCents >= threshold;

  // All three are already integer cents, so the sum is exact and nothing is
  // rounded here. The only rounding anywhere in this library is the weight's,
  // in `roundToWholePounds`.
  const totalCents = freeFreightApplied ? 0 : baseRateCents + residentialCents + liftgateCents;

  const notes: string[] = [];
  if (freeFreightApplied && threshold !== null) {
    notes.push(
      `This order reaches the free freight threshold of $${(threshold / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}, so freight is $0.00.`
    );
  }
  if (threshold === null) {
    notes.push(
      'No free freight threshold has been set, so that rule was not applied. If AFS gives free freight ' +
        'over a certain order value, set it under Settings → Freight rates.'
    );
  }
  if (input.weightMatchedItems < input.weightTotalItems) {
    notes.push(
      `The weight is based on ${input.weightMatchedItems} of ${input.weightTotalItems} line items — the ` +
        `rest did not match a known material and gauge, so the real shipment is heavier than this. ` +
        `Check the band before you send it.`
    );
  }

  const breakdown: FreightBreakdown = {
    baseRateCents,
    residentialCents,
    liftgateCents,
    freeFreightApplied,
    totalCents,
    bandId: matchedBand.band.id,
    rateVersionId: matchedBand.version.id,
    surchargeVersionId: surcharges?.id ?? null,
  };

  return {
    ok: true,
    freightClass,
    requiresManualEntry: false,
    estimate: {
      breakdown,
      freightClass,
      weightLbsUsed: roundToWholePounds(input.weightLbs),
      zoneName: zoneName ?? '',
      notes,
    },
  };
}
