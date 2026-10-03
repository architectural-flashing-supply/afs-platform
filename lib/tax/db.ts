/**
 * READING AND WRITING THE TAX TABLES. The only file in lib/tax that touches
 * Supabase — everything else here is pure so it can be unit-tested without one,
 * the same split lib/pricing/db.ts makes for the price book.
 *
 * EGRESS: every select names its columns. Neither table holds an image or a
 * base64 anything, and they are not to acquire one (CLAUDE.md rule #26's
 * principle).
 *
 * NOTHING HERE THROWS AT ITS CALLER. A read failure returns an empty list or
 * null with the error logged; a cache-write failure is logged and swallowed. The
 * reason is specific rather than general: a successful tax calculation must not
 * be downgraded into a failure because the row recording it could not be
 * written. The calculation really did happen, and reporting otherwise would be
 * the same class of lie as reporting a zero for an uncalculated tax.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildTaxCacheKey } from './cache-key';
import { nexusFingerprint } from './nexus';
import type {
  NexusBasis,
  NexusState,
  TaxCalculationRequest,
  TaxOrigin,
  TaxOutcome,
  TaxProviderName,
} from './types';

const NEXUS_COLUMNS =
  'id, state_code, collecting, nexus_basis, registration_id, effective_from, effective_to, note, created_at, updated_at';

// ONE LITERAL, NOT A CONCATENATION. supabase-js infers the row type from the
// select string itself, so a `'a, b' + 'c'` expression widens to `string` and the
// result comes back as `GenericStringError[]` — which then needs a cast through
// `unknown` to be usable, i.e. exactly the erased, assertion-free cast this
// codebase avoids. lib/data/invoices.ts:88 keeps its long list on one line for
// the same reason.
const CALCULATION_COLUMNS =
  'id, cache_key, provider, outcome, amount_cents, rate, taxable_amount_cents, freight_taxable, jurisdictions, to_state, to_zip, subtotal_cents, shipping_cents, customer_tax_exempt, nexus_fingerprint, problems, requires_review, reviewed_at, reviewed_by, review_note, created_at';

interface NexusRow {
  id: string;
  state_code: string;
  collecting: boolean;
  nexus_basis: string;
  registration_id: string | null;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
}

/**
 * A `date` column comes back from PostgREST as `YYYY-MM-DD`. Sliced defensively
 * rather than trusted: if a column were ever widened to `timestamptz`, the extra
 * time part would silently break the lexicographic date comparisons in nexus.ts
 * (`'2026-10-03T00:00:00' > '2026-10-03'`), which is the kind of bug that only
 * shows up on the boundary day.
 */
function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

export function toNexusState(row: NexusRow): NexusState {
  return {
    id: row.id,
    stateCode: row.state_code,
    collecting: row.collecting,
    // The database CHECK admits exactly the four NexusBasis values and a unit
    // test holds the two lists together, so this narrowing cannot be wrong
    // without that test failing first.
    basis: row.nexus_basis as NexusBasis,
    registrationId: row.registration_id,
    effectiveFrom: toDateOnly(row.effective_from),
    effectiveTo: row.effective_to === null ? null : toDateOnly(row.effective_to),
    note: row.note,
  };
}

/**
 * Every nexus state AFS has recorded, ordered by code.
 *
 * RETURNS AN EMPTY ARRAY ON ERROR, AND THAT IS SAFE HERE — which is worth
 * stating, because "empty on error" is usually a smell. It is safe because an
 * empty list is the MOST CONSERVATIVE answer this function can give:
 * `calculateTax` turns it into `not_configured`, which calculates no tax and
 * collects nothing. A read failure therefore degrades to "we do not know", never
 * to "no tax is owed".
 */
export async function getNexusStates(supabase: SupabaseClient): Promise<NexusState[]> {
  const { data, error } = await supabase
    .from('tax_nexus_states')
    .select(NEXUS_COLUMNS)
    .order('state_code', { ascending: true });

  if (error) {
    console.error('[Tax Nexus] could not read tax_nexus_states', error);
    return [];
  }
  return ((data ?? []) as NexusRow[]).map(toNexusState);
}

export interface TaxCalculationRecord {
  id: string;
  provider: TaxProviderName;
  outcome: 'calculated' | 'failed';
  amountCents: number | null;
  rate: number | null;
  toState: string | null;
  toZip: string | null;
  subtotalCents: number;
  shippingCents: number;
  problems: string[];
  requiresReview: boolean;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface CalculationRow {
  id: string;
  provider: string;
  outcome: string;
  amount_cents: number | null;
  rate: number | null;
  to_state: string | null;
  to_zip: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  problems: unknown;
  requires_review: boolean;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

function toProblemList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === 'string');
}

function toCalculationRecord(row: CalculationRow): TaxCalculationRecord {
  return {
    id: row.id,
    provider: row.provider as TaxProviderName,
    outcome: row.outcome === 'calculated' ? 'calculated' : 'failed',
    amountCents: row.amount_cents,
    rate: row.rate === null ? null : Number(row.rate),
    toState: row.to_state,
    toZip: row.to_zip,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    problems: toProblemList(row.problems),
    requiresReview: row.requires_review,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  };
}

/**
 * Failed calculations a human has not yet signed off.
 *
 * This is the "surface a flagged result for admin review" half of the item's
 * failure requirement — without a screen reading this, a flagged failure is just
 * a row nobody looks at.
 */
export async function getTaxCalculationsNeedingReview(
  supabase: SupabaseClient,
  limit = 25
): Promise<TaxCalculationRecord[]> {
  const { data, error } = await supabase
    .from('tax_calculations')
    .select(CALCULATION_COLUMNS)
    .eq('requires_review', true)
    .is('reviewed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Tax Nexus] could not read the tax review queue', error);
    return [];
  }
  return ((data ?? []) as CalculationRow[]).map(toCalculationRecord);
}

export interface CachedTaxFigures {
  amountCents: number;
  rate: number;
  taxableAmountCents: number | null;
  freightTaxable: boolean | null;
  jurisdictions: Record<string, unknown> | null;
  provider: TaxProviderName;
}

interface CacheHitRow {
  amount_cents: number | null;
  rate: number | null;
  taxable_amount_cents: number | null;
  freight_taxable: boolean | null;
  jurisdictions: unknown;
  provider: string;
}

export interface TaxCacheLookupInput {
  provider: TaxProviderName;
  origin: TaxOrigin;
  request: TaxCalculationRequest;
  exempt: boolean;
  nexus: readonly NexusState[];
}

/** The cache key for a lookup, built from the SAME nexus list the calculation will use. */
export function cacheKeyFor(input: TaxCacheLookupInput): string {
  return buildTaxCacheKey({
    provider: input.provider,
    origin: input.origin,
    request: input.request,
    exempt: input.exempt,
    nexusFingerprint: nexusFingerprint(input.nexus),
  });
}

/**
 * A still-valid cached figure, or null.
 *
 * ONLY A `calculated` ROW WITH AN UNEXPIRED `expires_at` IS EVER RETURNED. A
 * failed row is excluded twice over — by this filter and by migration 039's
 * `tax_calculations_failure_never_cached` CHECK, which refuses to store an
 * expiry on a failure at all. Serving a cached failure would turn one vendor
 * blip into a day of refusals, so it is forbidden in two places rather than one.
 */
export async function findCachedCalculation(
  supabase: SupabaseClient,
  cacheKey: string,
  now: Date
): Promise<CachedTaxFigures | null> {
  const { data, error } = await supabase
    .from('tax_calculations')
    .select('amount_cents, rate, taxable_amount_cents, freight_taxable, jurisdictions, provider')
    .eq('cache_key', cacheKey)
    .eq('outcome', 'calculated')
    .gt('expires_at', now.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // A cache read failure is not a calculation failure — fall through and ask
    // the provider, which is slower and correct.
    console.error('[Tax Nexus] cache read failed; falling through to the provider', error);
    return null;
  }
  if (!data) return null;

  const row = data as CacheHitRow;
  if (row.amount_cents === null) {
    // Defence in depth: the CHECK makes this impossible, and if it ever happens
    // the honest response is to ignore the row rather than read a null as a zero.
    console.error('[Tax Nexus] a cached "calculated" row had no amount; ignoring it');
    return null;
  }

  return {
    amountCents: row.amount_cents,
    rate: row.rate === null ? 0 : Number(row.rate),
    taxableAmountCents: row.taxable_amount_cents,
    freightTaxable: row.freight_taxable,
    jurisdictions:
      row.jurisdictions && typeof row.jurisdictions === 'object'
        ? (row.jurisdictions as Record<string, unknown>)
        : null,
    provider: row.provider as TaxProviderName,
  };
}

export interface RecordCalculationInput {
  cacheKey: string;
  outcome: TaxOutcome;
  request: TaxCalculationRequest;
  origin: TaxOrigin;
  exempt: boolean;
  nexus: readonly NexusState[];
  /** The vendor's raw body, when there was one. */
  responseSnapshot?: unknown;
  cacheTtlSeconds: number;
  now: Date;
  actorId: string | null;
  quoteId?: string | null;
  quoteRequestId?: string | null;
}

/**
 * Records a PROVIDER INTERACTION — and only a provider interaction.
 *
 * `not_configured`, `exempt` and `no_nexus` are decided locally, cost nothing to
 * recompute, and write NO ROW. That is what keeps this table meaningful: every
 * row in it is a real conversation with a tax service, so a count of rows is a
 * count of vendor calls and the review queue is not diluted by local decisions.
 *
 * Returns the new row's id, or null if nothing was written — including the
 * deliberate "nothing to write" case, which is not an error.
 *
 * NEVER THROWS. See the module header: a successful calculation must not be
 * downgraded into a failure because the row recording it could not be written.
 */
export async function recordCalculation(
  supabase: SupabaseClient,
  input: RecordCalculationInput
): Promise<string | null> {
  const outcome = input.outcome;
  if (outcome.kind !== 'calculated' && outcome.kind !== 'failed') return null;

  const isCalculated = outcome.kind === 'calculated';

  // A failure gets NO expiry, so it can never be served from cache. Migration
  // 039's CHECK refuses the alternative anyway; this is the writer agreeing with
  // it rather than relying on it.
  const expiresAt = isCalculated
    ? new Date(input.now.getTime() + input.cacheTtlSeconds * 1000).toISOString()
    : null;

  const row = {
    cache_key: input.cacheKey,
    provider: outcome.provider,
    outcome: outcome.kind,
    // NULL for a failure. Never 0 — see migration 039's load-bearing CHECK.
    amount_cents: isCalculated ? outcome.amountCents : null,
    rate: isCalculated ? outcome.rate : null,
    taxable_amount_cents: isCalculated ? outcome.taxableAmountCents : null,
    freight_taxable: isCalculated ? outcome.freightTaxable : null,
    jurisdictions: isCalculated ? outcome.jurisdictions : null,
    to_state: input.request.toState,
    to_zip: input.request.toZip,
    subtotal_cents: input.request.subtotalCents,
    shipping_cents: input.request.shippingCents,
    customer_tax_exempt: input.exempt,
    nexus_fingerprint: nexusFingerprint(input.nexus),
    request_snapshot: {
      from: input.origin,
      to: { state: input.request.toState, zip: input.request.toZip },
      subtotalCents: input.request.subtotalCents,
      shippingCents: input.request.shippingCents,
      customerTaxExempt: input.exempt,
      reason: outcome.reason,
    },
    response_snapshot: input.responseSnapshot ?? null,
    problems: outcome.kind === 'failed' ? outcome.problems : null,
    requires_review: outcome.kind === 'failed',
    quote_id: input.quoteId ?? null,
    quote_request_id: input.quoteRequestId ?? null,
    expires_at: expiresAt,
    created_by: input.actorId,
  };

  try {
    const { data, error } = await supabase
      .from('tax_calculations')
      .insert(row)
      .select('id')
      .single();

    if (error || !data) {
      console.error('[Tax Nexus] could not record a tax calculation', error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.error('[Tax Nexus] recording a tax calculation threw', err);
    return null;
  }
}

/**
 * Marks a flagged failure as looked at. Does NOT delete it: the record of a
 * failure is the point, and a resolved one still answers "has this happened
 * before?".
 */
export async function resolveReview(
  supabase: SupabaseClient,
  id: string,
  reviewerId: string,
  note: string | null,
  now: Date
): Promise<boolean> {
  const { error } = await supabase
    .from('tax_calculations')
    .update({
      requires_review: false,
      reviewed_at: now.toISOString(),
      reviewed_by: reviewerId,
      review_note: note,
    })
    .eq('id', id)
    // Only an unreviewed row, so two admins clicking at once cannot overwrite
    // each other's note — the same conditional-update discipline the single-use
    // approve token uses (CLAUDE.md rule #21).
    .is('reviewed_at', null);

  if (error) {
    console.error('[Tax Nexus] could not resolve a tax review', error);
    return false;
  }
  return true;
}

/**
 * Expires every cached figure.
 *
 * Called after a nexus edit. STRICTLY SPEAKING REDUNDANT — the nexus fingerprint
 * is part of the cache key, so an edited list can never match an old key anyway.
 * It is done regardless so the table does not accumulate rows that are
 * permanently unreachable but still look live to anyone reading it, and because
 * depending on a hash for correctness while ALSO leaving stale rows marked
 * unexpired is the sort of arrangement that invites a future "optimisation" to
 * drop the fingerprint from the key.
 *
 * Sets `expires_at` to now rather than deleting: the rows are also the audit
 * record of what was calculated.
 */
export async function expireCachedCalculations(
  supabase: SupabaseClient,
  now: Date
): Promise<void> {
  const { error } = await supabase
    .from('tax_calculations')
    .update({ expires_at: now.toISOString() })
    .eq('outcome', 'calculated')
    .gt('expires_at', now.toISOString());

  if (error) {
    console.error('[Tax Nexus] could not expire cached tax calculations', error);
  }
}
