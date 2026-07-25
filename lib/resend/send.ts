import { RESEND_API_URL, FROM_NAME } from './client';

export interface SendEmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: SendEmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Extends SPEC_RESEND_INTEGRATION.md §2's literal `Promise<void>` signature
 * to return a real success/error result instead, so callers can log an
 * accurate `notifications.status` ('sent'/'failed') the same way
 * lib/twilio/sms.ts's `sendSms()` already does for SMS. Never throws —
 * ARCHITECTURE.md §9: "notification failure must never block order flow."
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return { success: false, error: 'Resend is not configured.' };
  }

  try {
    const payload: Record<string, unknown> = {
      from: `${FROM_NAME} <${fromEmail}>`,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo ?? fromEmail,
    };

    if (opts.attachments?.length) {
      // Resend's REST API expects attachment content as a base64 string, not
      // a raw binary body — per their documented /emails payload shape. Not
      // independently re-verified against a live send in this sandbox (no
      // real RESEND_API_KEY is configured here) — flagged per this
      // codebase's own convention of labeling unverified integration
      // assumptions (see e.g. the Machine Bridge's DS1 generator).
      payload.attachments = opts.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
      }));
    }

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!res.ok) {
      return { success: false, error: data.message ?? `Resend responded with HTTP ${res.status}` };
    }

    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Resend error' };
  }
}
