/**
 * AUTO MATERIAL CALCULATOR — PRODUCT RESOLUTION.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §4's request body takes a `productId`, and
 * app/quote/page.tsx has nothing to put in it: `form.profileType`,
 * `form.material` and `form.gauge` are free-text labels from the hardcoded
 * PROFILE_TYPES / ALL_MATERIALS / GAUGES_BY_MATERIAL arrays, not foreign keys.
 * MATERIAL_CALC_SCOPE.md §6 identified this and concluded the route should not be
 * built at all.
 *
 * It is built, and the labels are resolved here instead — but ONLY when the
 * answer is unambiguous. This function is PURE: the database read lives in
 * lib/data/product-accessories.ts and hands the already-fetched candidate rows in,
 * so every resolution rule below is unit-testable without a database.
 *
 * TWO OR MORE MATCHES NEVER PICK ONE. Two products differing only by gauge can
 * carry different product_accessories rows, so guessing would put a fabricated
 * accessory list in front of a customer. `ambiguous` resolves to no product, the
 * accessory section says AFS will confirm, and nothing is invented.
 *
 * Material labels go through lib/data/catalog.ts's normalizeMaterialLabel, which
 * already owns this codebase's legacy material aliases (e.g. the
 * Galvanized-Galvalume rename of migration 026). A second alias map here would be
 * a second source of truth for the same question.
 */

import { normalizeMaterialLabel } from '@/lib/data/catalog';
import type {
  CalculatorProductCandidate,
  ProductLabels,
  ProductResolutionResult,
} from './types';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * The profile label may be either a product_profiles.name ("Drip Edge") or a
 * slug ("drip-edge"): FlashDraft speaks slugs, the quote wizard speaks names,
 * and both call this route.
 */
function profileMatches(candidate: CalculatorProductCandidate, label: string): boolean {
  const wanted = normalize(label);
  return normalize(candidate.profileName) === wanted || normalize(candidate.profileSlug) === wanted;
}

function materialMatches(candidate: CalculatorProductCandidate, label: string): boolean {
  return (
    normalize(normalizeMaterialLabel(candidate.materialName)) ===
    normalize(normalizeMaterialLabel(label))
  );
}

/**
 * A gauge NARROWS an existing match set; it never widens it. If any surviving
 * candidate carries the requested gauge, only those survive. If none does,
 * gauge-agnostic candidates (products with no gauge_id) survive instead — a
 * product specified without a gauge applies at every gauge. If neither holds, the
 * set is left as it was and the caller sees `ambiguous`, which is the honest
 * answer: the gauge did not tell us which one.
 */
function narrowByGauge(
  matches: CalculatorProductCandidate[],
  gaugeLabel: string
): CalculatorProductCandidate[] {
  const exact = matches.filter((c) => normalize(c.gaugeLabel) === normalize(gaugeLabel));
  if (exact.length > 0) return exact;

  const gaugeAgnostic = matches.filter((c) => c.gaugeLabel === null);
  if (gaugeAgnostic.length > 0) return gaugeAgnostic;

  return matches;
}

export function resolveProduct(
  candidates: readonly CalculatorProductCandidate[],
  labels: ProductLabels
): ProductResolutionResult {
  const profileLabel = (labels.profileLabel ?? '').trim();
  const materialLabel = (labels.materialLabel ?? '').trim();

  // Both halves are required. A profile alone matches every material it is made
  // in, which is ambiguity by construction rather than a real lookup.
  if (profileLabel.length === 0 || materialLabel.length === 0) return { status: 'none' };

  let matches = candidates.filter(
    (candidate) => profileMatches(candidate, profileLabel) && materialMatches(candidate, materialLabel)
  );

  const gaugeLabel = (labels.gaugeLabel ?? '').trim();
  if (gaugeLabel.length > 0 && matches.length > 1) {
    matches = narrowByGauge(matches, gaugeLabel);
  }

  if (matches.length === 0) return { status: 'none' };
  if (matches.length === 1) return { status: 'resolved', productId: matches[0].productId };
  return { status: 'ambiguous', matchCount: matches.length };
}
