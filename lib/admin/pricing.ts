/**
 * Manual estimator pricing helpers. PRICING_ENGINE.md is architected but its
 * commodity-indexed engine is deferred — estimators price every line item by
 * hand. This constant mirrors pricing_rules.waste_factor's schema default so
 * the manual flow still shows a billed quantity, not just what was ordered.
 */
export const DEFAULT_WASTE_FACTOR = 1.1;

export function computeBilledQuantity(quantity: number, lengthFt: number): number {
  return Math.ceil(quantity * lengthFt * DEFAULT_WASTE_FACTOR);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineTotal(unitPrice: number, quantity: number, lengthFt: number): number {
  return round2(unitPrice * computeBilledQuantity(quantity, lengthFt));
}
