import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend/send';
import type { MaterialCategory, ReplacementTier } from '@/lib/hailview/types';

const MATERIAL_LABELS: Record<MaterialCategory, string> = {
  asphalt_shingle: 'Asphalt Shingle',
  metal_r_panel: 'Metal — R-Panel',
  metal_standing_seam: 'Metal — Standing Seam',
  tpo_pvc_membrane: 'TPO/PVC Membrane',
  wood_shake: 'Wood Shake',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailReportRequestBody {
  email: string;
  address: string;
  material: MaterialCategory;
  score: number;
  tier: ReplacementTier;
  narrative: string;
}

function isValidBody(body: unknown): body is EmailReportRequestBody {
  if (!body || typeof body !== 'object') return false;
  const v = body as Record<string, unknown>;
  return (
    typeof v.email === 'string' &&
    typeof v.address === 'string' &&
    typeof v.material === 'string' &&
    typeof v.score === 'number' &&
    typeof v.tier === 'string' &&
    typeof v.narrative === 'string'
  );
}

function buildReportHtml(body: EmailReportRequestBody): string {
  const materialLabel = MATERIAL_LABELS[body.material] ?? body.material;
  const paragraphs = body.narrative
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `
    <div style="font-family:sans-serif;color:#1C1F26;max-width:560px;margin:0 auto;">
      <h1 style="font-size:20px;margin:0 0 4px;">HailView Report</h1>
      <p style="margin:0 0 20px;color:#4E5568;">${body.address}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 0;color:#4E5568;">Material</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${materialLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#4E5568;">Replacement probability</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${body.score}/100 — ${body.tier}</td>
        </tr>
      </table>
      ${paragraphs}
      <p style="margin-top:24px;color:#7A8299;font-size:12px;">
        This is a diagnostic report generated from public storm records. It is not a formal quote.
        Contact AFS to request a formal quote based on this report.
      </p>
    </div>
  `;
}

/**
 * Matches this codebase's standing Resend-degrade pattern (lib/resend/send.ts):
 * when RESEND_API_KEY/RESEND_FROM_EMAIL are not configured, sendEmail()
 * returns a soft { success: false } rather than throwing. This route
 * reflects that as a normal 200 response with configured:false so the
 * HailView UI can say "email delivery isn't live yet" without treating the
 * rest of the lookup flow as broken.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as EmailReportRequestBody | null;
    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'A valid email and report are required.' }, { status: 400 });
    }

    if (!EMAIL_PATTERN.test(body.email.trim())) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const materialLabel = MATERIAL_LABELS[body.material] ?? body.material;
    const result = await sendEmail({
      to: body.email.trim(),
      subject: `Your HailView Report — ${materialLabel} — ${body.address}`,
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
