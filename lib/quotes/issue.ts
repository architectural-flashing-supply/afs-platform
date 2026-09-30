/**
 * ISSUING A QUOTE — from the job, through the price book, to the customer's
 * inbox, with the history row that outlives all of it.
 *
 * ONE ORDER OF OPERATIONS, and it is deliberate:
 *
 *   1. Price the job from the price book AS OF TODAY. If anything is blank or
 *      unmeasurable, STOP — nothing is written and the admin is told which row
 *      to go and fill in. A quote is never half-issued.
 *   2. Write the `quotes` row, SNAPSHOTTING the cents used and the price-book
 *      version ids. From this moment the document does not move, whatever
 *      happens to the price book afterwards.
 *   3. Mint a signed, single-use, expiring Approve link and store only its
 *      HASH.
 *   4. Send the email through the site's existing service, or capture it in
 *      test mode.
 *   5. Advance the job to `quoted` and append the pricing-history rows.
 *
 * A REVISION IS A NEW QUOTE, NOT AN EDIT. `revision` increments, `supersedes_id`
 * points at the one it replaces, the old one is marked `expired`, and its
 * outstanding Approve links are expired with it — so a customer cannot approve
 * a price that has been withdrawn. The ledger gets a `quote_revised` row
 * carrying both.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getResolvedPriceBook } from '@/lib/pricing/db';
import { quoteFromPriceBook } from '@/lib/pricing/quote-math';
import { toQuoteItemInputs, type JobLineItemGeometry } from '@/lib/pricing/quote-inputs';
import { appendLedger, ledgerTestTag, type LedgerEntry } from '@/lib/pricing/ledger';
import { signApproveToken, approveLinkUrl, DEFAULT_APPROVE_TOKEN_TTL_SECONDS } from '@/lib/pricing/approve-token';
import { getSiteUrl } from '@/lib/site-url';
import { sendTrackedEmail } from '@/lib/email/outbound';
import { quoteEmailHtml } from '@/lib/quotes/email-template';
import type { QuoteLine, QuoteResult } from '@/lib/pricing/types';

/** The job fields a quote needs. Selected by name — no geometry images. */
export interface JobForQuote {
  id: string;
  request_number: string;
  job_name: string | null;
  line_items: JobLineItemGeometry[] | null;
  user_id: string | null;
  guest_email: string | null;
  is_rush: boolean;
  po_number: string | null;
  client_business_name: string | null;
  client_name: string | null;
  job_stage: string | null;
  quote_id: string | null;
}

export interface QuoteCustomer {
  email: string | null;
  name: string | null;
  company: string | null;
}

/**
 * Prices the job without writing anything — what the Job screen renders.
 *
 * `quantityOverrides` is the estimator's own count, per line, from the editable
 * Qty column in the quote table. It is applied to the PRICING ONLY: the
 * customer's submitted `line_items` are never rewritten, because what they
 * asked for is evidence and the quote is a separate document. The quote and
 * its ledger rows record the quantity that was actually quoted.
 */
export async function priceJob(
  supabase: SupabaseClient,
  job: JobForQuote,
  quantityOverrides?: (number | null)[] | null
): Promise<QuoteResult> {
  const priceBook = await getResolvedPriceBook(supabase);
  const inputs = toQuoteItemInputs(job.line_items).map((input, i) => {
    const override = quantityOverrides?.[i];
    return typeof override === 'number' && Number.isFinite(override) ? { ...input, quantity: override } : input;
  });
  return quoteFromPriceBook(inputs, priceBook);
}

export function resolveQuoteCustomer(
  job: JobForQuote,
  profile: { full_name?: string | null; email?: string | null; company?: string | null } | null
): QuoteCustomer {
  return {
    email: profile?.email ?? job.guest_email ?? null,
    name: profile?.full_name ?? job.client_name ?? null,
    company: profile?.company ?? job.client_business_name ?? null,
  };
}

async function nextDocumentNumber(supabase: SupabaseClient, table: 'quotes' | 'invoices'): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = table === 'quotes' ? `AFS-Q-${year}-` : `AFS-INV-${year}-`;
  const column = table === 'quotes' ? 'quote_number' : 'invoice_number';
  const { data } = await supabase
    .from(table)
    .select(column)
    .like(column, `${prefix}%`)
    .order(column, { ascending: false })
    .limit(1);
  const last = (data?.[0] as Record<string, string> | undefined)?.[column];
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

/** Exported so the invoice side numbers documents exactly the same way. */
export { nextDocumentNumber };

export type IssueQuoteOutcome =
  | {
      ok: true;
      quoteId: string;
      quoteNumber: string;
      revision: number;
      totalCents: number;
      approveUrl: string;
      emailStatus: string;
      emailMessage: string;
      message: string;
    }
  | { ok: false; problems: string[]; message: string };

export interface IssueQuoteOptions {
  /** The admin pressing Send quote. Recorded as the actor. */
  actor: { id: string; email: string | null; role: string };
  /** Overrides the derived recipient when the admin typed a different one. */
  sendTo?: string | null;
  /** Days the Approve link stays live. */
  ttlSeconds?: number;
  notes?: string | null;
  /** The estimator's own per-line quantity, from the editable quote table. */
  quantityOverrides?: (number | null)[] | null;
}

export async function issueQuoteForJob(
  supabase: SupabaseClient,
  job: JobForQuote,
  customer: QuoteCustomer,
  opts: IssueQuoteOptions
): Promise<IssueQuoteOutcome> {
  const priced = await priceJob(supabase, job, opts.quantityOverrides);
  if (!priced.ok) {
    return {
      ok: false,
      problems: priced.problems.map((p) => p.message),
      message:
        priced.problems.length === 1
          ? priced.problems[0].message
          : `This job cannot be quoted yet — there ${priced.problems.length === 1 ? 'is' : 'are'} ${priced.problems.length} things to fix first.`,
    };
  }

  const recipient = (opts.sendTo ?? customer.email ?? '').trim();
  if (recipient === '') {
    return {
      ok: false,
      problems: ['No email address on this job.'],
      message: 'There is no email address on this job, so the quote has nowhere to go. Add one first.',
    };
  }

  // ---- The revision chain ------------------------------------------------
  const { data: priorRows } = await supabase
    .from('quotes')
    .select('id, revision, status, total_cents, created_at')
    .eq('request_id', job.id)
    .order('revision', { ascending: false })
    .limit(1);
  const prior = (priorRows ?? [])[0] as
    | { id: string; revision: number; status: string; total_cents: number | null; created_at: string }
    | undefined;
  const revision = prior ? prior.revision + 1 : 1;

  const now = new Date();
  const nowIso = now.toISOString();
  const quoteNumber = await nextDocumentNumber(supabase, 'quotes');
  const expiresAt = new Date(now.getTime() + (opts.ttlSeconds ?? DEFAULT_APPROVE_TOKEN_TTL_SECONDS) * 1000);

  const { data: insertedQuote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      request_id: job.id,
      user_id: job.user_id,
      customer_email: recipient,
      customer_name: customer.name,
      status: 'sent',
      // The legacy numeric columns stay populated so every screen already built
      // against `quotes` keeps working; the cents columns are the real ones.
      subtotal: priced.subtotalCents / 100,
      total: priced.totalCents / 100,
      subtotal_cents: priced.subtotalCents,
      total_cents: priced.totalCents,
      rush_surcharge: 0,
      line_items: priced.lines,
      price_book_snapshot: {
        pricedAt: nowIso,
        versionIds: priced.priceBookVersionIds,
      },
      revision,
      supersedes_id: prior?.id ?? null,
      estimator_notes: opts.notes ?? null,
      created_by: opts.actor.id,
      sent_at: nowIso,
      expires_at: expiresAt.toISOString(),
      valid_until: expiresAt.toISOString().slice(0, 10),
    })
    .select('id')
    .single();

  if (quoteError || !insertedQuote) {
    console.error('[Issue Quote] could not write the quote', quoteError);
    return {
      ok: false,
      problems: [quoteError?.message ?? 'The quote could not be saved.'],
      message: 'The quote could not be saved, so nothing was sent. Please try again.',
    };
  }
  const quoteId = (insertedQuote as { id: string }).id;

  // ---- Withdraw the superseded quote and its outstanding links -----------
  if (prior && prior.status !== 'approved' && prior.status !== 'converted') {
    await supabase.from('quotes').update({ status: 'expired' }).eq('id', prior.id);
    // A customer must not be able to approve a price that has been withdrawn.
    await supabase
      .from('quote_approval_tokens')
      .update({ expires_at: nowIso })
      .eq('quote_id', prior.id)
      .is('used_at', null);
  }

  // ---- The signed, single-use Approve link -------------------------------
  const { token, tokenHash } = signApproveToken(quoteId, {
    now,
    ttlSeconds: opts.ttlSeconds ?? DEFAULT_APPROVE_TOKEN_TTL_SECONDS,
  });
  const { error: tokenError } = await supabase.from('quote_approval_tokens').insert({
    quote_id: quoteId,
    quote_request_id: job.id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    issued_to: recipient,
    created_by: opts.actor.id,
  });
  if (tokenError) {
    console.error('[Issue Quote] could not store the approve token', tokenError);
    return {
      ok: false,
      problems: [tokenError.message],
      message:
        'The quote was saved but its Approve link could not be stored, so nothing was emailed. ' +
        'Please try sending again.',
    };
  }

  const approveUrl = approveLinkUrl(getSiteUrl(), token);
  const testTag = ledgerTestTag(job.job_name);

  // ---- The email ---------------------------------------------------------
  const html = quoteEmailHtml({
    customerName: customer.name,
    quoteNumber,
    jobName: job.job_name,
    lines: priced.lines,
    totalCents: priced.totalCents,
    approveUrl,
    expiresAt,
    revision,
  });
  const email = await sendTrackedEmail({
    kind: revision > 1 ? 'quote_revision' : 'quote',
    to: recipient,
    subject:
      revision > 1
        ? `Revised quote ${quoteNumber} from Architectural Flashing Supply`
        : `Your quote ${quoteNumber} from Architectural Flashing Supply`,
    html,
    quoteId,
    quoteRequestId: job.id,
    createdBy: opts.actor.id,
    testTag,
  });

  // ---- The job moves to Quoted ------------------------------------------
  await supabase
    .from('quote_requests')
    .update({
      job_stage: 'quoted',
      stage_changed_at: nowIso,
      quoted_at: nowIso,
      quote_id: quoteId,
    })
    .eq('id', job.id);

  // ---- The pricing history ----------------------------------------------
  const entries: LedgerEntry[] = priced.lines.map((line: QuoteLine) => ({
    eventType: revision > 1 ? 'quote_revised' : 'quote_issued',
    source: 'admin_ui',
    occurredAt: nowIso,
    actorId: opts.actor.id,
    actorEmail: opts.actor.email,
    actorRole: opts.actor.role,
    quoteRequestId: job.id,
    quoteId,
    customerId: job.user_id,
    customerLabel: customer.company ?? customer.name ?? recipient,
    material: line.material,
    gauge: line.gauge,
    blankWidthIn: line.blankWidthIn,
    bendCount: line.bendCount,
    hemCount: line.hemCount,
    lengthFt: line.lengthFt,
    quantity: line.quantity,
    isRush: job.is_rush,
    priceBookVersionIds: [line.priceBookVersionId],
    pricesUsed: { ...line.pricesUsed, stripsPerSheet: line.stripsPerSheet },
    amountCents: line.lineTotalCents,
    revision,
    note: revision > 1 ? `Revision ${revision} of ${job.request_number}` : null,
    payload: {
      quoteNumber,
      quoteTotalCents: priced.totalCents,
      supersedesQuoteId: prior?.id ?? null,
      emailStatus: email.status,
    },
    testTag,
  }));
  await appendLedger(supabase, entries);

  return {
    ok: true,
    quoteId,
    quoteNumber,
    revision,
    totalCents: priced.totalCents,
    approveUrl,
    emailStatus: email.status,
    emailMessage: email.message,
    message:
      email.status === 'sent'
        ? `Quote ${quoteNumber} emailed to ${recipient}. The job is now waiting on the customer.`
        : `Quote ${quoteNumber} was saved and the job moved to Quoted. ${email.message}`,
  };
}
