/**
 * WHAT A ROUTE WILL ACCEPT — one validator, used by both write routes.
 *
 * Two rules it exists to make unmissable:
 *
 *   1. THE NOTE IS WHAT STEVE TYPED. There is no default, no template, no
 *      generated text and no "" accepted as a note. A blank save is refused
 *      with a sentence, by this function, by the route, and by the Postgres
 *      CHECK (migration 051) — three refusals, because a note that reads as
 *      empty on the shop floor is a job run with no instruction.
 *
 *   2. THE CLIENT NEVER SETS WHO OR WHICH COMPANY. `company_id` and
 *      `created_by` are absent from the accepted shape entirely, so there is
 *      no field for a forged one to arrive in. The route reads them from the
 *      session. A body carrying `companyId` is not rejected — it is simply
 *      never looked at, which is the stronger property: nothing downstream can
 *      be changed to start honouring a field that was never parsed.
 */
import { NOTE_MAX_CHARS } from './types';

export interface CalloutCreateInput {
  quoteRequestId: string | null;
  lineItemIndex: number;
  shopJobId: string | null;
  drawingId: string | null;
  drawingRevision: number | null;
  segmentIndex: number;
  segmentCount: number;
  t: number;
  segA: { x: number; y: number };
  segB: { x: number; y: number };
  anchor: { x: number; y: number };
  tail: { dx: number; dy: number };
  note: string;
}

export interface CalloutUpdateInput {
  note?: string;
  tail?: { dx: number; dy: number };
  /** A re-snapped or re-dragged tip, with its segment. All four or none. */
  anchor?: {
    segmentIndex: number;
    segmentCount: number;
    t: number;
    segA: { x: number; y: number };
    segB: { x: number; y: number };
    anchor: { x: number; y: number };
  };
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function point(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const x = num(o.x);
  const y = num(o.y);
  return x === null || y === null ? null : { x, y };
}

function offset(value: unknown): { dx: number; dy: number } | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const dx = num(o.dx);
  const dy = num(o.dy);
  return dx === null || dy === null ? null : { dx, dy };
}

/**
 * THE NOTE RULE, on its own because three callers need exactly it.
 *
 * Trimmed, 1..280 characters, counted AFTER the trim — so 280 characters plus a
 * trailing newline is a valid note rather than a refusal nobody can see the
 * cause of, and 281 real characters is refused. The message is the one the
 * popup shows inline; it names what to do, not what went wrong.
 */
export function validateNote(value: unknown): Validated<string> {
  if (typeof value !== 'string') return { ok: false, error: 'Type a note before saving.' };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Type a note before saving.' };
  if (trimmed.length > NOTE_MAX_CHARS) {
    return {
      ok: false,
      error: `That is ${trimmed.length} characters. A shop note is ${NOTE_MAX_CHARS} at most.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateCreate(raw: unknown): Validated<CalloutCreateInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Expected a JSON object.' };
  const b = raw as Record<string, unknown>;

  const quoteRequestId = typeof b.quoteRequestId === 'string' && b.quoteRequestId ? b.quoteRequestId : null;
  const shopJobId = typeof b.shopJobId === 'string' && b.shopJobId ? b.shopJobId : null;
  if (!quoteRequestId && !shopJobId) {
    return { ok: false, error: 'A callout needs a job: quoteRequestId or shopJobId.' };
  }

  const noteCheck = validateNote(b.note);
  if (!noteCheck.ok) return noteCheck;

  const segmentIndex = num(b.segmentIndex);
  const segmentCount = num(b.segmentCount);
  const t = num(b.t);
  if (segmentIndex === null || segmentIndex < 0 || !Number.isInteger(segmentIndex)) {
    return { ok: false, error: 'segmentIndex must be a whole number, 0 or greater.' };
  }
  if (segmentCount === null || segmentCount < 1 || !Number.isInteger(segmentCount)) {
    return { ok: false, error: 'segmentCount must be a whole number, 1 or greater.' };
  }
  if (t === null || t < 0 || t > 1) {
    return { ok: false, error: 't must be between 0 and 1 — it is a position along a segment.' };
  }

  const segA = point(b.segA);
  const segB = point(b.segB);
  const anchor = point(b.anchor);
  const tail = offset(b.tail);
  if (!segA || !segB || !anchor) {
    return { ok: false, error: 'segA, segB and anchor must each be {x, y} in inches.' };
  }
  if (!tail) return { ok: false, error: 'tail must be {dx, dy} in inches.' };

  const rawItem = num(b.lineItemIndex);
  const lineItemIndex = rawItem !== null && Number.isInteger(rawItem) && rawItem >= 0 ? rawItem : 0;

  const drawingRevision = num(b.drawingRevision);

  return {
    ok: true,
    value: {
      quoteRequestId,
      lineItemIndex,
      shopJobId,
      drawingId: typeof b.drawingId === 'string' && b.drawingId ? b.drawingId : null,
      drawingRevision: drawingRevision !== null && Number.isInteger(drawingRevision) ? drawingRevision : null,
      segmentIndex,
      segmentCount,
      t,
      segA,
      segB,
      anchor,
      tail,
      note: noteCheck.value,
    },
  };
}

/**
 * An update may carry the note, the tail, the anchor, or any combination — but
 * not nothing. An empty PATCH that answered 200 would let the popup report a
 * save that changed no row, which is the one kind of lie the save path must not
 * tell (Reid's requirement: never lose typed text on a failed save, and never
 * claim a save that did not happen).
 */
export function validateUpdate(raw: unknown): Validated<CalloutUpdateInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Expected a JSON object.' };
  const b = raw as Record<string, unknown>;
  const out: CalloutUpdateInput = {};

  if (b.note !== undefined) {
    const noteCheck = validateNote(b.note);
    if (!noteCheck.ok) return noteCheck;
    out.note = noteCheck.value;
  }

  if (b.tail !== undefined) {
    const tail = offset(b.tail);
    if (!tail) return { ok: false, error: 'tail must be {dx, dy} in inches.' };
    out.tail = tail;
  }

  if (b.anchor !== undefined) {
    const a = b.anchor as Record<string, unknown> | null;
    if (!a || typeof a !== 'object') return { ok: false, error: 'anchor must be an object.' };
    const segmentIndex = num(a.segmentIndex);
    const segmentCount = num(a.segmentCount);
    const t = num(a.t);
    const segA = point(a.segA);
    const segB = point(a.segB);
    const anchor = point(a.anchor);
    if (
      segmentIndex === null ||
      !Number.isInteger(segmentIndex) ||
      segmentIndex < 0 ||
      segmentCount === null ||
      !Number.isInteger(segmentCount) ||
      segmentCount < 1 ||
      t === null ||
      t < 0 ||
      t > 1 ||
      !segA ||
      !segB ||
      !anchor
    ) {
      return { ok: false, error: 'A re-anchor needs segmentIndex, segmentCount, t, segA, segB and anchor.' };
    }
    out.anchor = { segmentIndex, segmentCount, t, segA, segB, anchor };
  }

  if (out.note === undefined && out.tail === undefined && out.anchor === undefined) {
    return { ok: false, error: 'Nothing to change.' };
  }
  return { ok: true, value: out };
}
