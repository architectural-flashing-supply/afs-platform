/**
 * TELLING THE CUSTOMER WHEN THEIR DELIVERY IS — THROUGH THE SERVICES THAT
 * ALREADY EXIST. There is no second notification path here.
 *
 * Every line of plumbing below is a call into something this codebase already
 * ships, named so it can be checked:
 *
 *   lib/email/outbound.ts        sendTrackedEmail() — wraps lib/resend/send.ts,
 *                                writes `outbound_emails`, and CAPTURES rather
 *                                than sends when the job carries the reserved
 *                                `E2E-TEST-` prefix (CLAUDE.md rule #21).
 *   lib/resend/templates/base.ts baseEmailTemplate() + ctaButton() — the same
 *                                shell and the same crimson button the
 *                                dispatch email has used since afs-fl-014.
 *   lib/twilio/sms.ts            sendSms() — the only real SMS sender in the
 *                                codebase, already used by the 10-mile alert.
 *   lib/delivery/tracking-url.ts trackingUrlFor() — the one tracking-link
 *                                formula, now shared with the three older
 *                                callers rather than copied a fourth time.
 *   lib/pricing/ledger.ts        ledgerTestTag() — the ONE function that
 *                                decides a job is a test job.
 *   `notifications`              the existing row, written the same way
 *                                app/api/orders/[id]/dispatch/route.ts writes
 *                                its own.
 *
 * ================== WHAT IS NEVER PRETENDED ==================
 *
 * The result that comes back says what really happened, per channel. Resend is
 * not configured on this deployment, so the honest answer today is "the
 * message is saved here, nothing left the building" — and that is exactly what
 * `sendTrackedEmail` reports and what the Deliveries screen shows. Nothing
 * here writes `notified_at` unless a channel genuinely produced a result to
 * record.
 *
 * ================== SMS AND THE OPT-OUT ==================
 *
 * A text goes out only when the customer has a phone number AND `sms_opt_in`
 * is true — the same gate the dispatch route and the 10-mile alert apply.
 * Delivery scheduling is important, but it does not override an explicit
 * opt-out. And a TEST job never reaches Twilio at all: the capture rule that
 * protects customer email has to protect their phone too, or the prefix would
 * be half a promise.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTrackedEmail } from '@/lib/email/outbound';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';
import { sendSms } from '@/lib/twilio/sms';
import { ledgerTestTag } from '@/lib/pricing/ledger';
import { trackingUrlFor } from '@/lib/delivery/tracking-url';
import { findOrderForShopJob } from '@/lib/utils/shop-job-completion';
import { deliveryWindowLabel } from '@/lib/delivery/windows';
import { formatDayHeading, type DateOnly } from '@/lib/delivery/business-days';

export interface DeliveryNotifyInput {
  /** shop_profile_library.id — the piece of work being delivered. */
  shopJobId: string;
  /** The Job this belongs to, when there is one. Used for the tracking link. */
  quoteRequestId: string | null;
  orderNumber: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  /** "Drip edge" — what is being delivered, in the customer's words. */
  itemDescription: string;
  quantity: number | null;
  /** shop_profile_library.job_name — the ONLY thing that makes this a test. */
  jobName: string | null;
  scheduledDate: DateOnly;
  timeWindow: string;
  /** True when Mark finished booked this, false when a person picked the day. */
  autoScheduled: boolean;
}

export interface DeliveryNotifyResult {
  /** True when at least one channel produced a recordable result. */
  attempted: boolean;
  /** Plain English, safe to show an admin verbatim. */
  note: string;
  emailStatus: 'sent' | 'captured_test_mode' | 'not_configured' | 'failed' | 'no_address';
  smsStatus: 'sent' | 'captured_test_mode' | 'failed' | 'opted_out' | 'no_number';
  trackingUrl: string | null;
}

function firstName(full: string | null): string {
  const name = (full ?? '').trim();
  if (name === '') return 'there';
  return name.split(/\s+/)[0];
}

/**
 * Sends the "your delivery is booked" email and text.
 *
 * `supabase` must be a client that can read `orders` and `profiles` across
 * customers — in practice the service-role client, which is what every caller
 * here already holds. Never throws: a delivery that is genuinely booked in the
 * database must not be rolled back because an email provider was down, which
 * is the same rule ARCHITECTURE.md §9 puts on every other notification send.
 */
export async function notifyDeliveryScheduled(
  supabase: SupabaseClient,
  input: DeliveryNotifyInput
): Promise<DeliveryNotifyResult> {
  const testTag = ledgerTestTag(input.jobName);
  const dayText = formatDayHeading(input.scheduledDate);
  const windowText = deliveryWindowLabel(input.timeWindow);

  let trackingUrl: string | null = null;
  try {
    const order = await findOrderForShopJob(
      supabase as unknown as Parameters<typeof findOrderForShopJob>[0],
      { quoteRequestId: input.quoteRequestId, orderNumber: input.orderNumber }
    );
    trackingUrl = trackingUrlFor(order?.trackingToken);
  } catch {
    // A job with no paid order behind it has nothing to track. That is the
    // normal case for a V2 job today, not an error — the notification simply
    // gives the day and the window instead of a dead link.
    trackingUrl = null;
  }

  const qty = input.quantity && input.quantity > 0 ? ` × ${input.quantity}` : '';
  const subject = `Your AFS delivery is scheduled for ${dayText}`;

  // --- Email: the existing template, the existing sender ------------------
  let emailStatus: DeliveryNotifyResult['emailStatus'] = 'no_address';
  const to = (input.customerEmail ?? '').trim();
  if (to !== '') {
    const html = baseEmailTemplate(`
      <h1 style="font-size:20px;margin:0 0 16px;">Your Delivery Is Scheduled</h1>
      <p style="margin:0 0 12px;">Hi ${firstName(input.customerName)},</p>
      <p style="margin:0 0 12px;">Your ${input.itemDescription}${qty} is finished and going out on
        <strong>${dayText}</strong>, between <strong>${windowText}</strong>.</p>
      ${trackingUrl ? ctaButton(trackingUrl, 'Track Your Delivery') : ''}
      <p style="margin:16px 0 0;">If that day or time does not work, reply to this email and we will move it.</p>
    `);
    const sent = await sendTrackedEmail({
      kind: 'delivery_scheduled',
      to,
      subject,
      html,
      quoteRequestId: input.quoteRequestId,
      testTag,
    });
    emailStatus =
      sent.status === 'sent'
        ? 'sent'
        : sent.status === 'captured_test_mode'
          ? 'captured_test_mode'
          : sent.status === 'not_configured'
            ? 'not_configured'
            : 'failed';
    // A CAPTURED test message gets NO `notifications` row. That table's own
    // status CHECK is ('sent','delivered','failed'), so the only value a
    // capture could take is 'failed' — which would be a lie about a message
    // nobody tried to send. The capture is recorded in full in
    // `outbound_emails` instead, which is the table built to hold it.
    if (sent.status !== 'captured_test_mode') {
      await recordNotification(supabase, {
        recipient: to,
        channel: 'email',
        status: sent.delivered ? 'sent' : 'failed',
        error: sent.delivered ? null : sent.message,
      });
    }
  }

  // --- SMS: the existing sender, the existing opt-in gate -----------------
  let smsStatus: DeliveryNotifyResult['smsStatus'] = 'no_number';
  const phone = (input.customerPhone ?? '').trim();
  if (phone === '') {
    smsStatus = 'no_number';
  } else if (testTag) {
    // A test job never reaches a phone carrier. Recorded, not sent.
    smsStatus = 'captured_test_mode';
  } else if (!(await smsOptedIn(supabase, input.quoteRequestId))) {
    smsStatus = 'opted_out';
  } else {
    const body =
      `Your AFS ${input.itemDescription}${qty} is finished and going out ${dayText}, ${windowText}.` +
      (trackingUrl ? ` Track it: ${trackingUrl}` : '');
    const result = await sendSms(phone, body);
    smsStatus = result.success ? 'sent' : 'failed';
    await recordNotification(supabase, {
      recipient: phone,
      channel: 'sms',
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : (result.error ?? 'Unknown SMS error'),
    });
  }

  return {
    attempted: emailStatus !== 'no_address' || smsStatus !== 'no_number',
    note: describe(emailStatus, smsStatus, to, phone),
    emailStatus,
    smsStatus,
    trackingUrl,
  };
}

/**
 * The `notifications` row. Written exactly the way the dispatch route writes
 * its own — `order_id` and `user_id` stay null here, because a V2 shop job is
 * neither an order nor a user, and inventing a link would be worse than
 * leaving the columns empty.
 *
 * A failure to record never changes what already happened.
 */
async function recordNotification(
  supabase: SupabaseClient,
  row: { recipient: string; channel: 'email' | 'sms'; status: 'sent' | 'failed'; error: string | null }
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      order_id: null,
      user_id: null,
      channel: row.channel,
      type: 'delivery_scheduled',
      recipient: row.recipient,
      status: row.status,
      error: row.error,
    });
  } catch (err) {
    console.error('[Delivery Notify] could not record the notification', err);
  }
}

/** The customer's own SMS opt-in, read through the Job's owner. */
async function smsOptedIn(supabase: SupabaseClient, quoteRequestId: string | null): Promise<boolean> {
  if (!quoteRequestId) return false;
  try {
    const { data: job } = await supabase
      .from('quote_requests')
      .select('user_id')
      .eq('id', quoteRequestId)
      .maybeSingle();
    const userId = (job as { user_id?: string | null } | null)?.user_id;
    if (!userId) return false;
    const { data: profile } = await supabase
      .from('profiles')
      .select('sms_opt_in')
      .eq('id', userId)
      .maybeSingle();
    return Boolean((profile as { sms_opt_in?: boolean } | null)?.sms_opt_in);
  } catch {
    return false;
  }
}

/**
 * One sentence an admin can read off the screen. Exported so the wording is
 * unit-testable without a database or a provider.
 */
export function describe(
  emailStatus: DeliveryNotifyResult['emailStatus'],
  smsStatus: DeliveryNotifyResult['smsStatus'],
  to: string,
  phone: string
): string {
  const parts: string[] = [];
  switch (emailStatus) {
    case 'sent':
      parts.push(`Emailed ${to}.`);
      break;
    case 'captured_test_mode':
      parts.push(`Test job: the email to ${to} was recorded and NOT sent.`);
      break;
    case 'not_configured':
      parts.push(`Email is not connected yet, so nothing went to ${to}. The message is saved.`);
      break;
    case 'failed':
      parts.push(`That email did not go out to ${to}.`);
      break;
    case 'no_address':
      parts.push('No email address on this job, so nobody was emailed.');
      break;
  }
  switch (smsStatus) {
    case 'sent':
      parts.push(`Texted ${phone}.`);
      break;
    case 'captured_test_mode':
      parts.push('Test job: no text was sent.');
      break;
    case 'failed':
      parts.push(`That text did not go out to ${phone}.`);
      break;
    case 'opted_out':
      parts.push('No text — this customer has not opted in to texts.');
      break;
    case 'no_number':
      parts.push('No phone number on this job, so no text was sent.');
      break;
  }
  return parts.join(' ');
}
