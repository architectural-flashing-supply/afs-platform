/**
 * EES-OVN.08 AC-06 … AC-17, and test catalog items T-01 … T-05.
 *
 * The engine is pure, so every test here is deterministic and offline. The
 * provider is always injected — including, for the most important test in this
 * file, a provider that THROWS IF IT IS CALLED AT ALL.
 */
import { describe, it, expect } from 'vitest';
import { calculateTax, type TaxCalculationContext } from './calculate';
import { collectableTaxCents, isCollectable, requiresAdminReview } from './types';
import type { ProviderResult, TaxCalculationRequest, TaxProvider } from './types';
import { mockTaxProvider } from './providers/mock';
import {
  FIXTURE_TODAY,
  NEXUS_CA_NOT_COLLECTING,
  NEXUS_LIST_EMPTY,
  NEXUS_LIST_MIXED,
  NEXUS_OK_EXPIRED,
  NEXUS_NM_FUTURE,
  NEXUS_TX_COLLECTING,
} from '@/tests/fixtures/tax/nexus';

const REQUEST: TaxCalculationRequest = {
  toState: 'TX',
  toZip: '78701',
  subtotalCents: 100_000,
  shippingCents: 0,
};

/**
 * A provider that fails the test if it is ever called. This is how "no vendor
 * call was made" is proved, rather than asserted by reading the code.
 */
function forbiddenProvider(): TaxProvider {
  return {
    name: 'taxjar',
    isAuthoritative: true,
    calculate: async () => {
      throw new Error(
        'FORBIDDEN: the provider was called. The engine must decide exemption, configuration and ' +
          'nexus before any vendor request.'
      );
    },
  };
}

/** A provider returning exactly what the test wants, and counting its calls. */
function stubProvider(
  result: ProviderResult,
  options: { isAuthoritative?: boolean } = {}
): TaxProvider & { callCount: () => number } {
  let calls = 0;
  return {
    name: 'taxjar',
    isAuthoritative: options.isAuthoritative ?? true,
    calculate: async () => {
      calls += 1;
      return result;
    },
    callCount: () => calls,
  };
}

function context(overrides: Partial<TaxCalculationContext> = {}): TaxCalculationContext {
  return {
    provider: mockTaxProvider,
    providerReason: 'TAX_PROVIDER=mock.',
    origin: { zip: '78611', state: 'TX' },
    originReason: 'Shipping from TX 78611.',
    nexus: [NEXUS_TX_COLLECTING],
    customerTaxExempt: false,
    today: FIXTURE_TODAY,
    ...overrides,
  };
}

// ===========================================================================
// THE CENTRAL LAW: a non-answer carries no amount.
// ===========================================================================

describe('AC-06/AC-07: a non-answer has no amount, and collectableTaxCents says so', () => {
  it('T-01 / AC-01: an unconfigured provider yields not_configured and makes NO vendor call', async () => {
    // ARRANGE — a provider that throws if touched, so "no call" is proved.
    const ctx = context({
      provider: null,
      providerReason: 'No tax provider is configured (TAX_PROVIDER is not set), so no tax is calculated.',
    });

    // ACT
    const outcome = await calculateTax(REQUEST, ctx);

    // ASSERT
    expect(
      outcome.kind,
      `Expected not_configured, got ${outcome.kind}. A default that yields a figure is how a ` +
        'deployment nobody configured starts collecting tax.'
    ).toBe('not_configured');
    expect(
      'amountCents' in outcome,
      'THE LOAD-BEARING ASSERTION. not_configured must carry NO amountCents property at all. A ' +
        'nullable number is exactly the shape a caller writes "?? 0" against, which reinstates the ' +
        'silent zero this whole item exists to prevent.'
    ).toBe(false);
    expect(
      collectableTaxCents(outcome),
      'collectableTaxCents must return null, forcing the caller to handle "there is no figure".'
    ).toBeNull();
    expect(isCollectable(outcome), 'Nothing here is collectable.').toBe(false);
    expect(outcome.reason, 'The reason must explain what is missing.').toContain('TAX_PROVIDER');
  });

  it('AC-01: the provider is never consulted when it is not configured', async () => {
    // ARRANGE — belt and braces: a throwing provider WITH provider: null is
    // impossible, so assert the throwing provider is never reached via the
    // other pre-provider gates instead.
    const ctx = context({ provider: forbiddenProvider(), nexus: NEXUS_LIST_EMPTY });

    // ACT / ASSERT — an empty nexus list short-circuits before any call.
    await expect(
      calculateTax(REQUEST, ctx),
      'The forbidden provider must never be invoked; reaching it throws.'
    ).resolves.toMatchObject({ kind: 'not_configured' });
  });

  it('AC-06: a failed outcome also carries no amount', async () => {
    // ARRANGE
    const provider = stubProvider({
      ok: false,
      message: 'TaxJar refused the request with HTTP 500, so no tax was calculated. Nothing was charged.',
      problems: ['HTTP 500 from TaxJar.'],
      timedOut: false,
      status: 500,
    });

    // ACT
    const outcome = await calculateTax(REQUEST, context({ provider }));

    // ASSERT
    expect(outcome.kind).toBe('failed');
    expect(
      'amountCents' in outcome,
      'A failed calculation must not expose a readable amount. This is the branch SPEC §3 turned into ' +
        'a zero.'
    ).toBe(false);
    expect(collectableTaxCents(outcome)).toBeNull();
  });

  it('AC-07: the three answer-bearing outcomes return a number', async () => {
    // ARRANGE / ACT
    const calculated = await calculateTax(REQUEST, context());
    const exempt = await calculateTax(REQUEST, context({ customerTaxExempt: true }));
    const noNexus = await calculateTax(
      { ...REQUEST, toState: 'FL', toZip: '33101' },
      context({ nexus: NEXUS_LIST_MIXED })
    );

    // ASSERT
    expect(collectableTaxCents(calculated), 'A calculated tax has a figure.').toBe(6250);
    expect(collectableTaxCents(exempt), 'An exempt customer has a justified zero.').toBe(0);
    expect(collectableTaxCents(noNexus), 'A non-nexus state has a justified zero.').toBe(0);
    expect([calculated, exempt, noNexus].every(isCollectable), 'All three are collectable.').toBe(true);
  });
});

// ===========================================================================
// AC-08: the empty list
// ===========================================================================

describe('AC-08 / T-02: an empty nexus list is not_configured, never no_nexus and never zero', () => {
  it('reports not_configured and names the data blocker', async () => {
    // ARRANGE — the state this feature actually ships in.
    const ctx = context({ nexus: NEXUS_LIST_EMPTY });

    // ACT
    const outcome = await calculateTax(REQUEST, ctx);

    // ASSERT
    expect(
      outcome.kind,
      `Expected not_configured, got ${outcome.kind}. An empty nexus list means nobody has told AFS ` +
        'where it owes tax (checklist #31). Reporting no_nexus or 0 there asserts a legal fact AFS ' +
        'has not supplied, on every order, silently.'
    ).toBe('not_configured');
    expect(
      outcome.kind === 'not_configured' ? outcome.reason : '',
      'The reason must say this is NOT the same as owing no tax.'
    ).toContain('not the same as owing no tax');
    expect(collectableTaxCents(outcome)).toBeNull();
  });

  it('is not_configured even with a provider and an origin fully configured', async () => {
    const outcome = await calculateTax(REQUEST, context({ nexus: [] }));
    expect(
      outcome.kind,
      'A configured provider does not make an unsupplied nexus list into an answer.'
    ).toBe('not_configured');
  });

  it('points the reader at the screen that fixes it', async () => {
    const outcome = await calculateTax(REQUEST, context({ nexus: NEXUS_LIST_EMPTY }));
    expect(
      outcome.kind === 'not_configured' ? outcome.reason : '',
      'A reason that names the screen saves somebody hunting.'
    ).toContain('Settings');
  });
});

// ===========================================================================
// AC-05: origin
// ===========================================================================

describe('AC-05: a missing origin is not_configured', () => {
  it('yields not_configured and quotes the origin reason', async () => {
    // ARRANGE
    const ctx = context({
      origin: null,
      originReason:
        "The shop's tax origin is not configured (TAX_ORIGIN_ZIP not set). AFS's address is an " +
        'outstanding data blocker (checklist #5), and an origin is never guessed, so no tax is calculated.',
      provider: forbiddenProvider(),
    });

    // ACT
    const outcome = await calculateTax(REQUEST, ctx);

    // ASSERT
    expect(outcome.kind).toBe('not_configured');
    expect(outcome.reason, 'Expected the blocker to be named.').toContain('checklist #5');
    expect(collectableTaxCents(outcome)).toBeNull();
  });
});

// ===========================================================================
// AC-13, AC-14: exemption
// ===========================================================================

describe('AC-13 / AC-14: exemption', () => {
  it('AC-13: an exempt customer gets a justified zero and the provider is never called', async () => {
    // ARRANGE — SPEC §4: skip the TaxJar call entirely.
    const ctx = context({ customerTaxExempt: true, provider: forbiddenProvider() });

    // ACT
    const outcome = await calculateTax(REQUEST, ctx);

    // ASSERT
    expect(outcome.kind).toBe('exempt');
    expect(collectableTaxCents(outcome), 'An exemption is a real, documented zero.').toBe(0);
    expect(
      outcome.reason,
      'SPEC §4 requires the invoice note "Tax exempt — resale certificate on file".'
    ).toContain('resale certificate on file');
    expect(
      outcome.isAuthoritative,
      'A documented exemption is a real basis for a zero, whichever provider is configured.'
    ).toBe(true);
  });

  it('AC-14: exemption wins over being unconfigured', async () => {
    // ARRANGE — nothing configured at all, but the customer is exempt.
    const ctx = context({
      provider: null,
      providerReason: 'No tax provider is configured.',
      origin: null,
      originReason: 'No origin.',
      nexus: NEXUS_LIST_EMPTY,
      customerTaxExempt: true,
    });

    // ACT
    const outcome = await calculateTax(REQUEST, ctx);

    // ASSERT
    expect(
      outcome.kind,
      'An exempt customer owes nothing regardless of configuration, so the correct answer — zero, ' +
        'and why — is available even on a deployment with no provider.'
    ).toBe('exempt');
    expect(collectableTaxCents(outcome)).toBe(0);
  });

  it('exemption is checked before the request is even well-formed? No — validation comes first', async () => {
    // ARRANGE — an exempt customer with a broken state code.
    const ctx = context({ customerTaxExempt: true });

    // ACT
    const outcome = await calculateTax({ ...REQUEST, toState: 'TEX' }, ctx);

    // ASSERT
    expect(
      outcome.kind,
      'A malformed request is reported as failed even for an exempt customer: a bad address is still ' +
        'a bad address, and silently accepting it would hide a data problem.'
    ).toBe('failed');
  });
});

// ===========================================================================
// AC-15, AC-16, AC-17: nexus outcomes
// ===========================================================================

describe('AC-15 / AC-16 / AC-17: no_nexus is a justified zero', () => {
  it('AC-15: a state with no row yields no_nexus and zero', async () => {
    // ARRANGE / ACT
    const outcome = await calculateTax(
      { ...REQUEST, toState: 'FL', toZip: '33101' },
      context({ nexus: NEXUS_LIST_MIXED, provider: forbiddenProvider() })
    );

    // ASSERT
    expect(outcome.kind).toBe('no_nexus');
    expect(collectableTaxCents(outcome), 'The list was supplied and FL is not in it: a real zero.').toBe(0);
    expect(outcome.reason, 'The reason must name the state.').toContain('FL');
  });

  it('AC-16: a recorded nexus AFS is not collecting in yields no_nexus, and says why', async () => {
    // ARRANGE
    const ctx = context({ nexus: [NEXUS_CA_NOT_COLLECTING], provider: forbiddenProvider() });

    // ACT
    const outcome = await calculateTax({ ...REQUEST, toState: 'CA', toZip: '90001' }, ctx);

    // ASSERT
    expect(outcome.kind).toBe('no_nexus');
    expect(
      outcome.reason,
      'Calculating a tax AFS cannot remit is worse than calculating none, so the reason must ' +
        'distinguish "recorded but not collecting" from "no nexus at all".'
    ).toContain('not collecting there yet');
    expect(collectableTaxCents(outcome)).toBe(0);
  });

  it('AC-17: an expired window yields no_nexus', async () => {
    const outcome = await calculateTax(
      { ...REQUEST, toState: 'OK', toZip: '73101' },
      context({ nexus: [NEXUS_OK_EXPIRED], provider: forbiddenProvider() })
    );
    expect(
      outcome.kind,
      `OK's window closed ${NEXUS_OK_EXPIRED.effectiveTo}. A deregistered state must stop producing tax.`
    ).toBe('no_nexus');
  });

  it('AC-17: a future window yields no_nexus', async () => {
    const outcome = await calculateTax(
      { ...REQUEST, toState: 'NM', toZip: '87101' },
      context({ nexus: [NEXUS_NM_FUTURE], provider: forbiddenProvider() })
    );
    expect(
      outcome.kind,
      `NM starts ${NEXUS_NM_FUTURE.effectiveFrom}. A nexus registered ahead of time must not apply yet.`
    ).toBe('no_nexus');
  });
});

// ===========================================================================
// AC-10, AC-11: the two zeros that are not the same
// ===========================================================================

describe('AC-10 / T-04: the vendor contradicting AFS is a conflict, not a zero', () => {
  it('reports failed and names both sides', async () => {
    // ARRANGE — AFS records collecting nexus in TX; the vendor says no nexus.
    const provider = stubProvider({
      ok: true,
      figures: {
        amountCents: 0,
        rate: 0,
        taxableAmountCents: 0,
        hasNexus: false,
        freightTaxable: false,
        jurisdictions: null,
      },
      rawResponse: { tax: { has_nexus: false } },
    });

    // ACT
    const outcome = await calculateTax(REQUEST, context({ provider }));

    // ASSERT
    expect(
      outcome.kind,
      `Expected failed, got ${outcome.kind}. AFS's own record and the vendor disagree about a legal ` +
        'fact and exactly one is wrong. Accepting the zero would quietly adopt the vendor\'s view and ' +
        'under-collect a tax AFS has registered to remit.'
    ).toBe('failed');
    expect(requiresAdminReview(outcome), 'Only a person can resolve a contradiction.').toBe(true);
    expect(
      'amountCents' in outcome,
      'A conflict must not expose the zero the vendor offered.'
    ).toBe(false);
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(outcome.problems.join(' '), "Expected AFS's side to be stated.").toContain('AFS nexus record');
    expect(outcome.problems.join(' '), "Expected the vendor's side to be stated.").toContain('has_nexus = false');
  });

  it('a null hasNexus is NOT a conflict — the vendor simply did not say', async () => {
    // ARRANGE
    const provider = stubProvider({
      ok: true,
      figures: {
        amountCents: 8250,
        rate: 0.0825,
        taxableAmountCents: 100_000,
        hasNexus: null,
        freightTaxable: null,
        jurisdictions: null,
      },
      rawResponse: {},
    });

    // ACT
    const outcome = await calculateTax(REQUEST, context({ provider }));

    // ASSERT
    expect(
      outcome.kind,
      'Only an EXPLICIT false is a disagreement. Treating an absent field as false would turn a ' +
        'vendor field rename into a flood of false conflict alerts.'
    ).toBe('calculated');
    expect(collectableTaxCents(outcome)).toBe(8250);
  });

  it('AC-11 / T-05: a zero amount WITH nexus is a real calculated zero', async () => {
    // ARRANGE
    const provider = stubProvider({
      ok: true,
      figures: {
        amountCents: 0,
        rate: 0,
        taxableAmountCents: 0,
        hasNexus: true,
        freightTaxable: false,
        jurisdictions: null,
      },
      rawResponse: {},
    });

    // ACT
    const outcome = await calculateTax(REQUEST, context({ provider }));

    // ASSERT
    expect(
      outcome.kind,
      'The vendor has nexus and says the tax is nothing. That is an ANSWER, and it is why zero can ' +
        'never be used as a failure signal anywhere in this subsystem.'
    ).toBe('calculated');
    expect(collectableTaxCents(outcome)).toBe(0);
    expect(isCollectable(outcome), 'A real zero is collectable — there is simply nothing to collect.').toBe(true);
  });
});

// ===========================================================================
// AC-09: failures
// ===========================================================================

describe('AC-09 / T-03: a provider failure is flagged, never zeroed', () => {
  it('a timeout yields failed, requiresAdminReview, and says no tax was calculated', async () => {
    // ARRANGE
    const provider = stubProvider({
      ok: false,
      message:
        'TaxJar did not answer within 8 seconds, so NO TAX WAS CALCULATED. Nothing was charged and ' +
        'nothing was saved as a tax figure. Try again in a moment.',
      problems: ['The request to TaxJar timed out.'],
      timedOut: true,
      status: null,
    });

    // ACT
    const outcome = await calculateTax(REQUEST, context({ provider }));

    // ASSERT
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(outcome.requiresAdminReview, 'A human must see this before anything is billed.').toBe(true);
    expect(outcome.timedOut, 'The timeout flag must survive to the outcome.').toBe(true);
    expect(outcome.reason, 'Rule #30: say what did NOT happen.').toContain('NO TAX WAS CALCULATED');
    expect(collectableTaxCents(outcome), 'There is no figure to read.').toBeNull();
  });

  it('a provider that throws despite its contract is still reported, not propagated', async () => {
    // ARRANGE
    const provider: TaxProvider = {
      name: 'taxjar',
      isAuthoritative: true,
      calculate: async () => {
        throw new Error('provider bug');
      },
    };

    // ACT / ASSERT — the engine must resolve, never reject.
    const outcome = await calculateTax(REQUEST, context({ provider }));
    expect(
      outcome.kind,
      'An exception reaching a caller that is deciding what to bill is the one shape it cannot ' +
        'handle, so even a buggy provider becomes a reported failure.'
    ).toBe('failed');
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(outcome.problems.join(' ')).toContain('provider bug');
  });
});

// ===========================================================================
// Request validation — no malformed request reaches a vendor
// ===========================================================================

describe('request validation happens before any vendor call', () => {
  it.each<[string, Partial<TaxCalculationRequest>, string]>([
    ['a three-letter state', { toState: 'TEX' }, 'state'],
    ['an empty state', { toState: '' }, 'state'],
    ['an empty ZIP', { toZip: '' }, 'ZIP'],
    ['a whitespace ZIP', { toZip: '   ' }, 'ZIP'],
    ['a negative subtotal', { subtotalCents: -1 }, 'negative'],
    ['a negative shipping', { shippingCents: -500 }, 'negative'],
    ['a fractional subtotal', { subtotalCents: 1000.5 }, 'whole number'],
    ['a NaN subtotal', { subtotalCents: Number.NaN }, 'finite'],
    ['an Infinite subtotal', { subtotalCents: Number.POSITIVE_INFINITY }, 'finite'],
  ])('%s is failed with no vendor call', async (_label, overrides, fragment) => {
    // ARRANGE — a provider that throws if reached.
    const ctx = context({ provider: forbiddenProvider() });

    // ACT
    const outcome = await calculateTax({ ...REQUEST, ...overrides }, ctx);

    // ASSERT
    expect(
      outcome.kind,
      'A malformed request is our bug, not the vendor\'s. Sending it would turn a local validation ' +
        'error into a confusing remote one.'
    ).toBe('failed');
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(
      outcome.problems.join(' '),
      `Expected a problem mentioning "${fragment}"; got ${JSON.stringify(outcome.problems)}.`
    ).toContain(fragment);
    expect(collectableTaxCents(outcome)).toBeNull();
  });

  it('NaN is caught by the finite check, which is why it runs first', async () => {
    // ARRANGE — `if (x < 0)` returns false for NaN, so order matters. Same
    // reasoning as pathfinder-edge.ts's assertPositiveDimension.
    const outcome = await calculateTax(
      { ...REQUEST, shippingCents: Number.NaN },
      context({ provider: forbiddenProvider() })
    );

    // ASSERT
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(
      outcome.problems.join(' '),
      'A non-finite amount must be caught locally. JSON.stringify serialises NaN to the literal ' +
        'null, which would reach the vendor as a structurally valid request carrying nonsense.'
    ).toContain('not a finite number');
  });

  it('a zero subtotal is valid, not a validation failure', async () => {
    const outcome = await calculateTax({ ...REQUEST, subtotalCents: 0 }, context());
    expect(outcome.kind, 'A zero-value order is a legitimate question.').toBe('calculated');
  });
});

// ===========================================================================
// AC-06 (mock marking) / INV-06
// ===========================================================================

describe('INV-06: a mock figure can never be mistaken for a real one', () => {
  it('a mock calculation is marked non-authoritative and says so in words', async () => {
    // ARRANGE / ACT — the real mock provider, end to end through the engine.
    const outcome = await calculateTax(REQUEST, context({ provider: mockTaxProvider }));

    // ASSERT
    expect(outcome.kind).toBe('calculated');
    expect(
      outcome.isAuthoritative,
      'The engine must carry the provider\'s authority onto the outcome, or the admin screen has no ' +
        'way to warn that a figure is a development one.'
    ).toBe(false);
    expect(outcome.provider).toBe('mock');
    expect(
      outcome.reason,
      `Expected the reason to warn in words; got "${outcome.reason}".`
    ).toContain('must not be billed');
  });

  it('a real provider calculation is marked authoritative, with the rate in the reason', async () => {
    // ARRANGE
    const provider = stubProvider({
      ok: true,
      figures: {
        amountCents: 8250,
        rate: 0.0825,
        taxableAmountCents: 100_000,
        hasNexus: true,
        freightTaxable: false,
        jurisdictions: { country: 'US', state: 'TX', county: null, city: null },
      },
      rawResponse: {},
    });

    // ACT
    const outcome = await calculateTax(REQUEST, context({ provider }));

    // ASSERT
    expect(outcome.isAuthoritative).toBe(true);
    expect(outcome.reason, 'The rate is worth stating on screen.').toContain('8.25%');
  });
});

describe('the destination state is normalised before it reaches the provider', () => {
  it('a padded lower-case state resolves nexus and is sent uppercase', async () => {
    // ARRANGE
    let seenState = '';
    const provider: TaxProvider = {
      name: 'taxjar',
      isAuthoritative: true,
      calculate: async (req) => {
        seenState = req.toState;
        return {
          ok: true,
          figures: {
            amountCents: 1,
            rate: 0.01,
            taxableAmountCents: 100,
            hasNexus: true,
            freightTaxable: null,
            jurisdictions: null,
          },
          rawResponse: {},
        };
      },
    };

    // ACT
    const outcome = await calculateTax({ ...REQUEST, toState: ' tx ' }, context({ provider }));

    // ASSERT
    expect(outcome.kind, 'A padded state must still match the TX nexus row.').toBe('calculated');
    expect(
      seenState,
      'The provider must receive a normalised code, so the vendor is never asked about " tx ".'
    ).toBe('TX');
  });
});
