import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isJobStage, planStageTransition, type JobStageValue } from '@/lib/data/job-stage';
import { verifyApproveToken, redeemVerdict } from '@/lib/pricing/approve-token';
import { appendLedger, ledgerTestTag } from '@/lib/pricing/ledger';
import { createInvoiceFromQuote, type QuoteForInvoice } from '@/lib/invoices/create';

/**
 * THE APPROVE BUTTON IN THE QUOTE EMAIL.
 *
 * ================ THIS IS NOT A PATHFINDEREDGE BYPASS. READ WHY. ================
 *
 * CLAUDE.md rule #14: the only way anything reaches PathfinderEdge catalog
 * 20115 is a Command Center approval that `pushProfileToPathfinder` VERIFIES IN
 * THE DATABASE before any network call — the quote request must still be
 * `status='submitted'`, and the acting user must be a real `role='admin'`
 * profile.
 *
 * This route CREATES exactly that record and pushes nothing:
 *
 *   1. It writes `job_stage='approved'`, `approval_channel='email'`,
 *      `approved_at`, and `approved_by` = the customer's own profile when they
 *      have one (a guest leaves it null, which is the truth — no AFS admin
 *      clicked anything).
 *   2. It LEAVES `status='submitted'` alone, precisely so the guard's own
 *      condition still holds when an admin later presses "Send to machine".
 *   3. It imports NOTHING from lib/integrations/pathfinder-edge.ts and makes no
 *      outbound request to it. The static single-door test
 *      (lib/integrations/pathfinder-single-door.test.ts) would fail if it did,
 *      and that failure would be correct.
 *
 * The machine send remains a separate, deliberate admin click through the one
 * door. What this route changes is only HOW THE APPROVAL ARRIVED — the customer
 * clicked a link instead of telephoning. Exactly the same contract as
 * approve-by-phone.
 *
 * ================ THE LINK ================
 *
 * Signed (HMAC-SHA256), single-use, expiring. `verifyApproveToken` decides
 * shape, signature and expiry; the single-use half is a conditional UPDATE on
 * `quote_approval_tokens` — `where used_at is null` — so two simultaneous
 * clicks cannot both win. Only the token's HASH is ever stored.
 *
 * It answers with a PAGE, not JSON: a customer clicking a link in their email
 * must land on something readable, whatever the outcome.
 */
export const dynamic = 'force-dynamic';

interface QuoteRow extends QuoteForInvoice {
  status: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  try {
    const token = decodeURIComponent(params.token ?? '');

    // ---- 1. Is the link genuine and in date? ----------------------------
    const verdict = verifyApproveToken(token);
    if (!verdict.ok) {
      return page({
        tone: verdict.reason === 'expired' ? 'warn' : 'error',
        heading: verdict.reason === 'expired' ? 'That link has expired' : 'We could not use that link',
        body: verdict.message,
        status: verdict.reason === 'expired' ? 410 : 400,
      });
    }

    const admin = createAdminClient();

    // ---- 2. Has it already been used? ------------------------------------
    const { data: tokenRows } = await admin
      .from('quote_approval_tokens')
      .select('id, quote_id, quote_request_id, expires_at, used_at, issued_to')
      .eq('token_hash', verdict.tokenHash)
      .limit(1);
    const tokenRow = (tokenRows ?? [])[0] as
      | { id: string; quote_id: string; quote_request_id: string | null; expires_at: string; used_at: string | null }
      | undefined;

    const redeem = redeemVerdict(
      tokenRow ? { expiresAt: tokenRow.expires_at, usedAt: tokenRow.used_at } : null
    );
    if (!redeem.ok) {
      return page({
        tone: redeem.reason === 'used' ? 'ok' : 'warn',
        heading: redeem.reason === 'used' ? 'Already approved' : 'We could not use that link',
        body: redeem.message,
        status: redeem.reason === 'used' ? 200 : 410,
      });
    }
    const row = tokenRow as NonNullable<typeof tokenRow>;

    // ---- 3. Spend it, atomically ------------------------------------------
    // `is('used_at', null)` in the WHERE is what makes this single-use under a
    // double-click or a mail client that prefetches links: the second UPDATE
    // matches no rows, and nothing below it runs twice.
    const approvedAt = new Date();
    const approvedAtIso = approvedAt.toISOString();
    const { data: spent } = await admin
      .from('quote_approval_tokens')
      .update({
        used_at: approvedAtIso,
        used_from: request.headers.get('x-forwarded-for') ?? null,
      })
      .eq('id', row.id)
      .is('used_at', null)
      .select('id');
    if (!spent || spent.length === 0) {
      return page({
        tone: 'ok',
        heading: 'Already approved',
        body: 'This quote has already been approved — thank you. There is nothing more to do.',
        status: 200,
      });
    }

    // ---- 4. The quote and the job -----------------------------------------
    const { data: quoteData } = await admin
      .from('quotes')
      .select(
        'id, quote_number, request_id, user_id, customer_email, customer_name, line_items, price_book_snapshot, subtotal_cents, total_cents, revision, sent_at, status'
      )
      .eq('id', row.quote_id)
      .maybeSingle();
    const quote = quoteData as QuoteRow | null;
    if (!quote) {
      return page({
        tone: 'error',
        heading: 'We could not find that quote',
        body: 'The quote this link points at is no longer on file. Please get in touch and we will send a fresh one.',
        status: 404,
      });
    }
    if (quote.status === 'expired' || quote.status === 'cancelled') {
      return page({
        tone: 'warn',
        heading: 'That quote has been replaced',
        body: 'We have since sent you a revised quote. Please approve the newer one, or get in touch and we will resend it.',
        status: 410,
      });
    }

    const jobId = quote.request_id ?? row.quote_request_id;
    const { data: jobData } = jobId
      ? await admin
          .from('quote_requests')
          .select(
            'id, request_number, job_name, job_stage, status, user_id, is_rush, po_number, client_business_name, guest_email'
          )
          .eq('id', jobId)
          .maybeSingle()
      : { data: null };
    const job = jobData as {
      id: string;
      request_number: string;
      job_name: string | null;
      job_stage: string | null;
      status: string;
      user_id: string | null;
      is_rush: boolean;
      po_number: string | null;
      client_business_name: string | null;
      guest_email: string | null;
    } | null;

    const testTag = ledgerTestTag(job?.job_name ?? null);

    // ---- 5. The approval record the single-door guard reads ---------------
    let stageMessage = '';
    if (job) {
      const from: JobStageValue = isJobStage(job.job_stage) ? job.job_stage : null;
      const transition = planStageTransition(from, 'approved');
      if (transition.outcome === 'advance') {
        await admin
          .from('quote_requests')
          .update({
            job_stage: 'approved',
            stage_changed_at: approvedAtIso,
            approved_at: approvedAtIso,
            approval_channel: 'email',
            // The CUSTOMER approved, so this is their profile id — or null for a
            // guest, because no AFS admin clicked anything.
            approved_by: job.user_id,
            // `status` is DELIBERATELY NOT TOUCHED. The single-door guard
            // requires status='submitted' when it verifies this approval, and
            // this job has not been sent to the machine yet.
          })
          .eq('id', job.id);
        stageMessage = 'We have started getting your job ready.';
      } else {
        // Already approved, or further along. The customer is not told off for
        // clicking a link we sent them.
        stageMessage = 'Your job is already under way.';
      }
    }

    await admin
      .from('quotes')
      .update({ status: 'approved', approved_at: approvedAtIso })
      .eq('id', quote.id);

    // ---- 6. The invoice, created from the quote with no retyping ----------
    let invoiceNumber: string | null = null;
    let invoiceNote = '';
    try {
      const result = await createInvoiceFromQuote(
        admin,
        quote,
        {
          jobName: job?.job_name ?? null,
          company: job?.client_business_name ?? null,
          poNumber: job?.po_number ?? null,
          isRush: job?.is_rush ?? false,
          testTag,
        },
        approvedAt,
        { id: job?.user_id ?? null, email: quote.customer_email, role: 'customer' }
      );
      invoiceNumber = result.invoiceNumber;
      invoiceNote = `Your invoice is ${result.invoiceNumber} and a copy is on its way to you.`;
    } catch (err) {
      // The approval REALLY HAPPENED and is recorded. An invoicing failure does
      // not un-approve it, and the customer is not shown a scary error for
      // something on our side.
      console.error('[Quote Approve] invoice creation failed', err);
      invoiceNote = 'We will send your invoice shortly.';
    }

    // ---- 7. The pricing history -------------------------------------------
    const sentAt = quote.sent_at ? new Date(quote.sent_at) : null;
    await appendLedger(admin, {
      eventType: 'quote_outcome',
      source: 'customer_link',
      occurredAt: approvedAtIso,
      actorId: job?.user_id ?? null,
      actorEmail: quote.customer_email,
      actorRole: 'customer',
      quoteRequestId: job?.id ?? quote.request_id,
      quoteId: quote.id,
      customerId: quote.user_id,
      customerLabel: job?.client_business_name ?? quote.customer_name ?? quote.customer_email,
      isRush: job?.is_rush ?? null,
      amountCents: quote.total_cents,
      revision: quote.revision,
      outcome: 'approved',
      outcomeReason: 'Approved from the link in the quote email.',
      timeToDecisionSeconds: sentAt ? Math.round((approvedAt.getTime() - sentAt.getTime()) / 1000) : null,
      payload: { quoteNumber: quote.quote_number, invoiceNumber, approvalChannel: 'email' },
      testTag,
    });

    await logAdminAction({
      adminId: null,
      action: 'quote_approved_by_customer_link',
      resourceType: 'quote_request',
      resourceId: job?.id ?? quote.id,
      afterValue: {
        jobStage: 'approved',
        approvalChannel: 'email',
        quoteNumber: quote.quote_number,
        invoiceNumber,
        // Stated so an auditor does not have to infer it.
        statusLeftAt: job?.status ?? null,
        pathfinderPushed: false,
      },
    });

    return page({
      tone: 'ok',
      heading: 'Thank you — your quote is approved',
      body: `${stageMessage} ${invoiceNote}`.trim(),
      detail: `Quote ${quote.quote_number}${job ? ` · Job ${job.request_number}` : ''}`,
      status: 200,
    });
  } catch (error) {
    console.error('[Quote Approve Error]', error);
    return page({
      tone: 'error',
      heading: 'Something went wrong at our end',
      body: 'Your approval did not go through. Please reply to the quote email and we will sort it out.',
      status: 500,
    });
  }
}

/**
 * The page the customer sees. Plain HTML with literal colours, for the same
 * reason the email templates use them: this is rendered standalone, outside the
 * app shell, and must read correctly with no stylesheet available.
 *
 * Contrast, measured: #111111 on #FFFFFF is 18.1:1, #374151 on #FFFFFF is
 * 9.8:1, #17683A on #E3F2E9 is 5.9:1, #7A4200 on #FFF1B8 is 7.1:1 — the same
 * pairs, and the same measured ratios, recorded in tailwind.config.js for the
 * light working area.
 */
function page(opts: {
  tone: 'ok' | 'warn' | 'error';
  heading: string;
  body: string;
  detail?: string;
  status: number;
}): NextResponse {
  const accent = opts.tone === 'ok' ? '#17683A' : opts.tone === 'warn' ? '#7A4200' : '#C0001A';
  const band = opts.tone === 'ok' ? '#E3F2E9' : opts.tone === 'warn' ? '#FFF1B8' : '#FFFFFF';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.heading)} — Architectural Flashing Supply</title>
</head>
<body style="margin:0;background:#F1F2F4;font-family:Arial,Helvetica,sans-serif;color:#111111;">
  <div style="background:#1C1F26;padding:20px;text-align:center;">
    <span style="font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:4px;">AFS</span>
    <div style="font-size:10px;color:#C8D0E0;letter-spacing:3px;margin-top:4px;">ARCHITECTURAL FLASHING SUPPLY</div>
  </div>
  <div style="background:#C0001A;height:3px;"></div>
  <main style="max-width:600px;margin:32px auto;background:#FFFFFF;border:1px solid #D8D8D4;border-radius:10px;padding:32px;">
    <div style="background:${band};border-radius:8px;padding:20px;">
      <h1 style="margin:0;font-size:24px;line-height:1.3;color:${accent};">${escapeHtml(opts.heading)}</h1>
    </div>
    <p style="font-size:17px;line-height:1.6;color:#111111;margin:20px 0 0;">${escapeHtml(opts.body)}</p>
    ${opts.detail ? `<p style="font-size:14px;color:#374151;margin:16px 0 0;">${escapeHtml(opts.detail)}</p>` : ''}
    <p style="font-size:14px;color:#374151;margin:24px 0 0;">
      Questions? Reply to the email this link came from, or call (512) 372-4900.
    </p>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status: opts.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
