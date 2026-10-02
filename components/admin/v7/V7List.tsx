import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import V7RowLink from '@/components/admin/v7/V7RowLink';
import V7FilterBar from '@/components/admin/v7/V7FilterBar';
import { V7Btn, V7PillEl, V7Spec } from '@/components/admin/v7/V7Primitives';
import { NEW_QUOTE_HREF } from '@/lib/data/admin-nav';
import type { V7ListRow, V7ListView } from '@/lib/data/v7-view/types';

/**
 * QUOTES AND ORDERS — a transliteration of v7's `pageList()` (line 1745),
 * `listHTML()` (1738) and `listRowHTML()` (1725).
 *
 * ONE COMPONENT FOR BOTH, as v7 has one function for both: the lists differ
 * only in their title, their blurb, their stage options and whether the "+ New
 * quote" button is in the header. Everything else — the eight-column grid, the
 * row, the pills, the thumbnail — is identical, and splitting it would be two
 * things to keep in step.
 *
 * WHAT THE PIXEL GATE FOUND WRONG IN THE PREVIOUS BUILD. The old list had the
 * right columns and the right class names, and still did not look like v7:
 *
 *   - no profile drawing in the first column, which is 90px of every row;
 *   - no material colour chip beside the spec;
 *   - an "Apply" button in the filter bar that v7 does not have;
 *   - `.c7` carried the status pill but not the one-line note under it.
 *
 * THE ROW'S MARKUP ORDER IS v7's, NOT THE VISUAL ORDER. v7 emits the columns
 * `rt, c2, c1, c4, c5, c7, c3, c6` and the CSS grid places them by class, so
 * the DOM order and the column order deliberately differ. Keep the emitted
 * order — reordering to "match the header" would change the tab order and the
 * reading order for a screen reader while looking identical.
 */
export default function V7List({ view }: { view: V7ListView }) {
  return (
    <>
      <div className="greet">
        <div>
          <h1 className="t">{view.title}</h1>
          <p className="sub" style={{ marginTop: '4px' }}>
            {view.sub}
          </p>
        </div>
        {view.showNewQuote && (
          <div style={{ marginLeft: 'auto' }}>
            <Link href={NEW_QUOTE_HREF} className="btn red lg">
              + New quote
            </Link>
          </div>
        )}
      </div>

      <V7FilterBar filters={view.filters} />

      <div id="lres">
        <p className="rcount">{view.countLine}</p>
        {view.rows.length ? (
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
            {view.rows.map((r) => (
              <Row key={r.key} row={r} />
            ))}
          </div>
        ) : (
          <div className="none" style={{ padding: '14px' }}>
            {view.emptyText}
          </div>
        )}
      </div>
    </>
  );
}

function Row({ row }: { row: V7ListRow }) {
  return (
    <V7RowLink href={row.href} className="lr" testId="list-row">
      <span className="rt">
        {row.drawing && (
          <V7Drawing
            kind={row.drawing.kind}
            d={row.drawing.d}
            options={{ w: 90, h: 90, pad: 11, sw: 4.6 }}
          />
        )}
      </span>
      <div className="c2">
        {/* Plain text, as v7 has it. The row itself is the click target and the
            `.c6` button is the keyboard path — see V7RowLink for why an anchor
            here was removed. */}
        <b>{row.customer}</b>
        <span>{row.person}</span>
      </div>
      <div className="c1">
        <b>{row.profileName}</b>
        <span>{row.dims}</span>
        <span className="mut">{row.bends}</span>
      </div>
      <div className="c4">
        <b>{row.qty}</b>
        <span>
          <V7Spec spec={row.spec} />
        </span>
      </div>
      <div className="c5">
        <b>{row.total}</b>
        <span className="mut">{row.jobId}</span>
      </div>
      <div className="c7">
        <V7PillEl pill={row.statusPill} />
        {row.flagPills.map((p) => (
          <V7PillEl key={p.text} pill={p} />
        ))}
        <span className="mut">{row.meta}</span>
      </div>
      <div className="c3">
        <b>{row.date}</b>
        <span className="mut">{row.source}</span>
      </div>
      <div className="c6">{row.button && <V7Btn button={row.button} />}</div>
    </V7RowLink>
  );
}
