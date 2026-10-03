/**
 * AUTO MATERIAL CALCULATOR §2.1 — WASTE FACTOR.
 *
 * Moved here from lib/utils/material-calc.ts (deleted in the same commit) so
 * there is exactly ONE waste-factor formula in the repository. The arithmetic is
 * unchanged; components/quote/WasteFactorDisplay.tsx renders the same numbers it
 * always did.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1:
 *
 *   function applyWasteFactor(rawQuantityLf, wasteFactorMultiplier) {
 *     // Always round UP — never under-order
 *     return Math.ceil(rawQuantityLf * wasteFactorMultiplier);
 *   }
 *
 * NEITHER FUNCTION HERE THROWS. They are tolerant arithmetic on purpose:
 * WasteFactorDisplay already guards its own inputs and calls them directly, and
 * turning that into a throw would change a shipped screen's behaviour. Rejection
 * of bad input belongs at the library boundary — see validate.ts, which
 * calculateMaterials() runs before it reaches here.
 */

import { MATERIAL_CALCULATOR_CONFIG } from './config';
import { ceilQuantity, roundToWhole } from './rounding';
import type { WasteAdjustedQuantity } from './types';

/** Percent is a presentation unit, not a business constant. */
const PERCENT = 100;

export function applyWasteFactor(
  rawQuantityLf: number,
  wasteFactorMultiplier: number = MATERIAL_CALCULATOR_CONFIG.defaultWasteFactorMultiplier
): number {
  // Always round UP — never under-order.
  //
  // ceilQuantity, not Math.ceil. `Math.ceil(100 * 1.1)` is 111 because
  // `100 * 1.1 === 110.00000000000001` in IEEE 754, and the spec's own worked
  // example says 110. See rounding.ts — this was a live defect on /quote Step 2,
  // not a theoretical one.
  return ceilQuantity(rawQuantityLf * wasteFactorMultiplier);
}

/**
 * The full §2.1 breakdown §3's UI renders: raw, waste, total, and whether the
 * factor behind it is real or the documented default.
 *
 * `isEstimated` is DERIVED FROM WHETHER A MULTIPLIER WAS SUPPLIED AT ALL, not
 * from its value (EES deviation D-1). The previous module returned `true`
 * unconditionally, which was correct while nothing in the codebase could supply a
 * real per-product factor; lib/data/product-accessories.ts's
 * getProductWasteFactorMultiplier now can, so a permanent `true` would label real
 * data as estimated.
 *
 * It cannot be derived by comparing the multiplier against the default, because
 * `pricing_rules.waste_factor` DEFAULTS TO 1.10 in the database (migration 001
 * line 279) — a real row carrying 1.10 is real data and must not be badged
 * "estimated" just for agreeing with the spec's placeholder. So: null or
 * undefined means "nothing supplied one, this is the documented default";
 * a number means "this came from somewhere real".
 */
export function calculateWasteAdjustedQuantity(
  lengthFt: number,
  quantity: number,
  wasteFactorMultiplier?: number | null
): WasteAdjustedQuantity {
  const isEstimated =
    wasteFactorMultiplier === null || wasteFactorMultiplier === undefined
      ? MATERIAL_CALCULATOR_CONFIG.wasteFactorIsEstimatedUntilDataReceived
      : false;
  const multiplier =
    wasteFactorMultiplier ?? MATERIAL_CALCULATOR_CONFIG.defaultWasteFactorMultiplier;

  const rawQtyLf = lengthFt * quantity;
  const adjustedQtyLf = applyWasteFactor(rawQtyLf, multiplier);

  return {
    rawQtyLf,
    wasteFactorPct: roundToWhole((multiplier - 1) * PERCENT),
    wasteQtyLf: adjustedQtyLf - rawQtyLf,
    adjustedQtyLf,
    isEstimated,
  };
}
