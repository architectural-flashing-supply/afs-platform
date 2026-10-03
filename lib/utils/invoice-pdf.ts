import { createAdminClient } from '@/lib/supabase/admin';
import { toInvoiceRow, INVOICE_STATUS_LABEL } from '@/lib/data/invoices';
import { buildSimplePdf, type SimplePdfLine } from './simple-pdf';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface InvoiceOrderRecord {
  id: string;
  order_number: string;
  total: number;
  subtotal: number;
  freight: number | null;
  tax: number | null;
  rush_surcharge: number;
  payment_method: string | null;
  net_terms: number;
  delivery_address: { line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
  created_at: string;
  invoice_paid_at: string | null;
  /**
   * SPEC_PURCHASE_ORDER_INTEGRATION.md §2 lists "Invoice PDF header".
   *
   * The newer quote→invoice path already carried this (an `invoices` row's own
   * `po_number`, drawn by lib/documents/quote-invoice-pdf.ts); this older
   * order-derived path did not, so an invoice generated from an order was the
   * one document in the chain missing the customer's reference.
   */
  po_number: string | null;
}

export interface InvoiceProfileRecord {
  full_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
}

export interface InvoiceLineItemRecord {
  description: string;
  length_ft: number;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

/**
 * Shared by app/api/invoices/[id]/pdf/route.ts (customer download, keeps its
 * own session-scoped auth/query) and generateInvoicePDF() below (admin/
 * operator-triggered, no per-user session) so the invoice layout is defined
 * exactly once instead of duplicated across both call sites.
 *
 * NOTE: order_line_items (SCHEMA.md TABLE 19) has no separate material/gauge
 * columns — those already ride inside the free-text `description` field set
 * at order-creation time, not a fabricated join through
 * products→materials/gauges (many orders have no linked product_id at all,
 * since the product catalog is a CLAUDE.md Data Blocker). Length is rendered
 * as its own field since order_line_items does carry it as a real column.
 */
export function buildInvoicePdfLines(
  order: InvoiceOrderRecord,
  profile: InvoiceProfileRecord | null,
  lineItems: InvoiceLineItemRecord[]
): SimplePdfLine[] {
  const invoice = toInvoiceRow(order);
  const shipTo = order.delivery_address;

  const lines: SimplePdfLine[] = [];
  lines.push({ text: 'ARCHITECTURAL FLASHING SUPPLY — INVOICE', font: 'bold', size: 15 });
  lines.push({ text: `Invoice #: ${invoice.invoiceNumber}`, spaceBefore: 10 });
  lines.push({ text: `Order #: ${invoice.orderNumber}` });
  lines.push({ text: `Invoice Date: ${formatDate(invoice.date)}` });
  lines.push({ text: `Due Date: ${invoice.dueDate ? formatDate(invoice.dueDate) : 'Paid at checkout'}` });
  lines.push({ text: `Status: ${INVOICE_STATUS_LABEL[invoice.status]}` });
  // After Status, before Bill To — SPEC_PURCHASE_ORDER_INTEGRATION.md §2's
  // "Invoice PDF header" placement, and the position a contractor's accounts
  // team reads first when matching an invoice to their own PO. Omitted rather
  // than printed as a dash when the order has none.
  if (order.po_number) {
    lines.push({ text: `PO Number: ${order.po_number}` });
  }

  lines.push({ text: 'Bill To', font: 'bold', size: 11, spaceBefore: 18 });
  lines.push({ text: profile?.full_name ?? '—' });
  if (profile?.company) lines.push({ text: profile.company });
  if (profile?.email) lines.push({ text: profile.email });
  if (profile?.phone) lines.push({ text: profile.phone });

  lines.push({ text: 'Ship To', font: 'bold', size: 11, spaceBefore: 18 });
  if (shipTo) {
    if (shipTo.line1) lines.push({ text: shipTo.line1 });
    if (shipTo.line2) lines.push({ text: shipTo.line2 });
    lines.push({ text: [shipTo.city, shipTo.state, shipTo.zip].filter(Boolean).join(', ') || '—' });
  } else {
    lines.push({ text: 'Pickup at AFS facility' });
  }

  lines.push({ text: 'Line Items', font: 'bold', size: 11, spaceBefore: 18 });
  lines.push({ text: 'Length     Qty     Unit Price      Line Total', font: 'mono', size: 9, spaceBefore: 4 });
  for (const item of lineItems) {
    lines.push({ text: item.description, size: 9, spaceBefore: 6 });
    lines.push({
      text: `${`${item.length_ft}ft`.padEnd(10)} ${String(item.quantity).padEnd(7)} ${currency
        .format(item.unit_price)
        .padEnd(15)} ${currency.format(item.line_total)}`,
      font: 'mono',
      size: 9,
    });
  }

  lines.push({ text: `Subtotal: ${currency.format(order.subtotal)}`, font: 'mono', size: 10, spaceBefore: 16 });
  lines.push({ text: `Freight: ${order.freight != null ? currency.format(order.freight) : '—'}`, font: 'mono', size: 10 });
  if (order.rush_surcharge > 0) {
    lines.push({ text: `Rush Surcharge: ${currency.format(order.rush_surcharge)}`, font: 'mono', size: 10 });
  }
  lines.push({ text: `Tax: ${order.tax != null ? currency.format(order.tax) : '—'}`, font: 'mono', size: 10 });
  lines.push({ text: `Total: ${currency.format(order.total)}`, font: 'bold', size: 12, spaceBefore: 4 });

  lines.push({
    text:
      invoice.status === 'paid'
        ? 'Paid in full.'
        : `Payment due ${invoice.dueDate ? formatDate(invoice.dueDate) : 'upon receipt'} — Net ${order.net_terms} terms.`,
    size: 9,
    spaceBefore: 18,
  });
  lines.push({ text: 'Thank you for your business.', font: 'bold', size: 10, spaceBefore: 6 });
  lines.push({ text: 'Terms and Conditions: /legal/terms', size: 8, spaceBefore: 10 });

  return lines;
}

interface OrderWithUser extends InvoiceOrderRecord {
  user_id: string;
}

/**
 * Admin/operator-triggered generation — no per-user session to scope against
 * (the caller is a service action like dispatch, not a logged-in customer),
 * so this reads via the service-role client and trusts the caller (every
 * route that calls this already ran requireOperatorApi()) rather than
 * filtering by user_id the way the customer-facing PDF download route does.
 */
export async function generateInvoicePDF(orderId: string): Promise<Buffer> {
  const admin = createAdminClient();

  const { data: orderRaw, error: orderError } = await admin
    .from('orders')
    .select(
      'id, order_number, total, subtotal, freight, tax, rush_surcharge, payment_method, net_terms, delivery_address, created_at, invoice_paid_at, po_number, user_id'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !orderRaw) {
    throw new Error('Order not found.');
  }
  const order = orderRaw as OrderWithUser;

  const [{ data: profile }, { data: lineItemsRaw }] = await Promise.all([
    admin.from('profiles').select('full_name, company, email, phone').eq('id', order.user_id).maybeSingle(),
    admin
      .from('order_line_items')
      .select('description, length_ft, quantity, unit, unit_price, line_total')
      .eq('order_id', orderId)
      .order('sort_order', { ascending: true }),
  ]);

  const lines = buildInvoicePdfLines(
    order,
    (profile as InvoiceProfileRecord | null) ?? null,
    (lineItemsRaw as InvoiceLineItemRecord[] | null) ?? []
  );

  return buildSimplePdf(lines);
}
