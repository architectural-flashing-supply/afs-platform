import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuoteLine } from '@/lib/pricing/types';

/**
 * A CUSTOMER'S INVOICES — from BOTH places one can now come from.
 *
 * ================== WHAT THE V2 AUDIT ACTUALLY FOUND ==================
 *
 * docs/COMMAND_CENTER_V2_SPEC.md §2.5 records "routes exist but no `invoices`
 * table" as the build's top risk. Read against the code, that is narrower than
 * it sounds and worth stating precisely, because the difference decides what
 * this file has to do:
 *
 *   The five routes were NOT broken. They were built against `orders` — an
 *   invoice was DERIVED 1:1 from an order, and that worked. What did not exist
 *   was an invoice as a RECORD IN ITS OWN RIGHT: one a quote becomes on
 *   approval, carrying the quote's own frozen figures, for a job that never
 *   went through checkout at all.
 *
 * Migration 035 adds that table, and this module now reads BOTH:
 *
 *   source 'invoice' — a real `invoices` row. The quote became this on
 *                      approval; its figures are frozen on it and are never
 *                      recomputed.
 *   source 'order'   — the existing derivation from a checked-out order,
 *                      unchanged, so nothing that worked before stops working.
 *
 * An `invoices` row that names an `order_id` WINS over the derivation for that
 * order, so a single order can never appear twice in one customer's list.
 */

export type InvoiceStatus = 'paid' | 'due' | 'overdue';

export interface InvoiceRow {
  /** Routable id: an `invoices` id, or an order id for the derived kind. */
  id: string;
  source: 'invoice' | 'order';
  invoiceNumber: string;
  /** Null for an invoice raised from an approved quote with no order behind it. */
  orderId: string | null;
  orderNumber: string | null;
  date: string;
  dueDate: string | null;
  /** Dollars, because that is what every existing caller renders. */
  amount: number;
  status: InvoiceStatus;
  paymentMethod: string | null;
  netTerms: number;
}

interface OrderInvoiceSource {
  id: string;
  order_number: string;
  total: number;
  payment_method: string | null;
  net_terms: number;
  created_at: string;
  invoice_paid_at: string | null;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  quote_id: string | null;
  quote_request_id: string | null;
  order_id: string | null;
  user_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_company: string | null;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  freight_cents: number;
  total_cents: number;
  line_items: QuoteLine[] | null;
  issued_at: string;
  due_date: string | null;
  net_terms: number;
  paid_at: string | null;
  po_number: string | null;
  office_emailed_to: string | null;
  office_emailed_at: string | null;
}

/** The columns every read of `invoices` asks for. No base64, no blobs. */
export const INVOICE_COLUMNS =
  'id, invoice_number, quote_id, quote_request_id, order_id, user_id, customer_email, customer_name, customer_company, status, subtotal_cents, tax_cents, freight_cents, total_cents, line_items, issued_at, due_date, net_terms, paid_at, po_number, office_emailed_to, office_emailed_at';

function computeStatus(order: OrderInvoiceSource): { status: InvoiceStatus; dueDate: string | null } {
  if (order.invoice_paid_at) {
    return { status: 'paid', dueDate: null };
  }
  if (order.payment_method === 'net_terms' && order.net_terms > 0) {
    const due = new Date(order.created_at);
    due.setDate(due.getDate() + order.net_terms);
    const status: InvoiceStatus = Date.now() > due.getTime() ? 'overdue' : 'due';
    return { status, dueDate: due.toISOString() };
  }
  return { status: 'paid', dueDate: null };
}

/**
 * The 1:1 derivation from an order, unchanged from before migration 035.
 * `invoice_paid_at` is checked first, mirroring command-center-crm.ts's
 * `getCrmInvoices()` precedence exactly so the two cannot drift again.
 */
export function toInvoiceRow(order: OrderInvoiceSource): InvoiceRow {
  const { status, dueDate } = computeStatus(order);
  return {
    id: order.id,
    source: 'order',
    invoiceNumber: order.order_number.replace('AFS-', 'AFS-INV-'),
    orderId: order.id,
    orderNumber: order.order_number,
    date: order.created_at,
    dueDate,
    amount: order.total,
    status,
    paymentMethod: order.payment_method,
    netTerms: order.net_terms,
  };
}

/** A real `invoices` row, in the same shape the list renders. */
export function invoiceRecordToRow(record: InvoiceRecord): InvoiceRow {
  const paid = record.paid_at !== null || record.status === 'paid';
  const overdue =
    !paid && record.due_date !== null && Date.now() > new Date(record.due_date).getTime();
  return {
    id: record.id,
    source: 'invoice',
    invoiceNumber: record.invoice_number,
    orderId: record.order_id,
    orderNumber: null,
    date: record.issued_at,
    dueDate: record.due_date,
    amount: record.total_cents / 100,
    status: paid ? 'paid' : overdue ? 'overdue' : 'due',
    paymentMethod: null,
    netTerms: record.net_terms,
  };
}

export async function getInvoiceRows(
  supabase: SupabaseClient,
  userId: string,
  range?: { from?: string; to?: string }
): Promise<InvoiceRow[]> {
  let orderQuery = supabase
    .from('orders')
    .select('id, order_number, total, payment_method, net_terms, created_at, invoice_paid_at')
    .eq('user_id', userId);
  let invoiceQuery = supabase.from('invoices').select(INVOICE_COLUMNS).eq('user_id', userId);

  if (range?.from) {
    orderQuery = orderQuery.gte('created_at', range.from);
    invoiceQuery = invoiceQuery.gte('issued_at', range.from);
  }
  if (range?.to) {
    orderQuery = orderQuery.lte('created_at', range.to);
    invoiceQuery = invoiceQuery.lte('issued_at', range.to);
  }

  const [{ data: orderData }, { data: invoiceData }] = await Promise.all([
    orderQuery.order('created_at', { ascending: false }),
    invoiceQuery.order('issued_at', { ascending: false }),
  ]);

  const invoiceRows = ((invoiceData ?? []) as unknown as InvoiceRecord[]).map(invoiceRecordToRow);
  // An order that already has a real invoice must not also appear as a derived
  // one — the customer would see the same money twice.
  const billedOrderIds = new Set(
    ((invoiceData ?? []) as unknown as InvoiceRecord[]).map((r) => r.order_id).filter(Boolean) as string[]
  );
  const derivedRows = ((orderData ?? []) as OrderInvoiceSource[])
    .filter((o) => !billedOrderIds.has(o.id))
    .map(toInvoiceRow);

  return [...invoiceRows, ...derivedRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Resolves one id to whichever kind of invoice it is — a real row first, then
 * the order derivation. Scoped to `userId` when one is given, so the customer
 * download can only ever reach the customer's own.
 */
export async function resolveInvoice(
  supabase: SupabaseClient,
  id: string,
  userId?: string
): Promise<
  | { kind: 'invoice'; record: InvoiceRecord }
  | { kind: 'order'; order: OrderInvoiceSource }
  | { kind: 'none' }
> {
  let invoiceQuery = supabase.from('invoices').select(INVOICE_COLUMNS).eq('id', id);
  if (userId) invoiceQuery = invoiceQuery.eq('user_id', userId);
  const { data: invoiceData } = await invoiceQuery.maybeSingle();
  if (invoiceData) return { kind: 'invoice', record: invoiceData as unknown as InvoiceRecord };

  let orderQuery = supabase
    .from('orders')
    .select(
      'id, order_number, total, subtotal, freight, tax, rush_surcharge, payment_method, net_terms, delivery_address, created_at, invoice_paid_at'
    )
    .eq('id', id);
  if (userId) orderQuery = orderQuery.eq('user_id', userId);
  const { data: orderData } = await orderQuery.maybeSingle();
  if (orderData) return { kind: 'order', order: orderData as unknown as OrderInvoiceSource };

  return { kind: 'none' };
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
};
