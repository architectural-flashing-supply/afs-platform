/**
 * THE MOCK TAX PROVIDER — FULLY IMPLEMENTED, AND HONEST ABOUT WHAT IT IS.
 *
 * ================== WHY A MOCK EXISTS AT ALL ==================
 *
 * AFS has no TaxJar key and no nexus state list (CLAUDE.md DATA BLOCKERS,
 * checklist #31). Without a mock, every code path downstream of a provider would
 * be unreachable and therefore unexercised until the day somebody pastes a live
 * key into production — which is the worst possible moment to discover that the
 * cache, the review queue or the admin screen was never run end to end.
 *
 * ================== IT IS NOT A STUB ==================
 *
 * The Elite Standard is explicit: "Mock providers must be fully implemented and
 * tested", and "mock mode" never means reduced functionality. So this resolves a
 * rate, applies the taxable-freight rule, rounds in integer cents, and returns
 * the identical `ProviderResult` shape the real client returns — including real
 * failures.
 *
 * ================== AND IT CANNOT BE MISTAKEN FOR REAL ==================
 *
 * `isAuthoritative` is `false`. The engine copies that onto the outcome, the
 * admin screen renders it as a warning, and `TaxOutcome.reason` says so in
 * words. A figure from here must never be billed.
 *
 * ================== THE RATES ARE REFERENCE DATA, NOT AFS DATA ==================
 *
 * The table below is PUBLISHED STATEWIDE BASE RATES — the kind of figure printed
 * on any state revenue department's website — included so the mock produces
 * arithmetic that looks like tax rather than a made-up constant. They are NOT:
 *   - AFS's nexus states (nobody has supplied those — checklist #31),
 *   - a complete rate (real tax adds county, city and special districts),
 *   - a business number AFS has approved.
 *
 * AN UNKNOWN STATE IS A FAILURE, NOT A GUESS. If a state is not in the table the
 * mock returns a ProviderFailure saying so, rather than inventing a rate or
 * returning zero. That mirrors the real path exactly: this subsystem refuses to
 * produce a figure it cannot justify, and the mock is held to the same rule —
 * otherwise development would be exercising a code path production does not have.
 */

import type {
  ProviderResult,
  TaxCalculationRequest,
  TaxOrigin,
  TaxProvider,
} from '../types';

/**
 * Published statewide BASE rates, as reference data for development only.
 * Keyed by two-letter code. See the header: not AFS's nexus list, not complete,
 * never billed. Kept deliberately short — a longer list would start to look like
 * a product feature rather than scaffolding.
 */
export const MOCK_STATE_BASE_RATES: Readonly<Record<string, number>> = {
  TX: 0.0625,
  CA: 0.06,
  NM: 0.04875,
  OK: 0.045,
  AZ: 0.056,
  CO: 0.029,
  LA: 0.0445,
  AR: 0.065,
};

/**
 * Whether the mock treats freight as taxable, by state.
 *
 * Freight taxability genuinely varies by state and is one of the things a real
 * provider is for. Two entries are enough to exercise both branches; every state
 * not listed is treated as non-taxable freight, which is stated here rather than
 * left implicit.
 */
const MOCK_FREIGHT_TAXABLE: Readonly<Record<string, boolean>> = {
  TX: true,
  AR: true,
};

/**
 * Rounds a cents figure half-up.
 *
 * Operates on an integer-cents base times a fractional rate, so the input is
 * already a non-negative finite number by construction — the caller validated
 * the request before reaching here. `Math.round` is the same half-up convention
 * `lib/pricing/quote-math.ts` uses for money.
 */
function roundCents(value: number): number {
  return Math.round(value);
}

export class MockTaxProvider implements TaxProvider {
  readonly name = 'mock' as const;

  /** A mock figure is never a collectable tax. See the header. */
  readonly isAuthoritative = false;

  /**
   * Deterministic: no clock, no randomness, no network. The same request always
   * produces the same figures, which is what lets the cache tests assert on a
   * call counter rather than on a value.
   *
   * `origin` is accepted and deliberately unused in the arithmetic: this mock
   * applies the DESTINATION state's rate, which is how US destination-based
   * sales tax works for an interstate shipment. The parameter stays in the
   * signature because it is part of the `TaxProvider` contract the real client
   * genuinely needs.
   */
  // `origin` is prefixed with `_` to mark it as intentionally unused rather than
  // forgotten. An eslint-disable comment was tried here first and removed: this
  // repository has NO ESLint configuration at all (`next lint` offers to create
  // one), so the directive suppressed nothing and named a rule that never runs.
  async calculate(request: TaxCalculationRequest, _origin: TaxOrigin): Promise<ProviderResult> {
    const state = request.toState.trim().toUpperCase();
    const rate = MOCK_STATE_BASE_RATES[state];

    if (rate === undefined) {
      return {
        ok: false,
        message:
          `The development mock has no recorded rate for ${state || 'that state'}, so it calculated nothing. ` +
          'It does not guess a rate — the real provider would not either.',
        problems: [`No recorded mock rate for state "${state}".`],
        timedOut: false,
        status: null,
      };
    }

    const freightTaxable = MOCK_FREIGHT_TAXABLE[state] ?? false;
    const taxableAmountCents = request.subtotalCents + (freightTaxable ? request.shippingCents : 0);
    const amountCents = roundCents(taxableAmountCents * rate);

    return {
      ok: true,
      figures: {
        amountCents,
        rate,
        taxableAmountCents,
        // The mock is standing in for a provider that HAS nexus wherever it was
        // asked — the engine has already established that AFS is collecting in
        // this state before any provider is called, so claiming otherwise here
        // would manufacture the conflict case rather than model it.
        hasNexus: true,
        freightTaxable,
        jurisdictions: { country: 'US', state, county: null, city: null },
      },
      rawResponse: {
        mock: true,
        note: 'Generated by MockTaxProvider from recorded reference rates. NOT a real tax figure.',
        state,
        rate,
        taxableAmountCents,
        amountCents,
      },
    };
  }
}

/** One shared instance; the provider is stateless. */
export const mockTaxProvider = new MockTaxProvider();
