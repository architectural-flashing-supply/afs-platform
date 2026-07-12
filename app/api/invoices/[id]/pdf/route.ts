import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toInvoiceRow, INVOICE_STATUS_LABEL } from '@/lib/data/invoices';
import { buildSimplePdf, type SimplePdfLine } from '@/lib/utils/simple-pdf';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface OrderLineItemRow {
  description: string;
  length_ft: number;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: order } = await supabase
      .from('orders')
      .select(
        'id, order_number, total, subtotal, freight, tax, rush_surcharge, payment_method, net_terms, delivery_address, created_at'
      )
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company, email, phone')
      .eq('id', user.id)
      .single();

    const { data: lineItemsRaw } = await supabase
      .from('order_line_items')
      .select('description, length_ft, quantity, unit, unit_price, line_total')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true });
    const lineItems = (lineItemsRaw ?? []) as OrderLineItemRow[];

    const invoice = toInvoiceRow(order);
    const shipTo = order.delivery_address as
      | { line1?: string; line2?: string; city?: string; state?: string; zip?: string }
      | null;

    const lines: SimplePdfLine[] = [];
    lines.push({ text: 'AFS — Architectural Flashing Supply', font: 'bold', size: 16 });
    lines.push({ text: 'INVOICE', font: 'bold', size: 14, spaceBefore: 4 });
    lines.push({ text: `Invoice #: ${invoice.invoiceNumber}`, spaceBefore: 10 });
    lines.push({ text: `Order #: ${invoice.orderNumber}` });
    lines.push({ text: `Invoice Date: ${formatDate(invoice.date)}` });
    lines.push({ text: `Due Date: ${invoice.dueDate ? formatDate(invoice.dueDate) : 'Paid at checkout'}` });
    lines.push({ text: `Status: ${INVOICE_STATUS_LABEL[invoice.status]}` });

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
    lines.push({ text: 'Qty      Unit    Unit Price      Line Total', font: 'mono', size: 9, spaceBefore: 4 });
    for (const item of lineItems) {
      lines.push({ text: item.description, size: 9, spaceBefore: 6 });
      lines.push({
        text: `${String(item.quantity).padEnd(8)} ${item.unit.padEnd(7)} ${currency
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
          ? 'Paid — thank you for your business.'
          : `Payment due ${invoice.dueDate ? formatDate(invoice.dueDate) : 'upon receipt'} — Net ${
              order.net_terms
            } terms. Pay online at /account/invoices.`,
      size: 9,
      spaceBefore: 18,
    });
    lines.push({ text: 'Terms and Conditions: /legal/terms', size: 8, spaceBefore: 4 });

    const pdfBuffer = buildSimplePdf(lines);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('[Invoice PDF Error]', error);
    return NextResponse.json({ error: 'Could not generate invoice PDF.' }, { status: 500 });
  }
}
