/**
 * READING LINE ITEMS OFF AN UNTRUSTED REQUEST BODY.
 *
 * Shared by `POST /api/quote-requests/validate` and the admin review page,
 * because they read the same array from two different places — one from a JSON
 * body, one from `quote_requests.line_items` out of JSONB — and both have the
 * same problem: nothing guarantees the shape.
 *
 * THE ENGINE IS TOTAL, so this is not a gate. Every rule copes with an absent,
 * zero, negative or non-numeric field by design (see `readNumber` in
 * lib/order-validator/rules.ts), which is the only way a validator can report on
 * a half-filled form as the customer types it. What this does is narrow `unknown`
 * to the engine's input type without inventing values — a non-object entry is
 * dropped, and a field of the wrong type is passed through for the engine to
 * report rather than coerced into something plausible.
 */

import type { OrderValidatorItem, ValidatableHem } from './types';

function readHem(raw: unknown): ValidatableHem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const hem = raw as { lengthIn?: unknown };
  // An absent lengthIn stays absent. A hem read back out of JSONB may have lost
  // it, and absent is not zero — the engine reports a zero fold as a hem with no
  // fold at all, which would be a false accusation here.
  if (hem.lengthIn === null || hem.lengthIn === undefined) return {};
  return { lengthIn: typeof hem.lengthIn === 'number' ? hem.lengthIn : Number.NaN };
}

/**
 * FlashDraft's polyline, in world inches. Every point must be a finite pair or
 * the whole polyline is discarded — a half-read drawing would be measured, and a
 * measurement of a shape nobody drew is worse than no measurement. The geometry
 * predicates make the same call for the same reason.
 */
function readPoints(raw: unknown): { x: number; y: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const points: { x: number; y: number }[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const point = entry as { x?: unknown; y?: unknown };
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return null;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    points.push({ x: point.x, y: point.y });
  }
  return points;
}

function readString(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

/**
 * A number field as the engine wants it: `null` for absent, the number for a
 * number, and `NaN` for something supplied that is not one — which the engine
 * reports as "that is not a measurement" rather than skipping silently.
 */
function readNumberField(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  return Number.NaN;
}

/** One entry of an `items` array, narrowed. `null` when it is not an object. */
export function readOrderValidatorItem(raw: unknown): OrderValidatorItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  return {
    profileType: readString(item.profileType),
    profileName: readString(item.profileName),
    material: readString(item.material),
    gauge: readString(item.gauge),
    width: readNumberField(item.width),
    height: readNumberField(item.height),
    legA: readNumberField(item.legA),
    legB: readNumberField(item.legB),
    lengthFt: readNumberField(item.lengthFt),
    quantity: readNumberField(item.quantity),
    points: readPoints(item.points),
    hemStart: readHem(item.hemStart),
    hemEnd: readHem(item.hemEnd),
  };
}

/** Every readable entry of an `items` array. Unreadable entries are dropped. */
export function readOrderValidatorItems(raw: unknown): OrderValidatorItem[] {
  if (!Array.isArray(raw)) return [];
  const items: OrderValidatorItem[] = [];
  for (const entry of raw) {
    const item = readOrderValidatorItem(entry);
    if (item) items.push(item);
  }
  return items;
}

/** The distinct, non-empty profile labels in a set of items. */
export function profileLabelsOf(items: readonly OrderValidatorItem[]): string[] {
  const labels: string[] = [];
  for (const item of items) {
    const label = typeof item.profileType === 'string' ? item.profileType.trim() : '';
    if (label !== '' && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
