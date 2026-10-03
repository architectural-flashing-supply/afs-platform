/**
 * BAND BOUNDARIES AND RATE VERSIONS. Pure — the rules that decide which band a
 * shipment falls in and which rate was in force on a given day, with no
 * database in the way.
 *
 * ================== WHY `[min, max)` AND NOT `[min, max]` ==================
 *
 * A band covers `minWeightLbs <= w < maxWeightLbs`: INCLUSIVE FLOOR, EXCLUSIVE
 * CEILING. Carriers publish bands as "0–499 lb, 500–999 lb", which reads like a
 * closed range, and implementing it as one is the mistake this convention
 * exists to prevent. With closed ranges, bands written as `[0,500]` and
 * `[500,1000]` BOTH contain 500 and the lookup silently returns whichever
 * sorted first; bands written as `[0,499]` and `[500,999]` leave 499.5 covered
 * by nothing. With a half-open convention, `[0,500)` and `[500,1000)` are
 * exactly contiguous — no gap, no overlap — and a shipment of exactly 500 lb
 * belongs to exactly one band, every time, without anybody having to remember
 * which end is inclusive.
 *
 * `maxWeightLbs === null` is the OPEN-ENDED TOP BAND and covers everything at
 * or above its floor. There may be at most one per zone, which is a rule across
 * rows and therefore lives in `validateBandCoverage` rather than in a database
 * CHECK.
 *
 * ================== WHY A FAULTY TABLE IS A REFUSAL ==================
 *
 * `validateBandCoverage` finds the faults a single row cannot carry — an
 * overlap, a gap, a second open-ended band, a duplicated floor. `estimateFreight`
 * REFUSES on any of them and names the bands involved. It does not fall back to
 * first-match-wins, because the output of this code is a dollar figure on a
 * customer's formal quote: a wrong freight charge that looks right is strictly
 * worse than no freight charge at all, and only one of the two gets noticed.
 */
import type {
  BandCoverageProblem,
  FreightRateBand,
  FreightRateVersion,
  FreightSurcharges,
  ResolvedFreightBand,
} from './types';

/** YYYY-MM-DD, in the same terms `lib/pricing/price-book.ts` uses. */
export function toEffectiveDate(value: Date | string): string {
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Not a date: ${value}`);
    return parsed.toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/** How a band reads in a message: "500–999 lb", or "1,000 lb and over". */
export function describeBand(band: FreightRateBand): string {
  const min = band.minWeightLbs.toLocaleString('en-US');
  if (band.maxWeightLbs === null) return `${min} lb and over`;
  // The printed top is maxWeightLbs - 1 because the stored bound is EXCLUSIVE:
  // a band stored as [500, 1000) is the carrier's "500–999 lb".
  return `${min}–${(band.maxWeightLbs - 1).toLocaleString('en-US')} lb`;
}

/**
 * THE ONE PLACE A SHIPMENT WEIGHT IS ROUNDED.
 *
 * Freight tariffs are published in whole pounds, and the weight reaching this
 * code is a float — `estimateShipmentWeight` sums `weight_lbs_sqft` across line
 * items and rounds to two decimals. So the band lookup rounds to the nearest
 * whole pound FIRST and compares integers: 499.5 lb is a 500 lb shipment and
 * belongs to the upper band; 499.4 lb is a 499 lb shipment and belongs to the
 * lower one. Comparing the raw float instead would make the boundary depend on
 * floating-point representation of a sum, which is not a thing anybody should
 * have to reason about when a dollar figure comes out the other end.
 */
export function roundToWholePounds(weightLbs: number): number {
  return Math.round(weightLbs);
}

/** Only bands that can take new work: retired ones keep history and nothing else. */
function liveBands(bands: readonly FreightRateBand[]): FreightRateBand[] {
  return bands.filter((band) => band.retiredAt === null);
}

/** The same filter, for bands that already carry their resolved rate. */
function liveResolvedBands(bands: readonly ResolvedFreightBand[]): ResolvedFreightBand[] {
  return bands.filter((entry) => entry.band.retiredAt === null);
}

function sortByFloor(a: FreightRateBand, b: FreightRateBand): number {
  if (a.minWeightLbs !== b.minWeightLbs) return a.minWeightLbs - b.minWeightLbs;
  const aMax = a.maxWeightLbs === null ? Number.POSITIVE_INFINITY : a.maxWeightLbs;
  const bMax = b.maxWeightLbs === null ? Number.POSITIVE_INFINITY : b.maxWeightLbs;
  return aMax - bMax;
}

/**
 * The band a shipment of `weightLbs` falls in, or `null` when none covers it.
 *
 * `null` is a real answer and the caller must handle it — `estimateFreight`
 * turns it into a `no-band-for-weight` refusal naming the weight. There is
 * deliberately no nearest-band fallback: a shipment heavier than the top band
 * is a shipment nobody has priced, and charging it the top band's rate would be
 * inventing a number.
 *
 * A non-finite or negative weight returns `null` rather than throwing, so a
 * half-typed box in the UI renders as "no estimate" instead of a crash.
 * `estimateFreight` reports it as `bad-weight` separately, because a shipment
 * that weighs nothing is a different problem from one no band covers.
 *
 * The bands are sorted by floor before the walk, so the answer does not depend
 * on the order they arrive in. On a table `validateBandCoverage` has passed only
 * one band can match anyway, but a caller that skipped that check still gets a
 * deterministic answer rather than one that depends on `displayOrder`.
 */
export function bandForWeight(
  bands: readonly ResolvedFreightBand[],
  weightLbs: number
): ResolvedFreightBand | null {
  if (!Number.isFinite(weightLbs) || weightLbs < 0) return null;
  const pounds = roundToWholePounds(weightLbs);

  const ordered = liveResolvedBands(bands).sort((a, b) => sortByFloor(a.band, b.band));
  for (const entry of ordered) {
    const { minWeightLbs, maxWeightLbs } = entry.band;
    if (pounds < minWeightLbs) continue;
    if (maxWeightLbs === null) return entry;
    if (pounds < maxWeightLbs) return entry;
  }
  return null;
}

/**
 * Every structural fault in one zone's bands, each naming the bands involved.
 *
 * Retired bands are ignored throughout: a retired band overlapping a live one is
 * not a fault, it is history.
 *
 * NOT reported as faults, both on purpose:
 *  - A CLOSED top band. A table that stops at 2,000 lb is a legitimate choice —
 *    heavier shipments get a `no-band-for-weight` refusal and a phone call to
 *    the carrier, which is the honest outcome.
 *  - A lowest floor above zero. Same reasoning: a 50 lb shipment under a table
 *    that starts at 100 lb is unpriced, not contradictory.
 * Both of those produce a refusal at estimate time with the weight named. A
 * fault here is reserved for a table that CONTRADICTS ITSELF, because that is
 * the only kind that could make a lookup return a confidently wrong rate.
 */
export function validateBandCoverage(
  bands: readonly FreightRateBand[]
): BandCoverageProblem[] {
  const problems: BandCoverageProblem[] = [];
  const live = liveBands(bands);

  if (live.length === 0) {
    problems.push({
      kind: 'no-bands',
      bandIds: [],
      message:
        'This zone has no weight bands, so there is nothing to look a shipment up in. ' +
        'Add the bands your carrier bills — for example 0–499 lb, 500–999 lb, 1,000 lb and over.',
    });
    return problems;
  }

  // ---- faults a single band carries on its own --------------------------
  for (const band of live) {
    if (band.minWeightLbs < 0) {
      problems.push({
        kind: 'negative-min',
        bandIds: [band.id],
        message: `A band cannot start below 0 lb, and this one starts at ${band.minWeightLbs} lb. Correct its lower weight.`,
      });
    }
    if (band.maxWeightLbs !== null && band.maxWeightLbs <= band.minWeightLbs) {
      problems.push({
        kind: 'max-not-above-min',
        bandIds: [band.id],
        message:
          `The band starting at ${band.minWeightLbs.toLocaleString('en-US')} lb ends at ` +
          `${band.maxWeightLbs.toLocaleString('en-US')} lb, which is not above where it starts, so no shipment ` +
          `can ever fall in it. Raise its upper weight or leave it empty to make it the top band.`,
      });
    }
  }

  // ---- at most one open-ended top band ----------------------------------
  const openEnded = live.filter((band) => band.maxWeightLbs === null);
  if (openEnded.length > 1) {
    problems.push({
      kind: 'multiple-open-ended',
      bandIds: openEnded.map((band) => band.id),
      message:
        `${openEnded.length} bands in this zone have no upper weight, so a heavy shipment could fall in ` +
        `more than one and there is no way to say which rate is right. Give all but one of them an upper weight.`,
    });
  }

  // ---- a floor used twice ----------------------------------------------
  const byFloor = new Map<number, FreightRateBand[]>();
  for (const band of live) {
    const existing = byFloor.get(band.minWeightLbs);
    if (existing) existing.push(band);
    else byFloor.set(band.minWeightLbs, [band]);
  }
  for (const [floor, group] of byFloor) {
    if (group.length > 1) {
      problems.push({
        kind: 'duplicate-min',
        bandIds: group.map((band) => band.id),
        message:
          `${group.length} bands in this zone start at ${floor.toLocaleString('en-US')} lb. ` +
          `A shipment that weight would match more than one, so only one band may start at each weight.`,
      });
    }
  }

  // ---- overlaps and gaps between neighbours -----------------------------
  const sorted = [...live].sort(sortByFloor);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];

    // Already reported as duplicate-min; reporting it again as an overlap
    // would be two complaints about one mistake.
    if (lower.minWeightLbs === upper.minWeightLbs) continue;

    // An open-ended band with anything above it covers that band's whole range.
    if (lower.maxWeightLbs === null) {
      problems.push({
        kind: 'overlap',
        bandIds: [lower.id, upper.id],
        message:
          `The band starting at ${lower.minWeightLbs.toLocaleString('en-US')} lb has no upper weight, so it ` +
          `already covers the band starting at ${upper.minWeightLbs.toLocaleString('en-US')} lb. ` +
          `Give the lower band an upper weight.`,
      });
      continue;
    }

    if (lower.maxWeightLbs > upper.minWeightLbs) {
      problems.push({
        kind: 'overlap',
        bandIds: [lower.id, upper.id],
        message:
          `${describeBand(lower)} and ${describeBand(upper)} overlap, so a shipment between ` +
          `${upper.minWeightLbs.toLocaleString('en-US')} lb and ` +
          `${(lower.maxWeightLbs - 1).toLocaleString('en-US')} lb would match both. ` +
          `Adjust one of them so they meet without crossing.`,
      });
    } else if (lower.maxWeightLbs < upper.minWeightLbs) {
      problems.push({
        kind: 'gap',
        bandIds: [lower.id, upper.id],
        message:
          `Nothing covers ${lower.maxWeightLbs.toLocaleString('en-US')} lb to ` +
          `${(upper.minWeightLbs - 1).toLocaleString('en-US')} lb — ${describeBand(lower)} ends below it and ` +
          `${describeBand(upper)} starts above it. Extend one of them so they meet.`,
      });
    }
  }

  return problems;
}

/**
 * The rate version in force for one band on `asOf`: the latest `effectiveFrom`
 * that is not in the future relative to it.
 *
 * Same contract as `lib/pricing/price-book.ts`'s `versionInForce`, deliberately
 * — two kinds of price that resolve by different rules would be a trap. A
 * version dated tomorrow is NOT in force today, which is what makes "the
 * carrier's increase starts on the first" a safe thing to enter in advance: the
 * quote sent this afternoon still uses today's rate. Two versions on the same
 * day means the one entered later wins, because that is the correction.
 */
export function rateVersionInForce(
  versions: readonly FreightRateVersion[],
  asOf: string
): FreightRateVersion | null {
  let best: FreightRateVersion | null = null;
  for (const version of versions) {
    if (version.effectiveFrom > asOf) continue;
    if (best === null || version.effectiveFrom > best.effectiveFrom) best = version;
    else if (version.effectiveFrom === best.effectiveFrom && version.createdAt > best.createdAt) {
      best = version;
    }
  }
  return best;
}

/**
 * The surcharges in force on `asOf`, by the same rule.
 *
 * `null` means NOTHING HAS EVER BEEN SET — which is this deployment's state, and
 * is a different fact from "set to zero". `estimateFreight` keeps them apart: a
 * null surcharge row with the residential toggle on is a refusal, exactly as a
 * row whose `residentialCents` is null would be.
 */
export function surchargesInForce(
  versions: readonly FreightSurcharges[],
  asOf: string
): FreightSurcharges | null {
  let best: FreightSurcharges | null = null;
  for (const version of versions) {
    if (version.effectiveFrom > asOf) continue;
    if (best === null || version.effectiveFrom > best.effectiveFrom) best = version;
    else if (version.effectiveFrom === best.effectiveFrom && version.createdAt > best.createdAt) {
      best = version;
    }
  }
  return best;
}

/**
 * Bands with their in-force rate attached, in display order.
 *
 * `isPriced` is true only when a version is in force AND its `rateCents` is
 * filled in. A band with a version whose rate is null is NOT priced — that is
 * the blank-is-never-a-zero rule at the point it would otherwise be lost.
 */
export function resolveBands(
  bands: readonly FreightRateBand[],
  versions: readonly FreightRateVersion[],
  asOf: string
): ResolvedFreightBand[] {
  const byBand = new Map<string, FreightRateVersion[]>();
  for (const version of versions) {
    const existing = byBand.get(version.bandId);
    if (existing) existing.push(version);
    else byBand.set(version.bandId, [version]);
  }

  return [...bands]
    .sort((a, b) =>
      a.displayOrder !== b.displayOrder ? a.displayOrder - b.displayOrder : sortByFloor(a, b)
    )
    .map((band) => {
      const version = rateVersionInForce(byBand.get(band.id) ?? [], asOf);
      return {
        band,
        version,
        isPriced: version !== null && version.rateCents !== null,
      };
    });
}
