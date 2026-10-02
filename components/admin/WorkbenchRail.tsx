import Link from 'next/link';
import type { WorkbenchCard } from '@/lib/data/workbench';

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
 *   3. "Deliveries, next two days" — NOT BUILT. It needs the scheduled
 *      deliveries for today and tomorrow, which the Workbench query does not
 *      read (lib/data/workbench.ts selects only what a card needs, by design —
 *      see its egress rule). Adding that read belongs with the Deliveries work,
 *      where the business-day rules already live. The panel is omitted rather
 *      than shown empty, because an empty "Deliveries, next two days" says
 *      "nothing is scheduled", which would be a claim this screen cannot make.
 *
 * Everything rendered uses v7's own classes (`.rail2`, `.rp`, `.rl`, `.tx`,
 * `.btn`, `.hint`); the appearance comes from the ported stylesheet.
 */
export default function WorkbenchRail({ shopCards }: { shopCards: WorkbenchCard[] }) {
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
    </div>
  );
}
