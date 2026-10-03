/**
 * RESOLVING WHICH TAX PROVIDER IS IN USE, AND WHETHER IT CAN RUN.
 *
 * ================== THE DEFAULT IS "DO NOT CALCULATE" ==================
 *
 * `TAX_PROVIDER` unset means NO TAX CALCULATION IS PERFORMED. It does not mean
 * a rate of zero, and it does not quietly fall back to the mock. A deployment
 * that has not been configured must say "not configured" and nothing else — the
 * nexus state list is an open data blocker (CLAUDE.md DATA BLOCKERS, checklist
 * #31) and AFS collects no tax until its accountant supplies it.
 *
 * `'banana'` ALSO MEANS "DO NOT CALCULATE". A typo must not start producing
 * figures: if an unrecognised value fell back to `mock`, then `TAX_PROVIDR=mock`
 * (one letter short) would look like it was working while actually running the
 * wrong engine, and `TAX_PROVIDER=taxjer` would silently produce fixture
 * numbers in production. So anything unrecognised resolves to `none` and the
 * reason quotes the value back, which is what makes the typo findable.
 *
 * ================== WHY THESE FUNCTIONS TAKE `env` ==================
 *
 * Neither function reads `process.env` itself. They take a plain record, so a
 * test can resolve twenty configurations without mutating global state. Mutating
 * `process.env` in a test makes it order-dependent, and the Elite Standard
 * requires tests be isolated, order-independent and deterministic. The one place
 * that touches the real environment is `resolveTaxConfigFromEnv()` at the
 * bottom, which is a thin adapter over these two.
 *
 * NO SECRET IS EVER RETURNED OR LOGGED. The API key is checked for PRESENCE
 * only; its value never appears in a `reason`, which is a string this codebase
 * shows to an admin on screen.
 */

import type { TaxOrigin, TaxProviderName } from './types';

/** The env record shape these functions accept. `process.env` satisfies it. */
export type TaxEnv = Record<string, string | undefined>;

export interface TaxProviderResolution {
  provider: TaxProviderName;
  /**
   * Plain English, safe to put on an admin screen. When the provider is `none`
   * this names the specific thing that is missing, because "not configured" on
   * its own sends somebody hunting.
   */
  reason: string;
}

export interface TaxOriginResolution {
  origin: TaxOrigin | null;
  reason: string;
}

/**
 * How long a read may take before it is abandoned, in milliseconds.
 *
 * 8000 is BORROWED from `PATHFINDER_READ_TIMEOUT_MS`, which was itself chosen
 * from a live probe that measured 2.46s against PathfinderEdge. It is NOT a
 * measurement of TaxJar — nothing in this codebase has ever called TaxJar — and
 * saying so is the point: an unmeasured number presented as a measured one is
 * how a comment becomes wrong. Reuse of a known-good order of magnitude is a
 * defensible default; pretending it was measured is not.
 */
export const TAX_READ_TIMEOUT_MS = 8000;

/**
 * How long a successful calculation may be reused, in seconds. 24 hours.
 *
 * Sales tax rates change on published effective dates, not continuously, so a
 * day bounds staleness while removing repeat vendor calls for an unchanged
 * basket — TaxJar bills per call and rate-limits. This is an engineering
 * default, not a business number AFS supplied; it is overridable with
 * `TAX_CACHE_TTL_SECONDS`.
 */
export const TAX_CACHE_TTL_SECONDS_DEFAULT = 86_400;

/** TaxJar's documented API root. Overridable for the sandbox host. */
export const TAXJAR_DEFAULT_BASE_URL = 'https://api.taxjar.com';

function trimmed(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Which provider this deployment runs, and why.
 *
 * `TAX_PROVIDER` is matched case-insensitively after trimming, because an env
 * var pasted from a dashboard routinely arrives as `"mock "` or `"Mock"`, and
 * refusing those would be pedantry rather than safety — unlike an unrecognised
 * WORD, which really is a different instruction.
 */
export function resolveTaxProvider(env: TaxEnv): TaxProviderResolution {
  const raw = trimmed(env.TAX_PROVIDER).toLowerCase();

  if (raw === '') {
    return {
      provider: 'none',
      reason:
        'No tax provider is configured (TAX_PROVIDER is not set), so no tax is calculated and none is collected.',
    };
  }

  if (raw === 'mock') {
    return {
      provider: 'mock',
      reason:
        'TAX_PROVIDER=mock. Figures come from a recorded reference rate table for development — they are NOT a real tax and must never be billed.',
    };
  }

  if (raw === 'taxjar') {
    if (trimmed(env.TAXJAR_API_KEY) === '') {
      return {
        provider: 'none',
        reason:
          'TAX_PROVIDER=taxjar, but TAXJAR_API_KEY is not set, so no tax can be calculated. Add the key to switch TaxJar on.',
      };
    }
    return { provider: 'taxjar', reason: 'TAX_PROVIDER=taxjar with an API key present.' };
  }

  return {
    provider: 'none',
    reason:
      `TAX_PROVIDER is set to "${raw}", which is not a provider this app knows. ` +
      'The only accepted values are "mock" and "taxjar". No tax is calculated until it is corrected.',
  };
}

/**
 * Where the sale ships from, or null with the reason.
 *
 * BOTH HALVES ARE REQUIRED AND NEITHER IS GUESSED — see TaxOrigin's own comment
 * in types.ts for why `from_state: 'TX'` is not hardcoded here the way
 * specs/SPEC_TAXJAR_INTEGRATION.md §3 does it.
 */
export function resolveTaxOrigin(env: TaxEnv): TaxOriginResolution {
  const zip = trimmed(env.TAX_ORIGIN_ZIP);
  const state = trimmed(env.TAX_ORIGIN_STATE).toUpperCase();

  const missing: string[] = [];
  if (zip === '') missing.push('TAX_ORIGIN_ZIP');
  if (state === '') missing.push('TAX_ORIGIN_STATE');

  if (missing.length > 0) {
    return {
      origin: null,
      reason:
        `The shop's tax origin is not configured (${missing.join(' and ')} not set). ` +
        "AFS's address is an outstanding data blocker (checklist #5), and an origin is never guessed, " +
        'so no tax is calculated.',
    };
  }

  if (!/^[A-Z]{2}$/.test(state)) {
    return {
      origin: null,
      reason: `TAX_ORIGIN_STATE is "${state}", which is not a two-letter state code. No tax is calculated until it is corrected.`,
    };
  }

  return { origin: { zip, state }, reason: `Shipping from ${state} ${zip}.` };
}

/** TaxJar's base URL for this deployment. Never returns an empty string. */
export function resolveTaxJarBaseUrl(env: TaxEnv): string {
  const raw = trimmed(env.TAXJAR_API_BASE_URL);
  if (raw === '') return TAXJAR_DEFAULT_BASE_URL;
  // A trailing slash would produce `//v2/taxes`, which some gateways 404.
  return raw.replace(/\/+$/, '');
}

/**
 * The cache TTL in seconds. A non-numeric, negative or zero value falls back to
 * the default rather than disabling the cache silently — `TAX_CACHE_TTL_SECONDS=0`
 * reads as "off" to the person who typed it, but a 0-second TTL would hammer the
 * vendor on every identical request, so it is treated as a mistake.
 */
export function resolveTaxCacheTtlSeconds(env: TaxEnv): number {
  const raw = trimmed(env.TAX_CACHE_TTL_SECONDS);
  if (raw === '') return TAX_CACHE_TTL_SECONDS_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return TAX_CACHE_TTL_SECONDS_DEFAULT;
  }
  return parsed;
}

export interface TaxConfig {
  provider: TaxProviderName;
  providerReason: string;
  origin: TaxOrigin | null;
  originReason: string;
  baseUrl: string;
  cacheTtlSeconds: number;
}

/**
 * The one adapter that reads the real environment. Server-side callers use this;
 * everything else takes an explicit `env` so it stays testable.
 *
 * Returns no secret. `provider: 'taxjar'` is itself the statement that a key is
 * present, which is all any caller or screen needs to know.
 */
export function resolveTaxConfigFromEnv(env: TaxEnv = process.env): TaxConfig {
  const { provider, reason: providerReason } = resolveTaxProvider(env);
  const { origin, reason: originReason } = resolveTaxOrigin(env);
  return {
    provider,
    providerReason,
    origin,
    originReason,
    baseUrl: resolveTaxJarBaseUrl(env),
    cacheTtlSeconds: resolveTaxCacheTtlSeconds(env),
  };
}
