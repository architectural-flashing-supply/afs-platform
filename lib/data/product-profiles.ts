import type { SupabaseClient } from '@supabase/supabase-js';

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

export interface ProfileStockLengthRead {
  profiles: ProfileStockLength[];
  /**
   * True when the read itself failed, as opposed to succeeding and finding
   * nothing. The two need telling apart: an empty catalog means the cut list
   * has nothing to show, while a failed read means we do not know whether it
   * would have had anything — and a screen must not present the second as the
   * first. Both callers render different words for it.
   */
  failed: boolean;
}

/**
 * THE ONE QUERY. Both the customer-facing quote form and the admin Cut Plan
 * screen read stock lengths through here, so there is a single column list and
 * a single mapper, and both can tell a failed read apart from an empty catalog.
 *
 * There used to be a second export beside it that returned the rows alone and
 * swallowed the error. It was removed rather than kept for convenience: its
 * only remaining caller was its own test, and a function that cannot report a
 * failure is the reason the quote form could not distinguish "the lookup broke"
 * from "this profile has no stock length".
 */
export async function readProfileStockLengths(
  supabase: SupabaseClient
): Promise<ProfileStockLengthRead> {
  const { data, error } = await supabase
    .from('product_profiles')
    .select('slug, name, standard_length_ft, max_length_ft')
    .eq('is_active', true);

  if (error) return { profiles: [], failed: true };

  return {
    profiles: ((data ?? []) as ProfileStockLengthRow[]).map((row) => ({
      slug: row.slug,
      name: row.name,
      standardLengthFt: row.standard_length_ft,
      maxLengthFt: row.max_length_ft,
    })),
    failed: false,
  };
}

// lib/utils/profile-svg.ts's ProfileType is a 16-member slug union built for FlashDraft
// geometry — only 5 values are real product_profiles.slugs. Exact slug match; no row
// (or a NULL standard_length_ft, e.g. scupper/custom-profile) resolves to null.
//
// NO PRODUCTION CALLER TODAY. It was written for app/configure/page.tsx, which
// no longer exists — the Configurator was eliminated and FlashDraft is the only
// drawing tool. Kept rather than deleted because a slug-keyed lookup is what a
// FlashDraft-side caller would need, and its behaviour is pinned by
// ./product-profiles.test.ts either way. Recorded here so the next reader does
// not have to work out why nothing calls it.
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
