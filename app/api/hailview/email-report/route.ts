import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend/send';
import {
  buildReportHtml,
  buildReportSubject,
  validateEmailReportBody,
} from '@/lib/hailview/email-report-html';

// This route is deliberately thin. Validation, escaping and rendering all
// live in lib/hailview/email-report-html.ts, which is unit-tested — see that
// file's SECURITY NOTE for the HTML-injection defect hv2-02 fixed, the rules
// it now enforces, and the residual client-supplied-content concern that is
// recorded as PENDING REID.

/**
 * Matches this codebase's standing Resend-degrade pattern (lib/resend/send.ts):
 * when RESEND_API_KEY/RESEND_FROM_EMAIL are not configured, sendEmail()
 * returns a soft { success: false } rather than throwing. This route
 * reflects that as a normal 200 response with sent:false so the HailView UI
 * can say "email delivery isn't live yet" without treating the rest of the
 * lookup flow as broken.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await request.json().catch(() => null)) as unknown;

    const validated = validateEmailReportBody(raw);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.body;

    const result = await sendEmail({
      to: body.email,
      subject: buildReportSubject(body),
      html: buildReportHtml(body),
    });

    if (!result.success) {
      const notConfigured = result.error === 'Resend is not configured.';
      return NextResponse.json({
        sent: false,
        reason: notConfigured ? 'not_configured' : 'send_failed',
        message: notConfigured
          ? "Email delivery isn't live yet — you can screenshot or print this page to save your results."
          : 'Could not send the email right now. Try again shortly.',
      });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('[HailView Email Report Error]', error);
    return NextResponse.json({ error: 'Could not send the report. Please try again.' }, { status: 500 });
  }
}
