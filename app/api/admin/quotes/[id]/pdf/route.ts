import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildQuoteInvoicePdf } from '@/lib/documents/quote-invoice-pdf';
import type { QuoteLine } from '@/lib/pricing/types';

/**
 * THE QUOTE, AS A PDF. Admin only — it renders the same frozen snapshot the
 * customer's email showed, through the same renderer the invoice PDF uses, so
 * quote and invoice cannot present the same job differently.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: quoteData } = await admin
      .from('quotes')
      .select(
        'id, quote_number, request_id, customer_email, customer_name, line_items, subtotal_cents, total_cents, sent_at, created_at, valid_until, revision, status'
      )
      .eq('id', params.id)
      .maybeSingle();
    if (!quoteData) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
    const quote = quoteData as {
      id: string;
      quote_number: string;
      request_id: string | null;
      customer_email: string | null;
      customer_name: string | null;
      line_items: QuoteLine[] | null;
      subtotal_cents: number | null;
      total_cents: number | null;
      sent_at: string | null;
      created_at: string;
      valid_until: string | null;
      revision: number;
      status: string;
    };

    const { data: jobData } = quote.request_id
      ? await admin
          .from('quote_requests')
          .select('job_name, po_number, client_business_name')
          .eq('id', quote.request_id)
          .maybeSingle()
      : { data: null };
    const job = jobData as
      | { job_name: string | null; po_number: string | null; client_business_name: string | null }
      | null;

    const lines = (quote.line_items ?? []) as QuoteLine[];
    const subtotal = quote.subtotal_cents ?? lines.reduce((n, l) => n + (l.lineTotalCents ?? 0), 0);

    const pdf = buildQuoteInvoicePdf({
      kind: 'quote',
      number: quote.quote_number,
      issuedAt: quote.sent_at ?? quote.created_at,
      secondaryDate: quote.valid_until,
      jobName: job?.job_name ?? null,
      party: {
        name: quote.customer_name,
        company: job?.client_business_name ?? null,
        email: quote.customer_email,
        poNumber: job?.po_number ?? null,
      },
      lines,
      subtotalCents: subtotal,
      totalCents: quote.total_cents ?? subtotal,
      footnote:
        quote.status === 'approved'
          ? 'Approved by the customer.'
          : 'Approve this quote from the link in the email we sent you.',
    });

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quote_number}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('[Quote PDF Error]', error);
    return NextResponse.json({ error: 'Could not generate the quote PDF.' }, { status: 500 });
  }
}
