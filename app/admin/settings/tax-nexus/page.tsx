import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import TaxNexusEditor from '@/components/admin/TaxNexusEditor';
import { getNexusStates, getTaxCalculationsNeedingReview } from '@/lib/tax/db';
import { resolveTaxConfigFromEnv } from '@/lib/tax/config';
import { summariseTaxConfig } from '@/lib/tax/service';
import { shopDateOnly } from '@/lib/delivery/business-days';

/**
 * SETTINGS → TAX NEXUS.
 *
 * Gunmetal header, light working area (CLAUDE.md rule #18) — this page opts in by
 * wrapping itself in `LightWorkingArea`, exactly as
 * app/admin/settings/price-book/page.tsx does. The shell does not decide from the
 * pathname.
 *
 * Rendered fresh on every visit. Tax configuration is read from the environment
 * and from a table an admin is editing on this very screen, so a cached render
 * could tell Steve that tax is off when he has just switched it on — or, worse,
 * the reverse.
 *
 * ================== WHY THE SERVICE-ROLE CLIENT READS THE TABLES ==================
 *
 * `requireAdminUser` has already established that this visitor is an admin, and
 * migration 039's RLS would allow their own session to read both tables. The
 * service-role client is used anyway because it passes `cache: 'no-store'` on
 * every request (CLAUDE.md rule #22): Next.js patches global `fetch` and caches
 * GET responses, and a cached nexus list on the screen whose job is editing the
 * nexus list is a wrong answer. Both reads are of AFS's own configuration, not of
 * any customer's data.
 */
export const dynamic = 'force-dynamic';

export default async function TaxNexusPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const admin = createAdminClient();
  const [states, review] = await Promise.all([
    getNexusStates(admin),
    getTaxCalculationsNeedingReview(admin),
  ]);

  // "Today" is resolved on the server in the shop's own time zone, so the default
  // start date for a new state is the shop's date and not the browser's —
  // CLAUDE.md rule #24's reasoning, applied to a nexus window.
  const today = shopDateOnly(new Date());
  const config = resolveTaxConfigFromEnv();
  const summary = summariseTaxConfig(config, process.env, states, today);

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
          <h1 className="font-heading text-3xl text-afs-ink-900 mt-2">Sales tax nexus</h1>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            The states where AFS has to collect sales tax, and why. Only you see this — customers
            never do.
          </p>
        </div>

        <TaxNexusEditor states={states} review={review} summary={summary} today={today} />
      </div>
    </LightWorkingArea>
  );
}
