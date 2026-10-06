import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAIL_OFFSET_IN,
  ORPHAN_TOLERANCE_IN,
  PLACEMENT_TOLERANCE_IN,
  calloutBounds,
  closestPointOnSegment,
  defaultTailOffset,
  nearestSegment,
  placementHit,
  pointAtSegmentT,
  resolveCalloutAnchor,
  type CalloutAnchor,
  type CalloutPoint,
} from './geometry';

/**
 * An L — two legs, three points, two segments. Inches, y-down (FlashDraft's
 * screen convention, the same one lib/flashdraft/geometry.ts works in).
 *
 *   (0,0) ---- (4,0)
 *               |
 *             (4,3)
 */
const L: CalloutPoint[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
];

/** The anchor Steve would get by clicking the middle of the top leg. */
const topLegMiddle: CalloutAnchor = {
  segmentIndex: 0,
  segmentCount: 2,
  t: 0.5,
  segA: { x: 0, y: 0 },
  segB: { x: 4, y: 0 },
  anchor: { x: 2, y: 0 },
};

describe('closestPointOnSegment', () => {
  it('projects onto the segment and reports t', () => {
    const r = closestPointOnSegment({ x: 1, y: 5 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(r.point).toEqual({ x: 1, y: 0 });
    expect(r.t).toBeCloseTo(0.25);
    expect(r.distance).toBeCloseTo(5);
  });

  it('clamps past either end instead of running off the line', () => {
    expect(closestPointOnSegment({ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }).t).toBe(0);
    expect(closestPointOnSegment({ x: 99, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }).t).toBe(1);
  });

  it('handles a zero-length segment without dividing by zero', () => {
    const r = closestPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(r.t).toBe(0);
    expect(r.distance).toBeCloseTo(5);
    expect(Number.isFinite(r.distance)).toBe(true);
  });
});

describe('nearestSegment — the hit-test', () => {
  it('finds the nearer of two legs', () => {
    expect(nearestSegment({ x: 2, y: 0.4 }, L)?.segmentIndex).toBe(0);
    expect(nearestSegment({ x: 4.4, y: 2 }, L)?.segmentIndex).toBe(1);
  });

  it('returns null when there is no segment to be near', () => {
    expect(nearestSegment({ x: 0, y: 0 }, [])).toBeNull();
    expect(nearestSegment({ x: 0, y: 0 }, [{ x: 1, y: 1 }])).toBeNull();
  });

  it('keeps the first of two exactly equidistant segments', () => {
    // The corner (4,0) is on both legs. Picking the later one every time makes
    // a click at a bend feel like it jumped to the wrong leg.
    expect(nearestSegment({ x: 4, y: 0 }, L)?.segmentIndex).toBe(0);
  });
});

describe('placementHit — tolerance is in PROFILE UNITS', () => {
  it('uses two inches by default', () => {
    expect(PLACEMENT_TOLERANCE_IN).toBe(2);
  });

  it('accepts a click on or just beside the metal', () => {
    expect(placementHit({ x: 2, y: 0 }, L)).not.toBeNull();
    expect(placementHit({ x: 2, y: 1.9 }, L)).not.toBeNull();
  });

  it('creates nothing for a click out in empty space', () => {
    // This is the "Click closer to the profile" branch. It must be a refusal
    // and not a snap to the nearest thing however far away.
    expect(placementHit({ x: 2, y: 40 }, L)).toBeNull();
  });

  it('is unaffected by zoom, because it never sees a pixel', () => {
    // The same world click lands the same way whatever the view is doing —
    // there is no zoom argument to pass, which is the property being asserted.
    const a = placementHit({ x: 2, y: 0.5 }, L);
    const b = placementHit({ x: 2, y: 0.5 }, L);
    expect(a).toEqual(b);
    expect(a?.segmentIndex).toBe(0);
    expect(a?.t).toBeCloseTo(0.5);
  });
});

describe('resolveCalloutAnchor', () => {
  it('is exact while the drawing is unchanged', () => {
    const r = resolveCalloutAnchor(topLegMiddle, L);
    expect(r.status).toBe('exact');
    expect(r.tip).toEqual({ x: 2, y: 0 });
    expect(r.segmentIndex).toBe(0);
  });

  it('survives zoom, pan, resize and fit-to-view — none of which are inputs', () => {
    // The anchor is parametric and the geometry is in inches. There is no
    // view state in this function's signature, so a view change cannot reach
    // it. Asserted by resolving the same anchor repeatedly and comparing.
    const once = resolveCalloutAnchor(topLegMiddle, L);
    const again = resolveCalloutAnchor(topLegMiddle, L);
    expect(again).toEqual(once);
  });

  it('follows its own leg when the leg is stretched', () => {
    // Leg 0 is now 8in instead of 4in and the anchor was at t=0.5, so the tip
    // moves to the new midpoint. That is the point of storing t rather than a
    // position: the note stays "halfway along this leg".
    const stretched: CalloutPoint[] = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 3 },
    ];
    const r = resolveCalloutAnchor(topLegMiddle, stretched);
    // The stored endpoints no longer match, so it re-snaps rather than
    // claiming to be exact — and the re-snap lands on the same leg.
    expect(r.status).toBe('resnapped');
    expect(r.segmentIndex).toBe(0);
    expect(r.tip).toEqual({ x: 2, y: 0 });
  });

  it('does NOT trust the index after a prepend — CLAUDE.md rule #13', () => {
    // A leg prepended at the head shifts every index by one. An anchor that
    // trusted segment_index alone would now confidently point at the NEW first
    // leg, which it was never drawn on. The stored endpoints catch it, and the
    // re-snap puts it back on the leg it was really drawn on (now index 1).
    const prepended: CalloutPoint[] = [{ x: -3, y: 0 }, ...L];
    const r = resolveCalloutAnchor(topLegMiddle, prepended);
    expect(r.status).toBe('resnapped');
    expect(r.segmentIndex).toBe(1);
    expect(r.tip).toEqual({ x: 2, y: 0 });
  });

  it('orphans rather than silently moving the arrow somewhere wrong', () => {
    // The leg the note described is gone and the rest of the profile is far
    // away. The note is kept by the caller; this function only declines to
    // invent a position for the arrow.
    const elsewhere: CalloutPoint[] = [
      { x: 100, y: 100 },
      { x: 104, y: 100 },
    ];
    const r = resolveCalloutAnchor(topLegMiddle, elsewhere);
    expect(r.status).toBe('orphaned');
    expect(r.tip).toBeNull();
    expect(r.segmentIndex).toBeNull();
  });

  it('orphans when the profile has been emptied entirely', () => {
    expect(resolveCalloutAnchor(topLegMiddle, []).status).toBe('orphaned');
    expect(resolveCalloutAnchor(topLegMiddle, [{ x: 0, y: 0 }]).status).toBe('orphaned');
  });

  it('re-snaps inside the half-inch tolerance and orphans outside it', () => {
    expect(ORPHAN_TOLERANCE_IN).toBe(0.5);
    const nudgedUp: CalloutPoint[] = [
      { x: 0, y: -0.4 },
      { x: 4, y: -0.4 },
      { x: 4, y: 3 },
    ];
    expect(resolveCalloutAnchor(topLegMiddle, nudgedUp).status).toBe('resnapped');

    const movedFar: CalloutPoint[] = [
      { x: 0, y: -0.6 },
      { x: 4, y: -0.6 },
    ];
    expect(resolveCalloutAnchor(topLegMiddle, movedFar).status).toBe('orphaned');
  });

  it('refuses an out-of-range stored index without throwing', () => {
    const bad: CalloutAnchor = { ...topLegMiddle, segmentIndex: 99 };
    const r = resolveCalloutAnchor(bad, L);
    // Falls through to the geometric re-snap, which still knows where it was.
    expect(r.status).toBe('resnapped');
    expect(r.segmentIndex).toBe(0);
  });
});

describe('pointAtSegmentT', () => {
  it('interpolates and clamps', () => {
    expect(pointAtSegmentT(L, 0, 0.25)).toEqual({ x: 1, y: 0 });
    expect(pointAtSegmentT(L, 1, 2)).toEqual({ x: 4, y: 3 });
  });

  it('is null for a segment that does not exist', () => {
    expect(pointAtSegmentT(L, 2, 0.5)).toBeNull();
    expect(pointAtSegmentT(L, -1, 0.5)).toBeNull();
  });
});

describe('defaultTailOffset', () => {
  it('is 1.75in and points away from the metal', () => {
    expect(DEFAULT_TAIL_OFFSET_IN).toBe(1.75);
    // The L's centroid is below the top leg (y mean = 1), so the emptier side
    // of the top leg is upwards: negative y.
    const t = defaultTailOffset({ x: 2, y: 0 }, L[0], L[1], L);
    expect(t.y).toBeCloseTo(-DEFAULT_TAIL_OFFSET_IN);
    expect(t.x).toBeCloseTo(0);
  });

  it('points the other way for the other leg', () => {
    // The vertical leg's empty side is to the RIGHT of it (+x), away from the
    // centroid at x = 8/3.
    const t = defaultTailOffset({ x: 4, y: 1.5 }, L[1], L[2], L);
    expect(t.x).toBeCloseTo(DEFAULT_TAIL_OFFSET_IN);
    expect(t.y).toBeCloseTo(0);
  });

  it('keeps the offset length exactly', () => {
    const t = defaultTailOffset({ x: 2, y: 0 }, L[0], L[1], L, 3);
    expect(Math.hypot(t.x, t.y)).toBeCloseTo(3);
  });

  it('falls back to straight up for a degenerate segment', () => {
    const t = defaultTailOffset({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }, L);
    expect(t).toEqual({ x: 0, y: -DEFAULT_TAIL_OFFSET_IN });
  });
});

describe('calloutBounds', () => {
  it('includes the tails, so an arrow is never cropped off the plate', () => {
    const b = calloutBounds(L, [{ x: 2, y: -1.75 }]);
    expect(b).toEqual({ minX: 0, minY: -1.75, maxX: 4, maxY: 3 });
  });

  it('is null with nothing to bound', () => {
    expect(calloutBounds([], [])).toBeNull();
  });
});
