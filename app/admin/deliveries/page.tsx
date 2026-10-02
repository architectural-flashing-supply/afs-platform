import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getDeliveriesView } from '@/lib/data/deliveries';
import { businessDaysFrom, shopDateOnly } from '@/lib/delivery/business-days';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import DeliveriesWeek from '@/components/admin/DeliveriesWeek';
import DeliveryTrackPanel from '@/components/admin/DeliveryTrackPanel';
import V7Deliveries from '@/components/admin/v7/V7Deliveries';
import { isFixtureMode, type SearchParamValue } from '@/lib/fixtures/mode';
import { fixtureDeliveries } from '@/lib/data/v7-view/deliveries';

/**
 * DELIVERIES — Command Center V2 prompt v2-04, built to the approved
 * prototype's `deliveriesView`: a five-day week with per-day stops and **Mark
 * delivered**, a **Not scheduled yet** panel with **Schedule delivery**, and
 * the day + time-window window.
 *
 * WHAT THIS REPLACED. The v2-01 version of this page said, in so many words,
 * that the week view was Phase 5 and the `deliveries` table did not exist —
 * and listed finished `shop_profile_library` rows as a read-only table so the
 * nav item would not 404. Migration 037 created the table; this is the real
 * screen, and the honest placeholder has done its job.
 *
 * THE DAY PICKER IS COMPUTED HERE, ON THE SERVER. `businessDaysFrom` needs the
 * shop's own calendar date (America/Chicago), and a browser in another time
 * zone — or an operator's tablet with a wrong clock — would compute a
 * different "today". So the ten selectable days are decided server-side and
 * passed down, and the server refuses a non-weekday anyway.
 */
export const metadata: Metadata = {
  title: 'Deliveries | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** How many business days the scheduling window offers. Two working weeks. */
const PICKER_DAYS = 10;

/**
 * v7's expand states (`pageDeliveries()`, line 1819): `.fl` makes the schedule
 * the whole page, `.fm` the map. A whole-className map, not a template — the
 * contrast gate expands class maps but counts a runtime template as
 * `unresolved` (CLAUDE.md rule #28).
 */
const SPLIT_CLASS: Record<'split' | 'list' | 'map', string> = {
  split: 'dsplit',
  list: 'dsplit fl',
  map: 'dsplit fm',
};

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams?: { full?: string; day?: string } & Record<string, SearchParamValue>;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // FIXTURE MODE renders v7's own split with v7's own stops, so the whole-screen
  // gate can measure the layout around a map that must stay real on the live
  // screen. See components/admin/v7/V7Deliveries.tsx for why that split exists.
  if (isFixtureMode(searchParams)) {
    const f =
      searchParams?.full === 'list' ? 'list' : searchParams?.full === 'map' ? 'map' : null;
    return (
      <LightWorkingArea>
        <V7Deliveries view={fixtureDeliveries(searchParams?.day ?? 'thu', f)} />
      </LightWorkingArea>
    );
  }

  const now = new Date();
  const view = await getDeliveriesView(supabase, now);
  const pickerDays = businessDaysFrom(shopDateOnly(now), PICKER_DAYS);

  const full = searchParams?.full === 'list' ? 'list' : searchParams?.full === 'map' ? 'map' : null;

  return (
    // STAGE E — v7's Deliveries split view (`pageDeliveries()`, line 1818):
    // `.dsplit` with the schedule on the left and the tracking map on the
    // right, each expandable to the full page via `.fl` / `.fm`.
    <LightWorkingArea>
      <div className="greet">
        <div>
          <h1 className="t">Deliveries</h1>
          <p className="sub">
            The next five working days. A job the shop marks finished books itself onto the next
            business day and the customer is told — change any of it here.{' '}
            <Link href="/admin/shop-view" className="linkbtn">
              Shop View
            </Link>{' '}
            is what the machine is working on now.
          </p>
        </div>
      </div>

      <div className={SPLIT_CLASS[full ?? 'split']}>
        <section className="dpanel dleft">
          <div className="dph">
            <h2>Schedule</h2>
            <a className="btn slate sm" href={full === 'list' ? '/admin/deliveries' : '/admin/deliveries?full=list'}>
              {full === 'list' ? 'Back to split view' : 'Expand to full page'}
            </a>
          </div>
          <p className="sub">
            Schedule or change any delivery. Marking one delivered moves the job to Done.
          </p>
          <DeliveriesWeek view={view} pickerDays={pickerDays} />
        </section>

        <DeliveryTrackPanel view={view} full={full} />
      </div>
    </LightWorkingArea>
  );
}
