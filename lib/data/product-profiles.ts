import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileConstraints } from '@/lib/order-validator/types';

// Stock-length lookup for the Trim Length Optimizer (SPEC_TRIM_LENGTH_OPTIMIZER.md,
// TRIM_OPTIMIZER_SCOPE.md §2-3). product_profiles.standard_length_ft/max_length_ft
// are real, live-seeded data — no new table or API route needed, matching the
// pattern already proven at app/(public)/architects/cad-library/page.tsx:44.

export interface ProfileStockLength {
  slug: string;
  name: string;
  standardLengthFt: number | null;
  maxLengthFt: number | null;
}

interface ProfileStockLengthRow {
  slug: string;
  name: string;
  standard_length_ft: number | null;
  max_length_ft: number | null;
}

export async function getProfileStockLengths(supabase: SupabaseClient): Promise<ProfileStockLength[]> {
  const { data } = await supabase
    .from('product_profiles')
    .select('slug, name, standard_length_ft, max_length_ft')
    .eq('is_active', true);

  return ((data ?? []) as ProfileStockLengthRow[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    standardLengthFt: row.standard_length_ft,
    maxLengthFt: row.max_length_ft,
  }));
}

// lib/utils/profile-svg.ts's ProfileType is a 16-member slug union built for FlashDraft
// geometry — only 5 values are real product_profiles.slugs. Exact slug match; no row
// (or a NULL standard_length_ft, e.g. scupper/custom-profile) resolves to null.
export function resolveStockLengthBySlug(profiles: ProfileStockLength[], slug: string): number | null {
  const match = profiles.find((p) => p.slug === slug);
  return match?.standardLengthFt ?? null;
}

// app/quote/page.tsx's PROFILE_TYPES is free-text labels, not an FK. 9 of 17 match a
// product_profiles.name exactly. 3 more are near-misses resolved by this alias map
// (TRIM_OPTIMIZER_SCOPE.md §3) — the remaining 5 have no corresponding profile row at
// all and correctly resolve to null (no stock-length concept, per spec §3).
const QUOTE_LABEL_TO_SLUG: Record<string, string> = {
  'Expansion Joint Cover': 'expansion-joint',
  'Window / Door Flashing': 'window-door-flashing',
  'Standing Seam Roofing Panel': 'standing-seam-roofing',
};

export function resolveStockLengthByQuoteLabel(profiles: ProfileStockLength[], label: string): number | null {
  const aliasedSlug = QUOTE_LABEL_TO_SLUG[label];
  const match = aliasedSlug
    ? profiles.find((p) => p.slug === aliasedSlug)
    : profiles.find((p) => p.name === label);
  return match?.standardLengthFt ?? null;
}

// ---------------------------------------------------------------------------
// DIMENSION RANGES for the order validator (SPEC_AI_ORDER_VALIDATOR.md section 2)
// ---------------------------------------------------------------------------

/**
 * The min/max columns of the same `product_profiles` rows, read for
 * lib/order-validator. A sibling of `getProfileStockLengths` above rather than
 * a new module, for the reason that function's own header gives: these are real,
 * live-seeded columns on a table this file already owns, and a second reader
 * would fork `QUOTE_LABEL_TO_SLUG` — the label-aliasing map the Quote Builder's
 * free-text profile labels have to go through.
 *
 * EVERY BOUND IS INDEPENDENTLY NULLABLE AND IS PASSED THROUGH AS NULL. Of the 13
 * seeded rows, Fascia has no leg range, Valley Flashing has no height range, and
 * Custom Profile has no ranges at all. NULL means no constraint — never zero —
 * and coalescing here would invent a limit the catalog does not state.
 */
export interface ProfileConstraintRow {
  slug: string;
  name: string;
  min_width: number | null;
  max_width: number | null;
  min_height: number | null;
  max_height: number | null;
  min_leg_a: number | null;
  max_leg_a: number | null;
  min_leg_b: number | null;
  max_leg_b: number | null;
  max_length_ft: number | null;
  requires_consultation: boolean | null;
}

const PROFILE_CONSTRAINT_COLUMNS =
  'slug, name, min_width, max_width, min_height, max_height, min_leg_a, max_leg_a, min_leg_b, max_leg_b, max_length_ft, requires_consultation';

/**
 * A `DECIMAL(8,3)` column arrives from PostgREST as a number, but a numeric
 * string is also a shape the driver has produced historically, and `Number('')`
 * is 0 — which would turn "no constraint" into "minimum zero". So the conversion
 * is explicit and anything unusable becomes null rather than a number.
 */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // The explicit empty-string guard is the whole point: Number('') is 0, so
  // without it an absent minimum becomes "at least zero" and an absent MAXIMUM
  // becomes "at most zero", which refuses every dimension on the profile.
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * One row, mapped. Exported so the NULL passthrough and the numeric conversion
 * can be unit-tested without standing up a Supabase client — the two places this
 * could go wrong (a NULL becoming 0, a numeric string becoming NaN) are both
 * properties of this function alone.
 */
export function mapProfileConstraintRow(row: ProfileConstraintRow): ProfileConstraints {
  return {
    slug: row.slug,
    name: row.name,
    minWidth: toNullableNumber(row.min_width),
    maxWidth: toNullableNumber(row.max_width),
    minHeight: toNullableNumber(row.min_height),
    maxHeight: toNullableNumber(row.max_height),
    minLegA: toNullableNumber(row.min_leg_a),
    maxLegA: toNullableNumber(row.max_leg_a),
    minLegB: toNullableNumber(row.min_leg_b),
    maxLegB: toNullableNumber(row.max_leg_b),
    maxLengthFt: toNullableNumber(row.max_length_ft),
    requiresConsultation: row.requires_consultation === true,
  };
}

/**
 * READS THE ERROR, NOT JUST THE DATA.
 *
 * `getProfileStockLengths` above destructures only `data`, so a failed query and
 * an empty table are indistinguishable — both come back as `[]`. That matters
 * much more here: with no ranges the validator silently stops range-checking,
 * and "no dimension limits were applied" would look exactly like "every
 * dimension was within its limits".
 *
 * It still does not throw. An unreadable reference table must not take down a
 * quote request (the validate route is a safeguard, not a gate on submission),
 * so the failure is LOGGED with the real PostgREST message and the caller gets
 * an empty list it is already designed to cope with. Diagnosed, not hidden.
 */
export async function getProfileConstraints(supabase: SupabaseClient): Promise<ProfileConstraints[]> {
  const { data, error } = await supabase
    .from('product_profiles')
    .select(PROFILE_CONSTRAINT_COLUMNS)
    .eq('is_active', true);

  if (error) {
    console.error('[product_profiles] dimension-range read failed:', error.message, error.code ?? '');
    return [];
  }
  if (!data || data.length === 0) {
    console.error(
      '[product_profiles] dimension-range read returned no active rows. Migration 002 seeds 12; with none, the order validator cannot range-check anything.'
    );
    return [];
  }

  return (data as unknown as ProfileConstraintRow[]).map(mapProfileConstraintRow);
}

/**
 * The constraints, re-keyed so the validator's own exact label match finds them.
 *
 * `app/quote/page.tsx`'s `PROFILE_TYPES` is free-text, not a foreign key, and
 * three of its labels differ from the catalog name by more than punctuation —
 * which is exactly what `QUOTE_LABEL_TO_SLUG` above exists for. Resolving the
 * alias HERE, by returning the row under the label the customer actually chose,
 * keeps the alias map in one place and lets the engine's matching stay an exact
 * comparison. A fuzzy match inside the engine would be worse than no match: a
 * wrong profile row means wrong dimension limits.
 *
 * The five labels with no row at all — Step Flashing, Conductor Head, Downspout,
 * Reglet, Wall Panel / Cladding — are simply absent from the result, and the
 * engine reports that to the admin rather than inventing a range.
 */
export function constraintsForQuoteLabels(
  constraints: readonly ProfileConstraints[],
  labels: readonly string[]
): ProfileConstraints[] {
  const resolved: ProfileConstraints[] = [];
  for (const label of labels) {
    const aliasedSlug = QUOTE_LABEL_TO_SLUG[label];
    const match = aliasedSlug
      ? constraints.find((c) => c.slug === aliasedSlug)
      : constraints.find((c) => c.name === label || c.slug === label);
    if (!match) continue;
    // Re-announced under the customer's own label so the engine's exact match
    // succeeds; `slug` is kept so an admin caller holding a slug still matches.
    if (!resolved.some((c) => c.name === label && c.slug === match.slug)) {
      resolved.push({ ...match, name: label });
    }
  }
  return resolved;
}
