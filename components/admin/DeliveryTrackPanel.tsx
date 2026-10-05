'use client';

import { useState } from 'react';
import DeliveryTrackingMap from '@/components/track/DeliveryTrackingMap';
import type { DeliveriesView, DeliveryStop } from '@/lib/data/deliveries';

/**
 * TRACK DELIVERIES — the right half of v7's Deliveries split view
 * (`pageDeliveries()`, prototype line 1818).
 *
 * v7's own layout, class for class: `.dpanel.dright` with a `.dph` header, a
 * `.dtabs` row of day tabs, the map in a `.mapwrap`, a `.trk` truck line, and
 * `.trows` of `.trow` stops that select what the map shows.
 *
 * THE MAP IS THE REAL ONE. v7 draws a hand-built SVG of the Hill Country with
 * sample coordinates, and even says so in its own footnote: "Sample positions.
 * In the real build this panel is the same Track Deliveries map customers
 * already see on the website." That is exactly what this does — it renders
 * `components/track/DeliveryTrackingMap`, the Google Maps component the public
 * tracking page uses, so the office and the customer are looking at the same
 * thing. v7's SVG is not ported.
 *
 * WHAT A STOP NEEDS BEFORE IT CAN BE PUT ON A MAP, and why some cannot be.
 * The map needs a destination address, which lives on the ORDER
 * (`orders.delivery_address`). A delivery hangs off a SHOP JOB, and a shop job
 * can exist with no order behind it — a V2 Job that never became a paid order.
 * CLAUDE.md rule #25 records the same fact about the tracking link and says the
 * honest answer is to give the day and the window rather than a dead link. So a
 * stop with no order says so in plain English and the map stays on its
 * service-area view. Nothing is invented, and no coordinate is guessed.
 *
 * NO GEOCODING WAS ADDED. The map resolves the address itself, as it already
 * does for every customer tracking their own order.
 */
export default function DeliveryTrackPanel({
  view,
  full,
}: {
  view: DeliveriesView;
  /** v7's expand state: 'map' makes this panel the whole page. */
  full: 'list' | 'map' | null;
}) {
  const days = view.days;
  const [dayIndex, setDayIndex] = useState(0);
  const day = days[dayIndex] ?? days[0] ?? null;
  const stops = day?.stops ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: DeliveryStop | null =
    stops.find((s) => s.deliveryId === selectedId) ?? stops[0] ?? null;

  return (
    <section className="dpanel dright">
      <div className="dph">
        <h2>Track deliveries</h2>
        <span className="live">
          <i />
          Live
        </span>
        <a
          className="btn slate sm"
          href={full === 'map' ? '/admin/deliveries' : '/admin/deliveries?full=map'}
        >
          {full === 'map' ? 'Back to split view' : 'Expand to full page'}
        </a>
      </div>

      <div className="dtabs">
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className={i === dayIndex ? 'dtab on' : 'dtab'}
            onClick={() => {
              setDayIndex(i);
              setSelectedId(null);
            }}
          >
            {d.heading}
          </button>
        ))}
      </div>

      <div className="mapwrap">
        {/* The map fills a fixed-aspect box; DeliveryTrackingMap positions
            itself absolutely inside its container. */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '640 / 420' }}>
          <DeliveryTrackingMap
            orderId={selected?.orderId ?? undefined}
            deliveryAddress={selected?.deliveryAddress ?? null}
            // "Out for delivery" drives the live driver view. A stop that is
            // still scheduled is not on the road, and saying it is would be the
            // one thing this screen must never do.
            isOutForDelivery={selected?.status === 'scheduled' && Boolean(selected?.orderId)}
          />
        </div>
      </div>

      <div className="trk">
        <b>{day ? day.heading : 'No days to show'}</b>
        <span>
          {stops.length === 0
            ? 'No stops this day'
            : `${stops.length} stop${stops.length === 1 ? '' : 's'}, in window order`}
        </span>
      </div>

      <div className="trows">
        {stops.length === 0 ? (
          <div className="none">No deliveries on {day ? day.heading : 'this day'}.</div>
        ) : (
          stops.map((s, i) => (
            <button
              key={s.deliveryId}
              type="button"
              className={selected?.deliveryId === s.deliveryId ? 'trow sel' : 'trow'}
              onClick={() => setSelectedId(s.deliveryId)}
              data-testid="track-stop"
              data-delivery-id={s.deliveryId}
            >
              <span className="num">{i + 1}</span>
              <span className="tx">
                <b>{s.customer}</b>
                <span>
                  {s.item}
                  {s.quantity ? ` × ${s.quantity}` : ''} · window {s.timeWindowLabel}
                </span>
              </span>
              <span className={s.status === 'delivered' ? 'pill g' : 'pill a'}>
                {s.status === 'delivered' ? 'Delivered' : 'Scheduled'}
              </span>
            </button>
          ))
        )}
      </div>

      {selected && !selected.orderId && (
        <p className="hint">
          {selected.customer} has no order behind this delivery yet, so there is no address to put on
          the map. The day and the window above are what the customer was told.
        </p>
      )}
    </section>
  );
}
