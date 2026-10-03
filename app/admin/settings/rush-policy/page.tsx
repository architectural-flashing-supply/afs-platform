import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getRushPolicyBook } from '@/lib/pricing/db';
import { rushPolicyInForce } from '@/lib/pricing/rush-policy';
import { shopDateOnly } from '@/lib/delivery/business-days';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import RushPolicyEditor from '@/components/admin/RushPolicyEditor';

/**
 * SETTINGS → RUSH POLICY.
 *
 * Gunmetal header, light working area (CLAUDE.md rule #18) — this page opts in
 * by wrapping itself in `LightWorkingArea`, exactly as its Settings sibling
 * `/admin/settings/price-book` does. The shell does not decide from the
 * pathname.
 *
 * Rendered fresh on every visit: the rush policy is what a rush quote is built
 * from, and a cached one could show Steve a figure he has already changed —
 * the same reason the price-book screen is `force-dynamic`.
 *
 * "TODAY" IS THE SHOP'S DATE, NOT THE SERVER'S. Vercel runs in UTC and the shop
 * is in Burnet, Texas, so a policy entered at 7pm Central on a Tuesday would
 * default its start date to Wednesday if this read the raw server clock
 * (CLAUDE.md rule #24's second hazard). `shopDateOnly` is this codebase's one
 * shop clock and it is what decides both the default start date and which
 * policy counts as in force.
 */
export const dynamic = 'force-dynamic';

export default async function RushPolicyPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const today = shopDateOnly(new Date());
  // Never throws — on a deployment where migration 039_rush_policy.sql has not
  // been applied it returns the reason as a sentence, and the editor renders
  // that state with its form disabled rather than offering a save that cannot
  // land. See lib/pricing/db.ts.
  const book = await getRushPolicyBook(supabase);
  const inForce = rushPolicyInForce(book.policies, today);

  return (
    <LightWorkingArea>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/admin/settings"
            className="font-label text-sm font-bold text-afs-ink-700 hover:text-afs-ink-900 underline min-h-11 inline-flex items-center"
          >
            ← Settings
          </Link>
          <h1 className="font-heading text-3xl text-afs-ink-900 mt-2">Rush policy</h1>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            What a rush job costs, and the shortest notice you will take for one. Only you see this —
            a customer only ever sees the amount on their formal quote.
          </p>
        </div>

        <RushPolicyEditor
          policies={book.policies}
          unavailable={book.unavailable}
          inForce={inForce}
          today={today}
        />
      </div>
    </LightWorkingArea>
  );
}
