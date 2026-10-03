/**
 * THE CACHE KEY FOR A TAX CALCULATION.
 *
 * Sales tax rates change on published effective dates, not continuously, so an
 * identical request repeated within the TTL should not cost another vendor call —
 * TaxJar bills per call and rate-limits. A cache is therefore worth having. A
 * cache that serves a STALE answer after a configuration change is not.
 *
 * ================== WHAT IS IN THE KEY, AND WHY EACH ONE ==================
 *
 * provider           A mock figure and a real figure must never share a slot.
 *                    Without this, switching TAX_PROVIDER=mock → taxjar would
 *                    serve yesterday's fixture number as a real tax.
 * origin             Tax depends on where the sale ships FROM as well as to.
 * toState, toZip     The destination.
 * subtotalCents      The amount being taxed.
 * shippingCents      Freight may be taxable, so it changes the answer.
 * exempt             An exempt customer's zero must not be served to a
 *                    non-exempt one, or vice versa.
 * nexusFingerprint   THE LOAD-BEARING ONE. See below.
 *
 * ================== WHY THE NEXUS FINGERPRINT IS IN HERE ==================
 *
 * Without it, an admin adding a nexus state would keep being served the cached
 * "no nexus here, no tax" answer for up to the whole TTL — a WRONG answer
 * produced by a CORRECT edit. That is the worst kind of cache bug, because the
 * person who made the change has no reason to suspect it and the screen agrees
 * with them. Including the fingerprint means any change that could alter an
 * outcome changes the key, so the stale entry is simply never looked up again.
 * `nexusFingerprint()` in nexus.ts is deliberately narrow about which fields it
 * covers, for the opposite reason: a typo fix in a note must not throw the cache
 * away.
 *
 * ================== WHY SHA-256 AND NOT JSON ==================
 *
 * The key is a database column with an index on it. A raw JSON string would be
 * unbounded in length (the nexus fingerprint grows with every state) and would
 * put a customer's ZIP in a column that gets logged in query plans. A hash is
 * fixed-length, index-friendly, and carries no address.
 *
 * `node:crypto` is a built-in — no dependency — and this module is server-only
 * by virtue of importing it, which is correct: a tax figure is never computed in
 * a browser.
 */

import { createHash } from 'node:crypto';
import type { TaxCalculationRequest, TaxOrigin, TaxProviderName } from './types';

export interface TaxCacheKeyInput {
  provider: TaxProviderName;
  origin: TaxOrigin;
  request: TaxCalculationRequest;
  exempt: boolean;
  /** From `nexusFingerprint()` in nexus.ts. */
  nexusFingerprint: string;
}

/** Bumped if the key's composition ever changes, so old rows cannot collide with new ones. */
export const TAX_CACHE_KEY_VERSION = 'v1';

/**
 * A deterministic, fixed-length key.
 *
 * ORDER-INDEPENDENCE IS BY CONSTRUCTION, NOT BY SORTING. The canonical string is
 * assembled from named fields in a fixed order written out below, rather than
 * from `JSON.stringify(object)` — whose output depends on property insertion
 * order and would silently produce two different keys for two objects a reader
 * would call identical. The only collection involved is the nexus list, and
 * `nexusFingerprint()` sorts that itself.
 *
 * The state codes are uppercased and the ZIPs trimmed so that `"tx"` and `"TX"`,
 * or `"78611"` and `" 78611 "`, do not occupy two cache slots for one question.
 */
export function buildTaxCacheKey(input: TaxCacheKeyInput): string {
  const canonical = [
    `ver=${TAX_CACHE_KEY_VERSION}`,
    `provider=${input.provider}`,
    `fromState=${input.origin.state.trim().toUpperCase()}`,
    `fromZip=${input.origin.zip.trim()}`,
    `toState=${input.request.toState.trim().toUpperCase()}`,
    `toZip=${input.request.toZip.trim()}`,
    `subtotalCents=${input.request.subtotalCents}`,
    `shippingCents=${input.request.shippingCents}`,
    `exempt=${input.exempt ? '1' : '0'}`,
    input.nexusFingerprint,
  ].join('&');

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
