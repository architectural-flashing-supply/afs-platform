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
 * A port of prototype v7's `pageList(kind)` (line 1732), `listHTML(kind)`
 * (1724) and `listRowHTML(r)` (1711). Class names and structure are v7's own —
 * `.greet`, `.bar`, `.fld`, `.rcount`, `.ltab`, `.lh`, `.lr`, `.pill`, `.mut`,
 * `.none` — and the appearance comes entirely from the ported stylesheet
 * (app/styles/command-center-v7.generated.css). No Tailwind colour, size or
 * spacing utility appears here, and none should: one would override v7 and fail
 * tests/visual/v7-style-gate.spec.ts. See CLAUDE.md rule #33.
 *
 * This replaces a version that had v7's column order and v7's copy painted in
 * the old light-era Tailwind tokens (`bg-afs-bg-lane`, `afs-ink-900`,
 * `border-afs-border-catalog`) — right information, wrong look, which is the
 * failure this rebuild exists to correct.
 *
 * COLUMN ORDER IS v7's, and it is NOT the order the headings suggest. v7 emits
 * the cells as thumbnail · customer · profile · quantity+material · total ·
 * STATUS · DATE · action, while its `.lh` strip labels them Customer, Profile,
 * Quantity and material, Total, Status, Date. The grid places by DOM order, so
 * the cells are emitted in v7's order below and the `c1`…`c7` class names are
 * carried over as-is even though only `.c6` and `.c7` carry rules — they are
 * part of the prototype's markup and a future v7 revision may style the rest.
 *
 * STILL A SERVER COMPONENT. The filter bar is a plain GET form, so every view
 * is a shareable URL and the list works with no client JavaScript. v7 filters
 * in the browser because it has no server; that is a thing it fakes, so the
 * real behaviour is kept and only the look is taken.
 */

/**
 * v7 `PILLC` (line 1599) — the status pill's colour per lane. These are v7's
 * own pill modifiers, not Tailwind classes: `.pill.r` red, `.pill.a` amber,
 * `.pill.g` green, `.pill.v` violet, `.pill.b` blue.
 *
 * Written as a map to the WHOLE className. The contrast gate expands class maps
 * but reports a runtime template as `unresolved`, and CLAUDE.md rule #28 treats
 * a rising unresolved count as the gate going blind.
 */
const STAGE_PILL: Record<string, string> = {
  new: 'pill r',
  quoted: 'pill a',
  approved: 'pill g',
  shop: 'pill v',
  done: 'pill b',
};

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
  /** v7 puts "+ New quote" on the Quotes list only (pageList, line 1735). */
  newQuoteHref?: string;
}

export default function QuoteOrderList({
  kind,
  title,
  blurb,
  query,
  rows,
  rowHref,
  newQuoteHref,
}: QuoteOrderListProps) {
  return (
    <>
      <div className="greet">
        <div>
          <h1 className="t">{title}</h1>
          <p className="sub">{blurb}</p>
        </div>
        {newQuoteHref && (
          // v7 writes this as `<div style="margin-left:auto">` (line 1735).
          // Kept as an inline style rather than invented as a new class, so the
          // ported stylesheet stays exactly the prototype's. It is a layout
          // value, not a colour, so rule #4 does not apply.
          <div style={{ marginLeft: 'auto' }}>
            <Link href={newQuoteHref} className="btn red lg">
              + New quote
            </Link>
          </div>
        )}
      </div>

      {/* v7 `.bar` — a plain GET form, so every view is a URL. */}
      <form method="get" className="bar">
        <label className="fld q">
          Search {title.toLowerCase()}
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Customer, profile, material or job number"
            autoComplete="off"
          />
        </label>

        <label className="fld">
          Stage
          <select name="stage" defaultValue={query.stage}>
            {LIST_STAGES[kind].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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

        {/* v7 re-filters on change because it runs in the browser. This posts
            the form, so the button is what applies the filters without JS. */}
        <button type="submit" className="btn red">
          Apply
        </button>
      </form>

      <div id="lres">
        <p className="rcount">{resultCountLine(rows.length, kind, query.sort)}</p>

        {rows.length === 0 ? (
          <div className="none">Nothing here matches.</div>
        ) : (
          <div className="ltab">
            <div className="lh">
              <span />
              <span>Customer</span>
              <span>Profile</span>
              <span>Quantity and material</span>
              <span>Total</span>
              <span>Status</span>
              <span>Date</span>
              <span />
            </div>

            {rows.map((row) => (
              <article className="lr" key={row.id} data-testid="list-row">
                <span className="rt">
                  {row.profileId ? <LazyProfileThumb id={row.profileId} size={72} /> : null}
                </span>

                <div className="c2">
                  <b>{row.customer}</b>
                  {row.person ? <span>{row.person}</span> : null}
                </div>

                <div className="c1">
                  <b>{row.item}</b>
                </div>

                <div className="c4">
                  <b>
                    {row.quantity} {row.quantity === 1 ? 'piece' : 'pieces'}
                  </b>
                  <span>{row.spec}</span>
                </div>

                <div className="c5">
                  <b>{money(row.totalCents)}</b>
                  <span className="mut">{row.requestNumber}</span>
                </div>

                <div className="c7">
                  <span className={STAGE_PILL[row.stage] ?? STAGE_PILL.done}>
                    {STAGE_LABEL[row.stage]}
                  </span>
                  {row.isRush ? <span className="pill a">RUSH</span> : null}
                  <span className="mut">{row.meta}</span>
                </div>

                <div className="c3">
                  <b>{shortDate(row.submittedAt)}</b>
                  <span className="mut">{row.sourceLabel}</span>
                </div>

                <div className="c6">
                  <Link href={rowHref(row)} className="btn red sm">
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
