/**
 * EES-OVN.08 AC-27.
 */
import { describe, it, expect } from 'vitest';
import { MockTaxProvider, mockTaxProvider, MOCK_STATE_BASE_RATES } from './mock';
import type { TaxCalculationRequest, TaxOrigin } from '../types';

const ORIGIN: TaxOrigin = { zip: '78611', state: 'TX' };

function request(overrides: Partial<TaxCalculationRequest> = {}): TaxCalculationRequest {
  return { toState: 'TX', toZip: '78701', subtotalCents: 100_000, shippingCents: 0, ...overrides };
}

describe('MockTaxProvider — identity', () => {
  it('AC-27: declares itself non-authoritative, so a mock figure can never be billed', () => {
    expect(
      mockTaxProvider.isAuthoritative,
      'THE LOAD-BEARING ASSERTION for the mock. The engine copies this onto the outcome and the admin ' +
        'screen renders it as a warning. If it were ever true, a development fixture figure would be ' +
        'indistinguishable from a real collectable tax.'
    ).toBe(false);
  });

  it('is named "mock" so the outcome and the cache key record which engine ran', () => {
    expect(mockTaxProvider.name).toBe('mock');
  });
});

describe('MockTaxProvider — it is fully implemented, not a stub', () => {
  it('computes tax from the recorded rate for the destination state', async () => {
    // ARRANGE — $1,000.00 to Texas, whose recorded base rate is 6.25%.
    const provider = new MockTaxProvider();

    // ACT
    const result = await provider.calculate(request(), ORIGIN);

    // ASSERT
    expect(result.ok, 'TX is in the recorded table, so this must succeed.').toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.figures.rate, 'Expected the recorded TX base rate.').toBe(MOCK_STATE_BASE_RATES.TX);
    expect(
      result.figures.amountCents,
      'Expected 100000 cents * 0.0625 = 6250 cents. A stub returning a constant would not survive ' +
        'this assertion.'
    ).toBe(6250);
  });

  it('applies taxable freight where the recorded table says freight is taxable', async () => {
    // ARRANGE — TX treats freight as taxable in the recorded table.
    const result = await mockTaxProvider.calculate(
      request({ shippingCents: 15_000 }),
      ORIGIN
    );

    // ASSERT
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.figures.freightTaxable, 'The recorded table marks TX freight taxable.').toBe(true);
    expect(
      result.figures.taxableAmountCents,
      'Expected freight to be included in the taxable base: 100000 + 15000.'
    ).toBe(115_000);
    expect(result.figures.amountCents, 'Expected 115000 * 0.0625 = 7187.5 → 7188 cents, half-up.').toBe(7188);
  });

  it('excludes freight where the recorded table says it is not taxable', async () => {
    // ARRANGE — CA is in the rate table and not in the freight-taxable table.
    const result = await mockTaxProvider.calculate(
      request({ toState: 'CA', toZip: '90001', shippingCents: 15_000 }),
      ORIGIN
    );

    // ASSERT
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.figures.freightTaxable, 'CA is absent from the freight-taxable table.').toBe(false);
    expect(
      result.figures.taxableAmountCents,
      'Expected freight to be excluded, so the base is the subtotal alone.'
    ).toBe(100_000);
    expect(result.figures.amountCents, 'Expected 100000 * 0.06 = 6000 cents.').toBe(6000);
  });

  it('returns a zero tax for a zero subtotal rather than failing', async () => {
    const result = await mockTaxProvider.calculate(request({ subtotalCents: 0 }), ORIGIN);
    expect(result.ok, 'A zero amount is a valid question with a valid answer.').toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.figures.amountCents).toBe(0);
  });

  it('reports hasNexus: true, because the engine already established nexus before calling it', async () => {
    const result = await mockTaxProvider.calculate(request(), ORIGIN);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(
      result.figures.hasNexus,
      'The engine only calls a provider for a state AFS is already collecting in. Returning false ' +
        'here would manufacture the vendor/AFS conflict case rather than model it.'
    ).toBe(true);
  });

  it('normalises a padded lower-case destination state', async () => {
    const result = await mockTaxProvider.calculate(request({ toState: ' tx ' }), ORIGIN);
    expect(result.ok, 'The provider must normalise its input like everything else here.').toBe(true);
  });

  it('labels its raw response as not a real tax figure, for the audit snapshot', async () => {
    // ARRANGE / ACT
    const result = await mockTaxProvider.calculate(request(), ORIGIN);

    // ASSERT
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(
      JSON.stringify(result.rawResponse),
      'The snapshot is stored in tax_calculations and read by a human later. It must say what it is.'
    ).toContain('NOT a real tax figure');
  });
});

describe('MockTaxProvider — AC-27: it refuses rather than guesses', () => {
  it('fails for a state with no recorded rate, instead of inventing one', async () => {
    // ARRANGE — Florida is deliberately absent from the recorded table.
    const result = await mockTaxProvider.calculate(
      request({ toState: 'FL', toZip: '33101' }),
      ORIGIN
    );

    // ASSERT
    expect(
      result.ok,
      'THE LOAD-BEARING ASSERTION. An unknown state must be a failure, not a guessed rate and not a ' +
        'zero. If the mock invented a rate, development would be exercising a code path production ' +
        'does not have — and a zero would be the exact silent-zero bug this whole item exists to prevent.'
    ).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.message, `Expected the message to name the state; got "${result.message}".`).toContain('FL');
    expect(
      result.message,
      'Expected the message to say it does not guess, so a reader knows this is deliberate.'
    ).toContain('does not guess');
    expect(result.timedOut, 'A missing rate is not a timeout.').toBe(false);
    expect(result.status, 'There was no HTTP exchange, so there is no status.').toBeNull();
  });

  it('fails for an empty destination state without throwing', async () => {
    const result = await mockTaxProvider.calculate(request({ toState: '' }), ORIGIN);
    expect(result.ok, 'An empty state has no rate and must fail.').toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.problems.length, 'A failure must carry at least one problem.').toBeGreaterThan(0);
  });
});

describe('MockTaxProvider — determinism', () => {
  it('AC-27: the same request always produces the same figures', async () => {
    // ARRANGE / ACT
    const first = await mockTaxProvider.calculate(request(), ORIGIN);
    const second = await mockTaxProvider.calculate(request(), ORIGIN);

    // ASSERT
    expect(first.ok && second.ok, 'Both calls must succeed.').toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable');
    expect(
      second.figures,
      'The mock reads no clock and no randomness, so repeated calls must agree. The cache tests rely ' +
        'on this: they assert on a call counter, which is only meaningful if the value is stable.'
    ).toEqual(first.figures);
  });

  it('every recorded rate is a plausible finite fraction, so no row is a typo', () => {
    // ARRANGE / ACT / ASSERT — guards against a decimal slip like 6.25 for 0.0625.
    for (const [state, rate] of Object.entries(MOCK_STATE_BASE_RATES)) {
      expect(
        Number.isFinite(rate) && rate > 0 && rate < 0.2,
        `The recorded rate for ${state} is ${rate}, which is outside the plausible 0–20% band. A ` +
          'decimal slip here (6.25 instead of 0.0625) would produce a 100x tax in development.'
      ).toBe(true);
    }
  });
});
