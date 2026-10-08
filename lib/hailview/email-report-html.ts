// HailView "email me my own result" — validation and HTML rendering.
//
// ─────────────────────────────────────────────────────────────────────────
// SECURITY NOTE — READ BEFORE ADDING A FIELD.
//
// `app/api/hailview/email-report/route.ts` is an UNAUTHENTICATED PUBLIC POST
// that sends an AFS-branded email, from AFS's verified sending domain, to a
// recipient the caller chooses. Every field below is therefore attacker
// controlled, and this module is the boundary.
//
// hv2-02 fixed a real HTML-injection defect introduced by hv2-01: the report
// builder interpolated ELEVEN caller-supplied strings into the email body
// with no escaping at all — `address`, `narrative` (which additionally had
// its newlines turned into `<br/>`), `tier`, `material` (unvalidated, with a
// raw fallback when it was not a known key), `evidenceGrade`,
// `evidenceGradeReason`, `modelVersion`, `sensitivityNote`, and three fields
// per `perEvent` entry. `perEvent` itself was checked only with
// `Array.isArray`, so its numeric fields were never validated either and a
// non-number threw on `.toFixed()`, turning a malformed request into a 500.
//
// The rules this module enforces, and why each one:
//
//  1. EVERY interpolated string goes through `escapeHtml`. The codebase
//     already did this correctly in lib/quotes/email-template.ts; this route
//     was the outlier. The escaper now lives in lib/email/escape-html.ts so
//     there is one copy.
//  2. EVERY enum is checked AT RUNTIME against its real value set, not just
//     typed. A TypeScript union on a parsed JSON body is an assertion, not a
//     check — `material` was typed `MaterialCategory` and accepted any
//     string.
//  3. EVERY free-text field is LENGTH-CAPPED, and `perEvent` is COUNT-CAPPED.
//     Escaping stops markup; caps stop the body being used as a bulk payload.
//  4. EVERY number is checked finite before formatting, so a malformed
//     request is a 400 and never a 500.
//
// WHAT THIS MODULE DOES NOT FIX, and what it cannot:
//
// The caller still supplies the REPORT CONTENT and the RECIPIENT. After all
// of the above, someone can still send a bounded, plain-text, AFS-branded
// message to an arbitrary address. Escaping and caps reduce that to text with
// no markup and no links, which is much weaker than the original defect, but
// it is not zero. Closing it properly means not trusting the client for
// content at all — recomputing the report server-side from the address and
// material, or storing the lookup and emailing it by id — which changes
// SPEC_HAILVIEW.md section 8's contract and adds an external fetch per send.
// That is a product decision, it is RECORDED AS PENDING REID, and it is
// older than hv2-01: the pre-V2 route already accepted a free-text
// `narrative` and `address` for an arbitrary recipient.

import { escapeHtml, singleLineForSubject } from '@/lib/email/escape-html';
import type { MaterialCategory, ReplacementTier } from './types';
import type { EngineResult } from './v2/engine';

export const MATERIAL_LABELS: Record<MaterialCategory, string> = {
  asphalt_shingle: 'Asphalt Shingle',
  metal_r_panel: 'Metal — R-Panel',
  metal_standing_seam: 'Metal — Standing Seam',
  tpo_pvc_membrane: 'TPO/PVC Membrane',
  wood_shake: 'Wood Shake',
};

const MATERIAL_CATEGORIES = Object.keys(MATERIAL_LABELS) as MaterialCategory[];
const TIERS: ReplacementTier[] = ['Low', 'Moderate', 'High'];
const EVIDENCE_GRADES: EngineResult['evidenceGrade'][] = ['A', 'B', 'C', 'D'];
const WINDOW_STATUSES = ['in_window', 'outside_window'] as const;
const INTERPOLATIONS = ['interpolated', 'extrapolated'] as const;

/** Length caps. Generous enough for every real report this app produces. */
export const MAX_ADDRESS_LENGTH = 300;
export const MAX_NARRATIVE_LENGTH = 8000;
export const MAX_REASON_LENGTH = 1000;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_MODEL_VERSION_LENGTH = 40;
export const MAX_LABEL_LENGTH = 200;
export const MAX_PER_EVENT_COUNT = 60;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254; // RFC 5321 practical maximum

/**
 * CLAUDE.md rule #4, CANVAS_COLORS exception: a mail client cannot consume
 * Tailwind classes or CSS custom properties, so inline literal colours are
 * the only thing that works. One documented constant object mirroring the
 * afs-* token values, per the sanctioned pattern (cf.
 * STRIPE_CARD_ELEMENT_COLORS in app/checkout).
 *
 * `amberInk` is a DARKENED amber rather than afs-amber itself, because this
 * text sits on a white email background: rule #29's point applies here too —
 * a fill colour used as body text on light fails contrast, and in an email
 * there is no gate to catch it.
 */
const EMAIL_COLORS = {
  ink: '#1C1F26', // afs-ink-900
  inkMuted: '#4E5568', // afs-ink-700
  amberInk: '#8A5A00', // darkened afs-amber for body text on white
} as const;

/** A per-event row, after validation. Only the fields the email renders. */
export interface EmailReportEvent {
  convectiveDayUtc: string;
  estimatedSizeIn: number;
  estimatedSizeLowIn: number;
  estimatedSizeHighIn: number;
  reportCount: number;
  measuredCount: number;
  estimatedCount: number;
  interpolation: (typeof INTERPOLATIONS)[number];
  windowStatus: (typeof WINDOW_STATUSES)[number];
  windowLabel: string;
}

export interface EmailReportBody {
  email: string;
  address: string;
  material: MaterialCategory;
  score: number;
  tier: ReplacementTier;
  narrative: string;

  // V2 fields. ALL OPTIONAL on purpose: this is a public endpoint and an
  // older client (a stale tab, a bookmarked form) must still be able to mail
  // itself a report rather than get a 400. Each block renders only when its
  // field arrived — but a field that IS present must be well-formed.
  probability?: number;
  low?: number;
  high?: number;
  evidenceGrade?: EngineResult['evidenceGrade'];
  evidenceGradeReason?: string;
  modelVersion?: string;
  claimWindowMonths?: number;
  cosmeticExclusion?: boolean;
  sensitivityNote?: string;
  perEvent?: EmailReportEvent[];
}

export type ValidationResult =
  | { ok: true; body: EmailReportBody }
  | { ok: false; error: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function optionalString(
  v: unknown,
  maxLength: number
): { ok: true; value: string | undefined } | { ok: false } {
  if (v === undefined) return { ok: true, value: undefined };
  if (typeof v !== 'string') return { ok: false };
  if (v.length > maxLength) return { ok: false };
  return { ok: true, value: v };
}

function validateEvent(raw: unknown): EmailReportEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  for (const key of [
    'estimatedSizeIn',
    'estimatedSizeLowIn',
    'estimatedSizeHighIn',
    'reportCount',
    'measuredCount',
    'estimatedCount',
  ]) {
    if (!isFiniteNumber(e[key])) return null;
  }
  if (typeof e.convectiveDayUtc !== 'string' || e.convectiveDayUtc.length > MAX_LABEL_LENGTH) return null;
  if (typeof e.windowLabel !== 'string' || e.windowLabel.length > MAX_LABEL_LENGTH) return null;
  if (!INTERPOLATIONS.includes(e.interpolation as (typeof INTERPOLATIONS)[number])) return null;
  if (!WINDOW_STATUSES.includes(e.windowStatus as (typeof WINDOW_STATUSES)[number])) return null;

  return {
    convectiveDayUtc: e.convectiveDayUtc,
    estimatedSizeIn: e.estimatedSizeIn as number,
    estimatedSizeLowIn: e.estimatedSizeLowIn as number,
    estimatedSizeHighIn: e.estimatedSizeHighIn as number,
    reportCount: e.reportCount as number,
    measuredCount: e.measuredCount as number,
    estimatedCount: e.estimatedCount as number,
    interpolation: e.interpolation as (typeof INTERPOLATIONS)[number],
    windowStatus: e.windowStatus as (typeof WINDOW_STATUSES)[number],
    windowLabel: e.windowLabel,
  };
}

/**
 * Validates the request body. Returns a plain-English error rather than
 * throwing, so the route can answer 400 with something useful.
 *
 * REJECTS rather than coerces. An out-of-range enum or an over-long field is
 * a malformed request, and quietly dropping it would email a report missing a
 * section the sender believed it had included.
 */
export function validateEmailReportBody(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'A valid email and report are required.' };
  const v = raw as Record<string, unknown>;

  if (typeof v.email !== 'string' || v.email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!EMAIL_PATTERN.test(v.email.trim())) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  if (typeof v.address !== 'string' || v.address.length === 0 || v.address.length > MAX_ADDRESS_LENGTH) {
    return { ok: false, error: 'A valid address is required.' };
  }
  // Runtime enum check. `material` was previously only typed, and the
  // renderer fell back to echoing the raw value when it was not a known key.
  if (typeof v.material !== 'string' || !MATERIAL_CATEGORIES.includes(v.material as MaterialCategory)) {
    return { ok: false, error: `Material must be one of: ${MATERIAL_CATEGORIES.join(', ')}.` };
  }
  if (!isFiniteNumber(v.score) || v.score < 0 || v.score > 100) {
    return { ok: false, error: 'Score must be a number between 0 and 100.' };
  }
  if (typeof v.tier !== 'string' || !TIERS.includes(v.tier as ReplacementTier)) {
    return { ok: false, error: `Tier must be one of: ${TIERS.join(', ')}.` };
  }
  if (typeof v.narrative !== 'string' || v.narrative.length > MAX_NARRATIVE_LENGTH) {
    return { ok: false, error: 'The report text is missing or too long.' };
  }

  for (const key of ['probability', 'low', 'high'] as const) {
    if (v[key] !== undefined && (!isFiniteNumber(v[key]) || (v[key] as number) < 0 || (v[key] as number) > 1)) {
      return { ok: false, error: `${key} must be a number between 0 and 1.` };
    }
  }
  if (v.claimWindowMonths !== undefined && (!isFiniteNumber(v.claimWindowMonths) || v.claimWindowMonths < 0)) {
    return { ok: false, error: 'claimWindowMonths must be a non-negative number.' };
  }
  if (v.cosmeticExclusion !== undefined && typeof v.cosmeticExclusion !== 'boolean') {
    return { ok: false, error: 'cosmeticExclusion must be a boolean.' };
  }
  if (
    v.evidenceGrade !== undefined &&
    (typeof v.evidenceGrade !== 'string' ||
      !EVIDENCE_GRADES.includes(v.evidenceGrade as EngineResult['evidenceGrade']))
  ) {
    return { ok: false, error: `evidenceGrade must be one of: ${EVIDENCE_GRADES.join(', ')}.` };
  }

  const reason = optionalString(v.evidenceGradeReason, MAX_REASON_LENGTH);
  if (!reason.ok) return { ok: false, error: 'evidenceGradeReason is not a valid string.' };
  const note = optionalString(v.sensitivityNote, MAX_NOTE_LENGTH);
  if (!note.ok) return { ok: false, error: 'sensitivityNote is not a valid string.' };
  const modelVersion = optionalString(v.modelVersion, MAX_MODEL_VERSION_LENGTH);
  if (!modelVersion.ok) return { ok: false, error: 'modelVersion is not a valid string.' };

  let perEvent: EmailReportEvent[] | undefined;
  if (v.perEvent !== undefined) {
    if (!Array.isArray(v.perEvent) || v.perEvent.length > MAX_PER_EVENT_COUNT) {
      return { ok: false, error: 'perEvent is not a valid list of storms.' };
    }
    perEvent = [];
    for (const rawEvent of v.perEvent) {
      const event = validateEvent(rawEvent);
      if (!event) return { ok: false, error: 'perEvent contains an invalid storm entry.' };
      perEvent.push(event);
    }
  }

  return {
    ok: true,
    body: {
      email: v.email.trim(),
      address: v.address,
      material: v.material as MaterialCategory,
      score: v.score,
      tier: v.tier as ReplacementTier,
      narrative: v.narrative,
      probability: v.probability as number | undefined,
      low: v.low as number | undefined,
      high: v.high as number | undefined,
      evidenceGrade: v.evidenceGrade as EngineResult['evidenceGrade'] | undefined,
      evidenceGradeReason: reason.value,
      modelVersion: modelVersion.value,
      claimWindowMonths: v.claimWindowMonths as number | undefined,
      cosmeticExclusion: v.cosmeticExclusion as boolean | undefined,
      sensitivityNote: note.value,
      perEvent,
    },
  };
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function buildReportSubject(body: EmailReportBody): string {
  const materialLabel = MATERIAL_LABELS[body.material];
  return singleLineForSubject(`Your HailView Report — ${materialLabel} — ${body.address}`);
}

/**
 * Renders the report. Assumes `body` came from `validateEmailReportBody`.
 *
 * EVERY interpolated string is escaped here, including ones that look safe:
 * `convectiveDayUtc` and `modelVersion` are validated in shape but still
 * arrive from the caller, and an escaper applied "only where it is needed"
 * is an escaper somebody will forget.
 */
export function buildReportHtml(body: EmailReportBody): string {
  const materialLabel = escapeHtml(MATERIAL_LABELS[body.material]);

  const paragraphs = body.narrative
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`
    )
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
          <td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(body.evidenceGrade)}</td>
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
    ? `<p style="margin:0 0 20px;color:${EMAIL_COLORS.inkMuted};font-size:13px;line-height:1.5;">${escapeHtml(
        body.evidenceGradeReason
      )}</p>`
    : '';

  // EVERY storm is listed, including those outside the claim window, with
  // its window label — the same rule the engine follows. A storm silently
  // dropped from the email would read as a storm the tool never saw.
  const eventRows = (body.perEvent ?? [])
    .map(
      (e) => `<li style="margin:0 0 12px;line-height:1.5;">
        <strong>${escapeHtml(e.convectiveDayUtc)}</strong> &mdash; hail estimated at
        ${e.estimatedSizeIn.toFixed(2)}&quot; at your address
        (${e.estimatedSizeLowIn.toFixed(2)}&quot;&ndash;${e.estimatedSizeHighIn.toFixed(2)}&quot;),
        ${escapeHtml(e.interpolation)}, from ${e.reportCount} nearby report(s)
        &mdash; ${e.measuredCount} measured, ${e.estimatedCount} spotter-estimated.<br/>
        <span style="color:${EMAIL_COLORS.inkMuted};font-size:13px;">${escapeHtml(e.windowLabel)}</span>
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
       <p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(body.sensitivityNote)}</p>`
    : '';

  const uncalibratedBlock = body.modelVersion
    ? `<p style="margin-top:24px;color:${EMAIL_COLORS.amberInk};font-size:12px;line-height:1.5;">
         <strong>Uncalibrated model &mdash; ${escapeHtml(body.modelVersion)}.</strong> This model has
         not yet been fitted against real claim outcomes. Treat it as a data-backed indication, not a
         prediction of what your carrier will decide.
       </p>`
    : '';

  return `
    <div style="font-family:sans-serif;color:${EMAIL_COLORS.ink};max-width:560px;margin:0 auto;">
      <h1 style="font-size:20px;margin:0 0 4px;">HailView Report</h1>
      <p style="margin:0 0 20px;color:${EMAIL_COLORS.inkMuted};">${escapeHtml(body.address)}</p>
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
          <td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(body.tier)}</td>
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
