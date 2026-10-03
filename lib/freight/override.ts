/**
 * THE OVERRIDE AND THE AUDIT RECORD. Pure — builds the `freight_estimates` row
 * from an estimate result and whatever the estimator actually typed, so the
 * shape can be unit-tested against migration 039's CHECK constraints without a
 * database.
 *
 * ================== `basis` IS THE WHOLE POINT ==================
 *
 * Freight is the one line on an AFS quote with no cost basis behind it yet, so
 * the question that will be asked about it later is always the same: WHERE DID
 * THIS NUMBER COME FROM. `basis` answers it in one word, and the row keeps both
 * figures so the answer can be checked rather than taken on trust.
 *
 *   estimate — the rate table produced it and nobody changed it.
 *   override — the table produced one and the estimator typed a different
 *              figure. BOTH are kept, so "we quoted $180 where the table said
 *              $234" is a fact in the dataset rather than a lost decision.
 *   manual   — the table could not produce a figure at all (blank rate, no
 *              band, oversize piece, nothing configured) and the estimator
 *              typed one. `computedCents` is null and `refusals` records WHY
 *              there was nothing to compare against.
 *
 * ================== AN OVERRIDE OF ZERO IS A REAL OVERRIDE ==================
 *
 * "Freight waived on this one" is a decision somebody made, and it must be
 * recorded as a decision rather than as an absent value. So every amount in
 * this module is compared against `null` and NEVER tested for falsiness. A
 * single `if (overrideCents)` anywhere here would silently reclassify every
 * waived-freight job as "calculated from the table", which is the exact
 * opposite of what happened.
 *
 * For the same reason an override that happens to EQUAL the computed figure is
 * still `override`: the estimator typed it, and the audit trail records what
 * was done, not what turned out to be redundant.
 */
import type {
  FreightAuditDelta,
  FreightBasis,
  FreightEstimateRecord,
  FreightEstimateResult,
  FreightInput,
} from './types';

/** Why a record could not be built. Returned, not thrown — see below. */
export interface FreightRecordProblem {
  kind: 'nothing-to-record' | 'bad-override';
  message: string;
}

export type FreightRecordResult =
  | { ok: true; record: FreightEstimateRecord }
  | { ok: false; problem: FreightRecordProblem };

export interface BuildFreightRecordInput {
  /** What `estimateFreight` returned for this job. */
  result: FreightEstimateResult;
  /** The inputs it was given, so the record keeps them as they were. */
  input: FreightInput;
  /**
   * What the estimator typed in the freight box, in cents, or `null` for an
   * empty box. `0` is a real figure — freight waived by hand.
   */
  overrideCents: number | null;
  overrideReason?: string | null;
}

function isWholeNonNegativeCents(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * The `freight_estimates` row for one freight decision, or the reason there
 * isn't one.
 *
 * RETURNS a problem rather than throwing: this is called from a request handler
 * that must answer the estimator in a sentence, and from a code path that has
 * already created nothing — a throw here would turn "you left the freight box
 * empty and the table could not price it" into a 500.
 *
 * THE ONE CASE WITH NOTHING TO RECORD is no computed figure and no typed one.
 * There is then no freight to put on the quote at all, so there is nothing to
 * be the subject of an audit row, and inventing a 0 to fill it would be exactly
 * the fabrication this whole feature is built to avoid.
 */
export function buildFreightEstimateRecord(
  args: BuildFreightRecordInput
): FreightRecordResult {
  const { result, input, overrideCents } = args;
  const overrideReason =
    typeof args.overrideReason === 'string' && args.overrideReason.trim() !== ''
      ? args.overrideReason.trim()
      : null;

  if (overrideCents !== null && !isWholeNonNegativeCents(overrideCents)) {
    return {
      ok: false,
      problem: {
        kind: 'bad-override',
        message:
          `A freight amount of ${overrideCents} is not a whole number of cents at or above zero. ` +
          `Enter a dollar amount like 185 or 185.50.`,
      },
    };
  }

  const computedCents = result.ok ? result.estimate.breakdown.totalCents : null;

  if (computedCents === null && overrideCents === null) {
    return {
      ok: false,
      problem: {
        kind: 'nothing-to-record',
        message:
          'There is no freight figure to put on this quote: the rate table could not produce one and ' +
          'none was typed in. Enter an amount, or leave freight off the quote entirely.',
      },
    };
  }

  // Compared against null, never tested for falsiness — see the header. An
  // override of 0 takes the first branch here, which is the point.
  let basis: FreightBasis;
  let finalCents: number;
  if (overrideCents !== null) {
    basis = computedCents === null ? 'manual' : 'override';
    finalCents = overrideCents;
  } else {
    basis = 'estimate';
    // computedCents cannot be null on this branch: the pair being null is the
    // nothing-to-record case already returned above.
    finalCents = computedCents ?? 0;
  }

  const breakdown = result.ok ? result.estimate.breakdown : null;

  return {
    ok: true,
    record: {
      zoneId: input.zoneId,
      zoneName: result.ok ? result.estimate.zoneName : null,
      weightLbs: input.weightLbs,
      weightMatchedItems: input.weightMatchedItems,
      weightTotalItems: input.weightTotalItems,
      longestPieceFt: input.longestPieceFt,
      freightClass: result.freightClass,
      isResidential: input.isResidential,
      requiresLiftgate: input.requiresLiftgate,
      merchandiseSubtotalCents: input.merchandiseSubtotalCents,

      basis,
      computedCents,
      overrideCents,
      finalCents,

      bandId: breakdown?.bandId ?? null,
      // An array rather than a single id, matching the uuid[] column: a future
      // per-cwt rate (UNRESOLVED-01) could resolve through more than one
      // version, and a column that cannot hold that would have to be migrated.
      rateVersionIds: breakdown ? [breakdown.rateVersionId] : [],
      surchargeVersionId: breakdown?.surchargeVersionId ?? null,
      breakdown,
      // Kept on an override too, not only on a manual entry: "the table said
      // $234 and it was sent at $180, and here is what the table was unsure
      // about" is more use later than either half on its own.
      refusals: result.ok ? [] : result.refusals,
      notes: result.ok ? result.estimate.notes : [],
      overrideReason,
    },
  };
}

/**
 * The old → new pair for `admin_audit_log`.
 *
 * `old` is what the rate table computed — `null` when it could not compute
 * anything, which is itself the fact worth recording — and `new` is what went
 * on the quote. `old.basis` is always null because the table has no basis of
 * its own: the basis is the decision, and the decision is the new value.
 */
export function auditDelta(record: FreightEstimateRecord): FreightAuditDelta {
  return {
    old: { freightCents: record.computedCents, basis: null },
    new: { freightCents: record.finalCents, basis: record.basis },
  };
}

/**
 * `finalCents` as the dollars `quotes.freight` holds.
 *
 * `quotes.freight` is `DECIMAL(10,2)` and predates this work by six migrations
 * (001), while every table migration 039 adds speaks cents. This is the ONE
 * conversion boundary, and it is exact: an integer number of cents divided by
 * 100 is exactly representable as a float for any amount this business will
 * ever invoice, and `DECIMAL(10,2)` stores it without rounding. Migrating the
 * legacy column is recorded as UNRESOLVED-05 rather than done here — five other
 * modules read it.
 */
export function finalCentsToQuoteDollars(finalCents: number): number {
  return finalCents / 100;
}
