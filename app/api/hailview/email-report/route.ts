import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend/send';
import type { MaterialCategory, ReplacementTier } from '@/lib/hailview/types';
import type { EngineResult } from '@/lib/hailview/v2/engine';

const MATERIAL_LABELS: Record<MaterialCategory, string> = {
  asphalt_shingle: 'Asphalt Shingle',
  metal_r_panel: 'Metal — R-Panel',
  metal_standing_seam: 'Metal — Standing Seam',
  tpo_pvc_membrane: 'TPO/PVC Membrane',
  wood_shake: 'Wood Shake',
};

/**
 * CLAUDE.md rule #4, CANVAS_COLORS exception: an HTML email is rendered by
 * a mail client, which cannot consume Tailwind classes or CSS custom
 * properties — inline literal colours are the only thing that works. Single
 * documented constant object mirroring the afs-* token values, per the
 * sanctioned pattern (cf. STRIPE_CARD_ELEMENT_COLORS in app/checkout).
 *
 * `amberInk` was added in hv2-01 for the uncalibrated-model disclosure. It
 * is a DARKENED amber rather than afs-amber itself, because this text sits
 * on a white email background: rule #29's point applies here too — a fill
 * colour used as body text on light fails contrast, and in an email there
 * is no gate to catch it.
 */
const EMAIL_COLORS = {
  ink: '#1C1F26', // afs-ink-900
  inkMuted: '#4E5568', // afs-ink-700
  amberInk: '#8A5A00', // darkened afs-amber for body text on white
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailReportRequestBody {
  email: string;
  address: string;
  material: MaterialCategory;
  score: number;
  tier: ReplacementTier;
  narrative: string;

  // hv2-01 — V2 fields. ALL OPTIONAL on purpose: this route is a public
  // POST endpoint and an older client (a stale tab, a bookmarked form) must
  // still be able to mail itself a report rather than get a 400. Each block
  // below renders only when its field arrived.
  probability?: number;
  low?: number;
  high?: number;
  evidenceGrade?: EngineResult['evidenceGrade'];
  evidenceGradeReason?: string;
  modelVersion?: string;
  claimWindowMonths?: number;
  cosmeticExclusion?: boolean;
  sensitivityNote?: string;
  perEvent?: EngineResult['perEvent'];
}

function isValidBody(body: unknown): body is EmailReportRequestBody {
  if (!body || typeof body !== 'object') return false;
  const v = body as Record<string, unknown>;
  if (
    typeof v.email !== 'string' ||
    typeof v.address !== 'string' ||
    typeof v.material !== 'string' ||
    typeof v.score !== 'number' ||
    typeof v.tier !== 'string' ||
    typeof v.narrative !== 'string'
  ) {
    return false;
  }
  // The V2 fields are optional, but a wrong TYPE is still a bad request —
  // silently ignoring one would email a report missing a section the sender
  // believed it had included.
  if (v.probability !== undefined && typeof v.probability !== 'number') return false;
  if (v.low !== undefined && typeof v.low !== 'number') return false;
  if (v.high !== undefined && typeof v.high !== 'number') return false;
  if (v.perEvent !== undefined && !Array.isArray(v.perEvent)) return false;
  return true;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

function buildReportHtml(body: EmailReportRequestBody): string {
  const materialLabel = MATERIAL_LABELS[body.material] ?? body.material;
  const paragraphs = body.narrative
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  // The headline row states WHAT the number means, exactly as the web UI
  // does — "replacement probability" over a points total was the ambiguity
  // V2 exists to remove, and an emailed report that reverts to the old
  // wording would reintroduce it in the artefact people forward on.
  const headlineValue =
    body.probability !== undefined
      ? `${pct(body.probability)}${
          body.low !== undefined && body.high !== undefined
            ? ` (range ${pct(body.low)}&ndash;${pct(body.high)})`
            : ''
        }`
      : `${body.score}/100`;

  const evidenceRow =
    body.evidenceGrade !== undefined
      ? `<tr>
          <td style="padding:8px 0;color:${EMAIL_COLORS.inkMuted};">Evidence grade</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${body.evidenceGrade}</td>
        </tr>`
      : '';

  const cosmeticRow =
    body.cosmeticExclusion !== undefined
      ? `<tr>
          <td style="padding:8px 0;color:${EMAIL_COLORS.inkMuted};">Cosmetic damage</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${
            body.cosmeticExclusion ? 'Excluded by policy' : 'Covered'
          }</td>
        </tr>`
      : '';

  const evidenceReason = body.evidenceGradeReason
    ? `<p style="margin:0 0 20px;color:${EMAIL_COLORS.inkMuted};font-size:13px;line-height:1.5;">${body.evidenceGradeReason}</p>`
    : '';

  // EVERY storm is listed, including those outside the claim window, with
  // its window label — the same rule the engine follows. A storm silently
  // dropped from the email would read as a storm the tool never saw.
  const eventRows = (body.perEvent ?? [])
    .map(
      (e) => `<li style="margin:0 0 12px;line-height:1.5;">
        <strong>${e.convectiveDayUtc}</strong> &mdash; hail estimated at
        ${e.estimatedSizeIn.toFixed(2)}&quot; at your address
        (${e.estimatedSizeLowIn.toFixed(2)}&quot;&ndash;${e.estimatedSizeHighIn.toFixed(2)}&quot;),
        ${e.interpolation}, from ${e.reportCount} nearby report(s)
        &mdash; ${e.measuredCount} measured, ${e.estimatedCount} spotter-estimated.<br/>
        <span style="color:${EMAIL_COLORS.inkMuted};font-size:13px;">${e.windowLabel}</span>
      </li>`
    )
    .join('');

  const eventsBlock =
    body.perEvent === undefined
      ? ''
      : `<h2 style="font-size:15px;margin:24px 0 8px;">Storms considered</h2>
         <p style="margin:0 0 12px;color:${EMAIL_COLORS.inkMuted};font-size:13px;line-height:1.5;">
           One row per storm, not per report. Hail sizes are <strong>estimated at your address</strong>
           by triangulating nearby storm-spotter reports &mdash; they are not measurements taken at
           your property.
         </p>
         ${
           eventRows
             ? `<ul style="margin:0 0 16px;padding-left:20px;">${eventRows}</ul>`
             : `<p style="margin:0 0 16px;line-height:1.5;">No hail-producing storms were found near
                this address in the search window. Small towns generate fewer reports than cities, so
                this is weak evidence of no hail rather than proof of it.</p>`
         }`;

  const sensitivityBlock = body.sensitivityNote
    ? `<h2 style="font-size:15px;margin:24px 0 8px;">What moves this number</h2>
       <p style="margin:0 0 16px;line-height:1.5;">${body.sensitivityNote}</p>`
    : '';

  const uncalibratedBlock = body.modelVersion
    ? `<p style="margin-top:24px;color:${EMAIL_COLORS.amberInk};font-size:12px;line-height:1.5;">
         <strong>Uncalibrated model &mdash; ${body.modelVersion}.</strong> This model has not yet been
         fitted against real claim outcomes. Treat it as a data-backed indication, not a prediction of
         what your carrier will decide.
       </p>`
    : '';

  return `
    <div style="font-family:sans-serif;color:${EMAIL_COLORS.ink};max-width:560px;margin:0 auto;">
      <h1 style="font-size:20px;margin:0 0 4px;">HailView Report</h1>
      <p style="margin:0 0 20px;color:${EMAIL_COLORS.inkMuted};">${body.address}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:8px 0;color:${EMAIL_COLORS.inkMuted};">Material</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${materialLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:${EMAIL_COLORS.inkMuted};">Chance an insurer pays for a full roof replacement</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${headlineValue}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:${EMAIL_COLORS.inkMuted};">Tier</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${body.tier}</td>
        </tr>
        ${evidenceRow}
        ${cosmeticRow}
      </table>
      ${evidenceReason}
      ${paragraphs}
      ${eventsBlock}
      ${sensitivityBlock}
      ${uncalibratedBlock}
      <p style="margin-top:24px;color:${EMAIL_COLORS.inkMuted};font-size:12px;">
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
