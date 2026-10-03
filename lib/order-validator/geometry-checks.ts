/**
 * POLYLINE PREDICATES FOR A DRAWN PROFILE. Pure, total, and deliberately dull.
 *
 * FlashDraft stores a profile as a polyline of world points in INCHES
 * (app/studio/draft/page.tsx's `templatePointsToWorld` divides canvas pixels by
 * PIXELS_PER_INCH, and the same world coordinates go into
 * `quote_requests.line_items[].points`). Three things about such a polyline are
 * physically impossible to fabricate, and none of them is visible from the
 * named dimensions a Quote Builder submission carries:
 *
 *   1. A ZERO-LENGTH SEGMENT — two points at the same place. There is no leg
 *      there, and the bend angle at a coincident point is undefined.
 *   2. A SEGMENT SHORTER THAN THE BRAKE MINIMUM — handled by the caller, which
 *      owns the threshold; this module only measures.
 *   3. A SELF-INTERSECTION — the metal would have to pass through itself.
 *
 * WHAT IS NOT AN ERROR, and why the distinction is load-bearing: ADJACENT
 * segments share a vertex by construction, so they always "touch". A fold of 0
 * degrees — the metal folded flat back on itself — is a legal FlashDraft bend
 * (CLAUDE.md rule #12: "0 = folded flat back"), and its two legs lie on top of
 * each other. Reporting either as a self-intersection would refuse hems and
 * tight folds, which are AFS's ordinary work. So only NON-ADJACENT segment
 * pairs are ever considered.
 *
 * Nothing here throws, and nothing here reads a clock, a random source, or any
 * I/O: a validator has to give the same answer on the client and on the server
 * for the same drawing.
 */

export interface PlanePoint {
  x: number;
  y: number;
}

function isFinitePoint(point: unknown): point is PlanePoint {
  if (!point || typeof point !== 'object') return false;
  const candidate = point as { x?: unknown; y?: unknown };
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y)
  );
}

/**
 * Every point is finite and there are at least two of them. A polyline that
 * fails this is not "invalid geometry" — it is not geometry at all, and the
 * structural rules upstream have already said so — so each predicate below
 * returns its empty result rather than guessing.
 */
function usablePoints(points: readonly unknown[] | null | undefined): PlanePoint[] | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  const usable: PlanePoint[] = [];
  for (const point of points) {
    if (!isFinitePoint(point)) return null;
    usable.push({ x: point.x, y: point.y });
  }
  return usable;
}

/**
 * The length of each segment, in inches, in drawing order. `[]` when the
 * polyline is unusable.
 *
 * Deliberately NOT the same function as
 * `lib/pricing/quote-inputs.ts`'s `blankWidthInFromPoints`, which sums these
 * into one girth and is the canonical girth (CLAUDE.md rule #19 — the validator
 * imports that one rather than re-summing). This returns the per-segment
 * breakdown, which the girth does not, because a rule needs to name WHICH leg
 * is too short.
 */
export function segmentLengthsIn(points: readonly unknown[] | null | undefined): number[] {
  const usable = usablePoints(points);
  if (!usable) return [];
  const lengths: number[] = [];
  for (let i = 0; i < usable.length - 1; i += 1) {
    lengths.push(Math.hypot(usable[i + 1].x - usable[i].x, usable[i + 1].y - usable[i].y));
  }
  return lengths;
}

/**
 * Indices of segments at or below `epsilonIn` — two points in the same place.
 *
 * `epsilonIn` is a tolerance, not a minimum: a drag on the canvas snaps, so two
 * points the user meant to coincide can differ in the last float digit, and an
 * exact `=== 0` test would miss them.
 */
export function findZeroLengthSegments(
  points: readonly unknown[] | null | undefined,
  epsilonIn: number
): number[] {
  if (!Number.isFinite(epsilonIn) || epsilonIn < 0) return [];
  const lengths = segmentLengthsIn(points);
  const found: number[] = [];
  lengths.forEach((length, index) => {
    if (length <= epsilonIn) found.push(index);
  });
  return found;
}

/** Sign of the cross product (b-a) x (c-a): +1 left turn, -1 right turn, 0 collinear. */
function orientation(a: PlanePoint, b: PlanePoint, c: PlanePoint, epsilon: number): number {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (cross > epsilon) return 1;
  if (cross < -epsilon) return -1;
  return 0;
}

/** Is `point` within the axis-aligned box of segment a-b (used only when collinear)? */
function withinSpan(a: PlanePoint, b: PlanePoint, point: PlanePoint, epsilon: number): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

/**
 * Do segments p1-p2 and p3-p4 share any point?
 *
 * Standard orientation test, with the collinear case handled explicitly so that
 * two non-adjacent legs lying ON each other — a profile that has curled round
 * until a later leg runs back along an earlier one — is caught rather than
 * passed as "no proper crossing".
 */
function segmentsIntersect(
  p1: PlanePoint,
  p2: PlanePoint,
  p3: PlanePoint,
  p4: PlanePoint,
  epsilon: number
): boolean {
  const d1 = orientation(p3, p4, p1, epsilon);
  const d2 = orientation(p3, p4, p2, epsilon);
  const d3 = orientation(p1, p2, p3, epsilon);
  const d4 = orientation(p1, p2, p4, epsilon);

  if (d1 !== d2 && d3 !== d4) return true;

  if (d1 === 0 && withinSpan(p3, p4, p1, epsilon)) return true;
  if (d2 === 0 && withinSpan(p3, p4, p2, epsilon)) return true;
  if (d3 === 0 && withinSpan(p1, p2, p3, epsilon)) return true;
  if (d4 === 0 && withinSpan(p1, p2, p4, epsilon)) return true;

  return false;
}

/**
 * Index pairs `[i, j]` (i < j, always non-adjacent) of segments that cross or
 * touch. Empty when the profile is clean or the polyline is unusable.
 *
 * A TOUCH COUNTS. Two non-adjacent legs meeting at a point means the profile has
 * closed on itself, and the metal cannot be folded into that without passing
 * through itself — it is not a near miss that a fabricator could nudge.
 *
 * Pairs are returned in ascending `(i, j)` order so the caller's output is
 * deterministic.
 */
export function findSelfIntersections(
  points: readonly unknown[] | null | undefined,
  epsilonIn: number
): [number, number][] {
  const usable = usablePoints(points);
  if (!usable) return [];
  const epsilon = Number.isFinite(epsilonIn) && epsilonIn > 0 ? epsilonIn : 0;
  const segmentCount = usable.length - 1;
  const found: [number, number][] = [];

  for (let i = 0; i < segmentCount; i += 1) {
    // j starts at i + 2: i + 1 is the adjacent segment, which shares a vertex
    // with i by construction and is never an intersection.
    for (let j = i + 2; j < segmentCount; j += 1) {
      if (segmentsIntersect(usable[i], usable[i + 1], usable[j], usable[j + 1], epsilon)) {
        found.push([i, j]);
      }
    }
  }

  return found;
}
