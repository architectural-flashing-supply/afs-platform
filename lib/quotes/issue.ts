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
import { getResolvedPriceBook, getRushPolicyBook } from '@/lib/pricing/db';
import { quoteFromPriceBook } from '@/lib/pricing/quote-math';
import {
  evaluateRushLeadTime,
  evaluateRushSurcharge,
  rushPolicyInForce,
  type RushLeadTime,
  type RushPolicy,
  type RushSurcharge,
} from '@/lib/pricing/rush-policy';
import { shopDateOnly } from '@/lib/delivery/business-days';
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
  /**
   * The date the customer asked for, `quote_requests.requested_delivery`.
   * Read ONLY to check it against the rush policy's minimum notice — it never
   * decides whether the job is rush (CLAUDE.md rule #15: rush is set by the
   * customer's own checkbox or an admin's own toggle, and by nothing else).
   */
  requested_delivery: string | null;
  po_number: string | null;
  client_business_name: string | null;
  client_name: string | null;
  job_stage: string | null;
  quote_id: string | null;
}

/**
 * THE RUSH SIDE OF A QUOTE, in one object, resolved once.
 *
 * Carries the POLICY as well as the computed surcharge, because the Job screen
 * re-totals in the browser as the estimator edits Qty and has to recompute the
 * surcharge with the SAME `evaluateRushSurcharge` the server uses on Send. One
 * function, both sides, no drift.
 */
export interface RushQuoteContext {
  policy: RushPolicy | null;
  /** Non-null when the policy table could not be read. Plain English. */
  policyUnavailable: string | null;
  surcharge: RushSurcharge;
  leadTime: RushLeadTime;
}

/**
 * Resolves the rush policy and works out what it says about this job.
 *
 * ONE QUERY, AND ONLY FOR A RUSH JOB. A standard job short-circuits to
 * `not-rush` / `not-rush` without touching the database — there is nothing a
 * rush policy could say about it.
 *
 * `today` is the SHOP's date (`shopDateOnly`), never the server's: Vercel runs
 * in UTC and Burnet is Central, so a lead time measured from the raw clock
 * would be a day out every evening (CLAUDE.md rule #24's second hazard).
 */
export async function rushContextForJob(
  supabase: SupabaseClient,
  job: Pick<JobForQuote, 'is_rush' | 'requested_delivery'>,
  priced: { subtotalCents: number; lines: readonly { quantity: number }[] } | null,
  now: Date = new Date()
): Promise<RushQuoteContext> {
  if (!job.is_rush) {
    return {
      policy: null,
      policyUnavailable: null,
      surcharge: evaluateRushSurcharge({ isRush: false, subtotalCents: 0, pieceCount: 0 }, null),
      leadTime: evaluateRushLeadTime(
        { isRush: false, requestedDelivery: job.requested_delivery, today: shopDateOnly(now) },
        null
      ),
    };
  }

  const today = shopDateOnly(now);
  const book = await getRushPolicyBook(supabase);
  const policy = rushPolicyInForce(book.policies, today);

  const subtotalCents = priced?.subtotalCents ?? 0;
  const pieceCount = (priced?.lines ?? []).reduce((sum, l) => sum + l.quantity, 0);

  return {
    policy,
    policyUnavailable: book.unavailable,
    surcharge: evaluateRushSurcharge({ isRush: true, subtotalCents, pieceCount }, policy),
    leadTime: evaluateRushLeadTime(
      { isRush: true, requestedDelivery: job.requested_delivery, today },
      policy
    ),
  };
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
      /** Lines PLUS the rush surcharge — what the customer was asked for. */
      totalCents: number;
      /** 0 for a standard job, and for a rush with no policy in force. */
      rushSurchargeCents: number;
      /** So the route's audit row records WHY the surcharge was what it was. */
      rushSurchargeState: RushSurcharge['kind'];
      rushLeadTimeStatus: RushLeadTime['status'];
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

  // ---- The rush side, decided by AFS, here, on the formal quote -----------
  //
  // THE QUOTE IS WHERE THE SURCHARGE IS DECIDED. The customer REQUESTED rush
  // (a checkbox) and may have given a date; neither of those carries a price,
  // and the RFQ model says the only dollar amount a customer ever sees is one
  // AFS set deliberately. This is that moment.
  //
  // WITH AN EMPTY `rush_policies` TABLE THIS IS 0, AND EVERY FIGURE WRITTEN
  // BELOW IS IDENTICAL TO WHAT IT WAS BEFORE THIS CODE EXISTED. That invariant
  // is asserted directly, over a grid of subtotals and piece counts, in
  // lib/pricing/rush-policy.test.ts — shipping a rush policy must not silently
  // change the value of a single quote.
  const rush = await rushContextForJob(supabase, job, priced, now);
  const rushSurchargeCents = rush.surcharge.surchargeCents;
  const totalCents = priced.subtotalCents + rushSurchargeCents;

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
      total: totalCents / 100,
      // SUBTOTAL IS THE LINES AND THE TOTAL CARRIES THE SURCHARGE. Their
      // DIFFERENCE is the rush fee, which is what lets the invoice — whose
      // table has no rush column — present the same figure without recomputing
      // anything or needing a migration.
      subtotal_cents: priced.subtotalCents,
      total_cents: totalCents,
      // The existing column (migration 001), in dollars like the other legacy
      // numeric ones. It was hardcoded 0 until now, and three screens already
      // display it when it is non-zero: the customer's quote in their portal,
      // the admin order detail, and the invoice PDF.
      rush_surcharge: rushSurchargeCents / 100,
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
    totalCents,
    // Only a surcharge that is actually a figure reaches the customer's
    // document. `null` for a standard job, for an unpriced rush and for an
    // explicit "no extra charge" — a $0.00 row is noise on a quote, and a rush
    // nobody has priced must not appear as though it were free.
    surchargeCents: rushSurchargeCents > 0 ? rushSurchargeCents : null,
    surchargeLabel: rush.surcharge.customerLabel,
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
      quoteTotalCents: totalCents,
      quoteSubtotalCents: priced.subtotalCents,
      supersedesQuoteId: prior?.id ?? null,
      emailStatus: email.status,
      // The rush facts travel in the EXISTING payload JSON rather than in new
      // ledger columns — `pricing_ledger` is append-only and adding a column
      // would be a migration applied to a live table. `is_rush` above already
      // carries the flag; these say what it cost and what the policy said.
      rushSurchargeCents,
      rushPolicyId: rush.surcharge.policyId,
      rushSurchargeState: rush.surcharge.kind,
      rushLeadTimeStatus: rush.leadTime.status,
    },
    testTag,
  }));
  await appendLedger(supabase, entries);

  return {
    ok: true,
    quoteId,
    quoteNumber,
    revision,
    totalCents,
    rushSurchargeCents,
    rushSurchargeState: rush.surcharge.kind,
    rushLeadTimeStatus: rush.leadTime.status,
    approveUrl,
    emailStatus: email.status,
    emailMessage: email.message,
    message:
      (email.status === 'sent'
        ? `Quote ${quoteNumber} emailed to ${recipient}. The job is now waiting on the customer.`
        : `Quote ${quoteNumber} was saved and the job moved to Quoted. ${email.message}`) +
      // A rush job whose surcharge could not be worked out is told about HERE,
      // on the one screen that could act on it, rather than quietly going out
      // at the standard price. It is not a failure: the quote is sent.
      (rush.surcharge.kind === 'unpriced' ? ` ${rush.surcharge.message}` : ''),
  };
}
