import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSimplePdf } from '@/lib/utils/simple-pdf';
import { buildInvoicePdfLines, type InvoiceLineItemRecord, type InvoiceProfileRecord } from '@/lib/utils/invoice-pdf';
import { toInvoiceRow } from '@/lib/data/invoices';

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
    const lineItems = (lineItemsRaw ?? []) as InvoiceLineItemRecord[];

    const invoice = toInvoiceRow(order);

    // Shared with lib/utils/invoice-pdf.ts's generateInvoicePDF() (used by
    // the dispatch/invoice-send routes) so the layout is defined exactly
    // once — this route keeps its own session-scoped auth/query above,
    // since it's the customer-facing download and must stay scoped to the
    // requesting user's own orders.
    const lines = buildInvoicePdfLines(order, (profile as InvoiceProfileRecord | null) ?? null, lineItems);
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
