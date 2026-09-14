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

/**
 * Bid document line items (BID_DOCUMENT_SCOPE.md §1.1) are hand-priced
 * qty/spec/unit-price rows, not FlashDraft/Quote Builder output — no waste
 * factor, no billed-quantity rounding, just quantity × unit price. Extended, not
 * duplicated, per that document's §1.3.
 */
export function computeExtendedPrice(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/**
 * SPEC_FREIGHT_ESTIMATOR.md §4's NMFC-style freight class table. Pure
 * classification — no carrier rate data required.
 */
export function getFreightClass(longestPieceFt: number): string {
  if (longestPieceFt <= 8) return '85';
  if (longestPieceFt <= 12) return '92.5';
  if (longestPieceFt <= 16) return '100';
  return '110';
}

export interface WeightReferenceGauge {
  materialName: string;
  gaugeLabel: string;
  weightLbsPerSqft: number;
}

export interface WeightEstimateItem {
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
}

export interface WeightEstimateResult {
  totalLbs: number;
  matchedCount: number;
  totalCount: number;
}

/**
 * `quote_requests.line_items` stores material/gauge as free-text labels, not
 * FK references to `materials`/`gauges` — FlashDraft, the Quote Builder, and
 * AI takeoff path each produce slightly different strings for the same
 * material (e.g. "Kynar 500 (Painted Steel)" vs. seeded "Kynar 500 Painted
 * Steel"). This normalizes both sides the same way before comparing, so
 * matching stays deterministic rather than a fuzzy guess.
 */
function normalizeMatchKey(value: string): string {
  const alphanumeric = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return alphanumeric.replace(/^0+(?=[a-z0-9])/, '');
}

function keysMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Best-effort estimated shipment weight from seeded `gauges.weight_lbs_sqft`
 * reference data. Mirrors PRICING_ENGINE.md §3's developed-length geometry
 * (sum of whichever of width/height/legA/legB the profile has) so it works
 * for every profile shape, not just ones with a width and height — that
 * formula's `weightPerLfLbs` is mathematically the same number as
 * `weight_lbs_sqft × (developedLengthIn / 12)` since the seed data derives
 * weight_lbs_sqft from thickness × density in the first place.
 *
 * Line items whose material/gauge text doesn't confidently match a seeded
 * row are left out of the total rather than guessed at — see
 * FREIGHT_ESTIMATOR_SCOPE.md §3.
 */
export function estimateShipmentWeight(
  items: WeightEstimateItem[],
  reference: WeightReferenceGauge[]
): WeightEstimateResult {
  let totalLbs = 0;
  let matchedCount = 0;

  for (const item of items) {
    const developedLengthIn = (item.width ?? 0) + (item.height ?? 0) + (item.legA ?? 0) + (item.legB ?? 0);
    if (developedLengthIn <= 0 || !item.material || !item.gauge) continue;

    const materialKey = normalizeMatchKey(item.material);
    const gaugeKey = normalizeMatchKey(item.gauge);

    const materialMatches = reference.filter((row) => keysMatch(normalizeMatchKey(row.materialName), materialKey));
    const match = materialMatches.find((row) => keysMatch(normalizeMatchKey(row.gaugeLabel), gaugeKey));
    if (!match) continue;

    const weightPerLf = match.weightLbsPerSqft * (developedLengthIn / 12);
    totalLbs += weightPerLf * item.quantity * item.lengthFt;
    matchedCount += 1;
  }

  return { totalLbs: round2(totalLbs), matchedCount, totalCount: items.length };
}
