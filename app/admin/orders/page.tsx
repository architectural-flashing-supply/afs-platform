import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import V7List from '@/components/admin/v7/V7List';
import { getQuoteOrderRows } from '@/lib/data/quote-order-rows';
import { applyListQuery, parseListQuery } from '@/lib/data/quote-order-list';
import { isFixtureMode, type SearchParamValue } from '@/lib/fixtures/mode';
import { fixtureList } from '@/lib/data/v7-view/from-fixture';
import { liveList } from '@/lib/data/v7-view/from-live-lists';

export const dynamic = 'force-dynamic';

/**
 * ORDERS — v7 `pageList('orders')` (prototype line 1745).
 *
 * Everything the customer has approved: waiting for the machine, in the shop,
 * and delivered. Quotes that are still unpriced or unapproved live on
 * /admin/quotes; v7 never merges the two.
 *
 * This REPLACED the old production-queue view, which filtered `orders` by
 * fabrication status and had no search, no date range and a different sort
 * vocabulary. That screen's job is the shop's, and it still exists as Shop
 * View — the Orders nav item in v7 is an office list, which is what this is.
 * `ProductionQueueTable` and `ProductionQueueRealtime` are untouched.
 *
 * The screen is now `components/admin/v7/V7List.tsx`, a transliteration of v7's
 * own markup, shared with Orders exactly as v7 shares one `pageList(kind)`
 * between them. The query layer below is UNCHANGED — `parseListQuery` and
 * `applyListQuery` are the same pure, unit-tested functions they were.
 *
 * Auth follows the existing admin pattern exactly: `requireAdminUser` on the
 * server, which redirects anyone who is not `role='admin'`. The viewer's
 * identity comes from the session — never from a query string or a body.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string; range?: string; sort?: string } & Record<
    string,
    SearchParamValue
  >;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const query = parseListQuery(searchParams, 'orders');

  if (isFixtureMode(searchParams)) {
    return (
      <LightWorkingArea>
        <V7List view={fixtureList('orders', query)} />
      </LightWorkingArea>
    );
  }

  const all = await getQuoteOrderRows(supabase);
  const rows = applyListQuery(all, 'orders', query);

  return (
    <LightWorkingArea>
      <V7List view={liveList('orders', query, rows)} />
    </LightWorkingArea>
  );
}
