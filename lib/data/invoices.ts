import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceStatus = 'paid' | 'due' | 'overdue';

export interface InvoiceRow {
  id: string; // order id — invoices are derived 1:1 from orders (no separate invoices table)
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  date: string;
  dueDate: string | null;
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
}

function computeStatus(order: OrderInvoiceSource): { status: InvoiceStatus; dueDate: string | null } {
  if (order.payment_method === 'net_terms' && order.net_terms > 0) {
    const due = new Date(order.created_at);
    due.setDate(due.getDate() + order.net_terms);
    const status: InvoiceStatus = Date.now() > due.getTime() ? 'overdue' : 'due';
    return { status, dueDate: due.toISOString() };
  }
  return { status: 'paid', dueDate: null };
}

/**
 * SCHEMA.md has no standalone `invoices` table — every order already carries
 * AFS-set pricing, so an invoice is derived 1:1 from its order. Net-terms
 * orders are 'due'/'overdue' relative to created_at + net_terms; everything
 * else is captured at checkout and considered 'paid'.
 */
export function toInvoiceRow(order: OrderInvoiceSource): InvoiceRow {
  const { status, dueDate } = computeStatus(order);
  return {
    id: order.id,
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

export async function getInvoiceRows(
  supabase: SupabaseClient,
  userId: string,
  range?: { from?: string; to?: string }
): Promise<InvoiceRow[]> {
  let query = supabase
    .from('orders')
    .select('id, order_number, total, payment_method, net_terms, created_at')
    .eq('user_id', userId);

  if (range?.from) query = query.gte('created_at', range.from);
  if (range?.to) query = query.lte('created_at', range.to);

  const { data } = await query.order('created_at', { ascending: false });
  return ((data ?? []) as OrderInvoiceSource[]).map(toInvoiceRow);
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  due: 'Due',
  overdue: 'Overdue',
};
