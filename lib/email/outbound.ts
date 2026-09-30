/**
 * EVERY QUOTE, APPROVAL AND INVOICE EMAIL GOES THROUGH HERE — and every one of
 * them is written down, whether it was sent, captured or refused.
 *
 * It wraps the site's EXISTING email service (Resend, `lib/resend/send.ts`)
 * rather than introducing a second one. `notifications` already records that a
 * send was attempted, but it has nowhere to put what was in the message and its
 * status CHECK is ('sent','delivered','failed') only; `outbound_emails`
 * (migration 035) records the message itself, which is what makes "the invoice
 * was emailed to Tricia" a claim somebody can go and check.
 *
 * ===================== TEST MODE, AND WHY IT IS NOT A FLAG =====================
 *
 * A deployment-wide "test mode" env var on alpha would silence real customer
 * mail for everyone the moment somebody forgot to turn it off. So test mode is
 * decided PER MESSAGE, by the same reserved job-name prefix the pricing ledger
 * uses (`E2E-TEST-`, lib/pricing/ledger.ts): a message about a test job is
 * CAPTURED — written to `outbound_emails` with status 'captured_test_mode' and
 * NO PROVIDER CALL MADE AT ALL — while a message about a real job goes out
 * normally. One reserved prefix, one rule, two uses.
 *
 * `AFS_EMAIL_TEST_MODE=1` forces capture for everything, for local development.
 * It is deliberately NOT set in Vercel.
 *
 * ===================== WHEN RESEND IS NOT CONFIGURED =====================
 *
 * As of this build `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in neither
 * .env.local nor Vercel, so `sendEmail()` returns "Resend is not configured."
 * That is recorded honestly as status 'not_configured' — the row still says
 * exactly what would have gone to whom — instead of being reported to the admin
 * as a success. Nothing here pretends a message left the building.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend/send';

export type OutboundEmailStatus = 'sent' | 'failed' | 'captured_test_mode' | 'not_configured';

export interface OutboundEmailInput {
  /** 'quote' | 'invoice_customer' | 'invoice_office' | 'quote_followup' … */
  kind: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  quoteId?: string | null;
  quoteRequestId?: string | null;
  invoiceId?: string | null;
  createdBy?: string | null;
  /**
   * Non-null = this is a test job. The message is captured and NOTHING is sent.
   * Callers get it from `ledgerTestTag(job.job_name)`.
   */
  testTag?: string | null;
}

export interface OutboundEmailResult {
  status: OutboundEmailStatus;
  /** True only when a provider really accepted it. */
  delivered: boolean;
  providerId: string | null;
  error: string | null;
  /** Plain English, safe to show an admin. */
  message: string;
}

/** Forced capture for local development. Never set in Vercel. */
export function emailTestModeForced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AFS_EMAIL_TEST_MODE === '1';
}

export async function sendTrackedEmail(input: OutboundEmailInput): Promise<OutboundEmailResult> {
  const captured = Boolean(input.testTag) || emailTestModeForced();

  let result: OutboundEmailResult;
  if (captured) {
    result = {
      status: 'captured_test_mode',
      delivered: false,
      providerId: null,
      error: null,
      message: `Test mode: this message was recorded and NOT sent. It would have gone to ${input.to}.`,
    };
  } else if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    result = {
      status: 'not_configured',
      delivered: false,
      providerId: null,
      error: 'Resend is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL are unset).',
      message:
        `Email is not connected yet, so nothing was sent to ${input.to}. ` +
        `The message is saved here — send it from Outlook for now.`,
    };
  } else {
    const sent = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    result = sent.success
      ? {
          status: 'sent',
          delivered: true,
          providerId: sent.id ?? null,
          error: null,
          message: `Emailed to ${input.to}.`,
        }
      : {
          status: 'failed',
          delivered: false,
          providerId: null,
          error: sent.error ?? 'Unknown email error.',
          message: `That email did not go out to ${input.to}. ${sent.error ?? ''}`.trim(),
        };
  }

  // Recorded through the service role: `outbound_emails` is admin-only, and the
  // approve link runs with no session at all. A logging failure never changes
  // the outcome that was already decided above.
  try {
    await createAdminClient()
      .from('outbound_emails')
      .insert({
        kind: input.kind,
        recipient: input.to,
        subject: input.subject,
        body_html: input.html,
        status: result.status,
        provider_id: result.providerId,
        error: result.error,
        quote_id: input.quoteId ?? null,
        quote_request_id: input.quoteRequestId ?? null,
        invoice_id: input.invoiceId ?? null,
        created_by: input.createdBy ?? null,
      });
  } catch (err) {
    console.error('[Outbound Email] could not record the message', err);
  }

  return result;
}
