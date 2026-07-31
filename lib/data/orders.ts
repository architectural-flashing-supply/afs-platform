import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_STAGES,
  POST_PRODUCTION_STATUSES,
  stageIndex,
  type OrderStageKey,
} from '@/lib/admin/orderStages';

export interface DeliveryAddressInput {
  address: string;
  residential: boolean;
}

export interface CreateOrderFromQuoteInput {
  quoteId: string;
  userId: string;
  paymentMethod: 'card' | 'net_terms';
  netTerms: number;
  deliveryMethod: 'ship' | 'pickup';
  deliveryAddress: DeliveryAddressInput | null;
  contactName: string | null;
  contactPhone: string | null;
  poNumber: string | null;
  stripePaymentIntentId: string | null;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
}

interface QuoteSource {
  id: string;
  user_id: string;
  subtotal: number;
  freight: number | null;
  rush_surcharge: number;
  tax: number | null;
  total: number;
}

interface QuoteLineItemSource {
  product_id: string | null;
  finish_id: string | null;
  description: string;
  width_in: number | null;
  height_in: number | null;
  leg_a_in: number | null;
  leg_b_in: number | null;
  length_ft: number;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

async function generateOrderNumber(admin: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AFS-${year}-`;

  const { data } = await admin
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1);

  const last = data?.[0]?.order_number as string | undefined;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Shared by the Stripe webhook (card payment_intent.succeeded), the net-terms
 * checkout path, and the client-side confirm-order fallback — all convert an
 * AFS-approved quote into an order the same way. The webhook and confirm-order
 * fallback can run concurrently for the same quote (see
 * ORDER_LIFECYCLE_DECISION.md), so the SELECT-then-INSERT below is not by
 * itself race-safe — the real guard is the DB-level UNIQUE constraint on
 * orders.quote_id (011_orders_quote_id_unique.sql). If two calls both pass
 * the SELECT and both attempt the INSERT, the loser gets a Postgres
 * unique-violation (23505), which is caught below and turned into a re-query
 * for the winner's row so every caller still returns the same order.
 */
export async function createOrderFromQuote(
  admin: SupabaseClient,
  input: CreateOrderFromQuoteInput
): Promise<CreatedOrder | null> {
  const { data: existing } = await admin
    .from('orders')
    .select('id, order_number')
    .eq('quote_id', input.quoteId)
    .maybeSingle();
  if (existing) {
    return { orderId: existing.id as string, orderNumber: existing.order_number as string };
  }

  const { data: quoteRaw } = await admin
    .from('quotes')
    .select('id, user_id, subtotal, freight, rush_surcharge, tax, total')
    .eq('id', input.quoteId)
    .maybeSingle();
  if (!quoteRaw) return null;
  const quote = quoteRaw as QuoteSource;

  const { data: lineItemsRaw } = await admin
    .from('quote_line_items')
    .select(
      'product_id, finish_id, description, width_in, height_in, leg_a_in, leg_b_in, length_ft, quantity, unit, unit_price, line_total, sort_order'
    )
    .eq('quote_id', input.quoteId)
    .order('sort_order', { ascending: true });
  const lineItems = (lineItemsRaw ?? []) as QuoteLineItemSource[];

  const orderId = crypto.randomUUID();
  const orderNumber = await generateOrderNumber(admin);

  const deliveryAddress =
    input.deliveryMethod === 'ship' && input.deliveryAddress
      ? { address: input.deliveryAddress.address, residential: input.deliveryAddress.residential }
      : input.deliveryMethod === 'pickup'
      ? { contactName: input.contactName, contactPhone: input.contactPhone }
      : null;

  const { error: orderError } = await admin.from('orders').insert({
    id: orderId,
    order_number: orderNumber,
    quote_id: quote.id,
    user_id: quote.user_id,
    status: 'submitted',
    subtotal: quote.subtotal,
    freight: quote.freight,
    tax: quote.tax,
    rush_surcharge: quote.rush_surcharge,
    deposit_amount: 0,
    deposit_paid: input.paymentMethod === 'card',
    total: quote.total,
    payment_method: input.paymentMethod,
    net_terms: input.paymentMethod === 'net_terms' ? input.netTerms : 0,
    po_number: input.poNumber,
    delivery_method: input.deliveryMethod,
    delivery_address: deliveryAddress,
    stripe_payment_intent_id: input.stripePaymentIntentId,
  });
  if (orderError) {
    // 23505 = Postgres unique_violation. A concurrent caller (webhook vs.
    // confirm-order fallback) won the race on orders_quote_id_unique — its
    // insert committed first, so return its row instead of erroring out.
    if (orderError.code === '23505') {
      const { data: winner } = await admin
        .from('orders')
        .select('id, order_number')
        .eq('quote_id', input.quoteId)
        .maybeSingle();
      if (winner) {
        return { orderId: winner.id as string, orderNumber: winner.order_number as string };
      }
    }
    throw orderError;
  }

  if (lineItems.length > 0) {
    const orderLineItems = lineItems.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      finish_id: item.finish_id,
      description: item.description,
      width_in: item.width_in,
      height_in: item.height_in,
      leg_a_in: item.leg_a_in,
      leg_b_in: item.leg_b_in,
      length_ft: item.length_ft,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      line_total: item.line_total,
      sort_order: item.sort_order,
    }));
    const { error: lineItemsError } = await admin.from('order_line_items').insert(orderLineItems);
    if (lineItemsError) throw lineItemsError;
  }

  await admin.from('quotes').update({ status: 'converted' }).eq('id', quote.id);

  await admin.from('order_status_history').insert({
    order_id: orderId,
    status: 'submitted',
    note: input.paymentMethod === 'card' ? 'Payment confirmed' : 'Order placed on Net Terms',
  });

  return { orderId, orderNumber };
}

// ---------------------------------------------------------------------------
// Production queue (SPEC_PRODUCTION_QUEUE.md)
// ---------------------------------------------------------------------------

export type ProductionQueueFilter = 'all' | 'rush' | OrderStageKey;

/**
 * "all"/"rush" match every fabrication stage PLUS the three Employee PWA /
 * delivery-tracking statuses (PRODUCTION_QUEUE_AUDIT.md §2a) — without this,
 * an order that reached in_production/packaged/out_for_delivery vanished
 * from every tab and every count in the admin production queue, with no
 * filter tab that could ever show it again. Individual stage tabs are
 * unaffected — they still filter to exactly one ORDER_STAGES key.
 */
const QUEUE_VISIBLE_STATUSES: string[] = [...ACTIVE_ORDER_STATUSES, ...POST_PRODUCTION_STATUSES];

export type ProductionQueueSort = 'default' | 'expected' | 'status';

export interface ProductionQueueRow {
  id: string;
  orderNumber: string;
  customerName: string;
  profileSummary: string;
  createdAt: string;
  expectedShipDate: string | null;
  isRush: boolean;
  status: string;
}

interface OrderLineItemDescriptionSource {
  description: string;
}

interface ProductionQueueSource {
  id: string;
  order_number: string;
  created_at: string;
  delivery_scheduled_at: string | null;
  is_rush: boolean;
  status: string;
  profiles: { full_name: string; company: string | null } | null;
  order_line_items: OrderLineItemDescriptionSource[] | null;
}

function summarizeOrderLineItems(items: OrderLineItemDescriptionSource[] | null): string {
  if (!items || items.length === 0) return 'Custom specification';
  const first = items[0]?.description ?? 'Item';
  if (items.length === 1) return first;
  return `${first} + ${items.length - 1} more`;
}

/**
 * Rush orders always sort first, then oldest-created within each group
 * (SPEC_PRODUCTION_QUEUE.md §3) — this is the DB-level default order and what
 * `sort: 'default'` returns unchanged. "expected"/"status" (SPEC §1's
 * SortControls) re-sort that same result set in JS rather than via SQL —
 * "status" needs the ORDER_STAGES fabrication sequence, not alphabetical
 * order, which isn't expressible as a plain `ORDER BY`, and queue row counts
 * are small enough that sorting in memory is simpler than two more SQL
 * shapes. "all" and stage tabs exclude delivered orders — a delivered order
 * has left the production queue by definition.
 */
export async function getProductionQueue(
  supabase: SupabaseClient,
  filter: ProductionQueueFilter,
  sort: ProductionQueueSort = 'default'
): Promise<ProductionQueueRow[]> {
  let query = supabase
    .from('orders')
    .select(
      'id, order_number, created_at, delivery_scheduled_at, is_rush, status, profiles(full_name, company), order_line_items(description)'
    )
    .order('is_rush', { ascending: false })
    .order('created_at', { ascending: true });

  if (filter === 'rush') {
    query = query.eq('is_rush', true).in('status', QUEUE_VISIBLE_STATUSES);
  } else if (filter === 'all') {
    query = query.in('status', QUEUE_VISIBLE_STATUSES);
  } else {
    query = query.eq('status', filter);
  }

  const { data } = await query;

  const rows: ProductionQueueRow[] = ((data ?? []) as unknown as ProductionQueueSource[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.profiles?.company || row.profiles?.full_name || 'Unknown',
    profileSummary: summarizeOrderLineItems(row.order_line_items),
    createdAt: row.created_at,
    expectedShipDate: row.delivery_scheduled_at,
    isRush: row.is_rush,
    status: row.status,
  }));

  if (sort === 'expected') {
    return [...rows].sort((a, b) => {
      if (!a.expectedShipDate && !b.expectedShipDate) return 0;
      if (!a.expectedShipDate) return 1;
      if (!b.expectedShipDate) return -1;
      return new Date(a.expectedShipDate).getTime() - new Date(b.expectedShipDate).getTime();
    });
  }
  if (sort === 'status') {
    return [...rows].sort((a, b) => stageIndex(a.status) - stageIndex(b.status));
  }
  return rows;
}

// Employee PWA statuses (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §3) —
// widened onto orders.status by supabase/migrations/007_delivery_tracking.sql
// §6a, deliberately not part of OrderStageKey/ORDER_STAGES (see that
// migration's own comment: reconciling in_production with the existing
// granular admin stages is out of scope here).
const EMPLOYEE_QUEUE_STATUSES = ['in_production', 'ready', 'packaged', 'out_for_delivery'] as const;

/**
 * orders has no operator SELECT RLS policy (only order-owner and admin —
 * see 007_delivery_tracking.sql §1's comment), so this must be called with
 * the service-role client, matching every other operator-facing read in
 * this codebase (app/api/driver/location, app/api/orders/[id]/dispatch).
 * `driverId` matches an order either assigned to this driver or unassigned —
 * per SPEC §3 Screen 2, Steve and Christian share an unclaimed queue.
 */
export async function getEmployeeOrderQueue(admin: SupabaseClient, driverId: string): Promise<ProductionQueueRow[]> {
  const { data } = await admin
    .from('orders')
    .select(
      'id, order_number, created_at, delivery_scheduled_at, is_rush, status, profiles(full_name, company), order_line_items(description)'
    )
    .in('status', EMPLOYEE_QUEUE_STATUSES)
    .or(`assigned_driver_id.eq.${driverId},assigned_driver_id.is.null`)
    .order('is_rush', { ascending: false })
    .order('created_at', { ascending: true });

  return ((data ?? []) as unknown as ProductionQueueSource[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.profiles?.company || row.profiles?.full_name || 'Unknown',
    profileSummary: summarizeOrderLineItems(row.order_line_items),
    createdAt: row.created_at,
    expectedShipDate: row.delivery_scheduled_at,
    isRush: row.is_rush,
    status: row.status,
  }));
}

/**
 * `delivered` is intentionally absent at runtime — a delivered order has
 * left the production queue by definition, so getProductionQueueCounts()
 * below never queries for it. Making it optional here (rather than a
 * required `number`, as this type previously claimed) matches that: nothing
 * reads `counts.delivered` today since there's no "Delivered" tab, but the
 * type no longer lies about a value that was actually `undefined` at
 * runtime (PRODUCTION_QUEUE_AUDIT.md §2i).
 */
export type ProductionQueueCounts = Partial<Record<OrderStageKey, number>> & { all: number; rush: number };

export async function getProductionQueueCounts(supabase: SupabaseClient): Promise<ProductionQueueCounts> {
  const { data } = await supabase.from('orders').select('status, is_rush').in('status', QUEUE_VISIBLE_STATUSES);
  const rows = (data ?? []) as { status: string; is_rush: boolean }[];

  const counts = {
    all: rows.length,
    rush: rows.filter((r) => r.is_rush).length,
  } as ProductionQueueCounts;

  for (const stage of ORDER_STAGES) {
    if (stage.key === 'delivered') continue;
    counts[stage.key] = rows.filter((r) => r.status === stage.key).length;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Admin order detail (SPEC_PRODUCTION_QUEUE.md §2)
// ---------------------------------------------------------------------------

export interface AdminOrderLineItem {
  id: string;
  description: string;
  widthIn: number | null;
  heightIn: number | null;
  legAIn: number | null;
  legBIn: number | null;
  lengthFt: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrderNote {
  text: string;
  author: string;
  at: string;
}

export interface AdminOrderAttachment {
  id: string;
  filename: string;
  attachmentType: string;
  isVisibleToCustomer: boolean;
  createdAt: string;
  signedUrl: string | null;
}

export interface AdminOrderStatusHistoryRow {
  id: string;
  status: string;
  changedByName: string | null;
  note: string | null;
  createdAt: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  isRush: boolean;
  createdAt: string;
  subtotal: number;
  freight: number | null;
  tax: number | null;
  rushSurcharge: number;
  total: number;
  paymentMethod: string | null;
  netTerms: number;
  poNumber: string | null;
  deliveryMethod: string;
  deliveryAddress: Record<string, unknown> | null;
  deliveryScheduledAt: string | null;
  deliveryWindow: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  notes: string | null;
  adminNotes: AdminOrderNote[];
  stripePaymentIntentId: string | null;
  quoteId: string;
  quoteNumber: string | null;
  customer: { id: string; fullName: string; company: string | null; email: string; phone: string | null } | null;
  lineItems: AdminOrderLineItem[];
}

interface AdminOrderDetailSource {
  id: string;
  order_number: string;
  status: string;
  is_rush: boolean;
  created_at: string;
  subtotal: number;
  freight: number | null;
  tax: number | null;
  rush_surcharge: number;
  total: number;
  payment_method: string | null;
  net_terms: number;
  po_number: string | null;
  delivery_method: string;
  delivery_address: Record<string, unknown> | null;
  delivery_scheduled_at: string | null;
  delivery_window: string | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  admin_notes: string | null;
  stripe_payment_intent_id: string | null;
  quote_id: string;
  quotes: { quote_number: string } | null;
  profiles: { id: string; full_name: string; company: string | null; email: string; phone: string | null } | null;
}

export function parseAdminNotes(raw: string | null): AdminOrderNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AdminOrderNote[];
    return [];
  } catch {
    // Legacy/manual value that predates the structured note format.
    return [{ text: raw, author: 'Unknown', at: '' }];
  }
}

export async function getAdminOrderDetail(supabase: SupabaseClient, orderId: string): Promise<AdminOrderDetail | null> {
  const { data: orderRaw } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, is_rush, created_at, subtotal, freight, tax, rush_surcharge, total,
       payment_method, net_terms, po_number, delivery_method, delivery_address, delivery_scheduled_at,
       delivery_window, tracking_number, carrier, notes, admin_notes, stripe_payment_intent_id, quote_id,
       quotes(quote_number), profiles(id, full_name, company, email, phone)`
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!orderRaw) return null;
  const order = orderRaw as unknown as AdminOrderDetailSource;

  const { data: lineItemsRaw } = await supabase
    .from('order_line_items')
    .select('id, description, width_in, height_in, leg_a_in, leg_b_in, length_ft, quantity, unit, unit_price, line_total')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    isRush: order.is_rush,
    createdAt: order.created_at,
    subtotal: order.subtotal,
    freight: order.freight,
    tax: order.tax,
    rushSurcharge: order.rush_surcharge,
    total: order.total,
    paymentMethod: order.payment_method,
    netTerms: order.net_terms,
    poNumber: order.po_number,
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address,
    deliveryScheduledAt: order.delivery_scheduled_at,
    deliveryWindow: order.delivery_window,
    trackingNumber: order.tracking_number,
    carrier: order.carrier,
    notes: order.notes,
    adminNotes: parseAdminNotes(order.admin_notes),
    stripePaymentIntentId: order.stripe_payment_intent_id,
    quoteId: order.quote_id,
    quoteNumber: order.quotes?.quote_number ?? null,
    customer: order.profiles
      ? {
          id: order.profiles.id,
          fullName: order.profiles.full_name,
          company: order.profiles.company,
          email: order.profiles.email,
          phone: order.profiles.phone,
        }
      : null,
    lineItems: ((lineItemsRaw ?? []) as unknown[]).map((raw) => {
      const item = raw as {
        id: string;
        description: string;
        width_in: number | null;
        height_in: number | null;
        leg_a_in: number | null;
        leg_b_in: number | null;
        length_ft: number;
        quantity: number;
        unit: string;
        unit_price: number;
        line_total: number;
      };
      return {
        id: item.id,
        description: item.description,
        widthIn: item.width_in,
        heightIn: item.height_in,
        legAIn: item.leg_a_in,
        legBIn: item.leg_b_in,
        lengthFt: item.length_ft,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
      };
    }),
  };
}

export async function getOrderStatusHistory(
  supabase: SupabaseClient,
  orderId: string
): Promise<AdminOrderStatusHistoryRow[]> {
  const { data } = await supabase
    .from('order_status_history')
    .select('id, status, note, created_at, profiles(full_name)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  return ((data ?? []) as unknown as { id: string; status: string; note: string | null; created_at: string; profiles: { full_name: string } | null }[]).map(
    (row) => ({
      id: row.id,
      status: row.status,
      changedByName: row.profiles?.full_name ?? null,
      note: row.note,
      createdAt: row.created_at,
    })
  );
}

/**
 * Admin sees every attachment regardless of is_visible_to_customer, unlike the
 * customer-facing order detail RLS policy. Pre-ship photos get short-lived signed
 * URLs since the "orders" storage bucket is private (SCHEMA.md §5).
 */
export async function getOrderAttachments(supabase: SupabaseClient, orderId: string): Promise<AdminOrderAttachment[]> {
  const { data } = await supabase
    .from('order_attachments')
    .select('id, filename, attachment_type, storage_key, is_visible_to_customer, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as {
    id: string;
    filename: string;
    attachment_type: string;
    storage_key: string;
    is_visible_to_customer: boolean;
    created_at: string;
  }[];

  if (rows.length === 0) return [];

  const admin = createAdminClient();
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage.from('orders').createSignedUrl(row.storage_key, 900);
      return {
        id: row.id,
        filename: row.filename,
        attachmentType: row.attachment_type,
        isVisibleToCustomer: row.is_visible_to_customer,
        createdAt: row.created_at,
        signedUrl: signed?.signedUrl ?? null,
      };
    })
  );
}
