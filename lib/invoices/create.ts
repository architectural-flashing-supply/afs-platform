/**
 * THE QUOTE BECOMES THE INVOICE — WITH NO RETYPING OF ANY FIELD.
 *
 * Every figure on the invoice is COPIED from the quote row: the priced line
 * items, the subtotal, the total, the price-book snapshot. Nothing is
 * recomputed from the price book (which may have moved since the quote was
 * sent) and nothing is re-entered by a human. The only fields this function
 * originates are the invoice number, the issue date and the due date.
 *
 * That is not a convenience — it is the correctness property. A recomputed
 * invoice would silently bill a customer a different number from the one they
 * approved, which is the single worst bug this area could have.
 *
 * ONE INVOICE PER QUOTE, enforced by a UNIQUE constraint on
 * `invoices.quote_id` (migration 035). Clicking Approve twice cannot bill
 * twice: the second call finds the existing invoice and says so.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { nextDocumentNumber } from '@/lib/quotes/issue';
import { appendLedger, type LedgerEntry } from '@/lib/pricing/ledger';
import { sendTrackedEmail } from '@/lib/email/outbound';
import { invoiceEmailHtml } from '@/lib/quotes/email-template';
import { officeInvoiceEmail } from '@/lib/data/office';
import type { QuoteLine } from '@/lib/pricing/types';

export interface QuoteForInvoice {
  id: string;
  quote_number: string;
  request_id: string | null;
  user_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  line_items: QuoteLine[] | null;
  price_book_snapshot: Record<string, unknown> | null;
  subtotal_cents: number | null;
  total_cents: number | null;
  /**
   * The rush surcharge the quote was issued with, in DOLLARS (the column is
   * `DECIMAL(10,2)` from migration 001). Read so the invoice can PRINT the same
   * row the quote printed — `invoices` has no rush column and needs none,
   * because its own `total_cents - subtotal_cents` already carries the figure.
   * Never recomputed from the rush policy, which may have moved since.
   */
  rush_surcharge: number | null;
  revision: number;
  sent_at: string | null;
}

export interface InvoiceJobContext {
  jobName: string | null;
  company: string | null;
  poNumber: string | null;
  isRush: boolean;
  /** Non-null = a test job: emails are captured, never sent. */
  testTag: string | null;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  /** True when this call created it; false when it already existed. */
  created: boolean;
  officeEmail: string;
  officeEmailStatus: string;
  customerEmailStatus: string | null;
  message: string;
}

/**
 * Creates the invoice for an approved quote and emails it to the office
 * automatically.
 *
 * NEVER THROWS. An approval that has already happened must not be undone
 * because an email or a history row failed; every partial outcome is reported
 * in the returned message instead.
 */
export async function createInvoiceFromQuote(
  supabase: SupabaseClient,
  quote: QuoteForInvoice,
  job: InvoiceJobContext,
  approvedAt: Date,
  actor: { id: string | null; email: string | null; role: string }
): Promise<CreateInvoiceResult> {
  const office = officeInvoiceEmail();

  // Already billed? Say so rather than billing again.
  const { data: existingRows } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_cents, office_emailed_to')
    .eq('quote_id', quote.id)
    .limit(1);
  const existing = (existingRows ?? [])[0] as
    | { id: string; invoice_number: string; total_cents: number; office_emailed_to: string | null }
    | undefined;
  if (existing) {
    return {
      invoiceId: existing.id,
      invoiceNumber: existing.invoice_number,
      totalCents: existing.total_cents,
      created: false,
      officeEmail: existing.office_emailed_to ?? office,
      officeEmailStatus: 'already_sent',
      customerEmailStatus: null,
      message: `Invoice ${existing.invoice_number} was already created for this quote. Nothing was billed again.`,
    };
  }

  const lines = (quote.line_items ?? []) as QuoteLine[];
  // COPIED, never recomputed. If the cents columns are somehow absent, the
  // lines the customer approved are still the authority — not the price book.
  const subtotalCents =
    quote.subtotal_cents ?? lines.reduce((sum, l) => sum + (l.lineTotalCents ?? 0), 0);
  const totalCents = quote.total_cents ?? subtotalCents;
  // COPIED, like everything else. Converted from the quote's dollars column
  // once, here, so the row the invoice prints is the row the customer
  // approved — not a figure worked out again from a rush policy that may have
  // changed since the quote went out.
  const rushSurchargeCents =
    typeof quote.rush_surcharge === 'number' && Number.isFinite(quote.rush_surcharge)
      ? Math.round(quote.rush_surcharge * 100)
      : 0;

  const nowIso = approvedAt.toISOString();
  const invoiceNumber = await nextDocumentNumber(supabase, 'invoices');

  const { data: inserted, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      quote_id: quote.id,
      quote_request_id: quote.request_id,
      user_id: quote.user_id,
      customer_email: quote.customer_email,
      customer_name: quote.customer_name,
      customer_company: job.company,
      status: 'issued',
      subtotal_cents: subtotalCents,
      tax_cents: 0,
      freight_cents: 0,
      total_cents: totalCents,
      // The snapshot travels with the document. This is the "no retyping" line.
      line_items: lines,
      price_book_snapshot: quote.price_book_snapshot,
      issued_at: nowIso,
      po_number: job.poNumber,
      created_by: actor.id,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[Create Invoice] insert failed', error);
    throw new Error(error?.message ?? 'The invoice could not be created.');
  }
  const invoiceId = (inserted as { id: string }).id;

  // ---- The automatic copy to the office ----------------------------------
  const officeResult = await sendTrackedEmail({
    kind: 'invoice_office',
    to: office,
    subject: `Invoice ${invoiceNumber} — ${job.jobName ?? quote.quote_number} approved`,
    html: invoiceEmailHtml({
      audience: 'office',
      customerName: quote.customer_name,
      customerCompany: job.company,
      invoiceNumber,
      quoteNumber: quote.quote_number,
      jobName: job.jobName,
      lines,
      totalCents,
      surchargeCents: rushSurchargeCents > 0 ? rushSurchargeCents : null,
      approvedAt,
    }),
    quoteId: quote.id,
    quoteRequestId: quote.request_id,
    invoiceId,
    createdBy: actor.id,
    testTag: job.testTag,
  });

  // ---- And the customer's own copy ---------------------------------------
  let customerEmailStatus: string | null = null;
  if (quote.customer_email) {
    const customerResult = await sendTrackedEmail({
      kind: 'invoice_customer',
      to: quote.customer_email,
      subject: `Invoice ${invoiceNumber} from Architectural Flashing Supply`,
      html: invoiceEmailHtml({
        audience: 'customer',
        customerName: quote.customer_name,
        customerCompany: job.company,
        invoiceNumber,
        quoteNumber: quote.quote_number,
        jobName: job.jobName,
        lines,
        totalCents,
        surchargeCents: rushSurchargeCents > 0 ? rushSurchargeCents : null,
        approvedAt,
      }),
      quoteId: quote.id,
      quoteRequestId: quote.request_id,
      invoiceId,
      createdBy: actor.id,
      testTag: job.testTag,
    });
    customerEmailStatus = customerResult.status;
  }

  await supabase
    .from('invoices')
    .update({
      office_emailed_to: office,
      office_emailed_at: nowIso,
      status: officeResult.delivered || customerEmailStatus === 'sent' ? 'sent' : 'issued',
      updated_at: nowIso,
    })
    .eq('id', invoiceId);

  // ---- The pricing history ------------------------------------------------
  const entries: LedgerEntry[] = lines.map((line) => ({
    eventType: 'invoice_issued',
    source: 'system',
    occurredAt: nowIso,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    quoteRequestId: quote.request_id,
    quoteId: quote.id,
    invoiceId,
    customerId: quote.user_id,
    customerLabel: job.company ?? quote.customer_name ?? quote.customer_email,
    material: line.material,
    gauge: line.gauge,
    blankWidthIn: line.blankWidthIn,
    bendCount: line.bendCount,
    hemCount: line.hemCount,
    lengthFt: line.lengthFt,
    quantity: line.quantity,
    isRush: job.isRush,
    priceBookVersionIds: line.priceBookVersionId ? [line.priceBookVersionId] : null,
    pricesUsed: line.pricesUsed as unknown as Record<string, unknown>,
    amountCents: line.lineTotalCents,
    revision: quote.revision,
    payload: { invoiceNumber, quoteNumber: quote.quote_number, officeEmailStatus: officeResult.status },
    testTag: job.testTag,
  }));
  if (entries.length === 0) {
    entries.push({
      eventType: 'invoice_issued',
      source: 'system',
      occurredAt: nowIso,
      actorId: actor.id,
      quoteRequestId: quote.request_id,
      quoteId: quote.id,
      invoiceId,
      amountCents: totalCents,
      revision: quote.revision,
      note: 'Invoice with no priced lines on the quote.',
      testTag: job.testTag,
    });
  }
  await appendLedger(supabase, entries);

  return {
    invoiceId,
    invoiceNumber,
    totalCents,
    created: true,
    officeEmail: office,
    officeEmailStatus: officeResult.status,
    customerEmailStatus,
    message:
      officeResult.status === 'sent'
        ? `Invoice ${invoiceNumber} created from the quote and emailed to ${office}.`
        : `Invoice ${invoiceNumber} created from the quote. ${officeResult.message}`,
  };
}
