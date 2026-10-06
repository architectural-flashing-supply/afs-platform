import { isTakeoffConfidence, type TakeoffConfidence } from '@/lib/ai/takeoff-confidence';
import type { RawTakeoffItem } from '@/lib/ai/takeoff-run';
import type { DraftLineItem, SourceRef } from '@/lib/email-intake/types';

/**
 * Turns the takeoff engine's raw items into draft line items.
 *
 * Rules (addendum §2):
 *  - a field the AI could not read stays null (blank and flagged). Nothing is defaulted or guessed here;
 *  - every item carries a `sourceRef`, or is flagged "source unknown";
 *  - prices never appear: this module has no price fields at all.
 */

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function region(v: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const x = num(r.x), y = num(r.y), w = num(r.w), h = num(r.h);
  if (x === null || y === null || w === null || h === null) return null;
  const inUnit = (n: number) => n >= 0 && n <= 1;
  if (![x, y, w, h].every(inUnit) || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) return null;
  return { x, y, w, h };
}

/** Locates the AI's verbatim quote in the body. If it is not really there, the claim is discarded (never trusted). */
export function locateBodySpan(body: string | null, quote: unknown): { start: number; end: number } | null {
  const q = str(quote);
  if (!body || !q) return null;
  let i = body.indexOf(q);
  if (i < 0) {
    // tolerate whitespace differences only
    const norm = (s: string) => s.replace(/\s+/g, ' ');
    const nb = norm(body);
    const nq = norm(q);
    const j = nb.indexOf(nq);
    if (j < 0) return null;
    // map the normalized index back to the original by walking
    let orig = 0, n = 0;
    while (orig < body.length && n < j) {
      if (/\s/.test(body[orig]) && orig > 0 && /\s/.test(body[orig - 1])) { orig++; continue; }
      orig++; n++;
    }
    i = orig;
    return { start: i, end: Math.min(body.length, i + q.length) };
  }
  return { start: i, end: i + q.length };
}

export type ItemOrigin =
  | { kind: 'attachment'; emailMessageId: string; emailAttachmentId: string }
  | { kind: 'body'; emailMessageId: string; textBody: string | null };

export function buildDraftItems(raw: RawTakeoffItem[], origin: ItemOrigin, newId: () => string): DraftLineItem[] {
  const out: DraftLineItem[] = [];
  for (const r of raw) {
    const profileType = str(r.profileType);
    if (!profileType) continue; // an item with no identifiable profile is not a line item; it stays in processingNotes
    const flags: string[] = [];
    const lengthFt = num(r.lengthFt);
    const quantity = num(r.quantity);
    const unit = str(r.unit);
    let confidence: TakeoffConfidence = isTakeoffConfidence(r.confidence) ? r.confidence : 'low';

    if (lengthFt === null) flags.push('Length not read - enter it');
    if (quantity === null) flags.push('Piece count not read - confirm it');
    // Audit finding 4: the engine treats `quantity` as pieces and `lengthFt` as per-piece length, but the model
    // sometimes returns the run length in both. We do not guess which is right; we flag it and cap confidence.
    if (lengthFt !== null && quantity !== null && lengthFt === quantity && lengthFt > 10) {
      flags.push('Quantity equals length - confirm piece count vs. linear feet');
      if (confidence === 'high') confidence = 'medium';
    }
    if (lengthFt !== null && lengthFt > 10 && (unit ?? '').toUpperCase() !== 'LF') {
      flags.push('Length over 10 ft per piece - check whether this is a run total');
    }

    let sourceRef: SourceRef | null = null;
    if (origin.kind === 'attachment') {
      const pg = num(r.sourcePage);
      sourceRef = {
        emailMessageId: origin.emailMessageId,
        emailAttachmentId: origin.emailAttachmentId,
        page: pg !== null && pg >= 1 ? Math.floor(pg) : null,
        region: region(r.sourceRegion),
      };
    } else {
      const span = locateBodySpan(origin.textBody, r.sourceQuote);
      if (span) sourceRef = { emailMessageId: origin.emailMessageId, bodySpan: span };
    }
    if (!sourceRef) flags.push('Source unknown');

    out.push({
      id: newId(),
      profileType,
      material: str(r.material),
      gauge: str(r.gauge),
      finish: str(r.finish),
      width: num(r.width),
      height: num(r.height),
      legA: num(r.legA),
      legB: num(r.legB),
      lengthFt,
      quantity,
      unit,
      confidence,
      aiNote: str(r.aiNote),
      flags,
      sourceRef,
    });
  }
  return out;
}

/** The JSON stored in quote_requests.line_items. Same keys the existing readers use, plus id/flags/sourceRef. */
export function toQuoteRequestLineItem(i: DraftLineItem): Record<string, unknown> {
  return {
    id: i.id,
    profileType: i.profileType,
    material: i.material,
    gauge: i.gauge,
    finish: i.finish,
    width: i.width,
    height: i.height,
    legA: i.legA,
    legB: i.legB,
    lengthFt: i.lengthFt,
    quantity: i.quantity,
    unit: i.unit ?? 'LF',
    confidence: i.confidence,
    aiNote: i.aiNote,
    flags: i.flags,
    source_ref: i.sourceRef,
    ai_read: true,
  };
}
