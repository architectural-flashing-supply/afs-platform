/**
 * RECORDED TAXJAR RESPONSE FIXTURES — EES-OVN.08.
 *
 * ================== PROVENANCE, STATED HONESTLY ==================
 *
 * These bodies are HAND-CONSTRUCTED to the response shape documented for
 * TaxJar's `POST /v2/taxes` endpoint. They were NOT captured from a live call:
 * AFS has no TaxJar API key (CLAUDE.md MACHINE/integration env block, and
 * app/admin/settings/page.tsx has reported TaxJar as unconfigured since it was
 * written), and this build makes no network requests by rule.
 *
 * The shape is corroborated by specs/SPEC_TAXJAR_INTEGRATION.md §3, which was
 * written against the real `taxjar` SDK and reads
 * `response.tax.amount_to_collect` and `response.tax.rate` — the two fields
 * everything here depends on. That is good corroboration, not verification.
 * EES-OVN.08 records this as assumption A-1, tagged [Likely], and UNRESOLVED-01.
 *
 * WHY THAT IS SAFE ANYWAY: lib/tax/response.ts validates rather than casts, so
 * if the real wire format differs, the result is a reported shape problem plus a
 * logged truncated payload — a `failed` outcome flagged for admin review — never
 * a wrong tax figure. The fixtures prove the parser's behaviour; they are not
 * evidence about TaxJar.
 *
 * None of these numbers is an AFS business figure. They are test scaffolding.
 */

export const FIXTURE_VERSION = '2026-10-03.1';

/**
 * A successful calculation in a nexus state.
 * $1,000.00 taxable at 8.25% → $82.50 to collect.
 */
export const TAXJAR_SUCCESS_WITH_NEXUS = {
  tax: {
    order_total_amount: 1000,
    shipping: 0,
    taxable_amount: 1000,
    amount_to_collect: 82.5,
    rate: 0.0825,
    has_nexus: true,
    freight_taxable: false,
    tax_source: 'destination',
    jurisdictions: {
      country: 'US',
      state: 'TX',
      county: 'BURNET',
      city: 'BURNET',
    },
  },
} as const;

/**
 * A REAL ZERO: the vendor has nexus and the tax is genuinely nothing.
 * This is the fixture that proves `calculated` with `amountCents: 0` is a
 * legitimate answer, and therefore why a zero cannot be used as a failure
 * signal anywhere in this subsystem.
 */
export const TAXJAR_SUCCESS_ZERO_WITH_NEXUS = {
  tax: {
    order_total_amount: 1000,
    shipping: 0,
    taxable_amount: 0,
    amount_to_collect: 0,
    rate: 0,
    has_nexus: true,
    freight_taxable: false,
    tax_source: 'destination',
    jurisdictions: { country: 'US', state: 'TX', county: null, city: null },
  },
} as const;

/**
 * The vendor says it has NO nexus. Against a state AFS has configured as a
 * collecting nexus, this is a CONFLICT the engine must escalate, not a zero.
 */
export const TAXJAR_NO_NEXUS = {
  tax: {
    order_total_amount: 1000,
    shipping: 0,
    taxable_amount: 0,
    amount_to_collect: 0,
    rate: 0,
    has_nexus: false,
    freight_taxable: false,
    tax_source: null,
    jurisdictions: null,
  },
} as const;

/** Taxable freight, so the shipping-inclusive path has a fixture. */
export const TAXJAR_SUCCESS_FREIGHT_TAXABLE = {
  tax: {
    order_total_amount: 1150,
    shipping: 150,
    taxable_amount: 1150,
    amount_to_collect: 94.88,
    rate: 0.0825,
    has_nexus: true,
    freight_taxable: true,
    tax_source: 'destination',
    jurisdictions: { country: 'US', state: 'TX', county: 'BURNET', city: 'BURNET' },
  },
} as const;

/** `has_nexus` absent. NOT an error, and NOT to be read as `false`. */
export const TAXJAR_SUCCESS_NO_HAS_NEXUS_FIELD = {
  tax: {
    taxable_amount: 1000,
    amount_to_collect: 82.5,
    rate: 0.0825,
  },
} as const;

/** An exact half cent, to pin the rounding rule: 12.345 * 100 === 1234.5 → 1235 cents. */
export const TAXJAR_SUCCESS_FRACTIONAL_CENT = {
  tax: { amount_to_collect: 12.345, rate: 0.0825, taxable_amount: 149.64, has_nexus: true },
} as const;

/** Exactly half a cent, to pin half-up. 0.005 → 1 cent. */
export const TAXJAR_SUCCESS_HALF_CENT = {
  tax: { amount_to_collect: 0.005, rate: 0.0001, taxable_amount: 50, has_nexus: true },
} as const;

// ---------------------------------------------------------------------------
// MALFORMED BODIES — one per thing that can go wrong on the wire.
// Each must produce a reported shape problem, never a thrown error and never a
// silently-accepted figure.
// ---------------------------------------------------------------------------

/** An error object returned with a 200, which is the case a cast cannot survive. */
export const TAXJAR_ERROR_ENVELOPE_WITH_200 = {
  error: 'Unauthorized',
  detail: 'Invalid API token',
  status: 401,
} as const;

/** The `tax` object missing entirely. */
export const TAXJAR_MISSING_TAX_OBJECT = { data: { amount_to_collect: 82.5 } } as const;

/** `tax` present but not an object. */
export const TAXJAR_TAX_NOT_AN_OBJECT = { tax: 'nope' } as const;

/** `amount_to_collect` absent. */
export const TAXJAR_MISSING_AMOUNT = { tax: { rate: 0.0825, has_nexus: true } } as const;

/** `amount_to_collect` as a string — a renamed/retyped field. */
export const TAXJAR_AMOUNT_AS_STRING = {
  tax: { amount_to_collect: '82.50', rate: 0.0825, has_nexus: true },
} as const;

/** A negative tax, which is not a thing. */
export const TAXJAR_NEGATIVE_AMOUNT = {
  tax: { amount_to_collect: -82.5, rate: 0.0825, has_nexus: true },
} as const;

/** A non-finite amount. JSON cannot carry NaN, but a gateway can emit null. */
export const TAXJAR_NULL_AMOUNT = {
  tax: { amount_to_collect: null, rate: 0.0825, has_nexus: true },
} as const;

/** A negative rate. */
export const TAXJAR_NEGATIVE_RATE = {
  tax: { amount_to_collect: 82.5, rate: -0.0825, has_nexus: true },
} as const;

/** `rate` as a string. */
export const TAXJAR_RATE_AS_STRING = {
  tax: { amount_to_collect: 82.5, rate: '0.0825', has_nexus: true },
} as const;

/** An array where an object belongs. */
export const TAXJAR_ARRAY_BODY = [{ tax: { amount_to_collect: 82.5 } }] as const;

/** A long body, to exercise log truncation. */
export const TAXJAR_OVERSIZED_BODY = {
  tax: { amount_to_collect: 'x'.repeat(2000) },
} as const;
