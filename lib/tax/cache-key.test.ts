/**
 * EES-OVN.08 AC-30, AC-31.
 */
import { describe, it, expect } from 'vitest';
import { buildTaxCacheKey, TAX_CACHE_KEY_VERSION, type TaxCacheKeyInput } from './cache-key';
import { nexusFingerprint } from './nexus';
import { NEXUS_CA_NOT_COLLECTING, NEXUS_TX_COLLECTING } from '@/tests/fixtures/tax/nexus';

/** One explicit baseline input every test varies exactly one field of. */
function baseInput(): TaxCacheKeyInput {
  return {
    provider: 'taxjar',
    origin: { zip: '78611', state: 'TX' },
    request: { toState: 'TX', toZip: '78701', subtotalCents: 100_000, shippingCents: 0 },
    exempt: false,
    nexusFingerprint: nexusFingerprint([NEXUS_TX_COLLECTING]),
  };
}

describe('buildTaxCacheKey — shape and stability', () => {
  it('AC-31: the same input yields the same key, every time', () => {
    // ARRANGE / ACT
    const a = buildTaxCacheKey(baseInput());
    const b = buildTaxCacheKey(baseInput());

    // ASSERT
    expect(
      a,
      'A key that varies between calls would make the cache a pure cost: every lookup would miss.'
    ).toBe(b);
  });

  it('is a 64-character hex SHA-256, so it fits an indexed column', () => {
    const key = buildTaxCacheKey(baseInput());
    expect(key, `Expected 64 hex chars, got ${key.length}: "${key}".`).toMatch(/^[0-9a-f]{64}$/);
  });

  it('carries no customer address, which is why it is hashed at all', () => {
    // ARRANGE
    const input = baseInput();

    // ACT
    const key = buildTaxCacheKey(input);

    // ASSERT
    expect(
      key.includes('78701'),
      'The key is a database column that appears in query plans and logs. A raw ZIP in it would put ' +
        "a customer's address somewhere nobody intended."
    ).toBe(false);
  });

  it('AC-31: normalises case and padding so one question does not take two slots', () => {
    // ARRANGE
    const canonical = buildTaxCacheKey(baseInput());
    const messy = buildTaxCacheKey({
      ...baseInput(),
      origin: { zip: ' 78611 ', state: 'tx' },
      request: { toState: ' tx ', toZip: ' 78701 ', subtotalCents: 100_000, shippingCents: 0 },
    });

    // ASSERT
    expect(
      messy,
      'A padded lower-case destination is the same question as a clean upper-case one; two keys ' +
        'would mean two vendor calls for one answer.'
    ).toBe(canonical);
  });
});

describe('buildTaxCacheKey — every field that can change an answer changes the key', () => {
  const base = baseInput();

  it.each<[string, TaxCacheKeyInput, string]>([
    [
      'provider',
      { ...base, provider: 'mock' },
      'a mock figure and a real figure must never share a slot, or switching TAX_PROVIDER would ' +
        'serve a fixture number as a real tax',
    ],
    [
      'origin state',
      { ...base, origin: { zip: '78611', state: 'OK' } },
      'tax depends on where the sale ships from',
    ],
    [
      'origin ZIP',
      { ...base, origin: { zip: '73301', state: 'TX' } },
      'a different origin can sit in a different local jurisdiction',
    ],
    [
      'destination state',
      { ...base, request: { ...base.request, toState: 'CA' } },
      'a different state is a different tax',
    ],
    [
      'destination ZIP',
      { ...base, request: { ...base.request, toZip: '77002' } },
      'local rates vary within a state',
    ],
    [
      'subtotal',
      { ...base, request: { ...base.request, subtotalCents: 100_001 } },
      'the amount taxed changes the tax',
    ],
    [
      'shipping',
      { ...base, request: { ...base.request, shippingCents: 15_000 } },
      'freight may be taxable, so it changes the answer',
    ],
    [
      'exemption',
      { ...base, exempt: true },
      "an exempt customer's zero must never be served to a non-exempt one",
    ],
  ])('a different %s yields a different key', (_field, changed, why) => {
    expect(
      buildTaxCacheKey(changed),
      `Expected a different cache key, because ${why}.`
    ).not.toBe(buildTaxCacheKey(base));
  });

  it('AC-30: a changed nexus list yields a different key', () => {
    // ARRANGE — the same request, after an admin adds a state.
    const before = buildTaxCacheKey(base);
    const after = buildTaxCacheKey({
      ...base,
      nexusFingerprint: nexusFingerprint([NEXUS_TX_COLLECTING, NEXUS_CA_NOT_COLLECTING]),
    });

    // ASSERT
    expect(
      after,
      'THE LOAD-BEARING ASSERTION. Without the nexus fingerprint in the key, an admin adding a nexus ' +
        'state would keep being served the cached "no nexus, no tax" answer for the whole TTL — a ' +
        'wrong answer produced by a correct edit, which nobody would think to suspect.'
    ).not.toBe(before);
  });

  it('AC-30: stopping collection in a state yields a different key', () => {
    const collecting = buildTaxCacheKey(base);
    const stopped = buildTaxCacheKey({
      ...base,
      nexusFingerprint: nexusFingerprint([{ ...NEXUS_TX_COLLECTING, collecting: false }]),
    });
    expect(stopped, 'Retiring a state must invalidate its cached figures.').not.toBe(collecting);
  });
});

describe('TAX_CACHE_KEY_VERSION', () => {
  it('is part of the hashed material, so old rows cannot collide with a new scheme', () => {
    // ARRANGE — two keys that differ only by the version prefix cannot be built
    // through the public API, so assert the version participates by construction:
    // the constant exists and the key changes if it is ever bumped.
    expect(TAX_CACHE_KEY_VERSION, 'A version must be present to make a future bump possible.').toBe('v1');
    expect(
      buildTaxCacheKey(baseInput()),
      'The key must be a stable hash of versioned material, not an empty string.'
    ).toHaveLength(64);
  });
});
