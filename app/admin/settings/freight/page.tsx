import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { toEffectiveDate } from '@/lib/freight/bands';
import { getFreightRateTable } from '@/lib/freight/db';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import FreightRateEditor from '@/components/admin/FreightRateEditor';

/**
 * SETTINGS → FREIGHT RATES.
 *
 * Gunmetal header, light working area (CLAUDE.md rule #18) — this page opts in
 * by wrapping itself in `LightWorkingArea`, the same way the Workbench, the Job
 * screen and Settings → Price book do. The shell does not decide from the
 * pathname.
 *
 * Rendered fresh on every visit: these rates are what freight estimates are
 * built from, and a cached table could show an admin a rate they have already
 * changed.
 *
 * A read failure that means "migration 039 has not been applied" is NOT an
 * error here — it is the state of every deployment today, and the editor renders
 * a sentence explaining it. Any OTHER read failure propagates to the section's
 * error boundary (CLAUDE.md rule #30), because "the rates are missing" and "the
 * database refused us" must not look the same.
 */
export const dynamic = 'force-dynamic';

export default async function FreightRatesPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // "Today" is resolved on the server and passed down, so the default start
  // date for a new rate is the shop's date and not the browser's.
  const today = toEffectiveDate(new Date());
  const result = await getFreightRateTable(supabase, today);

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
          <h1 className="font-heading text-3xl text-afs-ink-900 mt-2">Freight rates</h1>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            What it costs to get a job to each place you deliver, by weight. Only you see this —
            customers see one freight line on their formal quote and nothing behind it.
          </p>
        </div>

        <FreightRateEditor
          table={result.installed ? result.table : null}
          notInstalledReason={result.installed ? null : result.reason}
          today={today}
        />
      </div>
    </LightWorkingArea>
  );
}
