/**
 * THE DISCRETE CUT PLANNER — pure, deterministic, and it never throws.
 *
 * Given required finished pieces (length, quantity, profile), the stock lengths
 * available and a kerf, it returns which pieces come off which stock piece,
 * what is left over, how much stock is consumed and what proportion is waste.
 *
 * Which question this answers, and which one lib/utils/trim-optimizer.ts
 * answers instead: see ./types.ts's header. They are different questions.
 *
 * ============================== THE KERF MODEL ==============================
 *
 * A stock piece carrying `k` finished cuts totalling `T` is feasible iff
 *
 *     T + (k - 1) * kerf <= S
 *
 * The blade loss lands BETWEEN adjacent pieces. If a gross remainder survives,
 * severing it costs one further cut, so
 *
 *     kerfTotal = (k - 1) * kerf + (grossRemainder > 0 ? kerf : 0)
 *
 * clamped so it can never exceed `S - T`, and the leftover is whatever is left:
 *
 *     leftover = S - T - kerfTotal        (always >= 0)
 *
 * WHY NOT THE SPEC'S MODEL. specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §2 charges one
 * kerf per stock piece (`usable = stock - kerf`). That charges a cut that is not
 * made when a finished piece uses the whole bar, so one 10 ft finished piece
 * would be reported as needing TWO 10 ft bars — and ten of the twelve seeded
 * profiles stock at exactly 10 ft, which makes that the single most common case
 * in the real data. The model above gives one bar, no blade loss, no off-cut.
 *
 * ================= WHY THE IDENTITY HOLDS, NOT JUST ROUGHLY =================
 *
 *     total stock = finished + kerf + leftover
 *
 * is true per stock piece by construction above, and summing integers preserves
 * it. All arithmetic here is in INTEGER SIXTEENTHS of an inch, so the identity
 * survives conversion to inches exactly (1/16 is dyadic — ./sixteenths.ts
 * explains it). optimize.test.ts asserts it with toBe(), not with a tolerance.
 *
 * ============================== DETERMINISM ==============================
 *
 * Stronger than "same input, same output": THE PLAN DOES NOT DEPEND ON INPUT
 * ORDER. Profiles are processed in ascending profile order, stock lengths are
 * de-duplicated and sorted ascending, pieces are expanded then sorted by
 * (length desc, id asc, occurrence asc) — a total order, because ids are unique
 * — and a tie between candidate bars breaks to the lowest bar index. There is
 * no clock, no randomness, no I/O and no module-level mutable state in this
 * file.
 */

import { formatInches } from '@/lib/utils/format-inches';
import {
  ceilToSixteenths,
  floorToSixteenths,
  fromSixteenths,
} from './sixteenths';
import type {
  CutAssignment,
  CutPlan,
  CutPlanError,
  CutPlanErrorCode,
  CutPlanInput,
  CutPlanResult,
  CutStrategy,
  CutTotals,
  ProfilePlan,
  RequiredPiece,
  ResolvedSettings,
  StockCut,
  StockLength,
} from './types';

/**
 * ~1/4 inch blade width. This is specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §2's own
 * default — 0.0208 ft, which is 0.2496 in — snapped up onto the 1/16 grid,
 * landing on exactly the "~1/4 inch blade width" its comment names. Not an
 * invented number.
 */
export const DEFAULT_KERF_IN = 0.25;

export const DEFAULT_STRATEGY: CutStrategy = 'best-fit-decreasing';

/**
 * A COMPUTATIONAL GUARD, NOT A BUSINESS LIMIT. Packing is quadratic in the
 * worst case and this function runs on the main thread of a form, so there has
 * to be a point at which it declines rather than freezing the tab. At the
 * seeded 10 ft standard length, 5,000 pieces is 50,000 linear feet in a single
 * line item — orders of magnitude beyond anything in this repository's data.
 * Above it the engine returns `too_many_pieces` and names the cap.
 */
export const MAX_TOTAL_PIECES = 5000;

/* ------------------------------------------------------------------ internal */

/** One instance of a required piece, in integer sixteenths. */
interface Item {
  pieceId: string;
  lengthS: number;
  /** Expansion order, the final tie-break that makes the sort a total order. */
  occurrence: number;
}

/** One stock size, in integer sixteenths. */
interface Stock {
  lengthS: number;
  label: string | null;
}

/** One bar being filled. */
interface Bin {
  stock: Stock;
  items: Item[];
  /** Sum of the finished cuts on this bar, sixteenths. */
  finishedS: number;
  /**
   * How long a piece could still be added: S - finished - k * kerf. May go
   * NEGATIVE once the bar is full enough that the next cut's blade loss alone
   * would overrun it, which correctly means "nothing more fits". It is NOT the
   * leftover — that is computed once, at the end, by `closeBin`.
   */
  remainingS: number;
}

function fail(
  code: CutPlanErrorCode,
  message: string,
  details: Partial<CutPlanError['details']> = {}
): CutPlanResult {
  return {
    ok: false,
    error: {
      code,
      message,
      details: {
        pieceIds: details.pieceIds ?? [],
        longestStockLengthIn: details.longestStockLengthIn ?? null,
        limit: details.limit ?? null,
      },
    },
  };
}

/* ---------------------------------------------------------------- packing */

function openBin(stock: Stock): Bin {
  return { stock, items: [], finishedS: 0, remainingS: stock.lengthS };
}

function place(bin: Bin, item: Item, kerfS: number): void {
  bin.items.push(item);
  bin.finishedS += item.lengthS;
  // Before: S - T - k*kerf. After: S - (T+L) - (k+1)*kerf.
  bin.remainingS -= item.lengthS + kerfS;
}

/**
 * Pack one profile's items into bars drawn from `stocks` (ascending).
 *
 * `maxRemainingBound` is an UPPER BOUND on every open bar's remaining capacity,
 * never an exact maximum — and that is what keeps the pathological shape cheap.
 * Items arrive longest-first, so when the bound says the current item cannot
 * fit anywhere, no scan is needed at all; that is the "every piece needs its own
 * bar" case, which would otherwise be the quadratic one. Placing into a bar only
 * lowers its capacity, so the bound stays valid; a full scan tightens it to the
 * true maximum for free, and opening a bar raises it.
 *
 * Returns null only if an item fits no stock length, which the caller has
 * already ruled out — it is a guard, not a path.
 */
function packItems(
  items: Item[],
  stocks: Stock[],
  kerfS: number,
  strategy: CutStrategy
): Bin[] | null {
  const bins: Bin[] = [];
  let maxRemainingBound = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    let chosen = -1;

    if (item.lengthS <= maxRemainingBound) {
      if (strategy === 'first-fit-decreasing') {
        let trueMax = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < bins.length; i += 1) {
          if (item.lengthS <= bins[i].remainingS) {
            chosen = i;
            break;
          }
          if (bins[i].remainingS > trueMax) trueMax = bins[i].remainingS;
        }
        // Only a COMPLETE scan licenses tightening the bound.
        if (chosen === -1) maxRemainingBound = trueMax;
      } else {
        let trueMax = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < bins.length; i += 1) {
          const remaining = bins[i].remainingS;
          if (remaining > trueMax) trueMax = remaining;
          // Tightest fit wins; a tie keeps the lower index.
          if (item.lengthS <= remaining && (chosen === -1 || remaining < bins[chosen].remainingS)) {
            chosen = i;
          }
        }
        maxRemainingBound = trueMax;
      }
    }

    if (chosen === -1) {
      // The shortest stock that can hold this piece. `stocks` is ascending, so
      // `find` is that choice, and R-15's candidate evaluation in
      // `planProfile` is what stops this local rule being the whole decision.
      const stock = stocks.find((candidate) => item.lengthS <= candidate.lengthS);
      if (!stock) return null;
      bins.push(openBin(stock));
      chosen = bins.length - 1;
    }

    place(bins[chosen], item, kerfS);
    if (bins[chosen].remainingS > maxRemainingBound) {
      maxRemainingBound = bins[chosen].remainingS;
    }
  }

  return bins;
}

/** Finished / kerf / leftover for a filled bar, per the kerf model above. */
function closeBin(bin: Bin, kerfS: number): { kerfTotalS: number; leftoverS: number } {
  const cutCount = bin.items.length;
  if (cutCount === 0) return { kerfTotalS: 0, leftoverS: bin.stock.lengthS };

  const betweenCuts = (cutCount - 1) * kerfS;
  const grossRemainderS = bin.stock.lengthS - bin.finishedS - betweenCuts;
  const severingCut = grossRemainderS > 0 ? kerfS : 0;
  // The clamp is what keeps leftover >= 0 when the gross remainder is thinner
  // than the blade: the blade eats the whole remnant and nothing survives.
  const kerfTotalS = Math.min(betweenCuts + severingCut, bin.stock.lengthS - bin.finishedS);

  return { kerfTotalS, leftoverS: bin.stock.lengthS - bin.finishedS - kerfTotalS };
}

/* ------------------------------------------------------------- plan assembly */

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

function instructionsFor(
  stockLengthS: number,
  cuts: CutAssignment[],
  kerfTotalS: number,
  leftoverS: number
): string {
  const stock = formatInches(fromSixteenths(stockLengthS));

  if (cuts.length === 1 && kerfTotalS === 0 && leftoverS === 0) {
    return `Use the full ${stock} stock piece — no cut needed`;
  }

  // Identical lengths are grouped ("3 × 48\"") rather than listed one by one.
  // Two reasons: it is how a cut sheet is actually read, and it bounds the
  // string by the number of DISTINCT lengths on the bar instead of by the
  // number of cuts — 1,920 sixteenth-inch pieces off one 10 ft bar is a legal
  // input, and enumerating it would produce an unreadable sentence. Grouping
  // adjacent runs is complete grouping here, because pieces are placed
  // longest-first, so each bar's cuts are already in non-increasing order.
  const groups: { lengthIn: number; count: number }[] = [];
  for (const cut of cuts) {
    const last = groups[groups.length - 1];
    if (last && last.lengthIn === cut.lengthIn) last.count += 1;
    else groups.push({ lengthIn: cut.lengthIn, count: 1 });
  }
  const lengths = groups
    .map((group) =>
      group.count === 1
        ? formatInches(group.lengthIn)
        : `${group.count} × ${formatInches(group.lengthIn)}`
    )
    .join(', ');
  const noun = cuts.length === 1 ? 'piece' : 'pieces';
  const blade =
    kerfTotalS > 0 ? `, ${formatInches(fromSixteenths(kerfTotalS))} blade loss` : '';
  const offcut =
    leftoverS > 0 ? `, ${formatInches(fromSixteenths(leftoverS))} off-cut` : ', no off-cut';

  return `Cut ${cuts.length} ${noun} from ${stock} stock: ${lengths}${blade}${offcut}`;
}

interface SixteenthTotals {
  requiredS: number;
  stockS: number;
  kerfS: number;
  leftoverS: number;
  stockPieceCount: number;
}

function toTotals(sums: SixteenthTotals): CutTotals {
  const wasteS = sums.kerfS + sums.leftoverS;
  return {
    requiredLengthIn: fromSixteenths(sums.requiredS),
    totalStockLengthIn: fromSixteenths(sums.stockS),
    kerfLengthIn: fromSixteenths(sums.kerfS),
    leftoverLengthIn: fromSixteenths(sums.leftoverS),
    wasteLengthIn: fromSixteenths(wasteS),
    wastePercent: percent(wasteS, sums.stockS),
    stockPieceCount: sums.stockPieceCount,
  };
}

/** A packed candidate, before it is turned into the public shape. */
interface Candidate {
  bins: Bin[];
  closed: { kerfTotalS: number; leftoverS: number }[];
  wasteS: number;
}

function evaluate(bins: Bin[], kerfS: number): Candidate {
  const closed = bins.map((bin) => closeBin(bin, kerfS));
  const wasteS = closed.reduce((sum, b) => sum + b.kerfTotalS + b.leftoverS, 0);
  return { bins, closed, wasteS };
}

/**
 * R-15: MULTIPLE STOCK LENGTHS ARE EVALUATED, NOT GUESSED.
 *
 * One candidate plan per distinct stock length used ALONE, plus one that may
 * mix them, and the least-waste candidate wins. Ties break to fewer bars, then
 * to the earlier candidate — and the candidate order is canonical (singles in
 * ascending length, mixed last), so the whole choice is deterministic.
 *
 * Why not simply let a new bar take the shortest stock that fits the piece:
 * with 60 in pieces and {120 in, 240 in} available, that rule puts one piece on
 * each 120 in bar for ~50% waste, where 240 in bars carry three for ~25%.
 * Shipping that when the input is plural by contract would be a knowingly poor
 * answer, so the engine tries both and reports the better one.
 */
function planProfile(items: Item[], stocks: Stock[], kerfS: number, strategy: CutStrategy): Candidate {
  const candidateSets: Stock[][] = stocks.map((stock) => [stock]);
  if (stocks.length > 1) candidateSets.push(stocks);

  let best: Candidate | null = null;
  for (const set of candidateSets) {
    const bins = packItems(items, set, kerfS, strategy);
    if (!bins) continue; // this single stock length is too short for some piece
    const candidate = evaluate(bins, kerfS);
    if (
      best === null ||
      candidate.wasteS < best.wasteS ||
      (candidate.wasteS === best.wasteS && candidate.bins.length < best.bins.length)
    ) {
      best = candidate;
    }
  }

  // Unreachable: validation has already proved every piece fits the longest
  // stock length, so the single-stock candidate for that length always packs.
  // Returning an empty plan rather than throwing keeps the no-throw guarantee
  // total instead of nearly total.
  return best ?? { bins: [], closed: [], wasteS: 0 };
}

/* ------------------------------------------------------------------- public */

function resolveSettings(input: CutPlanInput): ResolvedSettings {
  return {
    kerfIn: input.settings?.kerfIn ?? DEFAULT_KERF_IN,
    strategy: input.settings?.strategy ?? DEFAULT_STRATEGY,
  };
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function validatePieces(pieces: RequiredPiece[]): CutPlanResult | null {
  const badIds: string[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const piece of pieces) {
    // typeof, not just a truthiness check: the real caller is a form, so a
    // field that never got filled in arrives as undefined at runtime however
    // the type says `string`. Validating at the boundary is the point of this
    // function.
    const id = typeof piece.id === 'string' ? piece.id.trim() : '';
    const profile = typeof piece.profile === 'string' ? piece.profile : '';
    if (
      !isNonEmptyString(id) ||
      !isNonEmptyString(profile) ||
      !Number.isFinite(piece.lengthIn) ||
      piece.lengthIn <= 0 ||
      !Number.isFinite(piece.quantity) ||
      !Number.isInteger(piece.quantity) ||
      piece.quantity < 0
    ) {
      badIds.push(id || '(missing id)');
      continue;
    }
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }

  if (badIds.length > 0) {
    return fail(
      'invalid_piece',
      `No cut plan was produced. ${badIds.length === 1 ? 'One required piece is' : `${badIds.length} required pieces are`} incomplete: every piece needs an id, a profile, a length greater than zero, and a whole-number quantity of zero or more.`,
      { pieceIds: badIds }
    );
  }

  if (duplicates.length > 0) {
    return fail(
      'duplicate_piece_id',
      `No cut plan was produced. Two or more required pieces share the same id (${duplicates.join(', ')}), so a cut could not be traced back to the line that asked for it.`,
      { pieceIds: duplicates }
    );
  }

  return null;
}

/**
 * Plan the cuts. Returns a result, never throws, for any input of the declared
 * types — including a piece longer than every stock length, which is the one
 * failure a human most needs told in words.
 */
export function optimizeCutPlan(input: CutPlanInput): CutPlanResult {
  const settings = resolveSettings(input);

  if (!Number.isFinite(settings.kerfIn) || settings.kerfIn < 0) {
    return fail(
      'invalid_kerf',
      'No cut plan was produced. The blade width (kerf) must be zero or a positive number of inches.'
    );
  }
  const kerfS = ceilToSixteenths(settings.kerfIn);

  if (input.stockLengths.length === 0) {
    return fail(
      'no_stock_lengths',
      'No cut plan was produced. No stock length was given, so there is nothing to cut from.'
    );
  }

  const badStock = input.stockLengths.filter(
    (stock) => !Number.isFinite(stock.lengthIn) || stock.lengthIn <= 0 || floorToSixteenths(stock.lengthIn) <= 0
  );
  if (badStock.length > 0) {
    return fail(
      'invalid_stock_length',
      `No cut plan was produced. ${badStock.length === 1 ? 'A stock length is' : `${badStock.length} stock lengths are`} not a usable measurement: each must be longer than one sixteenth of an inch.`
    );
  }

  const pieceProblem = validatePieces(input.pieces);
  if (pieceProblem) return pieceProblem;

  // De-duplicate and sort the stock lengths. Two entries that snap to the same
  // grid length are the same bar.
  //
  // The surviving LABEL is the one that sorts first, not the one that came
  // first in the array — "first wins" would have made the plan depend on input
  // order, which is exactly the property this engine promises not to have.
  const labelsBySixteenths = new Map<number, string[]>();
  for (const stock of input.stockLengths) {
    const lengthS = floorToSixteenths(stock.lengthIn);
    const labels = labelsBySixteenths.get(lengthS) ?? [];
    if (typeof stock.label === 'string') labels.push(stock.label);
    labelsBySixteenths.set(lengthS, labels);
  }
  const stocks: Stock[] = [...labelsBySixteenths.entries()]
    .map(([lengthS, labels]) => ({ lengthS, label: [...labels].sort()[0] ?? null }))
    .sort((a, b) => a.lengthS - b.lengthS);
  const longestStockS = stocks[stocks.length - 1].lengthS;

  const totalPieces = input.pieces.reduce((sum, piece) => sum + piece.quantity, 0);
  if (totalPieces > MAX_TOTAL_PIECES) {
    return fail(
      'too_many_pieces',
      `No cut plan was produced. This request is for ${totalPieces} pieces and the planner handles up to ${MAX_TOTAL_PIECES} in one pass — split the job and plan it in parts.`,
      { limit: MAX_TOTAL_PIECES }
    );
  }

  // A piece longer than every bar can never be planned, whatever the packing.
  const tooLong = input.pieces.filter(
    (piece) => piece.quantity > 0 && ceilToSixteenths(piece.lengthIn) > longestStockS
  );
  if (tooLong.length > 0) {
    return fail(
      'piece_exceeds_stock',
      `No cut plan was produced. ${tooLong.length === 1 ? 'One required piece is' : `${tooLong.length} required pieces are`} longer than the longest stock length available (${formatInches(fromSixteenths(longestStockS))}), so ${tooLong.length === 1 ? 'it' : 'they'} cannot be cut from stock at all.`,
      {
        pieceIds: tooLong.map((piece) => piece.id.trim()),
        longestStockLengthIn: fromSixteenths(longestStockS),
      }
    );
  }

  // Group by profile — a bar is never shared between profiles (types.ts).
  const byProfile = new Map<string, Item[]>();
  let occurrence = 0;
  for (const piece of input.pieces) {
    const profile = piece.profile.trim();
    const lengthS = ceilToSixteenths(piece.lengthIn);
    const items = byProfile.get(profile) ?? [];
    for (let n = 0; n < piece.quantity; n += 1) {
      items.push({ pieceId: piece.id.trim(), lengthS, occurrence });
      occurrence += 1;
    }
    byProfile.set(profile, items);
  }

  const profiles: ProfilePlan[] = [];
  const planTotals: SixteenthTotals = {
    requiredS: 0,
    stockS: 0,
    kerfS: 0,
    leftoverS: 0,
    stockPieceCount: 0,
  };
  let stockIndex = 0;

  // Ascending profile order, by code unit — locale-independent and therefore
  // the same on every machine.
  for (const profile of [...byProfile.keys()].sort()) {
    const items = [...(byProfile.get(profile) ?? [])].sort(
      (a, b) =>
        b.lengthS - a.lengthS ||
        (a.pieceId < b.pieceId ? -1 : a.pieceId > b.pieceId ? 1 : 0) ||
        a.occurrence - b.occurrence
    );

    // A profile whose every line is zero quantity contributes no bars at all,
    // and is omitted rather than shown as an empty group.
    if (items.length === 0) continue;

    const candidate = planProfile(items, stocks, kerfS, settings.strategy);

    const stockPieces: StockCut[] = [];
    const profileSums: SixteenthTotals = {
      requiredS: 0,
      stockS: 0,
      kerfS: 0,
      leftoverS: 0,
      stockPieceCount: candidate.bins.length,
    };

    candidate.bins.forEach((bin, i) => {
      const { kerfTotalS, leftoverS } = candidate.closed[i];
      const cuts: CutAssignment[] = bin.items.map((item) => ({
        pieceId: item.pieceId,
        profile,
        lengthIn: fromSixteenths(item.lengthS),
      }));

      stockIndex += 1;
      stockPieces.push({
        index: stockIndex,
        profile,
        stockLengthIn: fromSixteenths(bin.stock.lengthS),
        stockLabel: bin.stock.label,
        cuts,
        finishedLengthIn: fromSixteenths(bin.finishedS),
        kerfTotalIn: fromSixteenths(kerfTotalS),
        leftoverIn: fromSixteenths(leftoverS),
        utilizationPercent: percent(bin.finishedS, bin.stock.lengthS),
        cuttingInstructions: instructionsFor(bin.stock.lengthS, cuts, kerfTotalS, leftoverS),
      });

      profileSums.requiredS += bin.finishedS;
      profileSums.stockS += bin.stock.lengthS;
      profileSums.kerfS += kerfTotalS;
      profileSums.leftoverS += leftoverS;
    });

    profiles.push({
      profile,
      stockPieces,
      stockLengthsUsedIn: [...new Set(candidate.bins.map((bin) => bin.stock.lengthS))]
        .sort((a, b) => a - b)
        .map(fromSixteenths),
      totals: toTotals(profileSums),
    });

    planTotals.requiredS += profileSums.requiredS;
    planTotals.stockS += profileSums.stockS;
    planTotals.kerfS += profileSums.kerfS;
    planTotals.leftoverS += profileSums.leftoverS;
    planTotals.stockPieceCount += profileSums.stockPieceCount;
  }

  const plan: CutPlan = {
    profiles,
    totals: toTotals(planTotals),
    // The kerf is echoed as the value actually RESERVED (snapped up onto the
    // grid), not as it was typed — otherwise the plan would report a blade
    // width the arithmetic did not use.
    settings: { kerfIn: fromSixteenths(kerfS), strategy: settings.strategy },
  };

  return { ok: true, plan };
}

/** Convenience for callers holding feet, as `product_profiles` does. */
export function stockLengthFromFeet(feet: number, label?: string): StockLength {
  return { lengthIn: feet * 12, ...(label === undefined ? {} : { label }) };
}
