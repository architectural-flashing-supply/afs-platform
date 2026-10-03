/**
 * THE ONE PLACE THAT DECIDES WHAT A PURCHASE ORDER NUMBER IS.
 *
 * SPEC_PURCHASE_ORDER_INTEGRATION.md §2 fixes the max length, the placeholder
 * and the required-hint copy; §3 fixes the blocking error copy. Both of those
 * sentences are quoted in the spec, so they live here as constants and are
 * asserted character-for-character by po-number.test.ts — a reword has to be a
 * deliberate spec change rather than a drift.
 *
 * Four callers depend on this module, and they must not disagree:
 *   - components/checkout/PoNumberField.tsx   (the input's attributes + hint)
 *   - app/checkout/page.tsx                   (client submit gating, UX only)
 *   - app/api/checkout/create-intent/route.ts (the real enforcement)
 *   - supabase/migrations/039_...sql          (the same limit, in Postgres)
 *
 * WHY A LENGTH LIMIT IS NOT COSMETIC. Checkout's card path puts the PO number
 * into Stripe PaymentIntent metadata (create-intent/route.ts). Stripe caps a
 * metadata VALUE at 500 characters, so before this limit existed a long paste
 * made `paymentIntents.create` throw and the customer saw only the generic
 * "Could not start checkout" with nothing to act on.
 *
 * WHY NORMALISE RATHER THAN TRUNCATE. Silently storing the first 50 characters
 * of somebody's accounting reference would put a wrong PO on a real invoice.
 * Over-long input is refused and named; it is never trimmed down to fit.
 */

/** SPEC §2: "Max: 50 characters". Also enforced in Postgres by migration 039. */
export const PO_NUMBER_MAX_LENGTH = 50;

/** SPEC §2: 'Placeholder: "e.g. PO-2026-04521"'. */
export const PO_NUMBER_PLACEHOLDER = 'e.g. PO-2026-04521';

/** SPEC §2: 'Hint if required: "Your account requires a PO number for all orders"'. */
export const PO_REQUIRED_HINT = 'Your account requires a PO number for all orders';

/** SPEC §3: the exact sentence shown when submit is blocked for a missing PO. */
export const PO_REQUIRED_ERROR = 'Purchase Order Number is required for your account';

/**
 * Not spec-quoted — the spec states the limit but no message for exceeding it.
 * Derived from the constant so the number can never contradict the rule.
 */
export const PO_TOO_LONG_ERROR = `Purchase Order Number must be ${PO_NUMBER_MAX_LENGTH} characters or fewer.`;

/**
 * The stored form of a PO number: a trimmed non-empty string, or null.
 *
 * `''`, `'   '` and a missing field must not become three different ways of
 * saying "no PO" in `orders.po_number` — a report grouping by that column
 * would split one state into three. Anything that is not a non-empty string
 * after trimming is null.
 *
 * Takes `unknown` because one of its callers is an API route reading a JSON
 * body, where the field genuinely can be any type.
 */
export function normalizePoNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type PoNumberValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * The server-side decision. `required` comes from `companies.require_po` for
 * the checking-out customer's company — never from the request body, which the
 * customer controls.
 *
 * When `required` is false this function rejects nothing a human could type:
 * the length check is the only way out, and the input carries `maxLength`. That
 * is what keeps a company with no PO requirement behaving exactly as it did
 * before this feature existed.
 */
export function validatePoNumber(raw: unknown, required: boolean): PoNumberValidation {
  const value = normalizePoNumber(raw);

  if (required && value === null) {
    return { ok: false, error: PO_REQUIRED_ERROR };
  }

  // Measured on the NORMALISED string, so trailing whitespace can never push an
  // otherwise-valid reference over the limit.
  if (value !== null && value.length > PO_NUMBER_MAX_LENGTH) {
    return { ok: false, error: PO_TOO_LONG_ERROR };
  }

  return { ok: true, value };
}

/**
 * The client's submit-gating predicate — deliberately narrower than
 * `validatePoNumber`.
 *
 * It ignores length because the rendered input carries `maxLength`, so an
 * over-long value cannot be typed into it; a paste that the browser truncates
 * is a different (and server-caught) problem. Keeping this to "is the
 * requirement satisfied" means that when `required` is false the term is
 * constantly true and `canSubmit` is arithmetically unchanged from before.
 */
export function isPoNumberSatisfied(raw: string, required: boolean): boolean {
  return !required || normalizePoNumber(raw) !== null;
}
