import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import V7FilterBar from '@/components/admin/v7/V7FilterBar';
import { V7Btn, V7Spec } from '@/components/admin/v7/V7Primitives';
import type { V7SearchRow, V7SearchView } from '@/lib/data/v7-view/types';

/**
 * SEARCH over every past quote and order — a transliteration of v7's
 * `pageSearch()` (line 1667), `resultsHTML()` (1664) and `resRow()` (1655).
 *
 * NOT the profile search. CLAUDE.md rule #27 keeps exactly one profile query
 * and one profile panel, at /admin/search/profiles; this screen asks a
 * different question over different tables and shares none of that machinery.
 *
 * Its row is SEVEN columns where the Quotes/Orders row is eight, and the two
 * are deliberately separate markup in v7 (`resRow` vs `listRowHTML`) because
 * they carry different things: Search leads with the PROFILE and shows a price
 * per piece, the lists lead with the CUSTOMER and show a status with its note.
 * Merging them would be a design decision v7 did not make.
 */
export default function V7Search({ view }: { view: V7SearchView }) {
  return (
    <>
      <div className="greet" style={{ display: 'block' }}>
        <h1 className="t">Search</h1>
        <p className="sub">
          Type the company, then what they ordered. Example: <b>Hill Country drip edge</b>. No
          special commands. Every past quote and order shows its profile, dimensions, date,
          quantity, material and price.
        </p>
      </div>

      <V7FilterBar filters={view.filters} />

      <div id="sres">
        {view.profileChip && (
          <div className="fchip">
            {view.profileChip.text}{' '}
            <Link href={view.profileChip.clearHref} className="btn slate sm">
              Show everything
            </Link>
          </div>
        )}
        <p className="rcount">{view.countLine}</p>
        {view.rows.length ? (
          <div className="rtab">
            <div className="rh">
              <span />
              <span>Profile</span>
              <span>Customer</span>
              <span>Job and date</span>
              <span>Quantity and material</span>
              <span>Price</span>
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

function Row({ row }: { row: V7SearchRow }) {
  return (
    <article className="rr" data-testid="search-row">
      <span className="rt">
        {row.drawing && (
          <V7Drawing
            kind={row.drawing.kind}
            d={row.drawing.d}
            options={{ w: 100, h: 100, pad: 11, sw: 4.6 }}
          />
        )}
      </span>
      <div className="c1">
        <b>{row.profileName}</b>
        <span>{row.dims}</span>
        <span className="mut">{row.bends}</span>
      </div>
      <div className="c2">
        <b>{row.customer}</b>
        <span>{row.person}</span>
      </div>
      <div className="c3">
        <b>{row.jobId}</b>
        <span>{row.date}</span>
        <span className="mut">{row.status}</span>
      </div>
      <div className="c4">
        <b>{row.qty}</b>
        <span>
          <V7Spec spec={row.spec} />
        </span>
      </div>
      <div className="c5">
        <b>{row.total}</b>
        <span>{row.price}</span>
      </div>
      <div className="c6">
        {row.buttons.map((b) => (
          <V7Btn key={b.label} button={b} />
        ))}
      </div>
    </article>
  );
}
