/**
 * THE 1/16-INCH GRID — the cut planner's canonical unit.
 *
 * Every length the engine reasons about is an INTEGER NUMBER OF SIXTEENTHS OF
 * AN INCH. Three independent parts of this codebase already agree that the
 * sixteenth is the platform's dimensional unit, so this is a convention being
 * reused rather than invented:
 *
 *   - lib/utils/format-inches.ts renders every dimension as whole inches plus a
 *     reduced fraction of sixteenths ("real sheet-metal fab convention is
 *     fractional sixteenths"), and CLAUDE.md rule #31 names it as canonical.
 *   - app/quote/page.tsx's dimensional inputs all carry step="0.0625" — 1/16 in.
 *   - FlashDraft's canvas and the 3D viewers label through that same function.
 *
 * WHY INTEGERS, AND WHY IT MATTERS MORE THAN TIDINESS. 1/16 = 0.0625 is a
 * dyadic rational, so it is exact in IEEE-754 float64, and so is any small
 * multiple or sum of multiples of it. Doing the packing arithmetic in integer
 * sixteenths and converting out with a single division by 16 therefore makes the
 * conservation identity
 *
 *     total stock = finished + kerf + leftover
 *
 * hold EXACTLY, in inches, with no decimal library and no epsilon in the
 * assertion. lib/trim-optimizer/optimize.test.ts asserts it with toBe(). A
 * planner that accumulated inches as decimals could not make that promise.
 *
 * SNAPPING HAS A DIRECTION, AND THE DIRECTION DEPENDS ON THE ROLE. Real input is
 * not guaranteed to land on the grid (a length typed in feet and multiplied by
 * 12 rarely does). Each role rounds the way that cannot under-provision
 * material, which is the same principle lib/utils/material-calc.ts states as
 * "Always round UP — never under-order":
 *
 *   - a REQUIRED PIECE rounds UP      — never plan a piece shorter than asked
 *   - an AVAILABLE STOCK LENGTH rounds DOWN — never claim material that is not there
 *   - the KERF rounds UP              — never under-reserve blade width
 *
 * These functions are pure arithmetic and do NOT validate. A non-finite input
 * produces a non-finite output on purpose: optimize.ts rejects such inputs with
 * an explicit error result before any snapping happens, and duplicating that
 * check here would put the same rule in two places.
 */

export const SIXTEENTHS_PER_INCH = 16;

/**
 * How close to a grid point counts as ON it, measured in sixteenths.
 *
 * Load-bearing, not decoration. `9.1 * 12` is 109.19999999999999, and a naive
 * ceil of a value a hair above a grid point would hand back a whole extra
 * sixteenth of material for a length that was already exact. The tolerance is
 * ~1e-9 of a sixteenth — eleven orders of magnitude below the smallest real
 * dimension this app accepts, so it cannot absorb a genuine difference.
 */
const GRID_TOLERANCE_SIXTEENTHS = 1e-9;

/** Inches -> sixteenths, unrounded. Internal to the snapping helpers. */
function rawSixteenths(inches: number): number {
  return inches * SIXTEENTHS_PER_INCH;
}

/** The nearest grid point, but only when the value is already on one. */
function gridPointOrNull(raw: number): number | null {
  const nearest = Math.round(raw);
  return Math.abs(raw - nearest) <= GRID_TOLERANCE_SIXTEENTHS ? nearest : null;
}

/** Round UP to the grid. For required piece lengths and for the kerf. */
export function ceilToSixteenths(inches: number): number {
  const raw = rawSixteenths(inches);
  return gridPointOrNull(raw) ?? Math.ceil(raw);
}

/** Round DOWN to the grid. For available stock lengths. */
export function floorToSixteenths(inches: number): number {
  const raw = rawSixteenths(inches);
  return gridPointOrNull(raw) ?? Math.floor(raw);
}

/**
 * Sixteenths -> inches, exactly. A single division by a power of two, so the
 * value returned is the precise rational and never a re-rounded decimal.
 */
export function fromSixteenths(sixteenths: number): number {
  return sixteenths / SIXTEENTHS_PER_INCH;
}

/** Feet -> inches. Stock-length data is stored in feet (product_profiles). */
export function feetToInches(feet: number): number {
  return feet * 12;
}
