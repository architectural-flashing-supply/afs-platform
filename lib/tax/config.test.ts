/**
 * EES-OVN.08 AC-01 … AC-05, plus the TTL and base-URL boundaries.
 *
 * Every case passes an explicit env record. `process.env` is never mutated, so
 * these tests are order-independent and deterministic.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTaxProvider,
  resolveTaxOrigin,
  resolveTaxJarBaseUrl,
  resolveTaxCacheTtlSeconds,
  resolveTaxConfigFromEnv,
  TAX_CACHE_TTL_SECONDS_DEFAULT,
  TAXJAR_DEFAULT_BASE_URL,
  TAX_READ_TIMEOUT_MS,
} from './config';

describe('resolveTaxProvider — the default performs no calculation', () => {
  it('AC-01: an unset TAX_PROVIDER resolves to none, and the reason says no tax is collected', () => {
    // ARRANGE
    const env = {};

    // ACT
    const result = resolveTaxProvider(env);

    // ASSERT
    expect(
      result.provider,
      'Expected provider "none" with TAX_PROVIDER unset, got ' +
        `"${result.provider}". An unconfigured deployment that resolves to a working provider ` +
        'is how a deployment nobody configured starts calculating tax.'
    ).toBe('none');
    expect(
      result.reason,
      `Expected the reason to state that no tax is calculated; got "${result.reason}". ` +
        'An admin reading "not configured" with no detail has nowhere to go.'
    ).toContain('no tax is calculated');
  });

  it('an empty-string TAX_PROVIDER is the same as unset', () => {
    expect(
      resolveTaxProvider({ TAX_PROVIDER: '' }).provider,
      'An empty TAX_PROVIDER must behave exactly as an absent one — an env var set to "" is the ' +
        'most common way a dashboard represents "not set".'
    ).toBe('none');
  });

  it('a whitespace-only TAX_PROVIDER is the same as unset', () => {
    expect(
      resolveTaxProvider({ TAX_PROVIDER: '   ' }).provider,
      'Whitespace-only must resolve to none, not to an unrecognised value.'
    ).toBe('none');
  });
});

describe('resolveTaxProvider — taxjar requires its key', () => {
  it('AC-02: taxjar without a key resolves to none and names the missing key', () => {
    // ARRANGE
    const env = { TAX_PROVIDER: 'taxjar' };

    // ACT
    const result = resolveTaxProvider(env);

    // ASSERT
    expect(
      result.provider,
      `Expected "none" when TAXJAR_API_KEY is absent, got "${result.provider}". ` +
        'Resolving to taxjar without a key would send an unauthenticated request on every quote.'
    ).toBe('none');
    expect(
      result.reason,
      `Expected the reason to name TAXJAR_API_KEY; got "${result.reason}".`
    ).toContain('TAXJAR_API_KEY');
  });

  it('an empty key is treated as no key', () => {
    expect(
      resolveTaxProvider({ TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: '' }).provider,
      'An empty TAXJAR_API_KEY must not count as present.'
    ).toBe('none');
  });

  it('a whitespace-only key is treated as no key', () => {
    expect(
      resolveTaxProvider({ TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: '  ' }).provider,
      'A whitespace-only TAXJAR_API_KEY must not count as present.'
    ).toBe('none');
  });

  it('taxjar with a key resolves to taxjar, and the reason carries no key value', () => {
    // ARRANGE
    const secret = 'tj_live_SHOULD_NEVER_BE_ECHOED';
    const env = { TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: secret };

    // ACT
    const result = resolveTaxProvider(env);

    // ASSERT
    expect(result.provider, 'Expected taxjar with a key present.').toBe('taxjar');
    expect(
      result.reason.includes(secret),
      'The reason string is shown on an admin screen. It must never contain the API key, and it ' +
        `contained it here: "${result.reason}".`
    ).toBe(false);
  });
});

describe('resolveTaxProvider — mock, and the typo rule', () => {
  it('AC-03: "MoCk  " resolves to mock (trimmed, case-insensitive)', () => {
    // ARRANGE / ACT
    const result = resolveTaxProvider({ TAX_PROVIDER: 'MoCk  ' });

    // ASSERT
    expect(
      result.provider,
      `Expected "mock" from "MoCk  ", got "${result.provider}". A value pasted from a dashboard ` +
        'routinely carries padding or different case, and refusing those is pedantry, not safety.'
    ).toBe('mock');
  });

  it('AC-03: the mock reason states the figures are not a real tax', () => {
    const { reason } = resolveTaxProvider({ TAX_PROVIDER: 'mock' });
    expect(
      reason,
      `Expected the mock reason to warn the figures are not real; got "${reason}". ` +
        'A mock figure that is not marked as one can be mistaken for a collectable tax.'
    ).toContain('NOT a real tax');
  });

  it('AC-04: an unrecognised value resolves to none, quotes the value, and never falls back to mock', () => {
    // ARRANGE
    const env = { TAX_PROVIDER: 'banana' };

    // ACT
    const result = resolveTaxProvider(env);

    // ASSERT
    expect(
      result.provider,
      `Expected "none" for an unrecognised provider, got "${result.provider}". Falling back to ` +
        'mock would mean a one-letter typo silently produced fixture figures in production.'
    ).toBe('none');
    expect(
      result.reason,
      `Expected the reason to quote "banana" back so the typo is findable; got "${result.reason}".`
    ).toContain('banana');
  });

  it('AC-04: a near-miss spelling does not resolve to taxjar', () => {
    expect(
      resolveTaxProvider({ TAX_PROVIDER: 'taxjer', TAXJAR_API_KEY: 'k' }).provider,
      '"taxjer" must not be accepted as "taxjar" — a fuzzy match here would hide the typo it is ' +
        'meant to surface.'
    ).toBe('none');
  });
});

describe('resolveTaxOrigin — both halves required, neither guessed', () => {
  it('AC-05: a missing ZIP yields no origin and names data blocker #5', () => {
    // ARRANGE
    const env = { TAX_ORIGIN_STATE: 'TX' };

    // ACT
    const result = resolveTaxOrigin(env);

    // ASSERT
    expect(
      result.origin,
      'Expected null origin when TAX_ORIGIN_ZIP is absent. Half an origin produces a request that ' +
        'looks complete and is not.'
    ).toBeNull();
    expect(
      result.reason,
      `Expected the reason to name TAX_ORIGIN_ZIP; got "${result.reason}".`
    ).toContain('TAX_ORIGIN_ZIP');
    expect(
      result.reason,
      `Expected the reason to cite the outstanding address data blocker (#5); got "${result.reason}".`
    ).toContain('checklist #5');
  });

  it('AC-05: a missing state yields no origin — "TX" is never assumed', () => {
    // ARRANGE
    const env = { TAX_ORIGIN_ZIP: '78611' };

    // ACT
    const result = resolveTaxOrigin(env);

    // ASSERT
    expect(
      result.origin,
      'Expected null origin with no TAX_ORIGIN_STATE. SPEC_TAXJAR_INTEGRATION.md §3 hardcodes ' +
        "'TX'; this codebase deliberately does not, because a tax origin is a legal input."
    ).toBeNull();
    expect(result.reason).toContain('TAX_ORIGIN_STATE');
  });

  it('AC-05: both missing names both variables', () => {
    const { reason } = resolveTaxOrigin({});
    expect(reason, `Expected both names in "${reason}".`).toContain('TAX_ORIGIN_ZIP');
    expect(reason, `Expected both names in "${reason}".`).toContain('TAX_ORIGIN_STATE');
  });

  it('both present resolves an origin, uppercasing and trimming the state', () => {
    // ARRANGE / ACT
    const result = resolveTaxOrigin({ TAX_ORIGIN_ZIP: ' 78611 ', TAX_ORIGIN_STATE: ' tx ' });

    // ASSERT
    expect(
      result.origin,
      'Expected a resolved origin from a padded lowercase state.'
    ).toEqual({ zip: '78611', state: 'TX' });
  });

  it('a malformed state code is refused rather than passed through', () => {
    // ARRANGE / ACT
    const result = resolveTaxOrigin({ TAX_ORIGIN_ZIP: '78611', TAX_ORIGIN_STATE: 'TEX' });

    // ASSERT
    expect(
      result.origin,
      'Expected null for a three-letter origin state. Sending "TEX" to a vendor produces a shape ' +
        'error far from the configuration mistake that caused it.'
    ).toBeNull();
    expect(result.reason, `Expected the reason to quote the bad value; got "${result.reason}".`).toContain('TEX');
  });
});

describe('resolveTaxJarBaseUrl', () => {
  it('defaults to TaxJar production when unset', () => {
    expect(resolveTaxJarBaseUrl({})).toBe(TAXJAR_DEFAULT_BASE_URL);
  });

  it('uses an override, e.g. the sandbox host', () => {
    expect(resolveTaxJarBaseUrl({ TAXJAR_API_BASE_URL: 'https://api.sandbox.taxjar.com' })).toBe(
      'https://api.sandbox.taxjar.com'
    );
  });

  it('strips trailing slashes so the path never doubles up', () => {
    expect(
      resolveTaxJarBaseUrl({ TAXJAR_API_BASE_URL: 'https://api.taxjar.com//' }),
      'A trailing slash would build "https://api.taxjar.com//v2/taxes", which some gateways 404.'
    ).toBe('https://api.taxjar.com');
  });

  it('an empty override falls back to the default rather than producing a relative URL', () => {
    expect(resolveTaxJarBaseUrl({ TAXJAR_API_BASE_URL: '   ' })).toBe(TAXJAR_DEFAULT_BASE_URL);
  });
});

describe('resolveTaxCacheTtlSeconds', () => {
  it('defaults to 24 hours', () => {
    expect(resolveTaxCacheTtlSeconds({})).toBe(TAX_CACHE_TTL_SECONDS_DEFAULT);
    expect(TAX_CACHE_TTL_SECONDS_DEFAULT, 'The documented default is 24 hours in seconds.').toBe(86_400);
  });

  it('accepts a positive integer', () => {
    expect(resolveTaxCacheTtlSeconds({ TAX_CACHE_TTL_SECONDS: '3600' })).toBe(3600);
  });

  it.each([
    ['0', 'zero would re-call the vendor on every identical request'],
    ['-1', 'a negative TTL has no meaning'],
    ['abc', 'a non-numeric value is a typo'],
    ['1.5', 'a fractional second is not a TTL this code models'],
  ])('falls back to the default for %s', (value, why) => {
    expect(
      resolveTaxCacheTtlSeconds({ TAX_CACHE_TTL_SECONDS: value }),
      `Expected the default TTL for "${value}" because ${why}.`
    ).toBe(TAX_CACHE_TTL_SECONDS_DEFAULT);
  });
});

describe('resolveTaxConfigFromEnv', () => {
  it('composes provider, origin, base URL and TTL from one record', () => {
    // ARRANGE
    const env = {
      TAX_PROVIDER: 'mock',
      TAX_ORIGIN_ZIP: '78611',
      TAX_ORIGIN_STATE: 'TX',
      TAX_CACHE_TTL_SECONDS: '600',
    };

    // ACT
    const config = resolveTaxConfigFromEnv(env);

    // ASSERT
    expect(config.provider).toBe('mock');
    expect(config.origin).toEqual({ zip: '78611', state: 'TX' });
    expect(config.baseUrl).toBe(TAXJAR_DEFAULT_BASE_URL);
    expect(config.cacheTtlSeconds).toBe(600);
  });

  it('an entirely empty environment yields a fully unconfigured, non-calculating config', () => {
    // ACT
    const config = resolveTaxConfigFromEnv({});

    // ASSERT
    expect(
      config.provider,
      'A deployment with no tax env at all must calculate nothing.'
    ).toBe('none');
    expect(config.origin, 'No origin may be inferred from an empty environment.').toBeNull();
  });
});

describe('TAX_READ_TIMEOUT_MS', () => {
  it('is 8 seconds, matching the only measured precedent in this codebase', () => {
    expect(
      TAX_READ_TIMEOUT_MS,
      'The value is borrowed from PATHFINDER_READ_TIMEOUT_MS. If it changes, the comment ' +
        'explaining that it is borrowed rather than measured must change with it.'
    ).toBe(8000);
  });
});
