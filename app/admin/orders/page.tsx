import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import QuoteOrderList from '@/components/admin/QuoteOrderList';
import { getQuoteOrderRows } from '@/lib/data/quote-order-rows';
import { applyListQuery, parseListQuery, type ListRow } from '@/lib/data/quote-order-list';

export const dynamic = 'force-dynamic';

/**
 * ORDERS — v7 `pageList('orders')` (prototype line 1732).
 *
 * Everything the customer has approved: waiting for the machine, in the shop,
 * and delivered. Quotes that are still unpriced or unapproved live on
 * /admin/quotes; v7 never merges the two.
 *
 * This REPLACED the old production-queue view, which filtered `orders` by
 * fabrication status (In Queue / Cutting / Forming / QC / Ready / Shipped) and
 * had no search, no date range and a different sort vocabulary. That screen's
 * job is the shop's, and it still exists as Shop View — the Orders nav item in
 * v7 is an office list, which is what this is. The production queue components
 * (`ProductionQueueTable`, `ProductionQueueRealtime`) are untouched and still
 * used by Shop View.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string; range?: string; sort?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const query = parseListQuery(searchParams, 'orders');
  const all = await getQuoteOrderRows(supabase);
  const rows = applyListQuery(all, 'orders', query);

  return (
    <LightWorkingArea>
      <QuoteOrderList
        kind="orders"
        title="Orders"
        blurb="Everything the customer has approved: waiting for the machine, in the shop, and delivered."
        query={query}
        rows={rows}
        rowHref={(row: ListRow) => `/admin/command-center/job/${row.id}`}
      />
    </LightWorkingArea>
  );
}
