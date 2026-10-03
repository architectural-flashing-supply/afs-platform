import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSimplePdf } from '@/lib/utils/simple-pdf';
import { buildInvoicePdfLines, type InvoiceLineItemRecord, type InvoiceProfileRecord } from '@/lib/utils/invoice-pdf';
import { buildQuoteInvoicePdf } from '@/lib/documents/quote-invoice-pdf';
import { resolveInvoice, toInvoiceRow } from '@/lib/data/invoices';
import type { QuoteLine } from '@/lib/pricing/types';

/**
 * THE CUSTOMER'S INVOICE PDF — for both kinds of invoice.
 *
 * `id` resolves to a real `invoices` row first (an approved quote that became
 * an invoice, migration 035) and falls back to the order derivation that was
 * here before it. Either way the query is scoped to the signed-in user's own
 * records, which is what makes this route safe to hand a raw id.
 *
 * A REAL INVOICE RENDERS FROM ITS OWN FROZEN SNAPSHOT — the same
 * `buildQuoteInvoicePdf` that drew the quote, from the same line items. That is
 * what "the quote becomes the invoice with no retyping" looks like on paper:
 * the customer's invoice PDF is their quote PDF with a different heading and a
 * different number.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolved = await resolveInvoice(supabase, params.id, user.id);
    if (resolved.kind === 'none') {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company, email, phone')
      .eq('id', user.id)
      .single();

    if (resolved.kind === 'invoice') {
      const record = resolved.record;
      const pdfBuffer = buildQuoteInvoicePdf({
        kind: 'invoice',
        number: record.invoice_number,
        issuedAt: record.issued_at,
        secondaryDate: record.due_date,
        jobName: null,
        party: {
          name: record.customer_name ?? (profile?.full_name as string | undefined) ?? null,
          company: record.customer_company ?? (profile?.company as string | undefined) ?? null,
          email: record.customer_email ?? (profile?.email as string | undefined) ?? null,
          poNumber: record.po_number,
        },
        lines: (record.line_items ?? []) as QuoteLine[],
        subtotalCents: record.subtotal_cents,
        totalCents: record.total_cents,
        footnote: record.paid_at ? 'Paid — thank you.' : null,
      });
      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${record.invoice_number}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    // The pre-existing order derivation. `resolveInvoice` now declares the
    // wider OrderInvoicePdfSource for this branch (money breakdown, ship-to
    // address, po_number), so this no longer needs an `as unknown as` cast to
    // reach buildInvoicePdfLines' parameter type — the columns it draws are in
    // the type, and a missing one is a compile error rather than an
    // "undefined" printed on a customer's invoice.
    const order = resolved.order;
    const { data: lineItemsRaw } = await supabase
      .from('order_line_items')
      .select('description, length_ft, quantity, unit, unit_price, line_total')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true });
    const lineItems = (lineItemsRaw ?? []) as InvoiceLineItemRecord[];

    // Used for the download filename. No cast needed either:
    // OrderInvoicePdfSource extends the narrower type toInvoiceRow takes.
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
