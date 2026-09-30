import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getResolvedPriceBook } from '@/lib/pricing/db';
import { toEffectiveDate } from '@/lib/pricing/price-book';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import PriceBookEditor from '@/components/admin/PriceBookEditor';

/**
 * SETTINGS → PRICE BOOK.
 *
 * Gunmetal header, light working area (CLAUDE.md rule #18) — this page opts in
 * by wrapping itself in `LightWorkingArea`, the same way the Workbench and the
 * Job screen do. The shell does not decide from the pathname.
 *
 * Rendered fresh on every visit: the price book is what quotes are built from,
 * and a cached one could show Steve a price he has already changed.
 */
export const dynamic = 'force-dynamic';

export default async function PriceBookPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // "Today" is resolved on the server and passed down, so the default start
  // date for a new price is the shop's date and not the browser's.
  const today = toEffectiveDate(new Date());
  const rows = await getResolvedPriceBook(supabase, today);

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
          <h1 className="font-heading text-3xl text-afs-ink-900 mt-2">Price book</h1>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            What things cost, and when each price started. Only you see this — customers never do.
          </p>
        </div>

        <PriceBookEditor rows={rows} today={today} />
      </div>
    </LightWorkingArea>
  );
}
