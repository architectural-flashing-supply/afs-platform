import Link from 'next/link';
import LazyProfileThumb from '@/components/admin/LazyProfileThumb';
import {
  LIST_RANGES,
  LIST_SORTS,
  LIST_STAGES,
  resultCountLine,
  STAGE_LABEL,
  type ListKind,
  type ListQuery,
  type ListRow,
} from '@/lib/data/quote-order-list';

/**
 * THE ONE LIST, used by /admin/quotes and /admin/orders.
 *
 * v7 builds both pages from a single `pageList(kind)` + `listHTML(kind)` +
 * `listRowHTML(r)` (lines 1732, 1724, 1711). This is that, as a server
 * component: the filter bar is a plain GET form so the whole thing works
 * without client JavaScript and every filter is a shareable URL.
 *
 * Column order is v7's, left to right:
 *   thumbnail · Customer · Profile · Quantity and material · Total · Status ·
 *   Date · (action)
 *
 * Light working area under the dark header, afs-* tokens only, and the single
 * red action colour. No new colours.
 */

const STAGE_PILL: Record<string, string> = {
  // v7 PILLC (line 1599): new=red, quoted=amber, approved=green, shop=violet,
  // done=blue. Mapped onto the existing light-theme tokens — no new colours.
  new: 'bg-afs-crimson text-white',
  quoted: 'bg-afs-amber-bg text-afs-amber-ink',
  approved: 'bg-afs-green-soft text-afs-green-ink',
  shop: 'bg-afs-bg-lane text-afs-ink-900',
  done: 'bg-afs-bg-light-raised text-afs-ink-700',
};

// ONE string literal, deliberately not a `+` concatenation: the contrast gate
// resolves class constants across modules, but only when it can read the value
// statically. A concatenated const comes back "unresolved", and rule #28 counts
// a rising unresolved number as the gate going blind.
const FIELD =
  'min-h-[44px] rounded border border-afs-border-catalog bg-afs-bg-light-raised px-3 py-2 font-body text-sm text-afs-ink-900 placeholder:text-afs-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson';

function money(cents: number | null): string {
  if (cents === null) return 'No price yet';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface QuoteOrderListProps {
  kind: ListKind;
  title: string;
  /** v7's own sub-line for each list (pageList, line 1734). */
  blurb: string;
  query: ListQuery;
  rows: ListRow[];
  /** Where a row links. Quotes and Orders both open the Job screen. */
  rowHref: (row: ListRow) => string;
}

export default function QuoteOrderList({
  kind,
  title,
  blurb,
  query,
  rows,
  rowHref,
}: QuoteOrderListProps) {
  return (
    <div className="mx-auto max-w-[1900px] px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-start gap-4 pt-8">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-none text-afs-ink-900">{title}</h1>
          <p className="mt-1 max-w-3xl font-body text-sm text-afs-ink-700">{blurb}</p>
        </div>
      </div>

      {/* Filter bar — a plain GET form, so every view is a URL. */}
      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1">
          <span className="font-label text-xs font-semibold uppercase tracking-wide text-afs-ink-900">
            Search {title.toLowerCase()}
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Customer, profile, material or job number"
            autoComplete="off"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label text-xs font-semibold uppercase tracking-wide text-afs-ink-900">
            Stage
          </span>
          <select name="stage" defaultValue={query.stage} className={FIELD}>
            {LIST_STAGES[kind].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label text-xs font-semibold uppercase tracking-wide text-afs-ink-900">
            Date
          </span>
          <select name="range" defaultValue={query.range} className={FIELD}>
            {LIST_RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label text-xs font-semibold uppercase tracking-wide text-afs-ink-900">
            Sort
          </span>
          <select name="sort" defaultValue={query.sort} className={FIELD}>
            {LIST_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-afs-crimson px-5 py-2.5 font-label text-sm uppercase tracking-wide text-white transition-colors hover:bg-afs-crimson-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson focus-visible:ring-offset-2"
        >
          Apply
        </button>
      </form>

      <p className="mt-4 font-data text-xs uppercase tracking-wide text-afs-ink-700">
        {resultCountLine(rows.length, kind, query.sort)}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded border border-afs-border-catalog bg-afs-bg-light-raised p-6 font-body text-base text-afs-ink-900">
          Nothing here matches.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[1040px]">
            {/* v7 .lh — the column header strip. */}
            <div className="grid grid-cols-[96px_1.3fr_1.4fr_1.2fr_1fr_1.3fr_1fr] gap-3 border-b border-afs-border-catalog px-3 pb-2 font-label text-xs uppercase tracking-wide text-afs-ink-700">
              <span className="sr-only">Profile drawing</span>
              <span>Customer</span>
              <span>Profile</span>
              <span>Quantity and material</span>
              <span>Total</span>
              <span>Status</span>
              <span>Date</span>
            </div>

            <ul className="divide-y divide-afs-border-catalog">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={rowHref(row)}
                    className="grid grid-cols-[96px_1.3fr_1.4fr_1.2fr_1fr_1.3fr_1fr] items-center gap-3 bg-afs-bg-lane px-3 py-3 transition-colors hover:bg-afs-bg-catalog-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson"
                  >
                    <span className="flex h-[72px] w-[88px] items-center justify-center overflow-hidden rounded bg-afs-bg-light">
                      {row.profileId ? (
                        <LazyProfileThumb id={row.profileId} size={72} />
                      ) : (
                        <span className="font-data text-[10px] uppercase text-afs-ink-700">
                          No drawing
                        </span>
                      )}
                    </span>

                    <span className="min-w-0">
                      <b className="block truncate font-body text-sm font-semibold text-afs-ink-900">
                        {row.customer}
                      </b>
                      {row.person ? (
                        <span className="block truncate font-body text-xs text-afs-ink-700">
                          {row.person}
                        </span>
                      ) : null}
                    </span>

                    <span className="min-w-0">
                      <b className="block truncate font-body text-sm font-semibold text-afs-ink-900">
                        {row.item}
                      </b>
                    </span>

                    <span className="min-w-0">
                      <b className="block font-body text-sm font-semibold text-afs-ink-900">
                        {row.quantity} {row.quantity === 1 ? 'piece' : 'pieces'}
                      </b>
                      <span className="block truncate font-body text-xs text-afs-ink-700">
                        {row.spec}
                      </span>
                    </span>

                    <span className="min-w-0">
                      <b className="block font-body text-sm font-semibold text-afs-ink-900">
                        {money(row.totalCents)}
                      </b>
                      <span className="block truncate font-data text-xs text-afs-ink-700">
                        {row.requestNumber}
                      </span>
                    </span>

                    <span className="min-w-0">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 font-label text-xs font-semibold ${STAGE_PILL[row.stage] ?? STAGE_PILL.done}`}
                        >
                          {STAGE_LABEL[row.stage]}
                        </span>
                        {row.isRush ? (
                          <span className="inline-flex items-center rounded bg-afs-amber-bg px-2 py-0.5 font-label text-xs font-semibold text-afs-amber-ink">
                            RUSH
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate font-body text-xs text-afs-ink-700">
                        {row.meta}
                      </span>
                    </span>

                    <span className="min-w-0">
                      <b className="block font-body text-sm font-semibold text-afs-ink-900">
                        {shortDate(row.submittedAt)}
                      </b>
                      <span className="block truncate font-body text-xs text-afs-ink-700">
                        {row.sourceLabel}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
