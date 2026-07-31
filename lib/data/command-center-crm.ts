import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCustomersList, type CustomerListRow } from '@/lib/data/customers';

// ── Customers tab ────────────────────────────────────────────────────────
// The Customers tab searches client-side over the full list (per spec:
// "Search input filters by name, company, or email (client-side filter on
// fetched data)"), so this just calls the existing admin-customers query
// with no filters applied rather than duplicating its aggregation logic.
export async function getCrmCustomers(supabase: SupabaseClient): Promise<CustomerListRow[]> {
  return getCustomersList(supabase, { search: '', role: 'all', tier: 'all' });
}

// ── Orders (CRM) tab ─────────────────────────────────────────────────────
export interface CrmOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCompany: string | null;
  status: string;
  isRush: boolean;
  deliveryMethod: 'ship' | 'pickup';
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  deliveryScheduledAt: string | null;
  deliveryWindow: string | null;
  trackingToken: string | null;
  total: number;
  createdAt: string;
}

interface CrmOrderSource {
  id: string;
  order_number: string;
  status: string;
  is_rush: boolean;
  delivery_method: 'ship' | 'pickup';
  assigned_driver_id: string | null;
  delivery_scheduled_at: string | null;
  delivery_window: string | null;
  tracking_token: string | null;
  total: number;
  created_at: string;
  user_id: string;
}

/**
 * "Delivery Date" in the CRM spec maps to the existing orders.delivery_scheduled_at
 * column (SCHEMA.md TABLE 18) — there is no separate `delivery_date` column
 * anywhere in the schema, and this is the only field with matching meaning.
 * delivery_method/delivery_window are selected so OrdersCrmTab can tell a
 * pickup order apart from a ship order (PICKUP_SCHEDULING_SCOPE.md item 3) —
 * previously this tab showed the same Assign Driver/Dispatch controls for both.
 */
export async function getCrmOrders(supabase: SupabaseClient): Promise<CrmOrderRow[]> {
  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, is_rush, delivery_method, assigned_driver_id, delivery_scheduled_at, delivery_window, tracking_token, total, created_at, user_id'
    )
    .order('created_at', { ascending: false });

  const orders = (data ?? []) as CrmOrderSource[];
  if (orders.length === 0) return [];

  const userIds = Array.from(new Set(orders.map((o) => o.user_id)));
  const driverIds = Array.from(new Set(orders.map((o) => o.assigned_driver_id).filter(Boolean))) as string[];
  const profileIds = Array.from(new Set([...userIds, ...driverIds]));

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, full_name, company')
    .in('id', profileIds);
  const profileById = new Map(
    ((profileRows ?? []) as { id: string; full_name: string; company: string | null }[]).map((p) => [p.id, p])
  );

  return orders.map((o) => {
    const customer = profileById.get(o.user_id);
    const driver = o.assigned_driver_id ? profileById.get(o.assigned_driver_id) : undefined;
    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: customer?.full_name ?? 'Unknown',
      customerCompany: customer?.company ?? null,
      status: o.status,
      isRush: o.is_rush,
      deliveryMethod: o.delivery_method,
      assignedDriverId: o.assigned_driver_id,
      assignedDriverName: driver?.full_name ?? null,
      deliveryScheduledAt: o.delivery_scheduled_at,
      deliveryWindow: o.delivery_window,
      trackingToken: o.tracking_token,
      total: o.total,
      createdAt: o.created_at,
    };
  });
}

export interface OperatorRow {
  id: string;
  fullName: string;
}

/** Drivers for the Assign Driver dropdown — real profiles with role = 'operator', not hardcoded names. */
export async function getOperators(supabase: SupabaseClient): Promise<OperatorRow[]> {
  const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'operator').order('full_name');
  return ((data ?? []) as { id: string; full_name: string }[]).map((p) => ({ id: p.id, fullName: p.full_name }));
}

// ── Invoices tab ─────────────────────────────────────────────────────────
export type CrmInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface CrmInvoiceRow {
  id: string; // order id — invoices are derived 1:1 from orders, see lib/data/invoices.ts
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  status: CrmInvoiceStatus;
  date: string;
  dueDate: string | null;
}

interface CrmInvoiceOrderSource {
  id: string;
  order_number: string;
  total: number;
  payment_method: string | null;
  net_terms: number;
  created_at: string;
  user_id: string;
  invoice_paid_at: string | null;
}

/**
 * Admin-wide counterpart to lib/data/invoices.ts's getInvoiceRows (which is
 * scoped to a single customer via .eq('user_id', userId)). Status here maps
 * onto the CRM spec's draft/sent/paid/overdue badges using real signals —
 * there's no separate `invoices` table (see lib/data/invoices.ts's own
 * header comment):
 *   - invoice_paid_at set  → 'paid' (unconditional manual override, see 009 migration)
 *   - net-terms and past its due date → 'overdue'
 *   - delivery_notifications.invoice_sent → 'sent' (the dispatch flow already
 *     emails a real invoice PDF — app/api/orders/[id]/dispatch/route.ts)
 *   - otherwise → 'draft' (invoice not yet emailed to the customer)
 */
export async function getCrmInvoices(supabase: SupabaseClient): Promise<CrmInvoiceRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, total, payment_method, net_terms, created_at, user_id, invoice_paid_at')
    .order('created_at', { ascending: false });

  const orders = (data ?? []) as CrmInvoiceOrderSource[];
  if (orders.length === 0) return [];

  const userIds = Array.from(new Set(orders.map((o) => o.user_id)));
  const orderIds = orders.map((o) => o.id);

  const [{ data: profileRows }, { data: notifRows }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, company').in('id', userIds),
    supabase.from('delivery_notifications').select('order_id, invoice_sent').in('order_id', orderIds),
  ]);

  const profileById = new Map(
    ((profileRows ?? []) as { id: string; full_name: string; company: string | null }[]).map((p) => [p.id, p])
  );
  const invoiceSentByOrder = new Map(
    ((notifRows ?? []) as { order_id: string; invoice_sent: boolean }[]).map((n) => [n.order_id, n.invoice_sent])
  );

  return orders.map((o) => {
    let status: CrmInvoiceStatus;
    let dueDate: string | null = null;

    if (o.invoice_paid_at) {
      status = 'paid';
    } else if (o.payment_method === 'net_terms' && o.net_terms > 0) {
      const due = new Date(o.created_at);
      due.setDate(due.getDate() + o.net_terms);
      dueDate = due.toISOString();
      status = Date.now() > due.getTime() ? 'overdue' : invoiceSentByOrder.get(o.id) ? 'sent' : 'draft';
    } else {
      status = invoiceSentByOrder.get(o.id) ? 'sent' : 'draft';
    }

    const customer = profileById.get(o.user_id);
    return {
      id: o.id,
      invoiceNumber: o.order_number.replace('AFS-', 'AFS-INV-'),
      orderId: o.id,
      orderNumber: o.order_number,
      customerName: customer?.full_name ?? 'Unknown',
      amount: o.total,
      status,
      date: o.created_at,
      dueDate,
    };
  });
}

export const CRM_INVOICE_STATUS_LABEL: Record<CrmInvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

// ── GBP Photos tab ───────────────────────────────────────────────────────
export type GbpPhotoStatus = 'pending_review' | 'approved' | 'rejected' | 'posted';

export interface GbpPhotoRow {
  id: string;
  storageKey: string;
  signedUrl: string | null;
  caption: string | null;
  queuedByName: string | null;
  queuedAt: string;
  status: GbpPhotoStatus;
}

interface GbpPhotoSource {
  id: string;
  storage_key: string;
  caption: string | null;
  status: GbpPhotoStatus;
  queued_at: string;
  queued_by: string | null;
}

/**
 * No app code populates gbp_photo_queue yet — it's fed by the (not-yet-built,
 * out of scope for this task) Employee PWA per SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md
 * §3/§5. This returns an empty array gracefully until that exists. Uses the
 * admin/service-role client for signed URLs since the storage bucket
 * ('gbp-photos') isn't provisioned yet either — createSignedUrl simply
 * returns null on a missing object/bucket rather than throwing, matching
 * the same graceful-fallback pattern PreShipPhotoSection.tsx already uses.
 */
export async function getGbpPhotos(supabase: SupabaseClient): Promise<GbpPhotoRow[]> {
  const { data } = await supabase
    .from('gbp_photo_queue')
    .select('id, storage_key, caption, status, queued_at, queued_by')
    .order('queued_at', { ascending: false });

  const rows = (data ?? []) as GbpPhotoSource[];
  if (rows.length === 0) return [];

  const queuedByIds = Array.from(new Set(rows.map((r) => r.queued_by).filter(Boolean))) as string[];
  const { data: profileRows } =
    queuedByIds.length > 0 ? await supabase.from('profiles').select('id, full_name').in('id', queuedByIds) : { data: [] };
  const nameById = new Map(((profileRows ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  const admin = createAdminClient();
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage.from('gbp-photos').createSignedUrl(row.storage_key, 900);
      return {
        id: row.id,
        storageKey: row.storage_key,
        signedUrl: signed?.signedUrl ?? null,
        caption: row.caption,
        queuedByName: row.queued_by ? (nameById.get(row.queued_by) ?? null) : null,
        queuedAt: row.queued_at,
        status: row.status,
      };
    })
  );
}
