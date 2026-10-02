import Link from 'next/link';
import { V7Btn, V7Thumb } from '@/components/admin/v7/V7Primitives';
import type { V7DeliveriesView, V7DeliveryCard } from '@/lib/data/v7-view/deliveries';

/**
 * DELIVERIES, FIXTURE RENDER — a transliteration of v7's `pageDeliveries()`
 * (line 1818), `dcard()` (line 1810) and the track panel beside it.
 *
 * FIXTURE ONLY, AND THAT IS THE DESIGN RATHER THAN A SHORTCUT. The live screen
 * keeps `DeliveriesWeek` and `DeliveryTrackPanel`, which schedule against the
 * real business-day rules (CLAUDE.md rule #24), really mark a delivery
 * delivered, really notify the customer (rule #25) and render the real tracking
 * map the customer already sees. v7 mimes all four with a hardcoded schematic
 * and a sample truck. Rule #33's own carve-out is for exactly this: keep the
 * behaviour, and here the behaviour IS the screen.
 *
 * So what this renders is v7's layout with v7's stops in it, which is what lets
 * the whole-screen gate measure the split, the schedule column, the day
 * sections, the tabs and the stop rows — the parts the live screen does share —
 * rather than leaving the busiest screen in the app unmeasured.
 *
 * The divergence is listed in docs/design/V7_PIXEL_REPORT.md, where it belongs.
 */
const SPLIT_CLASS: Record<'split' | 'list' | 'map', string> = {
  split: 'dsplit',
  list: 'dsplit fl',
  map: 'dsplit fm',
};

export default function V7Deliveries({ view }: { view: V7DeliveriesView }) {
  return (
    <>
      <div className="greet" style={{ display: 'block' }}>
        <h1 className="t">Deliveries</h1>
      </div>

      <div className={SPLIT_CLASS[view.full ?? 'split']}>
        <section className="dpanel dleft">
          <div className="dph">
            <h2>Schedule</h2>
            <Link
              href={view.full === 'list' ? '/admin/deliveries?fixture=v7' : '/admin/deliveries?full=list&fixture=v7'}
              className="btn slate sm"
            >
              {view.full === 'list' ? 'Back to split view' : 'Expand to full page'}
            </Link>
          </div>
          <p className="sub" style={{ margin: '0 0 10px' }}>
            Schedule or change any delivery. Marking one delivered moves the job to Done. Point at a
            stop to see it on the map.
          </p>
          <div className="dlist">
            <section className="un">
              <h2>Not scheduled yet</h2>
              <p>In the shop, waiting for a delivery day.</p>
              {view.unscheduled.length ? (
                view.unscheduled.map((c) => <DCard key={c.key} card={c} />)
              ) : (
                <div className="none">Everything in the shop has a delivery day.</div>
              )}
            </section>

            {view.days.map((d) => (
              <section key={d.key} className={d.today ? 'day today' : 'day'}>
                <div className="dh">
                  <div className="dn">{d.label}</div>
                  <span className={d.today ? 'td' : undefined}>{d.sub}</span>
                </div>
                {d.cards.length ? (
                  d.cards.map((c) => <DCard key={c.key} card={c} />)
                ) : (
                  <div className="none">No deliveries.</div>
                )}
              </section>
            ))}
          </div>
        </section>

        <section className="dpanel dright">
          <div className="dph">
            <h2>Track deliveries</h2>
            <span className="live">
              <i />
              Live
            </span>
            <Link
              href={view.full === 'map' ? '/admin/deliveries?fixture=v7' : '/admin/deliveries?full=map&fixture=v7'}
              className="btn slate sm"
            >
              {view.full === 'map' ? 'Back to split view' : 'Expand to full page'}
            </Link>
          </div>

          <div className="dtabs">
            {view.tabs.map((t) => (
              <Link
                key={t.key}
                href={`/admin/deliveries?day=${t.key}&fixture=v7`}
                className={t.on ? 'dtab on' : 'dtab'}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* The schematic. Fixture only — see this file's header and
              lib/design/v7-delivery-map.ts. Its input is v7's own sample stop
              list and nothing else; no database value reaches it. */}
          <div className="mapwrap" dangerouslySetInnerHTML={{ __html: view.mapSvg ?? '' }} />

          <div className="trk">
            <b>Truck 1</b>
            <span>{view.truckLine}</span>
          </div>

          <div className="trows">
            {view.trackRows.length ? (
              view.trackRows.map((r) => (
                <div key={r.key} className={r.selected ? 'trow sel' : 'trow'}>
                  <span className="num">{r.index}</span>
                  <div className="tx">
                    <b>{r.customer}</b>
                    <span>{r.detail}</span>
                  </div>
                  <span className={`pill ${r.pillTone}`}>{r.state}</span>
                </div>
              ))
            ) : (
              <div className="none">{view.trackEmpty}</div>
            )}
          </div>

          <p className="hint" style={{ marginTop: '10px' }}>
            Sample positions. In the real build this panel is the same Track Deliveries map customers
            already see on the website, so Steve and the shop watch exactly what the customer sees.
          </p>
        </section>
      </div>
    </>
  );
}

/** v7 `dcard()` (line 1810). */
function DCard({ card }: { card: V7DeliveryCard }) {
  return (
    <article className={card.selected ? 'dcard sel' : 'dcard'}>
      <div className="cr">
        <V7Thumb drawing={card.drawing} className="sm" label={card.customer} />
        <div>
          <b>{card.customer}</b>
        </div>
      </div>
      <div className="cd">
        <span className="ci2">{card.itemLine}</span>
        <span>{card.specLine}</span>
      </div>
      {card.state ? (
        <div className="drow">
          <span className={card.state.tone}>{card.state.text}</span>
        </div>
      ) : (
        <span className="win">{card.window}</span>
      )}
      <div className="drow">
        {card.buttons.map((b) => (
          <V7Btn key={b.label} button={b} />
        ))}
      </div>
    </article>
  );
}
