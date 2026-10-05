import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import V7Search from '@/components/admin/v7/V7Search';
import { getQuoteOrderRows } from '@/lib/data/quote-order-rows';
import { applySearchQuery, parseSearchQuery } from '@/lib/data/quote-order-list';
import { isFixtureMode, type SearchParamValue } from '@/lib/fixtures/mode';
import { fixtureSearch } from '@/lib/data/v7-view/from-fixture';
import { liveSearch } from '@/lib/data/v7-view/from-live-lists';

export const metadata: Metadata = {
  title: 'Search | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * SEARCH — a port of v7 `pageSearch()` (prototype line 1667).
 *
 * Every past quote and order in one place, with v7's four controls: Show
 * (quotes, orders or both), Material, Date and Sort. v7's own blurb explains
 * the intent: "Type the company, then what they ordered. No special commands."
 *
 * WHAT CHANGED ON THIS ROUTE. /admin/search used to be the profile rail. v7's
 * Search is over QUOTES AND ORDERS, so that is what lives here now, and the
 * profile rail moved to /admin/search/profiles — still the single
 * `admin_profile_search` UI that CLAUDE.md rule #27 requires. One query, one
 * panel, a different URL.
 *
 * NO NEW QUERY AND NO MIGRATION. These are the same `getQuoteOrderRows` rows
 * the Quotes and Orders lists already load, filtered by `applySearchQuery`,
 * which shares its matching, date-cut and sort helpers with `applyListQuery`.
 * A change to how matching works therefore cannot apply to the lists and miss
 * Search.
 *
 * WHAT THIS PASS CHANGED. The screen used to build v7's markup inline, with a
 * `<form method="get">` and a submit button in the filter bar. v7 has no
 * submit button — it filters as you type and on change — so the bar is now the
 * shared `V7FilterBar`, and the rows are `components/admin/v7/V7Search.tsx`,
 * a transliteration of `resRow()`. The query layer is untouched.
 */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: { q?: string; show?: string; material?: string; range?: string; sort?: string } & Record<
    string,
    SearchParamValue
  >;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  if (isFixtureMode(searchParams)) {
    // v7's own search state, from the URL, over v7's own sample rows.
    const first = (v: SearchParamValue) => (Array.isArray(v) ? v[0] : v);
    return (
      <LightWorkingArea>
        <V7Search
          view={fixtureSearch({
            q: first(searchParams.q) ?? '',
            mat: first(searchParams.material) ?? 'All materials',
            range: first(searchParams.range) ?? 'all',
            show: first(searchParams.show) ?? 'all',
            sort: first(searchParams.sort) ?? 'new',
            pid: Number(first(searchParams.pid) ?? 0) || 0,
          })}
        />
      </LightWorkingArea>
    );
  }

  const all = await getQuoteOrderRows(supabase);
  const query = parseSearchQuery(searchParams, all);
  const rows = applySearchQuery(all, query);

  return (
    <LightWorkingArea>
      <V7Search view={liveSearch(query, rows, all)} />
    </LightWorkingArea>
  );
}
