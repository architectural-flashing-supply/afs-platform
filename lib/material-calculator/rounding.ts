/**
 * AUTO MATERIAL CALCULATOR — PRECISION-SAFE ROUNDING. ONE OF IT, FOR A REASON.
 *
 * THIS FIXES A LIVE BUG, NOT A HYPOTHETICAL ONE.
 *
 * `Math.ceil(100 * 1.1)` is **111**, not 110. In IEEE 754 doubles,
 * `100 * 1.1 === 110.00000000000001`, and `Math.ceil` dutifully climbs to the next
 * whole foot. SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1's own worked example is
 * "Your order: 100 LF + 10% waste = 110 LF total (billed quantity)", and the
 * shipped lib/utils/material-calc.ts rendered 111 for exactly that input — which
 * is what components/quote/WasteFactorDisplay.tsx has been showing on
 * /quote Step 2 for every round order: 10 ft x 10 pieces, 200 LF, 500 LF.
 * It was found by writing the spec's example down as an assertion.
 *
 * The same dust bites every other `Math.ceil` in the library. Both of these were
 * found by searching the real input domain rather than guessed at:
 * `Math.ceil(25 * 2.2)` is 56 where 25 pieces at a per_piece rate of 2.2 must
 * order 55; `Math.ceil(21 / 0.7)` is 31 where 21 LF at one unit per 0.7 LF is
 * exactly 30; and `(1.075 - 1) * 100` is 7.499999999999996, so a stored waste
 * factor of 1.075 displayed as **7%** instead of 8%.
 *
 * THE FIX IS TO SNAP TO THE DATA'S REAL PRECISION BEFORE ROUNDING, not to round
 * twice and hope. Every number that reaches here comes from one of:
 *   - `quote_requests` line lengths, entered in the wizard at `step="0.5"` — at
 *     most one decimal place;
 *   - `pricing_rules.waste_factor`, `DECIMAL(5,4)` — at most four;
 *   - `product_accessories.calc_rate`, `DECIMAL(8,4)` — at most four.
 * So an exact product or quotient carries at most about five decimal places, and
 * snapping to SIX cannot erase a real fraction. Floating-point dust lives around
 * the fifteenth significant digit and is removed outright.
 *
 * DO NOT replace these with bare Math.ceil / Math.round, and do not add a second
 * copy with a different precision. A quantity that disagrees with itself between
 * two screens is worse than one that is slightly wrong on both.
 */

/**
 * Decimal places kept before rounding. Six: comfortably beyond the four that the
 * widest DECIMAL column in play can hold, and comfortably short of the fifteen
 * where double-precision noise begins.
 */
const SIGNIFICANT_DECIMALS = 6;
const SCALE = 10 ** SIGNIFICANT_DECIMALS;

/** Removes floating-point dust without moving a real fraction. */
function snap(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * SCALE) / SCALE;
}

/**
 * `Math.ceil`, except that 110.00000000000001 is recognised as 110.
 * This is the "always round UP — never under-order" of §2.1 and §2.2, made to
 * round up only when there is really something left over.
 */
export function ceilQuantity(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.ceil(snap(value));
}

/**
 * `Math.round`, except that 7.499999999999996 is recognised as 7.5 and rounds to
 * 8. Used for the whole-number percentage §3 prints.
 */
export function roundToWhole(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(snap(value));
}
