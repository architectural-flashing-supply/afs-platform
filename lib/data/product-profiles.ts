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

/**
 * HOW LONG THE READ GETS BEFORE IT IS A FAILURE.
 *
 * Not decoration, and not hypothetical: a hard network abort (an offline
 * laptop, a captive portal, a blocked domain) does not make this read reject
 * promptly — it leaves the promise pending, and the quote form sat on
 * "Checking stock lengths…" indefinitely. Found by aborting the real request in
 * a browser, in tests/e2e/trim-optimizer-quote-states.spec.ts. A permanent
 * "checking" is worse than a plain "we could not look this up", because the
 * customer cannot tell it from a slow connection and has nothing to act on.
 *
 * 8000 ms is not a new figure: it is PATHFINDER_READ_TIMEOUT_MS, the read
 * timeout this codebase already settled on (CLAUDE.md rule #32 — "the vendor
 * API gets a timeout on READS"). Reused rather than re-guessed, because no
 * measurement of this particular read exists to justify a different one.
 *
 * A TIMEOUT IS ONLY EVER APPLIED TO THIS READ. Nothing here writes anything, so
 * there is no committed-but-abandoned case to worry about — which is exactly
 * why rule #32 withholds a timeout from the vendor POST and grants one here.
 */
export const STOCK_LENGTH_READ_TIMEOUT_MS = 8000;

/** What the read came back with, before it is shaped for a caller. */
type ReadOutcome = { kind: 'rows'; rows: ProfileStockLengthRow[] } | { kind: 'failed' };

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
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<ReadOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'failed' }), STOCK_LENGTH_READ_TIMEOUT_MS);
  });

  // Promise.resolve() because PostgREST's builder is a THENABLE, not a Promise:
  // it has .then() but no .catch(), so a rejection could not be handled on it
  // directly.
  const read: Promise<ReadOutcome> = Promise.resolve(
    supabase
      .from('product_profiles')
      .select('slug, name, standard_length_ft, max_length_ft')
      .eq('is_active', true)
  )
    .then(({ data, error }) =>
      error
        ? ({ kind: 'failed' } as ReadOutcome)
        : ({ kind: 'rows', rows: (data ?? []) as ProfileStockLengthRow[] } as ReadOutcome)
    )
    .catch(() => ({ kind: 'failed' }) as ReadOutcome);

  try {
    const outcome = await Promise.race([read, giveUp]);
    if (outcome.kind === 'failed') return { profiles: [], failed: true };

    return {
      profiles: outcome.rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        standardLengthFt: row.standard_length_ft,
        maxLengthFt: row.max_length_ft,
      })),
      failed: false,
    };
  } finally {
    clearTimeout(timer);
  }
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
