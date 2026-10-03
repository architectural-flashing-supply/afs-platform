/**
 * THE TAX ENGINE. One function decides what a tax figure is, and this is it.
 *
 * ================== WHY IT IS PURE ==================
 *
 * It touches no database, no `process.env` and no clock. The provider, the
 * origin, the nexus list, the exemption flag and today's date all arrive as
 * arguments. That is what makes every branch below a unit test instead of
 * something only a configured deployment could answer — and it is also why a
 * test can inject a provider that THROWS IF CALLED, which is the only honest way
 * to prove that an unconfigured deployment makes no vendor call.
 *
 * ================== THE DECISION ORDER IS LOAD-BEARING ==================
 *
 *   1. A malformed request          -> failed      (and no provider call)
 *   2. The customer is tax-exempt   -> exempt      (a justified 0)
 *   3. No provider configured       -> not_configured
 *   4. No origin configured         -> not_configured
 *   5. The nexus list is EMPTY      -> not_configured   <-- the centre of this item
 *   6. No collecting nexus row      -> no_nexus     (a justified 0)
 *   7. Otherwise                    -> ask the provider
 *
 * Each position is deliberate:
 *
 * (1) BEFORE the provider, because a bad state code or a negative amount is our
 *     bug, not the vendor's, and sending it would turn a local validation error
 *     into a confusing remote one.
 *
 * (2) BEFORE configuration, so a customer holding a resale certificate gets the
 *     correct answer — zero, and WHY — even on a deployment with no provider at
 *     all. specs/SPEC_TAXJAR_INTEGRATION.md §4 is explicit that an exempt
 *     customer skips the vendor call entirely.
 *
 * (5) IS THE ONE THAT MATTERS MOST. An empty nexus list does NOT mean "AFS owes
 *     no tax anywhere". It means NOBODY HAS TOLD AFS where it owes tax — the
 *     nexus state list is an open data blocker (CLAUDE.md DATA BLOCKERS,
 *     checklist #31). Answering `no_nexus` and a confident zero there would
 *     assert a legal fact AFS has not supplied, on every order, silently. So an
 *     empty list is `not_configured`, which carries no amount at all.
 *
 * (6) is the genuinely different case: the list is populated, somebody HAS told
 *     us where AFS collects, and this state is not one of them. That zero is an
 *     answer, so it is allowed to be one.
 *
 * ================== TWO ZEROS THAT ARE NOT THE SAME ==================
 *
 * A provider returning `amount_to_collect: 0` WITH `has_nexus: true` is a real
 * calculated zero and is reported as `calculated`.
 *
 * A provider returning `has_nexus: FALSE` for a state AFS has configured as a
 * collecting nexus is a CONFLICT, not a zero. AFS's own record and the vendor
 * disagree about a legal fact, and exactly one of them is wrong. That is reported
 * as `failed` with `requiresAdminReview`, naming both sides — because the only
 * correct action is for a person to find out which.
 */

import {
  findNexusForState,
  normalizeStateCode,
  nexusFingerprint as computeNexusFingerprint,
} from './nexus';
import type {
  NexusState,
  TaxCalculationRequest,
  TaxOrigin,
  TaxOutcome,
  TaxProvider,
  TaxProviderName,
} from './types';

export interface TaxCalculationContext {
  /** Null when no provider is configured. Resolved by config.ts, never read here. */
  provider: TaxProvider | null;
  /** The human reason behind a null provider, so the outcome can quote it. */
  providerReason: string;
  /** Null when the shop's origin is not configured. */
  origin: TaxOrigin | null;
  /** The human reason behind a null origin. */
  originReason: string;
  /** Every nexus row AFS has recorded. EMPTY is the state this ships in. */
  nexus: readonly NexusState[];
  /** From `profiles.tax_exempt` — a resale certificate is on file. */
  customerTaxExempt: boolean;
  /** `YYYY-MM-DD`, supplied by the caller. This module never reads a clock. */
  today: string;
}

/** The provider name to report when no provider ran. */
function providerNameOf(provider: TaxProvider | null): TaxProviderName {
  return provider?.name ?? 'none';
}

/**
 * Validates the request before anything else.
 *
 * `Number.isFinite` IS CHECKED FIRST, and the ordering matters for the same
 * reason it does in `pathfinder-edge.ts`'s `assertPositiveDimension`: every
 * comparison against `NaN` silently returns false, so `if (x < 0)` would let
 * `NaN` through, and `JSON.stringify` would then serialise it to the literal
 * `null` in the outbound request body. A non-finite amount must be caught here,
 * not discovered as a vendor shape error.
 */
function validateRequest(request: TaxCalculationRequest): string[] {
  const problems: string[] = [];

  if (normalizeStateCode(request.toState) === null) {
    problems.push(
      `The ship-to state "${request.toState}" is not a two-letter state code, so no tax could be calculated.`
    );
  }
  if (typeof request.toZip !== 'string' || request.toZip.trim() === '') {
    problems.push('The ship-to ZIP code is missing, so no tax could be calculated.');
  }

  const amounts: [number, string][] = [
    [request.subtotalCents, 'subtotal'],
    [request.shippingCents, 'shipping'],
  ];
  for (const [value, label] of amounts) {
    if (!Number.isFinite(value)) {
      problems.push(`The ${label} is not a finite number (got ${String(value)}), so no tax could be calculated.`);
    } else if (!Number.isInteger(value)) {
      problems.push(`The ${label} is ${value}, which is not a whole number of cents.`);
    } else if (value < 0) {
      problems.push(`The ${label} is negative (${value}), so no tax could be calculated.`);
    }
  }

  return problems;
}

/**
 * THE ONE FUNCTION. Never throws: a provider that somehow throws despite its own
 * contract is caught and reported as `failed`, because an exception reaching a
 * caller that is deciding what to bill is the one shape it cannot handle.
 */
export async function calculateTax(
  request: TaxCalculationRequest,
  context: TaxCalculationContext
): Promise<TaxOutcome> {
  const provider = context.provider;
  const providerName = providerNameOf(provider);

  // ---- 1. A malformed request is OUR bug, and never reaches the vendor -----
  const problems = validateRequest(request);
  if (problems.length > 0) {
    return {
      kind: 'failed',
      reason:
        'The order details were not complete enough to calculate tax, so no tax was calculated and ' +
        'nothing was charged.',
      problems,
      requiresAdminReview: true,
      timedOut: false,
      provider: providerName,
      isAuthoritative: false,
    };
  }

  // ---- 2. Exemption wins over everything, including being unconfigured ----
  // SPEC §4: a tax-exempt customer skips the provider call and the tax is 0,
  // noted on the invoice as "Tax exempt — resale certificate on file".
  if (context.customerTaxExempt) {
    return {
      kind: 'exempt',
      amountCents: 0,
      zeroReason: 'customer_exempt',
      reason: 'Tax exempt — resale certificate on file. No tax is charged on this order.',
      provider: providerName,
      // A documented exemption is a real basis for a zero, whichever provider
      // is (or is not) configured.
      isAuthoritative: true,
    };
  }

  // ---- 3. No provider -----------------------------------------------------
  if (provider === null) {
    return {
      kind: 'not_configured',
      reason: context.providerReason,
      provider: 'none',
      isAuthoritative: false,
    };
  }

  // ---- 4. No origin -------------------------------------------------------
  if (context.origin === null) {
    return {
      kind: 'not_configured',
      reason: context.originReason,
      provider: providerName,
      isAuthoritative: false,
    };
  }

  // ---- 5. AN EMPTY NEXUS LIST IS NOT A ZERO -------------------------------
  // See the file header. This is the branch the whole module exists for.
  if (context.nexus.length === 0) {
    return {
      kind: 'not_configured',
      reason:
        'No sales tax nexus states have been configured, so no tax was calculated. This is not the ' +
        "same as owing no tax — it means AFS's accountant has not yet supplied the list of states " +
        'where AFS has nexus (checklist #31). Add them in Settings → Tax nexus.',
      provider: providerName,
      isAuthoritative: false,
    };
  }

  // ---- 6. Configured, and this state is not one we collect in -------------
  const normalizedState = normalizeStateCode(request.toState) ?? request.toState;
  const nexusRow = findNexusForState(context.nexus, normalizedState, context.today);

  if (nexusRow === null) {
    return {
      kind: 'no_nexus',
      amountCents: 0,
      zeroReason: 'no_nexus',
      reason: `AFS has no sales tax nexus in ${normalizedState}, so no tax is charged on this order.`,
      provider: providerName,
      isAuthoritative: true,
    };
  }

  if (!nexusRow.collecting) {
    return {
      kind: 'no_nexus',
      amountCents: 0,
      zeroReason: 'no_nexus',
      reason:
        `AFS has recorded nexus in ${normalizedState} but is not collecting there yet, so no tax is ` +
        'charged on this order. Mark it as collecting in Settings → Tax nexus once registration is complete.',
      provider: providerName,
      isAuthoritative: true,
    };
  }

  // ---- 7. Ask the provider ------------------------------------------------
  let result: Awaited<ReturnType<TaxProvider['calculate']>>;
  try {
    result = await provider.calculate({ ...request, toState: normalizedState }, context.origin);
  } catch (err) {
    // A provider is contracted never to throw. If one does, that is a bug in the
    // provider — and it still must not reach a caller as an exception.
    return {
      kind: 'failed',
      reason:
        'The tax service failed unexpectedly, so no tax was calculated and nothing was charged. ' +
        'This has been recorded for review.',
      problems: [err instanceof Error ? err.message : 'The tax provider threw a non-Error value.'],
      requiresAdminReview: true,
      timedOut: false,
      provider: providerName,
      isAuthoritative: false,
    };
  }

  if (!result.ok) {
    return {
      kind: 'failed',
      reason: result.message,
      problems: result.problems,
      requiresAdminReview: true,
      timedOut: result.timedOut,
      provider: providerName,
      isAuthoritative: false,
    };
  }

  const figures = result.figures;

  // ---- THE CONFLICT CASE, which is not a zero ----------------------------
  // Only an EXPLICIT false counts. `null` means the vendor did not say, which is
  // not a disagreement — see response.ts on why defaulting it to false would
  // turn a field rename into a flood of false alarms.
  if (figures.hasNexus === false) {
    return {
      kind: 'failed',
      reason:
        `AFS records a sales tax nexus in ${normalizedState} and is collecting there, but the tax ` +
        'service reports no nexus for this address. Those two cannot both be right, so no tax was ' +
        'calculated and nothing was charged. Someone needs to check which is correct.',
      problems: [
        `AFS nexus record: collecting in ${normalizedState} from ${nexusRow.effectiveFrom}.`,
        'Tax service response: has_nexus = false.',
      ],
      requiresAdminReview: true,
      timedOut: false,
      provider: providerName,
      isAuthoritative: false,
    };
  }

  // A zero here is a REAL calculated zero. See the file header.
  return {
    kind: 'calculated',
    amountCents: figures.amountCents,
    rate: figures.rate,
    taxableAmountCents: figures.taxableAmountCents,
    freightTaxable: figures.freightTaxable,
    jurisdictions: figures.jurisdictions,
    provider: providerName,
    isAuthoritative: provider.isAuthoritative,
    reason: provider.isAuthoritative
      ? `Tax calculated for ${normalizedState} at ${(figures.rate * 100).toFixed(4).replace(/\.?0+$/, '')}%.`
      : `DEVELOPMENT FIGURE ONLY — produced by the ${providerName} provider from recorded reference ` +
        'rates. This is not a real tax and must not be billed.',
  };
}

/**
 * The fingerprint of the nexus list used for a calculation, for the cache key.
 *
 * Re-exported from here so a caller assembling a cache key imports it from the
 * same module it got the outcome from, and cannot accidentally fingerprint a
 * different list from the one the calculation actually used.
 */
export const nexusFingerprintFor = computeNexusFingerprint;
