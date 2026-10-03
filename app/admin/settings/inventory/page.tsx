import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import {
  NOT_PROVISIONED_MESSAGE,
  getInventoryItems,
  getInventoryVocabulary,
  type InventoryItemRow,
  type MaterialOption,
} from '@/lib/data/inventory';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import InventoryManager from '@/components/admin/InventoryManager';

/**
 * SETTINGS → SHOP MATERIAL INVENTORY.
 *
 * Linked from the "Inventory / Stock Status" section of `/admin/settings`,
 * which is where `specs/SPEC_LIVE_INVENTORY.md` §3 puts stock management. It is
 * a sub-page rather than a section for the same reason `/admin/settings/
 * price-book` is: it is a screen's worth of work, not a panel.
 *
 * Gunmetal header, light working area (CLAUDE.md rule #18) — the page opts in
 * by wrapping itself in `LightWorkingArea`, exactly as the price book does. The
 * shell does not decide from the pathname.
 *
 * Rendered fresh on every visit. A cached page would show a quantity somebody
 * has already adjusted, and on a screen whose whole job is being the record of
 * what is really in the shop, a stale number is a wrong one.
 */
export const dynamic = 'force-dynamic';

/**
 * SPEC_LIVE_INVENTORY.md's §2/§3 stock SIGNAL — the three-value
 * `products.stock_type` a customer sees as a coloured dot — is a different
 * thing, lives on `/admin/settings` itself, and is already built. This screen
 * is the AFS-internal quantity record the spec defers to its §4. Both are
 * reachable from the same Settings section, and neither shows a customer a
 * number.
 */
export default async function ShopInventoryPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const [itemsLoad, vocabularyLoad] = await Promise.all([
    getInventoryItems(supabase),
    getInventoryVocabulary(supabase),
  ]);

  // THE STATE THIS DEPLOYMENT IS REALLY IN, and it is designed for rather than
  // discovered: migration 039 is written but deliberately not applied, so
  // PostgREST answers 42P01 and `getInventoryItems` reports `not_provisioned`.
  // An empty table here would say "nothing is being tracked yet", which is a
  // different and wrong statement — it would send somebody looking for stock
  // rows that cannot exist instead of telling them the migration has not run.
  const notProvisioned = itemsLoad.state === 'not_provisioned';
  const failed = itemsLoad.state === 'error' ? itemsLoad.message : null;

  const items: InventoryItemRow[] = itemsLoad.state === 'ready' ? itemsLoad.rows : [];
  const materials: MaterialOption[] = vocabularyLoad.state === 'ready' ? vocabularyLoad.rows : [];

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
          <h1 className="font-heading text-3xl text-afs-ink-900 mt-2">Shop material inventory</h1>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            What is on the floor, what is promised to a job, and what is running low. Only you see this.
          </p>
        </div>

        {notProvisioned ? (
          <section
            data-testid="inventory-not-provisioned"
            className="bg-afs-bg-card border border-afs-border-light rounded-xl p-8"
          >
            <h2 className="font-heading text-xl text-afs-ink-900 mb-2">
              The database part of this is not switched on yet
            </h2>
            <p className="font-body text-[15px] text-afs-ink-900 mb-3">
              Nothing is broken and nothing has been lost — the two tables this screen reads have not been created in
              this database yet, so there is nothing for it to show.
            </p>
            <p className="font-body text-[15px] text-afs-ink-700 mb-3">{NOT_PROVISIONED_MESSAGE}</p>
            <p className="font-body text-[15px] text-afs-ink-700">
              Until then this screen stays read-only and no quantity is invented to fill the space. The customer-facing
              stock signal on{' '}
              <Link href="/admin/settings" className="underline text-afs-ink-900 hover:text-afs-ink-700">
                Settings
              </Link>{' '}
              is a separate thing and is unaffected.
            </p>
          </section>
        ) : failed ? (
          <section data-testid="inventory-error" className="bg-afs-bg-card border border-afs-border-light rounded-xl p-8">
            <h2 className="font-heading text-xl text-afs-ink-900 mb-2">The inventory could not be read</h2>
            <p className="font-body text-[15px] text-afs-ink-900 mb-3">{failed}</p>
            <p className="font-body text-[15px] text-afs-ink-700">
              Nothing was changed and nothing was lost. Reload the page; if it keeps happening, the database is not
              answering and this is worth reporting rather than retrying.
            </p>
          </section>
        ) : (
          <InventoryManager initialItems={items} materials={materials} />
        )}
      </div>
    </LightWorkingArea>
  );
}
