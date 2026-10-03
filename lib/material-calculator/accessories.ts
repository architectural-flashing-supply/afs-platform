/**
 * AUTO MATERIAL CALCULATOR §2.2 — ACCESSORY QUANTITIES.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §2.2:
 *
 *   per_lf:    Math.ceil(orderedLf / calcRate)    e.g., 1 tube per 20 LF
 *   per_piece: orderedPieces * calcRate
 *   fixed:     calcRate (always exactly this quantity)
 *
 * THREE THINGS THE SPEC LEAVES WRONG OR OPEN, AND HOW EACH IS RESOLVED:
 *
 * 1. `per_sqft` is permitted by product_accessories' calc_method CHECK and is
 *    listed in §2.2's own AccessoryRequirement interface, but §2.2's switch
 *    statement HAS NO CASE FOR IT — so it falls through to the spec's
 *    `let qty = 1` and emits a fabricated quantity. There is no area in §4's
 *    request body either. Refused instead: the row is returned in `uncalculable`
 *    with the reason in plain English (config A-04).
 *
 * 2. §2.2's prose says `per_piece: orderedPieces * calcRate` and its code says
 *    `Math.ceil(orderedPieces * acc.calc_rate)`. The code wins — half a box of
 *    screws is not orderable, and `ceil` is the only reading consistent with
 *    §2.1's "never under-order" (config A-03).
 *
 * 3. The spec divides by `calc_rate` without guarding it. `calc_rate` is
 *    DECIMAL(8,4) NOT NULL DEFAULT 1 with no CHECK, so a 0 is storable and
 *    `Math.ceil(110 / 0)` is `Infinity`. A rate that cannot produce a finite,
 *    non-negative count puts its row in `uncalculable` — never Infinity, never
 *    NaN, never a placeholder 1.
 *
 * Required and optional rows come back in separate arrays because §3's UI splits
 * them into "REQUIRED WITH THIS ORDER" and "ALSO COMMONLY ORDERED"; doing it here
 * keeps that split in one tested place instead of in a component's filter.
 */

import { MATERIAL_CALCULATOR_CONFIG, isSupportedCalcMethod } from './config';
import { ceilQuantity } from './rounding';
import type {
  AccessoryCalculation,
  AccessoryRequirement,
  ProductAccessory,
  UncalculableAccessory,
} from './types';

export interface AccessoryCalculationInput {
  /**
   * The BILLED linear footage — §2.1's waste-adjusted quantity, which is what
   * §2.2 means by `orderedQtyLf`. Sealant for 110 LF of installed flashing is
   * sealant for 110 LF.
   */
  orderedQtyLf: number;
  orderedPieces: number;
  accessories: readonly ProductAccessory[];
}

const REASON_PER_SQFT =
  'This accessory is priced per square foot, and a square-foot quantity cannot be ' +
  'derived from a length and a piece count. AFS will confirm the quantity on your quote.';

const REASON_NON_POSITIVE_RATE =
  'This accessory has no usable quantity rate on file. AFS will confirm the quantity on your quote.';

const REASON_NEGATIVE_RATE =
  'This accessory has a negative quantity rate on file, which cannot be ordered. ' +
  'AFS will confirm the quantity on your quote.';

const REASON_NOT_FINITE =
  'This accessory quantity did not resolve to a whole, orderable number. ' +
  'AFS will confirm the quantity on your quote.';

function toUncalculable(accessory: ProductAccessory, reason: string): UncalculableAccessory {
  return {
    accessoryId: accessory.accessoryId,
    accessoryName: accessory.accessoryName,
    sku: accessory.sku,
    calcMethod: accessory.calcMethod,
    unit: accessory.unit,
    isRequired: accessory.isRequired,
    reason,
  };
}

// ceilQuantity, not Math.ceil: `Math.ceil(25 * 2.2)` is 56, where 25 pieces at a
// per_piece rate of 2.2 must order 55. See rounding.ts.
function round(value: number, mode: 'ceil' | 'exact'): number {
  return mode === 'ceil' ? ceilQuantity(value) : value;
}

/**
 * One accessory row → either a quantity or a stated refusal.
 * Exported for the unit tests, which assert each rule in isolation.
 */
export function calculateAccessoryQuantity(
  accessory: ProductAccessory,
  orderedQtyLf: number,
  orderedPieces: number
): { ok: true; calculatedQty: number } | { ok: false; reason: string } {
  if (!isSupportedCalcMethod(accessory.calcMethod)) {
    return { ok: false, reason: REASON_PER_SQFT };
  }

  if (!Number.isFinite(accessory.calcRate)) {
    return { ok: false, reason: REASON_NOT_FINITE };
  }

  if (accessory.calcRate < 0) {
    return { ok: false, reason: REASON_NEGATIVE_RATE };
  }

  let quantity: number;
  switch (accessory.calcMethod) {
    case 'per_lf':
      // A per-LF rate of 0 would mean "one per zero feet" — division by zero.
      // A 0 here is missing data, not an answer.
      if (accessory.calcRate === 0) return { ok: false, reason: REASON_NON_POSITIVE_RATE };
      // ceilQuantity, not Math.ceil: `Math.ceil(21 / 0.7)` is 31 where the answer
      // is exactly 30. See rounding.ts.
      quantity = ceilQuantity(orderedQtyLf / accessory.calcRate);
      break;
    case 'per_piece':
      // A per-piece rate of 0 IS a real answer: none needed for this product.
      quantity = round(
        orderedPieces * accessory.calcRate,
        MATERIAL_CALCULATOR_CONFIG.perPieceRoundingMode
      );
      break;
    case 'fixed':
      quantity = round(accessory.calcRate, MATERIAL_CALCULATOR_CONFIG.fixedRoundingMode);
      break;
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return { ok: false, reason: REASON_NOT_FINITE };
  }

  return { ok: true, calculatedQty: quantity };
}

/**
 * Deterministic order: name ascending, then accessory id ascending as the
 * tie-break. PostgREST gives no ordering guarantee without an explicit
 * `order()`, and a list that reshuffles between two identical requests reads as a
 * bug to whoever is looking at it.
 */
function byNameThenId(a: { accessoryName: string; accessoryId: string }, b: typeof a): number {
  const byName = a.accessoryName.localeCompare(b.accessoryName);
  return byName !== 0 ? byName : a.accessoryId.localeCompare(b.accessoryId);
}

export function calculateAccessories(input: AccessoryCalculationInput): AccessoryCalculation {
  const required: AccessoryRequirement[] = [];
  const optional: AccessoryRequirement[] = [];
  const uncalculable: UncalculableAccessory[] = [];

  for (const accessory of input.accessories) {
    const result = calculateAccessoryQuantity(accessory, input.orderedQtyLf, input.orderedPieces);

    if (!result.ok) {
      uncalculable.push(toUncalculable(accessory, result.reason));
      continue;
    }

    const requirement: AccessoryRequirement = {
      accessoryId: accessory.accessoryId,
      accessoryName: accessory.accessoryName,
      sku: accessory.sku,
      calcMethod: accessory.calcMethod,
      calculatedQty: result.calculatedQty,
      unit: accessory.unit,
      isRequired: accessory.isRequired,
    };

    if (accessory.isRequired) required.push(requirement);
    else optional.push(requirement);
  }

  return {
    required: required.sort(byNameThenId),
    optional: optional.sort(byNameThenId),
    uncalculable: uncalculable.sort(byNameThenId),
  };
}
