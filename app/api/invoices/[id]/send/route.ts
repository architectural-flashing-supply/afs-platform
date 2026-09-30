import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { sendInvoiceEmail } from '@/lib/utils/invoice-email';
import { resolveInvoice } from '@/lib/data/invoices';
import { sendTrackedEmail } from '@/lib/email/outbound';
import { invoiceEmailHtml } from '@/lib/quotes/email-template';
import { ledgerTestTag } from '@/lib/pricing/ledger';
import { officeInvoiceEmail } from '@/lib/data/office';
import type { QuoteLine } from '@/lib/pricing/types';

/**
 * RESEND AN INVOICE. `id` resolves to either kind:
 *
 *  - a real `invoices` row (an approved quote that became an invoice,
 *    migration 035) — resent from its own frozen snapshot, to the customer and
 *    to the office, through the same tracked path the approval used, so a
 *    resend is byte-for-byte the message that was sent the first time;
 *  - an order id — the pre-existing derivation, unchanged, still going through
 *    `sendInvoiceEmail` so a manual resend and an automatic dispatch email stay
 *    identical.
 *
 * Operator-gated. A resend is a real message to a real customer.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const admin = createAdminClient();
    const resolved = await resolveInvoice(admin, params.id);

    if (resolved.kind === 'invoice') {
      const record = resolved.record;
      const lines = (record.line_items ?? []) as QuoteLine[];
      const office = record.office_emailed_to ?? officeInvoiceEmail();

      // A test job's mail stays captured on a resend too — the tag lives on the
      // job, not on the moment.
      let testTag: string | null = null;
      if (record.quote_request_id) {
        const { data: job } = await admin
          .from('quote_requests')
          .select('job_name')
          .eq('id', record.quote_request_id)
          .maybeSingle();
        testTag = ledgerTestTag((job as { job_name?: string | null } | null)?.job_name ?? null);
      }

      const issuedAt = new Date(record.issued_at);
      const results: string[] = [];

      if (record.customer_email) {
        const sent = await sendTrackedEmail({
          kind: 'invoice_customer',
          to: record.customer_email,
          subject: `Invoice ${record.invoice_number} from Architectural Flashing Supply`,
          html: invoiceEmailHtml({
            audience: 'customer',
            customerName: record.customer_name,
            customerCompany: record.customer_company,
            invoiceNumber: record.invoice_number,
            quoteNumber: null,
            jobName: null,
            lines,
            totalCents: record.total_cents,
            approvedAt: issuedAt,
          }),
          quoteId: record.quote_id,
          quoteRequestId: record.quote_request_id,
          invoiceId: record.id,
          createdBy: auth.userId,
          testTag,
        });
        results.push(sent.message);
      } else {
        results.push('There is no customer email on this invoice, so only the office copy went.');
      }

      const officeSent = await sendTrackedEmail({
        kind: 'invoice_office',
        to: office,
        subject: `Invoice ${record.invoice_number} (resent)`,
        html: invoiceEmailHtml({
          audience: 'office',
          customerName: record.customer_name,
          customerCompany: record.customer_company,
          invoiceNumber: record.invoice_number,
          quoteNumber: null,
          jobName: null,
          lines,
          totalCents: record.total_cents,
          approvedAt: issuedAt,
        }),
        quoteId: record.quote_id,
        quoteRequestId: record.quote_request_id,
        invoiceId: record.id,
        createdBy: auth.userId,
        testTag,
      });
      results.push(officeSent.message);

      return NextResponse.json({
        sent: true,
        invoiceNumber: record.invoice_number,
        message: results.join(' '),
      });
    }

    if (resolved.kind === 'none') {
      return NextResponse.json({ error: 'That invoice could not be found.' }, { status: 404 });
    }

    const result = await sendInvoiceEmail(params.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Could not send invoice.' }, { status: 400 });
    }

    // Best-effort — only meaningful when a delivery_notifications row
    // already exists for this order (a pickup order that was never
    // dispatched may not have one); a 0-row update is not an error.
    await admin.from('delivery_notifications').update({ invoice_sent: true }).eq('order_id', params.id);

    return NextResponse.json({ sent: true, invoiceNumber: result.invoiceNumber });
  } catch (error) {
    console.error('[Invoice Send Route Error]', error);
    return NextResponse.json({ error: 'Could not send invoice. Please try again.' }, { status: 500 });
  }
}
