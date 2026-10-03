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
 * The most points a drawn profile may carry into the validator.
 *
 * `findSelfIntersections` compares every non-adjacent segment pair, so its cost
 * is quadratic in the point count. The validate endpoint is unauthenticated (as
 * the submit endpoint it guards has always been), which makes an unbounded
 * polyline a real way to burn server time: fifty items of ten thousand points
 * each is billions of orientation tests from one request.
 *
 * 1000 is three orders of magnitude above anything real — a FlashDraft profile
 * is a handful of points, and the most complex shape in the shop's send history
 * is nowhere near a hundred. The cap is enforced at the API boundary with an
 * explicit 400 rather than only here, so a caller is told rather than quietly
 * losing the geometry checks.
 */
export const MAX_POINTS_PER_ITEM = 1000;

/**
 * FlashDraft's polyline, in world inches. Every point must be a finite pair or
 * the whole polyline is discarded — a half-read drawing would be measured, and a
 * measurement of a shape nobody drew is worse than no measurement. The geometry
 * predicates make the same call for the same reason.
 */
function readPoints(raw: unknown): { x: number; y: number }[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_POINTS_PER_ITEM) return null;
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

/**
 * The distinct, non-empty profile labels in a set of items, in first-seen order.
 *
 * Deduplicated through a Set rather than `labels.includes`, so the cost is
 * linear in the item count instead of quadratic. With fifty items that
 * difference is immaterial; it matters because this is reached from the
 * unauthenticated validate endpoint, where "immaterial per request" is the wrong
 * unit to reason in.
 */
export function profileLabelsOf(items: readonly OrderValidatorItem[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of items) {
    const label = typeof item.profileType === 'string' ? item.profileType.trim() : '';
    if (label === '' || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/**
 * The number of items in a raw body whose `points` array is over the cap.
 *
 * Counted rather than silently dropped so the API boundary can refuse the
 * request and say why. CLAUDE.md rule #28's principle, applied to a payload
 * limit: a cap that is not reported looks exactly like coverage.
 */
export function countOversizedPolylines(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let count = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const points = (entry as { points?: unknown }).points;
    if (Array.isArray(points) && points.length > MAX_POINTS_PER_ITEM) count += 1;
  }
  return count;
}
