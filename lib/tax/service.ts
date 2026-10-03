/**
 * THE COMPOSITION ROOT. The one place where configuration, a provider, the
 * database, the cache and the pure engine are assembled into a single call.
 *
 * Everything else in lib/tax is either pure (types, config, nexus, calculate,
 * cache-key, response) or a thin database layer (db.ts). This file is the only
 * one that does all of it, which is why it is small and why it reads top to
 * bottom as a sequence rather than branching.
 *
 * ================== WHAT IT GUARANTEES ==================
 *
 * 1. NO VENDOR CALL WHEN NOTHING IS CONFIGURED. `buildProvider` returns null for
 *    `'none'`, and `calculateTax` short-circuits on a null provider before any
 *    network access — proved in calculate.test.ts with a provider that throws if
 *    called.
 *
 * 2. THE CACHE IS CONSULTED ONLY WHEN A CALL WOULD OTHERWISE HAPPEN. An exempt
 *    customer, an unconfigured deployment and a non-nexus state are all decided
 *    locally and for free, so there is nothing to cache and no row written.
 *
 * 3. A CACHE OR RECORDING FAILURE NEVER DOWNGRADES A GOOD ANSWER. Both are
 *    logged and swallowed in db.ts. A tax really was calculated; saying otherwise
 *    because a bookkeeping write failed would be the same class of lie as
 *    reporting a zero for an uncalculated tax.
 *
 * 4. NOTHING HERE IS WIRED TO A CUSTOMER-FACING TOTAL. That is deliberate and it
 *    is enforced by a static test — see lib/tax/tax-not-in-money-path.test.ts and
 *    EES-OVN.08 §8 for why the spec's checkout flow is too ambiguous to wire
 *    tonight. The only caller today is the admin Tax nexus screen's preview.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateTax } from './calculate';
import { findNexusForState } from './nexus';
import { resolveTaxConfigFromEnv, type TaxConfig, type TaxEnv } from './config';
import {
  cacheKeyFor,
  findCachedCalculation,
  getNexusStates,
  recordCalculation,
} from './db';
import { mockTaxProvider } from './providers/mock';
import { TaxJarProvider } from './providers/taxjar';
import type {
  NexusState,
  TaxCalculationRequest,
  TaxOutcome,
  TaxProvider,
} from './types';
// The shop's one clock. NOTE: CLAUDE.md rule #24 cites `shopDateOnly()` as
// living in lib/utils/waiting-time.ts; it does not — that module exports
// SHOP_TIME_ZONE, and the function itself is in lib/delivery/business-days.ts
// (verified by grep, not assumed from the rule text). Imported from where it
// really is; the doc discrepancy is reported rather than worked around.
import { shopDateOnly } from '@/lib/delivery/business-days';

/**
 * The provider for a resolved configuration, or null.
 *
 * `env` is passed in rather than read here so this stays testable, and the API
 * key is read at the single moment it is needed rather than being held anywhere.
 */
export function buildProvider(config: TaxConfig, env: TaxEnv): TaxProvider | null {
  switch (config.provider) {
    case 'none':
      return null;
    case 'mock':
      return mockTaxProvider;
    case 'taxjar': {
      const apiKey = env.TAXJAR_API_KEY;
      // resolveTaxProvider already refuses 'taxjar' without a key, so this is
      // unreachable in practice. It is still handled rather than asserted with a
      // `!`: a non-null assertion here would be the one place a configuration
      // change could put an empty bearer token on the wire.
      if (typeof apiKey !== 'string' || apiKey.trim() === '') return null;
      return new TaxJarProvider({ apiKey, baseUrl: config.baseUrl });
    }
  }
}

export interface CalculateForOrderInput {
  request: TaxCalculationRequest;
  /** From `profiles.tax_exempt`. Read from the database by the caller, never from a request body. */
  customerTaxExempt: boolean;
  /** Who asked, for the audit row. Null for an unattributed/automated call. */
  actorId: string | null;
  quoteId?: string | null;
  quoteRequestId?: string | null;
  /** Injectable for tests. Defaults to the real environment. */
  env?: TaxEnv;
  /** Injectable for tests. Defaults to now. */
  now?: Date;
}

export interface CalculateForOrderResult {
  outcome: TaxOutcome;
  /** True when the figure came from the cache rather than a fresh vendor call. */
  fromCache: boolean;
  /** The nexus list the decision was made against, for display. */
  nexus: NexusState[];
  config: TaxConfig;
  /** The recorded row's id, when a provider interaction was recorded. */
  recordId: string | null;
}

/**
 * CALCULATE TAX FOR AN AFS-SET AMOUNT.
 *
 * The date is derived through `shopDateOnly` in the shop's own time zone, not
 * from the raw server clock — CLAUDE.md rule #24's reasoning applies to a nexus
 * effective window exactly as it does to a delivery day: Vercel runs in UTC and
 * the shop is in Burnet, Texas, so a nexus that starts "tomorrow" would
 * otherwise begin six hours early for every evening order.
 */
export async function calculateTaxForOrder(
  supabase: SupabaseClient,
  input: CalculateForOrderInput
): Promise<CalculateForOrderResult> {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const config = resolveTaxConfigFromEnv(env);
  const provider = buildProvider(config, env);
  const nexus = await getNexusStates(supabase);
  const today = shopDateOnly(now);

  // The row that will actually justify a provider call, if any. Resolved HERE
  // rather than inferred from `nexus.length`, for the reason in the next comment.
  const nexusRow = findNexusForState(nexus, input.request.toState, today);
  const inForceAndCollecting = nexusRow !== null && nexusRow.collecting;

  // ---- Would a vendor call even happen? -----------------------------------
  // The cache is only worth consulting when the alternative is a network
  // request. An exemption, a missing configuration and a non-nexus state are all
  // decided locally in microseconds, so looking them up would cost a database
  // round trip to save nothing.
  //
  // ============ WHY THIS TESTS THE DESTINATION ROW, NOT `nexus.length > 0` ============
  //
  // A CACHED FIGURE MUST NOT OUTLIVE THE NEXUS WINDOW IT WAS COMPUTED UNDER.
  //
  // This condition used to read `nexus.length > 0`, and that was a real defect.
  // Consider a TX row with `effective_to = 2026-10-31` and a long
  // TAX_CACHE_TTL_SECONDS. A calculation on 2026-10-30 stores a positive figure.
  // On 2026-11-02 the same request arrives: the nexus row has NOT changed, so
  // `nexusFingerprint` is identical and the cache key MATCHES — and the stale
  // positive tax would be served, when the engine would correctly have answered
  // `no_nexus`. AFS would be over-collecting in a state it had stopped
  // collecting in.
  //
  // The fingerprint cannot catch this, and that is the point worth remembering:
  // it protects against a changed LIST, and here nothing changed except the date.
  // Putting `today` in the cache key would fix it by throwing the cache away
  // every midnight, which defeats having one. Checking the destination row's
  // in-force status before looking up costs nothing and is exact — if the window
  // has closed, the local answer is already `no_nexus` and no cache is involved.
  //
  // The opposite direction was always safe: a not-yet-started window yields
  // `no_nexus`, which is decided locally and writes no row, so there is nothing
  // to go stale.
  const couldCallProvider =
    provider !== null && config.origin !== null && inForceAndCollecting && !input.customerTaxExempt;

  if (couldCallProvider && config.origin !== null) {
    const cacheKey = cacheKeyFor({
      provider: config.provider,
      origin: config.origin,
      request: input.request,
      exempt: input.customerTaxExempt,
      nexus,
    });

    const cached = await findCachedCalculation(supabase, cacheKey, now);
    if (cached !== null) {
      return {
        outcome: {
          kind: 'calculated',
          amountCents: cached.amountCents,
          rate: cached.rate,
          taxableAmountCents: cached.taxableAmountCents,
          freightTaxable: cached.freightTaxable,
          jurisdictions: null,
          provider: cached.provider,
          // A cached MOCK figure stays non-authoritative. The provider name
          // travels in the cache key, so a mock row can never be served to a
          // taxjar-configured deployment in the first place — but the flag is
          // carried here too rather than recomputed, because a figure's
          // authority is a property of the figure, not of the current config.
          isAuthoritative: cached.provider === 'taxjar',
          reason:
            cached.provider === 'taxjar'
              ? 'Tax calculated earlier for this same order and address, and reused.'
              : 'DEVELOPMENT FIGURE ONLY, reused from an earlier mock calculation. This is not a real tax.',
        },
        fromCache: true,
        nexus,
        config,
        recordId: null,
      };
    }
  }

  const outcome = await calculateTax(input.request, {
    provider,
    providerReason: config.providerReason,
    origin: config.origin,
    originReason: config.originReason,
    nexus,
    customerTaxExempt: input.customerTaxExempt,
    today,
  });

  // Only a provider interaction is recorded — see recordCalculation's comment.
  const recordId =
    config.origin === null
      ? null
      : await recordCalculation(supabase, {
          cacheKey: cacheKeyFor({
            provider: config.provider,
            origin: config.origin,
            request: input.request,
            exempt: input.customerTaxExempt,
            nexus,
          }),
          outcome,
          request: input.request,
          origin: config.origin,
          exempt: input.customerTaxExempt,
          nexus,
          cacheTtlSeconds: config.cacheTtlSeconds,
          // DEFENCE IN DEPTH for the staleness bug described above: a stored row
          // may not outlive the nexus window that justified it, whatever the TTL
          // is set to. The guard above already prevents a stale row being READ;
          // this prevents one being WRITTEN with a lifetime it has no right to.
          nexusEffectiveTo: nexusRow?.effectiveTo ?? null,
          now,
          actorId: input.actorId,
          quoteId: input.quoteId ?? null,
          quoteRequestId: input.quoteRequestId ?? null,
        });

  return { outcome, fromCache: false, nexus, config, recordId };
}

/**
 * A plain-English summary of the current configuration, for the admin screen.
 *
 * CARRIES NO SECRET. `hasApiKey` is a boolean derived from presence; the key's
 * value never leaves the server and never enters this object.
 */
export interface TaxConfigSummary {
  provider: TaxConfig['provider'];
  providerReason: string;
  originConfigured: boolean;
  originReason: string;
  /** Presence only, never the value. */
  hasApiKey: boolean;
  cacheTtlSeconds: number;
  nexusCount: number;
  collectingCount: number;
  /** True when a calculation could actually happen right now. */
  readyToCalculate: boolean;
}

export function summariseTaxConfig(
  config: TaxConfig,
  env: TaxEnv,
  nexus: readonly NexusState[],
  today: string
): TaxConfigSummary {
  const collecting = nexus.filter(
    (row) =>
      row.collecting &&
      row.effectiveFrom <= today &&
      (row.effectiveTo === null || row.effectiveTo >= today)
  ).length;

  return {
    provider: config.provider,
    providerReason: config.providerReason,
    originConfigured: config.origin !== null,
    originReason: config.originReason,
    hasApiKey: typeof env.TAXJAR_API_KEY === 'string' && env.TAXJAR_API_KEY.trim() !== '',
    cacheTtlSeconds: config.cacheTtlSeconds,
    nexusCount: nexus.length,
    collectingCount: collecting,
    readyToCalculate: config.provider !== 'none' && config.origin !== null && collecting > 0,
  };
}
