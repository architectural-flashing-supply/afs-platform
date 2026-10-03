/**
 * CONTRACTS FOR THE DISCRETE CUT PLANNER.
 *
 * ================== WHICH QUESTION THIS LIBRARY ANSWERS ==================
 *
 * There are two different cut-list questions in this codebase and they have two
 * different answers. Keeping them apart is deliberate:
 *
 *   lib/utils/trim-optimizer.ts  — "how much STOCK does this many LINEAR FEET
 *     consume?" That is the right question for a lapped continuous run (a 180 LF
 *     coping run made of overlapping 10 ft sticks), it is the algorithm
 *     specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §2 specifies, and it is what the
 *     customer's quote form already prints. Its numbers are not changed here.
 *
 *   lib/trim-optimizer/ (this one) — "which DISCRETE FINISHED PIECES come off
 *     which stock piece?" That is the fabrication question: a list of required
 *     pieces with their own lengths and quantities, packed into bars. It is the
 *     only one of the two that can say "a 12 ft piece cannot be made from 10 ft
 *     stock", which is why it has an explicit error result and the other does
 *     not.
 *
 * Neither is implemented in terms of the other, because neither is a special
 * case of the other.
 *
 * EVERY LENGTH IN THIS FILE IS INCHES. The engine works internally in integer
 * sixteenths (see ./sixteenths.ts) and converts at the boundary, so every
 * length handed back here is an exact multiple of 1/16 in.
 *
 * NO MONEY APPEARS ANYWHERE IN THIS LIBRARY, by design — AFS is an RFQ platform
 * and this module is quantities only (CLAUDE.md "BUSINESS MODEL", and the spec's
 * own §1: "No pricing involved").
 */

/** One line of the requirement: N pieces of this length, in this profile. */
export interface RequiredPiece {
  /**
   * Caller-supplied identity for this requirement, echoed onto every cut made
   * for it. Must be non-empty and unique within one input — a cut that cannot
   * be traced back to the line that asked for it is not a plan.
   */
  id: string;
  /**
   * Which profile this piece is. Pieces of DIFFERENT profiles are never nested
   * into one stock piece: a coping cap and a drip edge are different blanks off
   * different coils, so a bar belongs to exactly one profile.
   */
  profile: string;
  /** Finished length of ONE piece, inches. Must be finite and > 0. */
  lengthIn: number;
  /**
   * How many of this piece are needed. Must be a non-negative integer.
   * ZERO IS VALID and contributes nothing — a line an estimator has zeroed out
   * is not an error.
   */
  quantity: number;
}

/** One stock size AFS can cut from. */
export interface StockLength {
  /** Length of one stock piece, inches. Must be finite and > 0. */
  lengthIn: number;
  /** Optional human label, e.g. "10 ft standard". Echoed onto each stock piece. */
  label?: string;
}

/**
 * 'first-fit-decreasing' — longest piece first, into the first bar it fits.
 * 'best-fit-decreasing'  — longest piece first, into the bar it fills most
 *                          tightly. Same asymptotics, never worse than FFD on
 *                          this library's fixtures, and the default.
 *
 * Both are heuristics. Bin packing is NP-hard and NOTHING here claims to be
 * optimal — the plan reports its own waste so a human can judge it.
 */
export type CutStrategy = 'first-fit-decreasing' | 'best-fit-decreasing';

export interface TrimOptimizerSettings {
  /**
   * Blade width consumed by one cut, inches. Defaults to DEFAULT_KERF_IN.
   *
   * There is deliberately NO order-level waste-factor setting here.
   * lib/utils/material-calc.ts owns that number (10%, marked "estimated" until
   * real per-product data arrives) and a second copy would be a second source
   * of truth for it. Kerf and leftover are this engine's only waste.
   *
   * There is also deliberately no "minimum reusable off-cut" threshold: no such
   * figure has been supplied by AFS, and a default would be an invented
   * business rule. Every off-cut is reported with its length; the reader
   * decides what is worth keeping.
   */
  kerfIn?: number;
  strategy?: CutStrategy;
}

/** The settings actually used, with every default resolved. Echoed in the plan. */
export interface ResolvedSettings {
  kerfIn: number;
  strategy: CutStrategy;
}

export interface CutPlanInput {
  pieces: RequiredPiece[];
  stockLengths: StockLength[];
  settings?: TrimOptimizerSettings;
}

/** One finished piece, cut from one stock piece. */
export interface CutAssignment {
  /** The RequiredPiece.id this cut satisfies. */
  pieceId: string;
  profile: string;
  /** As-cut length, inches — the requirement's length snapped UP to 1/16 in. */
  lengthIn: number;
}

/** One physical stock piece and everything that comes off it. */
export interface StockCut {
  /** 1-based, counted across the whole plan so a shop sheet can be read in order. */
  index: number;
  profile: string;
  stockLengthIn: number;
  stockLabel: string | null;
  cuts: CutAssignment[];
  /** Sum of the finished cuts, inches. */
  finishedLengthIn: number;
  /** Metal consumed by the blade on this stock piece, inches. */
  kerfTotalIn: number;
  /** The off-cut left over, inches. Always >= 0. */
  leftoverIn: number;
  /** finishedLengthIn / stockLengthIn * 100. Unrounded; the UI rounds. */
  utilizationPercent: number;
  /** Plain-English shop instruction for this stock piece. */
  cuttingInstructions: string;
}

export interface CutTotals {
  /** Finished length actually planned, inches (after the 1/16 snap). */
  requiredLengthIn: number;
  totalStockLengthIn: number;
  kerfLengthIn: number;
  leftoverLengthIn: number;
  /** kerf + leftover. */
  wasteLengthIn: number;
  /** wasteLengthIn / totalStockLengthIn * 100, or 0 when no stock is used. */
  wastePercent: number;
  stockPieceCount: number;
}

export interface ProfilePlan {
  profile: string;
  stockPieces: StockCut[];
  /** The distinct stock lengths this profile's plan ended up using, ascending. */
  stockLengthsUsedIn: number[];
  totals: CutTotals;
}

export interface CutPlan {
  /** One entry per profile, in ascending profile order. */
  profiles: ProfilePlan[];
  totals: CutTotals;
  settings: ResolvedSettings;
}

export type CutPlanErrorCode =
  /** `stockLengths` was empty — there is nothing to cut from. */
  | 'no_stock_lengths'
  /** A stock length was non-finite, <= 0, or snapped away to nothing. */
  | 'invalid_stock_length'
  /** The kerf was non-finite or negative. */
  | 'invalid_kerf'
  /** A piece had a bad id, profile, length or quantity. */
  | 'invalid_piece'
  /** Two pieces shared an `id`, so a cut could not be traced to its line. */
  | 'duplicate_piece_id'
  /** A required piece is longer than every stock length available. */
  | 'piece_exceeds_stock'
  /** More pieces than the engine will pack in one call. */
  | 'too_many_pieces';

/**
 * Which fields are populated depends on the code, and each is null when the
 * error is not about that thing. They are stated explicitly rather than hidden
 * behind an index signature so a caller can render them without guessing.
 */
export interface CutPlanErrorDetails {
  /** The pieces this error is about. Empty when it is not about pieces. */
  pieceIds: string[];
  /** Populated for `piece_exceeds_stock`: the longest stock there is, inches. */
  longestStockLengthIn: number | null;
  /** Populated for `too_many_pieces`: the cap that was exceeded. */
  limit: number | null;
}

export interface CutPlanError {
  code: CutPlanErrorCode;
  /**
   * Plain English, and it says WHAT DID NOT HAPPEN — CLAUDE.md rule #30's
   * wording rule applied to a library. Never a stack trace, never blame.
   */
  message: string;
  details: CutPlanErrorDetails;
}

/**
 * The engine's only return shape. IT NEVER THROWS: a planning failure is data,
 * because the caller is a form that has to say something useful about it.
 */
export type CutPlanResult = { ok: true; plan: CutPlan } | { ok: false; error: CutPlanError };
