import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getDeliveriesView } from '@/lib/data/deliveries';
import { businessDaysFrom, shopDateOnly } from '@/lib/delivery/business-days';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import DeliveriesWeek from '@/components/admin/DeliveriesWeek';

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

export default async function AdminDeliveriesPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const now = new Date();
  const view = await getDeliveriesView(supabase, now);
  const pickerDays = businessDaysFrom(shopDateOnly(now), PICKER_DAYS);

  return (
    <LightWorkingArea>
      <div className="max-w-[1600px] mx-auto">
        <h1 className="font-heading text-3xl text-afs-ink-900">Deliveries</h1>
        <p className="font-body text-[17px] text-afs-ink-700 mt-1 mb-5 max-w-3xl">
          The next five working days. A job the shop marks finished books itself onto the next
          business day and the customer is told — change any of it here.{' '}
          <Link href="/admin/shop-view" className="text-afs-green-ink underline font-semibold">
            Shop View
          </Link>{' '}
          is what the machine is working on now.
        </p>

        <DeliveriesWeek view={view} pickerDays={pickerDays} />
      </div>
    </LightWorkingArea>
  );
}
