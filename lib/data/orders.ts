import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVE_ORDER_STATUSES, ORDER_STAGES, type OrderStageKey } from '@/lib/admin/orderStages';

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
 * Shared by the Stripe webhook (card payment_intent.succeeded) and the net-terms
 * checkout path — both convert an AFS-approved quote into an order the same way.
 * Idempotent on quote_id so retried webhook deliveries don't double-create orders.
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
  if (orderError) throw orderError;

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

export interface ProductionQueueRow {
  id: string;
  orderNumber: string;
  customerName: string;
  profileSummary: string;
  createdAt: string;
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
 * (SPEC_PRODUCTION_QUEUE.md §3). "all" and stage tabs exclude delivered orders —
 * a delivered order has left the production queue by definition.
 */
export async function getProductionQueue(
  supabase: SupabaseClient,
  filter: ProductionQueueFilter
): Promise<ProductionQueueRow[]> {
  let query = supabase
    .from('orders')
    .select(
      'id, order_number, created_at, is_rush, status, profiles(full_name, company), order_line_items(description)'
    )
    .order('is_rush', { ascending: false })
    .order('created_at', { ascending: true });

  if (filter === 'rush') {
    query = query.eq('is_rush', true).in('status', ACTIVE_ORDER_STATUSES);
  } else if (filter === 'all') {
    query = query.in('status', ACTIVE_ORDER_STATUSES);
  } else {
    query = query.eq('status', filter);
  }

  const { data } = await query;

  return ((data ?? []) as unknown as ProductionQueueSource[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.profiles?.company || row.profiles?.full_name || 'Unknown',
    profileSummary: summarizeOrderLineItems(row.order_line_items),
    createdAt: row.created_at,
    isRush: row.is_rush,
    status: row.status,
  }));
}

export type ProductionQueueCounts = Record<'all' | 'rush' | OrderStageKey, number>;

export async function getProductionQueueCounts(supabase: SupabaseClient): Promise<ProductionQueueCounts> {
  const { data } = await supabase.from('orders').select('status, is_rush').in('status', ACTIVE_ORDER_STATUSES);
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
