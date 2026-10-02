import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import LazyProfileThumb from '@/components/admin/LazyProfileThumb';
import { getQuoteOrderRows } from '@/lib/data/quote-order-rows';
import {
  applySearchQuery,
  materialOptions,
  parseSearchQuery,
  searchCountLine,
  LIST_RANGES,
  LIST_SORTS,
  SEARCH_SHOWS,
  STAGE_LABEL,
  type ListRow,
} from '@/lib/data/quote-order-list';

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
 * profile rail moved to /admin/search/profiles — linked from the bar below and
 * still the single `admin_profile_search` UI that CLAUDE.md rule #27 requires.
 * One query, one panel, a different URL.
 *
 * NO NEW QUERY AND NO MIGRATION. These are the same `getQuoteOrderRows` rows
 * the Quotes and Orders lists already load, filtered by `applySearchQuery`,
 * which shares its matching, date-cut and sort helpers with `applyListQuery`.
 * A change to how matching works therefore cannot apply to the lists and miss
 * Search.
 *
 * `.rr` IS THE SEARCH ROW, NOT `.lr`. v7 gives Search its own seven-column grid
 * (`.rh`/`.rr`) separate from the lists' eight-column one, because a search
 * result has no Status column — it spans every stage, so the stage is shown as
 * a pill inside the row instead.
 */

function money(cents: number | null): string {
  if (cents === null) return 'No price yet';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** v7's pill modifier per stage (PILLC, line 1599), as a whole-className map. */
const STAGE_PILL: Record<string, string> = {
  new: 'pill r',
  quoted: 'pill a',
  approved: 'pill g',
  shop: 'pill v',
  done: 'pill b',
};

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: { q?: string; show?: string; material?: string; range?: string; sort?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const all = await getQuoteOrderRows(supabase);
  const query = parseSearchQuery(searchParams, all);
  const rows = applySearchQuery(all, query);
  const materials = materialOptions(all);

  return (
    <LightWorkingArea>
      <div className="greet">
        <div>
          <h1 className="t">Search</h1>
          <p className="sub">
            Type the company, then what they ordered. Example: <b>Hill Country drip edge</b>. No
            special commands. Every past quote and order shows its profile, date, quantity, material
            and price.
          </p>
        </div>
      </div>

      <form method="get" className="bar">
        <label className="fld q">
          Search for
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Company, then profile, material or job number"
            autoComplete="off"
          />
        </label>

        <label className="fld">
          Show
          <select name="show" defaultValue={query.show}>
            {SEARCH_SHOWS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="fld">
          Material
          <select name="material" defaultValue={query.material}>
            {materials.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="fld">
          Date
          <select name="range" defaultValue={query.range}>
            {LIST_RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="fld">
          Sort
          <select name="sort" defaultValue={query.sort}>
            {LIST_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn red">
          Search
        </button>

        <Link href="/admin/search/profiles" className="btn line">
          Find a past profile
        </Link>
      </form>

      <div id="sres">
        <p className="rcount">{searchCountLine(rows.length, query.sort)}</p>

        {rows.length === 0 ? (
          <div className="none">Nothing found. Try the company name first.</div>
        ) : (
          <div className="rtab">
            <div className="rh">
              <span />
              <span>Customer</span>
              <span>Profile</span>
              <span>Quantity</span>
              <span>Material and price</span>
              <span>Date</span>
              <span />
            </div>

            {rows.map((row: ListRow) => (
              <article className="rr" key={row.id} data-testid="search-row">
                <span className="rt">
                  {row.profileId ? <LazyProfileThumb id={row.profileId} size={72} /> : null}
                </span>

                <div>
                  <b>{row.customer}</b>
                  {row.person ? <span>{row.person}</span> : null}
                  <span className={STAGE_PILL[row.stage] ?? 'pill'}>{STAGE_LABEL[row.stage]}</span>
                </div>

                <div>
                  <b>{row.item}</b>
                  <span className="mut">{row.requestNumber}</span>
                </div>

                <div>
                  <b>
                    {row.quantity} {row.quantity === 1 ? 'piece' : 'pieces'}
                  </b>
                </div>

                <div>
                  <b>{money(row.totalCents)}</b>
                  <span className="mut">{row.spec}</span>
                </div>

                <div>
                  <b>{shortDate(row.submittedAt)}</b>
                  <span className="mut">{row.sourceLabel}</span>
                </div>

                <div className="c6">
                  <Link href={`/admin/command-center/job/${row.id}`} className="btn slate sm">
                    Open
                  </Link>
                  {/* v7's Reorder. It opens the New quote screen already focused
                      on this customer, which is where a reorder really starts —
                      their last order and saved profiles are both one click
                      away there. No new route is invented for it. */}
                  <Link
                    href={`/admin/quotes/new?q=${encodeURIComponent(row.customer)}`}
                    className="btn red sm"
                  >
                    Reorder
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </LightWorkingArea>
  );
}
