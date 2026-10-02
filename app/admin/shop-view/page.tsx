import type { Metadata } from 'next';
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
      {/* v7 `pageShop()` (prototype line 1476): a `.greet` title and one-line
          sub, then the `.shopg` grid the board renders. */}
      <div className="greet">
        <h1 className="t">Shop View</h1>
        <span className="sub">
          The Thalmann queue, in the order jobs are bent. Click a job to take over the screen.
        </span>
      </div>

      <ShopQueueBoard initial={queue} />
    </LightWorkingArea>
  );
}
