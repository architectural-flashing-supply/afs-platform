import { describe, expect, it } from 'vitest';
import { findSelfIntersections, findZeroLengthSegments, segmentLengthsIn } from './geometry-checks';
import { SELF_CROSSING_POINTS, W_PROFILE_POINTS, Z_PROFILE_POINTS } from './fixtures';

const EPSILON_IN = 0.001;

describe('segmentLengthsIn', () => {
  it('measures each leg of an L in drawing order', () => {
    const lengths = segmentLengthsIn([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
    ]);
    expect(
      lengths,
      'Expected [6, 4] — the per-segment breakdown in drawing order, which is what a rule needs to name WHICH leg is too short (the girth alone cannot).'
    ).toEqual([6, 4]);
  });

  it('measures a diagonal leg by its true length, not its x or y extent', () => {
    const lengths = segmentLengthsIn([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(
      lengths,
      'Expected [5] for a 3-4-5 diagonal. A fold is formed along the metal, so the leg length is the hypotenuse, not the horizontal run.'
    ).toEqual([5]);
  });

  it('returns no lengths for a polyline with fewer than two points', () => {
    expect(segmentLengthsIn([{ x: 1, y: 1 }]), 'Expected [] for one point: there is no segment.').toEqual([]);
    expect(segmentLengthsIn([]), 'Expected [] for an empty polyline.').toEqual([]);
  });

  it('returns no lengths for null and undefined input', () => {
    expect(segmentLengthsIn(null), 'Expected [] for null — a Quote Builder item has no points at all.').toEqual(
      []
    );
    expect(segmentLengthsIn(undefined), 'Expected [] for undefined.').toEqual([]);
  });

  it('returns no lengths when any coordinate is not a finite number', () => {
    const cases: { label: string; points: unknown[] }[] = [
      { label: 'NaN', points: [{ x: 0, y: 0 }, { x: Number.NaN, y: 2 }] },
      { label: 'Infinity', points: [{ x: 0, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 2 }] },
      { label: 'a string coordinate', points: [{ x: 0, y: 0 }, { x: '5', y: 2 }] },
      { label: 'a missing coordinate', points: [{ x: 0, y: 0 }, { x: 5 }] },
      { label: 'a null point', points: [{ x: 0, y: 0 }, null] },
    ];
    for (const { label, points } of cases) {
      expect(
        segmentLengthsIn(points),
        `Expected [] when the polyline contains ${label}: a half-measured profile is worse than an unmeasured one, because the structural rules upstream have already reported the real problem.`
      ).toEqual([]);
    }
  });
});

describe('findZeroLengthSegments', () => {
  it('finds nothing in a clean L', () => {
    expect(
      findZeroLengthSegments(
        [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 4 },
        ],
        EPSILON_IN
      ),
      'Expected [] — both legs of this L have real length.'
    ).toEqual([]);
  });

  it('finds the index of a segment whose two points are identical', () => {
    expect(
      findZeroLengthSegments(
        [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 4 },
        ],
        EPSILON_IN
      ),
      'Expected [1] — the second segment has no length because its end points coincide, and the bend angle at a coincident point is undefined.'
    ).toEqual([1]);
  });

  it('finds every zero-length segment, not just the first', () => {
    expect(
      findZeroLengthSegments(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 0 },
        ],
        EPSILON_IN
      ),
      'Expected [0, 2]: a customer fixing one duplicated point should be told about the other in the same pass.'
    ).toEqual([0, 2]);
  });

  it('treats a segment exactly at the tolerance as zero length (boundary)', () => {
    expect(
      findZeroLengthSegments(
        [
          { x: 0, y: 0 },
          { x: EPSILON_IN, y: 0 },
        ],
        EPSILON_IN
      ),
      'Expected [0]. The comparison is <=, so a drag that snapped to exactly the tolerance counts as the same point rather than falling between the two rules.'
    ).toEqual([0]);
  });

  it('treats a segment just above the tolerance as a real leg (boundary)', () => {
    expect(
      findZeroLengthSegments(
        [
          { x: 0, y: 0 },
          { x: EPSILON_IN * 2, y: 0 },
        ],
        EPSILON_IN
      ),
      'Expected [] at twice the tolerance: this is a real (if absurdly short) leg, and it is the TOO-SHORT rule that should report it, so the customer is told the minimum rather than "you duplicated a point".'
    ).toEqual([]);
  });

  it('returns nothing for a negative or non-finite tolerance rather than flagging everything', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ];
    expect(findZeroLengthSegments(points, -1), 'Expected [] for a negative tolerance.').toEqual([]);
    expect(findZeroLengthSegments(points, Number.NaN), 'Expected [] for a NaN tolerance.').toEqual([]);
  });
});

describe('findSelfIntersections', () => {
  it('finds nothing in a Z, which has two bends and no crossing', () => {
    expect(
      findSelfIntersections(Z_PROFILE_POINTS, EPSILON_IN),
      'Expected [] for a Z. This is the first thing a naive "do any two segments touch" check gets wrong, because every pair of adjacent legs touches at its shared bend.'
    ).toEqual([]);
  });

  it('finds nothing in a W, which has three bends and no crossing', () => {
    expect(
      findSelfIntersections(W_PROFILE_POINTS, EPSILON_IN),
      'Expected [] for a W — a real AFS profile shape, and the shape CLAUDE.md rule #12 records as having been rendered wrongly once before.'
    ).toEqual([]);
  });

  it('finds the crossing pair when a later leg cuts back over an earlier one', () => {
    expect(
      findSelfIntersections(SELF_CROSSING_POINTS, EPSILON_IN),
      'Expected [[0, 2]]: segment 2 runs from (10,10) to (5,-5) and crosses segment 0 along y=0 at x≈6.67. The metal would have to pass through itself.'
    ).toEqual([[0, 2]]);
  });

  it('never reports adjacent segments, which share a vertex by construction', () => {
    const tightFold = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 0.0005 },
    ];
    expect(
      findSelfIntersections(tightFold, EPSILON_IN),
      'Expected [] for a near-flat fold. CLAUDE.md rule #12 makes a 0 degree bend (folded flat back) legal, and its two legs lie almost on top of each other — reporting that would refuse hems and tight folds, which are ordinary AFS work.'
    ).toEqual([]);
  });

  it('never reports a non-adjacent leg that returns alongside an earlier one with a real gap', () => {
    const smashedHemShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0.1 },
      { x: 2, y: 0.1 },
    ];
    expect(
      findSelfIntersections(smashedHemShape, EPSILON_IN),
      'Expected [] — segment 2 runs back parallel to segment 0 with a 1/10 in gap between them, which is what a tight return fold looks like. Flagging a parallel neighbour as an intersection would refuse a shape AFS makes every day; only a real crossing or touch counts.'
    ).toEqual([]);
  });

  it('reports non-adjacent segments that merely touch at a point', () => {
    const closedBox = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];
    expect(
      findSelfIntersections(closedBox, EPSILON_IN),
      'Expected [[0, 3]]: the last leg returns to the first point, so the profile has closed on itself. A touch is not a near miss a fabricator could nudge — and CLAUDE.md rule #13 says no gesture can even draw a closing leg, so a closed polyline is corrupt data.'
    ).toEqual([[0, 3]]);
  });

  it('reports a non-adjacent leg that runs back along an earlier one (collinear overlap)', () => {
    const doubledBack = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 8, y: 5 },
      { x: 8, y: 0 },
      { x: 2, y: 0 },
    ];
    const found = findSelfIntersections(doubledBack, EPSILON_IN);
    expect(
      found.length,
      `Expected at least one crossing: the last leg runs back along the first leg's line between x=8 and x=2, which a pure "proper crossing" test misses because the two are parallel. Got ${JSON.stringify(found)}.`
    ).toBeGreaterThan(0);
  });

  it('returns pairs in ascending order so the result is deterministic', () => {
    const found = findSelfIntersections(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 5, y: -5 },
        { x: 1, y: 6 },
        { x: -2, y: -2 },
      ],
      EPSILON_IN
    );
    const sorted = [...found].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
    expect(
      found,
      'Expected the pairs already in ascending (i, j) order. Three surfaces validate the same drawing and must print the same message in the same order.'
    ).toEqual(sorted);
  });

  it('returns nothing for too-few points, null, undefined and non-finite coordinates', () => {
    expect(findSelfIntersections([{ x: 0, y: 0 }], EPSILON_IN), 'Expected [] for one point.').toEqual([]);
    expect(findSelfIntersections([], EPSILON_IN), 'Expected [] for no points.').toEqual([]);
    expect(findSelfIntersections(null, EPSILON_IN), 'Expected [] for null.').toEqual([]);
    expect(findSelfIntersections(undefined, EPSILON_IN), 'Expected [] for undefined.').toEqual([]);
    expect(
      findSelfIntersections([{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }, { x: 2, y: 2 }], EPSILON_IN),
      'Expected [] when a coordinate is NaN: an orientation test on NaN is neither positive nor negative, so the result would be arbitrary.'
    ).toEqual([]);
  });

  it('finds nothing in a two-point profile, which has only one segment', () => {
    expect(
      findSelfIntersections(
        [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
        ],
        EPSILON_IN
      ),
      'Expected [] — one segment cannot cross itself.'
    ).toEqual([]);
  });
});
