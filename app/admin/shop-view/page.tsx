import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getShopQueue } from '@/lib/data/shop-queue';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import ShopQueueBoard from '@/components/admin/ShopQueueBoard';

/**
 * SHOP VIEW — Command Center V2 prompt v2-04, rebuilt to the approved
 * prototype's `shopView`: the queue in queue order, large cards, **Start
 * bending**, **Mark finished**.
 *
 * WHAT THIS REPLACED, AND WHY IT IS NOT A LOSS. The previous page rendered
 * `ShopViewBoard.tsx` — a gunmetal "focus mode" that showed ONE job
 * full-screen with a queue strip beside it. Three things made it the wrong
 * thing to keep:
 *
 *   1. The approved UX is a queue of large cards, not a single-job focus panel.
 *   2. It polled `/api/admin/shop-library`, whose payload includes
 *      `geometry_svg` — a base64 PNG at 70KB–786KB a row, ~6MB across the
 *      twenty live rows, re-fetched every thirty seconds. Drawings now
 *      lazy-load one at a time.
 *   3. Its poll did not stop when the tab was hidden. A tablet left on all day
 *      polled all day.
 *
 * Everything an operator actually read off those cards is still on these ones:
 * the spec, the customer, the machine profile number, the drawing, and the
 * shop-floor instructions (painted side, hem, special). The queue REORDERING
 * controls live where they already did, on /admin/shop-library, which still
 * uses the old route untouched.
 */
export const metadata: Metadata = {
  title: 'Shop View | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ShopViewPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const queue = await getShopQueue(supabase);

  return (
    <LightWorkingArea>
      <div className="max-w-[1400px] mx-auto">
        <h1 className="font-heading text-4xl text-afs-ink-900">Shop View</h1>
        <p className="font-body text-[19px] text-afs-ink-700 mt-1 mb-6 max-w-3xl">
          What the Thalmann is working on, in order. Built for the tablet next to the machine — it
          refreshes itself every thirty seconds while this screen is in front.{' '}
          <Link href="/admin/deliveries" className="text-afs-green-ink underline font-semibold">
            Deliveries
          </Link>{' '}
          is where finished work gets a day.
        </p>

        <ShopQueueBoard initial={queue} />
      </div>
    </LightWorkingArea>
  );
}
