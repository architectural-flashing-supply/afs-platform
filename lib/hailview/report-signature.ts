/**
 * THE HAILVIEW REPORT SIGNATURE — what stops the email endpoint being an
 * open relay for attacker-authored content.
 *
 * ============ THE PROBLEM ============
 *
 * `app/api/hailview/email-report` is an UNAUTHENTICATED PUBLIC POST that
 * sends an AFS-branded email, from AFS's verified sending domain, to a
 * recipient the caller chooses. SPEC_HAILVIEW.md section 8 wants exactly
 * that: a homeowner types their own address to get their own result.
 *
 * hv2-02 escaped and validated every field, which removed the HTML-injection
 * defect — but escaping only guarantees the content is INERT, not that it is
 * GENUINE. A caller could still post any prose they liked as `narrative` and
 * have AFS deliver it, as plain text, in AFS's own template. That is a
 * phishing vector wearing AFS's branding, and escaping does not touch it.
 *
 * ============ THE FIX ============
 *
 * The lookup route SIGNS the report it just computed; the email route
 * REFUSES to send anything it cannot verify. The MAC covers every field the
 * email renders, so a single altered character — one digit of the
 * probability, one sentence of the narrative — invalidates it. The caller can
 * no longer author content; it can only ask us to mail back something this
 * server produced.
 *
 * WHY NOT RECOMPUTE SERVER-SIDE INSTEAD. That was the first option
 * considered and it is worse here: it would add a geocode and an IEM fetch to
 * every send, and the emailed number could differ from the one on the
 * customer's screen if the feed moved in between — a report that disagrees
 * with what the user was just shown is its own defect. Signing costs nothing
 * per send and cannot drift.
 *
 * ============ WHAT THIS DOES *NOT* FIX ============
 *
 * THE RECIPIENT IS NOT SIGNED, AND CANNOT BE. The user types their address
 * into the form AFTER the lookup has already been computed and signed, so
 * binding the MAC to a recipient would mean re-signing per keystroke.
 *
 * So the residual abuse is: run a real lookup for any address, then mail that
 * GENUINE report to somebody who did not ask for it. That is unsolicited
 * mail, and it is bounded by the TTL below and by the route's rate limit —
 * but it carries no attacker-authored prose, which is the part that made the
 * original hole dangerous. Closing it completely means authenticating the
 * sender, which SPEC_HAILVIEW.md section 8 deliberately does not do.
 *
 * ============ THE SECRET ============
 *
 * Same construction as lib/pricing/approve-token.ts, for the same reasons
 * recorded there: `HAILVIEW_REPORT_SECRET` if set, otherwise DERIVED from
 * `SUPABASE_SERVICE_ROLE_KEY` by HMAC with a fixed, non-secret label. That
 * key is already required server-side everywhere in this app and is never in
 * the client bundle, so it is a real secret that is certain to be present —
 * requiring a brand-new env var would have meant the email button silently
 * failing on any deployment where somebody forgot to add it. **No new
 * environment variable is needed for this to work.**
 *
 * THE LABEL IS DIFFERENT FROM THE QUOTE TOKEN'S, and that is load-bearing.
 * Key separation: with a shared label, a quote-approve MAC and a report MAC
 * would be computed under the same key, and a value signed for one purpose
 * could be presented for the other.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const KEY_DERIVATION_LABEL = 'afs-hailview-report-v1';

/**
 * How long a signed report may be emailed for.
 *
 * Short on purpose. A legitimate user types their email seconds after seeing
 * the result; nobody needs to mail a lookup from last week. This is the main
 * bound on the residual replay described above, so do not lengthen it without
 * a reason.
 */
export const REPORT_SIGNATURE_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export interface ReportSignatureEnv {
  HAILVIEW_REPORT_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** So `process.env` itself is assignable; nothing else here is read. */
  [key: string]: string | undefined;
}

/** Resolves the signing secret. Throws rather than signing with nothing. */
export function reportSignatureSecret(env: ReportSignatureEnv = process.env): string {
  const explicit = env.HAILVIEW_REPORT_SECRET;
  if (explicit && explicit.trim() !== '') return explicit.trim();

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && serviceKey.trim() !== '') {
    return createHmac('sha256', serviceKey.trim()).update(KEY_DERIVATION_LABEL).digest('hex');
  }

  throw new Error(
    'Cannot sign a HailView report: neither HAILVIEW_REPORT_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set.'
  );
}

/**
 * The fields the signature covers — EVERY field the email renders, and
 * nothing else.
 *
 * If you add a field to the email, add it here in the same commit. A rendered
 * field outside the MAC is a field the caller can rewrite freely, which is
 * the whole defect this module exists to close.
 */
export interface SignableReport {
  address: string;
  material: string;
  score: number;
  tier: string;
  narrative: string;
  probability?: number;
  low?: number;
  high?: number;
  evidenceGrade?: string;
  evidenceGradeReason?: string;
  modelVersion?: string;
  claimWindowMonths?: number;
  cosmeticExclusion?: boolean;
  sensitivityNote?: string;
  perEvent?: readonly {
    convectiveDayUtc: string;
    estimatedSizeIn: number;
    estimatedSizeLowIn: number;
    estimatedSizeHighIn: number;
    reportCount: number;
    measuredCount: number;
    estimatedCount: number;
    interpolation: string;
    windowStatus: string;
    windowLabel: string;
  }[];
}

/**
 * Canonical serialization. Field order is FIXED here rather than taken from
 * `Object.keys`, and every value is length-prefixed.
 *
 * The length prefixes matter: without them, concatenating fields lets two
 * different reports produce the same input string (an address ending in "X"
 * with a narrative starting "Y" versus one ending "XY" with a narrative
 * starting at ""), which is a classic MAC-canonicalization break.
 */
function canonicalize(report: SignableReport): string {
  const parts: string[] = [];
  const push = (label: string, value: string | number | boolean | undefined) => {
    if (value === undefined) {
      parts.push(`${label}:-`);
      return;
    }
    const s = String(value);
    parts.push(`${label}:${s.length}:${s}`);
  };

  push('address', report.address);
  push('material', report.material);
  push('score', report.score);
  push('tier', report.tier);
  push('narrative', report.narrative);
  push('probability', report.probability);
  push('low', report.low);
  push('high', report.high);
  push('evidenceGrade', report.evidenceGrade);
  push('evidenceGradeReason', report.evidenceGradeReason);
  push('modelVersion', report.modelVersion);
  push('claimWindowMonths', report.claimWindowMonths);
  push('cosmeticExclusion', report.cosmeticExclusion);
  push('sensitivityNote', report.sensitivityNote);

  if (report.perEvent === undefined) {
    parts.push('perEvent:-');
  } else {
    parts.push(`perEvent:${report.perEvent.length}`);
    for (const e of report.perEvent) {
      push('e.day', e.convectiveDayUtc);
      push('e.size', e.estimatedSizeIn);
      push('e.low', e.estimatedSizeLowIn);
      push('e.high', e.estimatedSizeHighIn);
      push('e.reports', e.reportCount);
      push('e.measured', e.measuredCount);
      push('e.estimated', e.estimatedCount);
      push('e.interp', e.interpolation);
      push('e.window', e.windowStatus);
      push('e.label', e.windowLabel);
    }
  }

  return parts.join('|');
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

/**
 * `<expiryEpochSeconds>.<macB64url>`.
 *
 * The expiry is in the clear and is COVERED BY THE MAC, so a forged expiry is
 * never believed — the signature is checked before the expiry, exactly as
 * lib/pricing/approve-token.ts does and for the same reason.
 */
export function signHailViewReport(
  report: SignableReport,
  opts: { now?: Date; ttlSeconds?: number; secret?: string } = {}
): string {
  const secret = opts.secret ?? reportSignatureSecret();
  const now = opts.now ?? new Date();
  const ttl = opts.ttlSeconds ?? REPORT_SIGNATURE_TTL_SECONDS;
  const exp = Math.floor(now.getTime() / 1000) + ttl;
  const mac = createHmac('sha256', secret).update(`${exp}.${canonicalize(report)}`).digest();
  return `${exp}.${b64url(mac)}`;
}

export type ReportSignatureVerdict =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'tampered' | 'expired'; message: string };

/**
 * Shape, then signature, then expiry — in that order.
 *
 * A tampered signature's claimed expiry must never be believed, so the MAC is
 * checked first. The messages are deliberately uninformative about WHICH
 * field failed: a caller probing for which part of a report it can alter
 * learns nothing useful from them.
 */
export function verifyHailViewReportSignature(
  report: SignableReport,
  signature: unknown,
  opts: { now?: Date; secret?: string } = {}
): ReportSignatureVerdict {
  const secret = opts.secret ?? reportSignatureSecret();
  const now = opts.now ?? new Date();

  if (typeof signature !== 'string' || signature.trim() === '') {
    return {
      ok: false,
      reason: 'malformed',
      message: 'This report cannot be emailed. Run the lookup again and send it from the results page.',
    };
  }
  const parts = signature.split('.');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return {
      ok: false,
      reason: 'malformed',
      message: 'This report cannot be emailed. Run the lookup again and send it from the results page.',
    };
  }
  const exp = Number(parts[0]);
  if (!Number.isInteger(exp)) {
    return {
      ok: false,
      reason: 'malformed',
      message: 'This report cannot be emailed. Run the lookup again and send it from the results page.',
    };
  }

  const expected = createHmac('sha256', secret).update(`${exp}.${canonicalize(report)}`).digest();
  const actual = fromB64url(parts[1]);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return {
      ok: false,
      reason: 'tampered',
      message:
        'This report does not match one we produced, so it was not sent. Run the lookup again and send it from the results page.',
    };
  }

  if (Math.floor(now.getTime() / 1000) > exp) {
    return {
      ok: false,
      reason: 'expired',
      message: 'This result is too old to email. Run the lookup again and send the fresh one.',
    };
  }

  return { ok: true };
}
