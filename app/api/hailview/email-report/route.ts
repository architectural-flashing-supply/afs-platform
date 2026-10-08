import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend/send';
import {
  buildReportHtml,
  buildReportSubject,
  validateEmailReportBody,
} from '@/lib/hailview/email-report-html';
import { verifyHailViewReportSignature } from '@/lib/hailview/report-signature';

// This route is deliberately thin. Validation, escaping and rendering all
// live in lib/hailview/email-report-html.ts, which is unit-tested — see that
// file's SECURITY NOTE for the HTML-injection defect hv2-02 fixed.
//
// hv2-03 closed the other half: this endpoint is unauthenticated and sends
// AFS-branded mail from AFS's own domain, so it now REFUSES ANY REPORT IT
// CANNOT VERIFY. The lookup route signs what it computed; this route checks
// the MAC before it sends anything, so the caller can no longer author the
// content — only ask us to mail back something this server produced. Full
// contract, including what signing does NOT fix: lib/hailview/report-signature.ts.

// Per-IP rate limit, same in-process pattern as app/api/track/verify/route.ts.
// This is a serverless deployment, so the map is per instance and this is a
// speed bump rather than a hard quota — it blunts scripted abuse without
// adding infrastructure. A durable limit needs a shared store (see the
// governance note); do not mistake this for one.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const sendsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const sends = (sendsByIp.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  sends.push(now);
  sendsByIp.set(ip, sends);
  return sends.length > RATE_LIMIT_MAX;
}

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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many reports sent from this connection. Please try again later.' },
        { status: 429 }
      );
    }

    const raw = (await request.json().catch(() => null)) as unknown;

    const validated = validateEmailReportBody(raw);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.body;

    // THE REPORT MUST BE ONE WE PRODUCED. Checked before anything is sent and
    // before the recipient is used for anything.
    const signature = (raw as Record<string, unknown> | null)?.reportSignature;
    const verdict = verifyHailViewReportSignature(
      {
        address: body.address,
        material: body.material,
        score: body.score,
        tier: body.tier,
        narrative: body.narrative,
        probability: body.probability,
        low: body.low,
        high: body.high,
        evidenceGrade: body.evidenceGrade,
        evidenceGradeReason: body.evidenceGradeReason,
        modelVersion: body.modelVersion,
        claimWindowMonths: body.claimWindowMonths,
        cosmeticExclusion: body.cosmeticExclusion,
        sensitivityNote: body.sensitivityNote,
        perEvent: body.perEvent,
      },
      signature
    );
    if (!verdict.ok) {
      console.error('[HailView Email Report Rejected]', { reason: verdict.reason, ip });
      return NextResponse.json({ error: verdict.message }, { status: 400 });
    }

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
