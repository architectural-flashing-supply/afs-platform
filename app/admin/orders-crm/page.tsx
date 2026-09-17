import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCrmOrders, getOperators, getCrmInvoices } from '@/lib/data/command-center-crm';
import OrdersCrmTab from '@/components/admin/OrdersCrmTab';

/**
 * Phase 2 (Command Center redesign, afs-cc-001) — promoted from
 * app/admin/command-center's old `?tab=orders` CRM tab so "Orders" can be
 * its own first-class nav destination (AdminShell/AdminTopBar), distinct
 * from "Production Queue" (/admin/orders — fabrication-stage tracking of
 * the same `orders` table, a different view built for a different job).
 * Route is `/admin/orders-crm` rather than `/admin/orders` because that
 * path was already taken by the production queue page before this pass —
 * renaming it would have meant re-pointing every existing link/notification
 * that already points there, which this pass's scope doesn't call for.
 */
export default async function AdminOrdersCrmPage({ searchParams }: { searchParams: { view?: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const [orders, operators, invoices] = await Promise.all([
    getCrmOrders(supabase),
    getOperators(supabase),
    getCrmInvoices(supabase),
  ]);

  const initialView = searchParams.view === 'invoices' ? 'invoices' : 'orders';

  return (
    <div>
      <div className="mb-8">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">Orders</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">Customer orders, dispatch, and invoicing in one place.</p>
      </div>

      <OrdersCrmTab orders={orders} operators={operators} invoices={invoices} initialView={initialView} />
    </div>
  );
}
