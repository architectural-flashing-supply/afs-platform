import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import QuoteOrderList from '@/components/admin/QuoteOrderList';
import { getQuoteOrderRows } from '@/lib/data/quote-order-rows';
import { applyListQuery, parseListQuery, type ListRow } from '@/lib/data/quote-order-list';

export const dynamic = 'force-dynamic';

/**
 * QUOTES — v7 `pageList('quotes')` (prototype line 1732).
 *
 * Quotes only: the `new` and `quoted` stages. Everything the customer has
 * already approved lives on /admin/orders, which v7 keeps deliberately
 * separate.
 *
 * Auth follows the existing admin pattern exactly: `requireAdminUser` on the
 * server, which redirects anyone who is not `role='admin'`. The viewer's
 * identity comes from the session — never from a query string or a body.
 */
export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string; range?: string; sort?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const query = parseListQuery(searchParams, 'quotes');
  const all = await getQuoteOrderRows(supabase);
  const rows = applyListQuery(all, 'quotes', query);

  return (
    <LightWorkingArea>
      <QuoteOrderList
        kind="quotes"
        title="Quotes"
        blurb="Every quote that still needs a price or is waiting on the customer. Revised quotes show here too."
        query={query}
        rows={rows}
        rowHref={(row: ListRow) => `/admin/command-center/job/${row.id}`}
      />
    </LightWorkingArea>
  );
}
