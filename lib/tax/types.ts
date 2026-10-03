/**
 * THE TAX VOCABULARY. One type system for sales tax, and this is it.
 *
 * ==================== THE RULE THIS FILE EXISTS TO ENFORCE ====================
 *
 * AN UNCALCULATED TAX IS NOT A ZERO TAX.
 *
 * A missing configuration, an unreachable vendor, a malformed vendor response
 * and a rate of genuinely zero are FOUR DIFFERENT FACTS. Collapsing any of the
 * first three into `0` does one of two bad things: it under-collects a tax AFS
 * is legally obliged to remit, or it puts a number on a customer's document that
 * nobody can stand behind.
 *
 * specs/SPEC_TAXJAR_INTEGRATION.md §3 does exactly that. Its `catch` block is:
 *
 *     return { taxAmount: 0, taxRate: 0, error: true };
 *
 * The `error: true` is discarded by the first caller that reads `.taxAmount`,
 * and a vendor outage silently becomes a zero tax. That shape is rejected here.
 *
 * SO THE OUTCOME TYPE IS A DISCRIMINATED UNION IN WHICH THE TWO NON-ANSWERS
 * CARRY NO AMOUNT FIELD AT ALL. Not `amountCents: null` — ABSENT. A nullable
 * number is precisely the shape a caller writes `?? 0` against, which would
 * reinstate the bug through the front door. With the field absent, `tsc` refuses
 * to read it, and the only way to get a number out of an outcome is
 * `collectableTaxCents()`, which returns `null` for a non-answer and forces the
 * caller to decide what that means.
 *
 * This is the same discipline CLAUDE.md rule #19 applies to the price book
 * ("a blank is never a zero") and rule #17 applies to AI confidence (one
 * vocabulary, no local re-declaration). Do not add a second tax result type.
 */

/** Which engine produced an outcome. `'none'` means no provider was configured. */
export type TaxProviderName = 'none' | 'mock' | 'taxjar';

/**
 * Why AFS has nexus in a state. Mirrors the bases named in
 * specs/SPEC_TAXJAR_INTEGRATION.md §2 ("physical presence, economic nexus
 * thresholds, employee presence"), plus voluntary registration, which is a real
 * fourth case an accountant can report. These four are the migration's CHECK
 * constraint, so this union and the database cannot drift.
 */
export type NexusBasis =
  | 'physical_presence'
  | 'economic_threshold'
  | 'employee_presence'
  | 'voluntary';

export const NEXUS_BASES: readonly NexusBasis[] = [
  'physical_presence',
  'economic_threshold',
  'employee_presence',
  'voluntary',
];

/** Human wording for each basis. The English lives here and nowhere else. */
export const NEXUS_BASIS_LABELS: Record<NexusBasis, string> = {
  physical_presence: 'Physical presence',
  economic_threshold: 'Economic nexus threshold',
  employee_presence: 'Employee presence',
  voluntary: 'Voluntary registration',
};

/**
 * One state AFS has sales tax nexus in, as recorded by whoever was told.
 *
 * DATES ARE PLAIN `YYYY-MM-DD` STRINGS, never `Date`. A date-only value has no
 * instant and no offset, and keeping it a string is what stops one creeping in —
 * the same convention lib/delivery/business-days.ts establishes and CLAUDE.md
 * rule #24 requires. They compare correctly with `<=` because ISO date strings
 * sort lexicographically.
 */
export interface NexusState {
  id: string;
  /** Two uppercase ASCII letters. Always normalised through normalizeStateCode. */
  stateCode: string;
  /**
   * Whether AFS actually collects here. A row can exist with `false`: the
   * accountant has told us nexus exists but registration is not complete. That
   * is a RECORDED nexus AFS is not collecting on, and it must never produce a
   * calculated tax.
   */
  collecting: boolean;
  basis: NexusBasis;
  /** The state's registration number. Null until AFS supplies it. */
  registrationId: string | null;
  effectiveFrom: string;
  /** Null means "still current". */
  effectiveTo: string | null;
  note: string | null;
}

/**
 * Where the sale ships FROM. Both halves are required and neither is guessed.
 *
 * specs/SPEC_TAXJAR_INTEGRATION.md §3 hardcodes `from_state: 'TX'` with the
 * comment `// BLOCKED: infer from ZIP`. CLAUDE.md does place the shop in Burnet,
 * Texas — but the ZIP half is an open data blocker (#5, "AFS address, phone,
 * hours"), and a tax origin is a legal input to a filing rather than a
 * convenience. Hardcoding one half of a blocked pair produces a request that
 * LOOKS complete and is not, which is worse than refusing. So both come from
 * configuration, and a missing one means "not configured" by name.
 */
export interface TaxOrigin {
  zip: string;
  state: string;
}

/** Where the sale ships TO, plus the AFS-set money it is calculated on. */
export interface TaxCalculationRequest {
  toState: string;
  toZip: string;
  /**
   * The AFS-SET amount, in integer cents. Never a customer estimate — AFS is an
   * RFQ business and tax is a component of a figure AFS stands behind.
   */
  subtotalCents: number;
  /** Freight, in cents. Whether it is taxable is the vendor's answer, not ours. */
  shippingCents: number;
}

/** The jurisdiction names a provider attributes the tax to, when it supplies them. */
export interface TaxJurisdictions {
  country: string | null;
  state: string | null;
  county: string | null;
  city: string | null;
}

/**
 * What a provider hands back on success. Deliberately NOT a TaxOutcome: a
 * provider reports what it found, and the engine decides what that means (e.g.
 * `hasNexus: false` against a configured state is a conflict, not a zero).
 */
export interface ProviderTaxFigures {
  amountCents: number;
  /** Combined rate as a fraction, e.g. 0.0825. */
  rate: number;
  taxableAmountCents: number | null;
  /**
   * The vendor's own view of whether it has nexus. `null` when the vendor did
   * not say — which is not an error, and is NOT treated as `false`.
   */
  hasNexus: boolean | null;
  freightTaxable: boolean | null;
  jurisdictions: TaxJurisdictions | null;
}

export interface ProviderSuccess {
  ok: true;
  figures: ProviderTaxFigures;
  /** The raw body, for the audit snapshot. Never contains the API key. */
  rawResponse: unknown;
}

export interface ProviderFailure {
  ok: false;
  /** Plain English, safe to show an admin. Never carries a key or a token. */
  message: string;
  /** One entry per thing wrong, when the failure is a shape problem. */
  problems: string[];
  /** True only when the request was aborted by our own timeout. */
  timedOut: boolean;
  /** HTTP status, when there was a response at all. */
  status: number | null;
}

export type ProviderResult = ProviderSuccess | ProviderFailure;

/**
 * A tax provider. The engine depends on this interface and never on a concrete
 * provider, which is what lets every test run with an injected double and no
 * network (the item's "recorded fixtures only; no network" rule).
 *
 * A PROVIDER NEVER THROWS. It returns a ProviderFailure. A throw would travel up
 * through the engine and reach a caller as an exception, which is the one shape
 * that cannot be reasoned about at a call site that is deciding what to bill.
 */
export interface TaxProvider {
  readonly name: TaxProviderName;
  /** True only for a provider whose figures are a real, collectable tax. */
  readonly isAuthoritative: boolean;
  calculate(request: TaxCalculationRequest, origin: TaxOrigin): Promise<ProviderResult>;
}

/** Why a justified zero is justified. */
export type ZeroTaxReason = 'customer_exempt' | 'no_nexus';

/**
 * A real, collectable tax figure from a configured provider.
 *
 * `amountCents` MAY be 0 — see `no_nexus` below for the contrast. A provider
 * that says "I have nexus here and the tax is zero" has answered the question,
 * and that is a different fact from not having asked.
 */
export interface TaxCalculated {
  kind: 'calculated';
  amountCents: number;
  rate: number;
  taxableAmountCents: number | null;
  freightTaxable: boolean | null;
  jurisdictions: TaxJurisdictions | null;
  provider: TaxProviderName;
  isAuthoritative: boolean;
  reason: string;
}

/**
 * The customer holds a resale certificate (`profiles.tax_exempt`).
 * A JUSTIFIED zero — spec §4: skip the provider call, set tax = 0, and note
 * "Tax exempt — resale certificate on file" on the invoice.
 */
export interface TaxExempt {
  kind: 'exempt';
  amountCents: 0;
  reason: string;
  zeroReason: Extract<ZeroTaxReason, 'customer_exempt'>;
  provider: TaxProviderName;
  isAuthoritative: boolean;
}

/**
 * Nexus IS configured, and this ship-to state is not one AFS collects in.
 * A JUSTIFIED zero: the question was asked and the answer is nothing owed.
 */
export interface TaxNoNexus {
  kind: 'no_nexus';
  amountCents: 0;
  reason: string;
  zeroReason: Extract<ZeroTaxReason, 'no_nexus'>;
  provider: TaxProviderName;
  isAuthoritative: boolean;
}

/**
 * NO TAX WAS CALCULATED. Not zero — unknown.
 *
 * NOTE THE ABSENT `amountCents`. That is the whole point of this type; see the
 * file header. Reach for `collectableTaxCents()`, which returns `null` here.
 */
export interface TaxNotConfigured {
  kind: 'not_configured';
  /** Names the specific missing thing — a provider, an origin, or a nexus list. */
  reason: string;
  provider: TaxProviderName;
  isAuthoritative: false;
}

/**
 * The calculation was attempted and did not produce a trustworthy answer.
 *
 * ALSO NO `amountCents`, and `requiresAdminReview` is always true: a human has
 * to look at this before anything is billed. This is the branch the source
 * spec turned into a zero.
 */
export interface TaxFailed {
  kind: 'failed';
  reason: string;
  problems: string[];
  requiresAdminReview: true;
  timedOut: boolean;
  provider: TaxProviderName;
  isAuthoritative: false;
}

export type TaxOutcome =
  | TaxCalculated
  | TaxExempt
  | TaxNoNexus
  | TaxNotConfigured
  | TaxFailed;

/**
 * THE ONLY WAY TO GET A NUMBER OUT OF AN OUTCOME.
 *
 * Returns the cents for the three outcomes that genuinely have an amount, and
 * `null` for the two that do not. A caller therefore cannot reach a figure
 * without handling the "there is no figure" case — and `null` is deliberately
 * hostile to `?? 0`, because writing that is the exact mistake this module
 * exists to make visible in review.
 *
 * A caller deciding what to bill should use `isCollectable()` first and refuse
 * to proceed when it is false.
 */
export function collectableTaxCents(outcome: TaxOutcome): number | null {
  switch (outcome.kind) {
    case 'calculated':
    case 'exempt':
    case 'no_nexus':
      return outcome.amountCents;
    case 'not_configured':
    case 'failed':
      return null;
  }
}

/** True when the outcome states a tax AFS can act on (including a justified 0). */
export function isCollectable(
  outcome: TaxOutcome
): outcome is TaxCalculated | TaxExempt | TaxNoNexus {
  return outcome.kind === 'calculated' || outcome.kind === 'exempt' || outcome.kind === 'no_nexus';
}

/** True when a human must look at this before anything is billed. */
export function requiresAdminReview(outcome: TaxOutcome): boolean {
  return outcome.kind === 'failed';
}

/**
 * Short label for an admin screen. Lives here so the Needs-review panel, the
 * preview result and any future surface cannot word the same state differently.
 */
export const TAX_OUTCOME_LABELS: Record<TaxOutcome['kind'], string> = {
  calculated: 'Tax calculated',
  exempt: 'Tax exempt',
  no_nexus: 'No nexus — no tax',
  not_configured: 'Not configured — no tax calculated',
  failed: 'Calculation failed — needs review',
};
