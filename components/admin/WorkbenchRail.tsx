import Link from 'next/link';
import type { WorkbenchCard } from '@/lib/data/workbench';
import type { DeliveryStop } from '@/lib/data/deliveries';

/**
 * The Workbench's right-hand rail — prototype v7's `railPanels()` (line 1270).
 *
 * v7 renders THREE panels here. This builds the one that has real data behind
 * it today, and is explicit about the other two rather than faking them:
 *
 *   1. "Email inbox" — Connected to Outlook, a message list, per-message Draft
 *      quote / Apply / Log it actions, and a "Check now" button. NOT BUILT, and
 *      not buildable here: it needs Microsoft Graph and an inbound mail parser,
 *      and there is no Graph code in this repository. It is the only
 *      Microsoft-dependent feature in the whole v7 design (see
 *      docs/COMMAND_CENTER_V7_GAP_AUDIT.md §c), and this build does not add
 *      any. v7's "N new emails" summary chip is absent for the same reason.
 *
 *   2. "In the shop right now" — BUILT below, from the Workbench's own shop
 *      lane. No extra query: those cards are already fetched for the board, so
 *      the panel is a second view of data in hand rather than a second trip to
 *      the database.
 *
 *   3. "Deliveries, next two days" — BUILT in Stage E, from the real schedule.
 *      It was omitted before rather than shown empty, because an empty panel
 *      says "nothing is scheduled" and that was a claim this screen could not
 *      then make. It can now: the stops come from `getDeliveriesView`, the same
 *      read the Deliveries screen uses, so an empty panel really does mean
 *      nothing is booked and says so in v7's own words.
 *
 * Everything rendered uses v7's own classes (`.rail2`, `.rp`, `.rl`, `.tx`,
 * `.btn`, `.hint`); the appearance comes from the ported stylesheet.
 */
export default function WorkbenchRail({
  shopCards,
  nextTwoDays,
}: {
  shopCards: WorkbenchCard[];
  /** Today's and tomorrow's scheduled stops, each day already in window order. */
  nextTwoDays: { heading: string; stops: DeliveryStop[] }[];
}) {
  const upcoming = nextTwoDays.flatMap((d) => d.stops.map((s) => ({ day: d.heading, stop: s })));

  return (
    <div className="rail2">
      <section className="rp">
        <h3>
          In the shop right now
          <Link href="/admin/shop-view" className="btn slate sm">
            Shop View
          </Link>
        </h3>
        {shopCards.length === 0 ? (
          <div className="hint">Nothing in the queue.</div>
        ) : (
          shopCards.map((card) => (
            <Link key={card.id} href={`/admin/command-center/job/${card.id}`} className="rl">
              <div className="tx">
                <b>{card.itemLine}</b>
                <span>
                  {card.customer} · {card.meta}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="rp">
        <h3>
          Deliveries, next two days
          <Link href="/admin/deliveries" className="btn slate sm">
            Deliveries
          </Link>
        </h3>
        {upcoming.length === 0 ? (
          <div className="hint">No deliveries scheduled.</div>
        ) : (
          upcoming.map(({ day, stop }) => (
            <Link key={stop.deliveryId} href="/admin/deliveries" className="rl">
              <div className="tx">
                <b>{stop.customer}</b>
                <span>
                  {day} · {stop.timeWindowLabel} · {stop.item}
                  {stop.quantity ? ` × ${stop.quantity}` : ''}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
