/**
 * THE WIRE SHAPE of `POST /api/quote-requests/validate`, declared once so the
 * route and the Quote Builder cannot disagree about it.
 *
 * WHY THIS IS NOT SPEC section 6's SHAPE. The spec asks for
 * `{ profileId, materialId, gaugeId, dimensions }` — three UUID references into
 * `product_profiles`, `materials` and `gauges`. No customer surface in this
 * repository has those: `quote_requests.line_items` stores profile, material and
 * gauge as FREE TEXT, written by three different writers who each spell the same
 * material slightly differently, and the Quote Builder's own `PROFILE_TYPES` is
 * a local string array rather than a foreign key. A request shape nothing can
 * produce would have to be faked at the call site.
 *
 * So the endpoint takes the SAME `items` array `POST /api/quote-requests`
 * already accepts. One line-item shape across the whole platform is worth more
 * than matching a spec snippet whose premise is not in the schema. The
 * divergence is recorded in EES-OVN.04-ORDER-VALIDATOR.md as discrepancy D2.
 *
 * The RESPONSE keeps the spec's own vocabulary — `valid`, `errors`, `warnings` —
 * because that part does describe something real, and adds the counts and the
 * assumption disclosure the deterministic engine has that the spec's AI-only
 * design did not.
 */

import type { ValidationFinding } from './types';

/** Enough for any real request; a guard against an accidental unbounded post. */
export const MAX_ITEMS_PER_VALIDATION = 50;

/**
 * One finding as it crosses the wire to a customer surface.
 *
 * NO `code` AND NO `audience`. The code is for an estimator reading the admin
 * panel; sending it to the browser would put it one view-source away from a
 * customer-facing banner. The audience is already spent — the route filters to
 * customer scope before serialising, so a field saying which scope this was is
 * either redundant or a bug waiting to be trusted.
 */
export interface ValidationMessage {
  field: ValidationFinding['field'];
  severity: ValidationFinding['severity'];
  message: string;
  itemIndex: number;
  /** True when this came from the advisory model rather than from an AFS rule. */
  fromAi: boolean;
}

export interface ValidationResponse {
  /**
   * SPEC section 6's own definition: true when there is nothing to show the customer,
   * errors or warnings. Information notes do not make a request invalid.
   */
  valid: boolean;
  /** True when a deterministic error must stop the customer advancing. */
  blocked: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  infos: ValidationMessage[];
  counts: { error: number; warn: number; info: number };
  /**
   * True when at least one threshold behind these messages is still an
   * unconfirmed placeholder (lib/order-validator/limits.ts). Sent so a surface
   * can be honest about it instead of implying every limit is settled shop
   * capability.
   */
  hasAssumedLimits: boolean;
}

export interface ValidationErrorResponse {
  error: string;
}

/** Strips a finding down to what a customer surface is allowed to receive. */
export function toValidationMessage(finding: ValidationFinding): ValidationMessage {
  return {
    field: finding.field,
    severity: finding.severity,
    message: finding.message,
    itemIndex: finding.itemIndex,
    fromAi: finding.source === 'ai',
  };
}

/**
 * The non-blocking, nothing-to-say answer.
 *
 * Returned when the validator itself fails — a reference read that did not come
 * back, an unexpected throw. SPEC section 6 says to "fall through to valid if API
 * slow", and this applies that to every failure mode: the validator is a
 * safeguard in front of a quote request, and a safeguard that breaks must not
 * take the quote request with it.
 */
export function emptyValidationResponse(): ValidationResponse {
  return {
    valid: true,
    blocked: false,
    errors: [],
    warnings: [],
    infos: [],
    counts: { error: 0, warn: 0, info: 0 },
    hasAssumedLimits: false,
  };
}
