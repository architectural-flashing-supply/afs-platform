/**
 * SHOP CALLOUT GEOMETRY — where an arrow points, in profile units, forever.
 *
 * ============ WHY THIS IS A MODULE AND NOT INLINE IN THE CANVAS ============
 *
 * `app/studio/draft/page.tsx` is 5,000 lines. This project has already paid for
 * putting a rule inside it: the revision rule was an inline ternary in that
 * component, nothing could assert it, and it stayed wrong through several
 * passes (SESSION_STATE.md, 2026-10-03 — `lib/flashdraft/revision.ts` exists
 * for exactly that reason). The anchoring rule here has the same shape: easy to
 * write, impossible to eyeball, and wrong in a way nobody sees until a part is
 * bent to the wrong note. So it lives here, pure, with a test.
 *
 * ============ EVERYTHING HERE IS IN INCHES ============
 *
 * FlashDraft's `points` are inches (`PIXELS_PER_INCH` is applied only at
 * render). Not one function in this file takes or returns a screen pixel. Zoom,
 * pan, resize and fit-to-view are therefore incapable of moving an arrow: they
 * change `worldToScreen`, and `worldToScreen` is applied to this module's
 * output by the caller, after the fact.
 *
 * ============ THE ANCHOR SURVIVES AN EDIT, OR SAYS IT DID NOT ============
 *
 * `resolveCalloutAnchor` answers in three ways and never in a fourth:
 *
 *   'exact'      the segment it was drawn on is still there, unmoved. Use
 *                segment_index + t, which is sub-thousandth-of-an-inch faithful.
 *   'resnapped'  the drawing changed. The authored tip is re-snapped to the
 *                nearest point on the polyline as it is NOW, within tolerance.
 *   'orphaned'   nothing is within tolerance. NO ARROW IS DRAWN AND THE NOTE IS
 *                KEPT. A shop note is never discarded because somebody moved a
 *                leg — see migration 051's header.
 */

export interface CalloutPoint {
  x: number;
  y: number;
}

/** The stored anchor, exactly as `shop_callouts` holds it. All inches. */
export interface CalloutAnchor {
  segmentIndex: number;
  segmentCount: number;
  /** 0..1 along the authored segment. */
  t: number;
  /** The authored segment's own endpoints — how "same segment?" is decided. */
  segA: CalloutPoint;
  segB: CalloutPoint;
  /** The authored arrow tip. The fallback when the index can no longer be trusted. */
  anchor: CalloutPoint;
}

export type CalloutAnchorStatus = 'exact' | 'resnapped' | 'orphaned';

export interface ResolvedCalloutAnchor {
  status: CalloutAnchorStatus;
  /** Where the tip goes now, in inches. Null only when orphaned. */
  tip: CalloutPoint | null;
  /** Which segment it ended up on now. Null only when orphaned. */
  segmentIndex: number | null;
  /** 0..1 along that segment. Null only when orphaned. */
  t: number | null;
}

/**
 * How far an authored endpoint may have moved and still count as "the same
 * segment". A thousandth of an inch is below any dimension this shop works to
 * and well above float noise from a JSON round-trip through `numeric`.
 */
export const SAME_SEGMENT_TOLERANCE_IN = 0.001;

/**
 * How far from the profile a re-snap may land before the callout is orphaned.
 *
 * Half an inch, in profile units. Chosen so that nudging a leg, changing a
 * bend angle a few degrees, or adding a leg somewhere else keeps the note on
 * the metal, while deleting the leg it described does not quietly slide the
 * arrow onto a different leg and keep looking authoritative.
 */
export const ORPHAN_TOLERANCE_IN = 0.5;

/**
 * How close a placement click must be to the profile, in profile units.
 *
 * Reid's requirement is a tolerance in PROFILE UNITS, not pixels, which is the
 * right call: at a far-out zoom a 20px screen tolerance is a foot of metal.
 * Two inches is about the width of a leg on a typical coping cap, so a click
 * anywhere on or just beside the part lands, and a click out in white space
 * creates nothing and says so.
 */
export const PLACEMENT_TOLERANCE_IN = 2;

/** Default distance from tip to tail, in inches, before Steve drags it. */
export const DEFAULT_TAIL_OFFSET_IN = 1.75;

function sub(a: CalloutPoint, b: CalloutPoint): CalloutPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function len(v: CalloutPoint): number {
  return Math.hypot(v.x, v.y);
}

/** Closest point to `p` on the finite segment a->b, plus its 0..1 parameter. */
export function closestPointOnSegment(
  p: CalloutPoint,
  a: CalloutPoint,
  b: CalloutPoint
): { point: CalloutPoint; t: number; distance: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  // A zero-length segment is a real possibility in a half-drawn profile; it
  // has no direction, so every point on it is `a` and t is 0 by definition.
  if (lengthSq === 0) {
    return { point: { x: a.x, y: a.y }, t: 0, distance: len(sub(p, a)) };
  }
  const raw = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  const t = Math.max(0, Math.min(1, raw));
  const point = { x: a.x + t * abx, y: a.y + t * aby };
  return { point, t, distance: len(sub(p, point)) };
}

export interface NearestSegmentHit {
  segmentIndex: number;
  t: number;
  point: CalloutPoint;
  distance: number;
}

/**
 * The nearest point on the nearest segment of the polyline, in inches.
 *
 * Returns null for a polyline with fewer than two points — there is no segment
 * to be near. NEARER WINS on a tie-free comparison (`<`), so the FIRST of two
 * equidistant segments is kept; that matters at a bend vertex, where two
 * segments are exactly equidistant and picking the later one every time would
 * make a click at a corner feel like it jumped.
 */
export function nearestSegment(
  p: CalloutPoint,
  points: readonly CalloutPoint[]
): NearestSegmentHit | null {
  if (points.length < 2) return null;
  let best: NearestSegmentHit | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const hit = closestPointOnSegment(p, points[i], points[i + 1]);
    if (best === null || hit.distance < best.distance) {
      best = { segmentIndex: i, t: hit.t, point: hit.point, distance: hit.distance };
    }
  }
  return best;
}

/**
 * The placement answer for a click: a hit, or an explicit refusal.
 *
 * `null` is the refusal and the caller shows "Click closer to the profile" and
 * creates nothing. It is deliberately not "snap to the nearest thing however
 * far away" — a callout out in empty space, with an arrow stretching across the
 * canvas to some leg it was never meant to describe, is worse than no callout.
 */
export function placementHit(
  p: CalloutPoint,
  points: readonly CalloutPoint[],
  toleranceIn: number = PLACEMENT_TOLERANCE_IN
): NearestSegmentHit | null {
  const hit = nearestSegment(p, points);
  if (!hit) return null;
  return hit.distance <= toleranceIn ? hit : null;
}

/** The point at parameter `t` along segment `i`, or null if there is no such segment. */
export function pointAtSegmentT(
  points: readonly CalloutPoint[],
  segmentIndex: number,
  t: number
): CalloutPoint | null {
  if (segmentIndex < 0 || segmentIndex + 1 >= points.length) return null;
  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  const clamped = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * clamped, y: a.y + (b.y - a.y) * clamped };
}

function samePoint(a: CalloutPoint, b: CalloutPoint, tol: number): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

/**
 * WHERE THE ARROW POINTS NOW. See this file's header for the three answers.
 *
 * The index is checked against the stored ENDPOINTS before it is trusted,
 * which is the whole point: CLAUDE.md rule #13 means a prepend shifts every
 * index by one, so an anchor that trusted `segment_index` alone would, after a
 * prepend, confidently point at a leg it was never drawn on. Comparing
 * geometry catches that, because the leg at index 0 is no longer the leg whose
 * endpoints were recorded.
 */
export function resolveCalloutAnchor(
  anchor: CalloutAnchor,
  points: readonly CalloutPoint[],
  orphanToleranceIn: number = ORPHAN_TOLERANCE_IN
): ResolvedCalloutAnchor {
  const segmentCount = Math.max(0, points.length - 1);

  // 1. The exact segment, still where it was.
  if (
    segmentCount > 0 &&
    anchor.segmentIndex >= 0 &&
    anchor.segmentIndex < segmentCount &&
    samePoint(points[anchor.segmentIndex], anchor.segA, SAME_SEGMENT_TOLERANCE_IN) &&
    samePoint(points[anchor.segmentIndex + 1], anchor.segB, SAME_SEGMENT_TOLERANCE_IN)
  ) {
    const tip = pointAtSegmentT(points, anchor.segmentIndex, anchor.t);
    if (tip) {
      return { status: 'exact', tip, segmentIndex: anchor.segmentIndex, t: anchor.t };
    }
  }

  // 2. The drawing moved. Re-snap the authored tip onto the polyline as it is.
  const hit = nearestSegment(anchor.anchor, points);
  if (hit && hit.distance <= orphanToleranceIn) {
    return { status: 'resnapped', tip: hit.point, segmentIndex: hit.segmentIndex, t: hit.t };
  }

  // 3. Nothing within tolerance. The note survives; the arrow does not.
  return { status: 'orphaned', tip: null, segmentIndex: null, t: null };
}

/** The average of the polyline's vertices. Used only to choose a tail side. */
export function polylineCentroid(points: readonly CalloutPoint[]): CalloutPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/**
 * THE DEFAULT TAIL OFFSET, in inches, on the emptier side of the profile.
 *
 * "The side with the most empty canvas" is approximated by "the side away from
 * the profile's own centroid", measured along the anchored segment's NORMAL.
 * For an open sheet-metal cross-section — which is every profile this tool
 * draws — the metal is on the centroid side and the air is on the other, so the
 * approximation is the answer rather than a guess at it. It also costs nothing
 * to be wrong: the tail is draggable the moment it appears.
 *
 * The degenerate case (a tip exactly at the centroid, or a zero-length
 * segment) falls back to straight up — negative y is up in FlashDraft's y-down
 * screen convention, the same convention `lib/flashdraft/geometry.ts` works in.
 */
export function defaultTailOffset(
  tip: CalloutPoint,
  segA: CalloutPoint,
  segB: CalloutPoint,
  points: readonly CalloutPoint[],
  offsetIn: number = DEFAULT_TAIL_OFFSET_IN
): CalloutPoint {
  const dx = segB.x - segA.x;
  const dy = segB.y - segA.y;
  const segLen = Math.hypot(dx, dy);
  if (segLen === 0) return { x: 0, y: -offsetIn };

  // Either normal will do; which one is decided below.
  let nx = -dy / segLen;
  let ny = dx / segLen;

  const c = polylineCentroid(points);
  const away = { x: tip.x - c.x, y: tip.y - c.y };
  const dot = nx * away.x + ny * away.y;
  if (dot < 0) {
    nx = -nx;
    ny = -ny;
  } else if (dot === 0) {
    // Exactly on the centroid line — no side is emptier. Up.
    return { x: 0, y: -offsetIn };
  }
  return { x: nx * offsetIn, y: ny * offsetIn };
}

/**
 * The bounding box of a profile together with its callout tails, in inches.
 *
 * Shop View draws the profile itself, so it has to know how much room the
 * arrows need — a tail sticking out past the metal must not be cropped off the
 * side of the plate. Returns null for an empty polyline.
 */
export function calloutBounds(
  points: readonly CalloutPoint[],
  tails: readonly CalloutPoint[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const all = [...points, ...tails];
  if (all.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
