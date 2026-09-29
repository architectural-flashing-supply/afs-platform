import { describe, it, expect } from 'vitest';
import {
  bendTurnDegrees,
  buildCrossSectionPoints,
  computeProfilePoints,
  formatBendAngleLabel,
  signedInteriorAngleDeg,
  type ProfileGeometryPoint,
} from './geometry';

/**
 * lr-02 — the 3D cross-section helper.
 *
 * The bug this file pins down: the 3D path (ProfileViewer3D, and through
 * it SubmitConfirmation3DModal and MatchedProfile3DModal) reconstructed
 * the cross-section from UNSIGNED bend angles, so every bend turned the
 * same way regardless of which way the user actually folded it. Reid's
 * reported failing case is `W_PROFILE` below — a 2D "W" with legs
 * 21 3/4, 16 1/4, 15 15/16, 22 3/16 and bends -50, +51, -53, which
 * rendered in 3D as a curled triangle with three positive labels.
 *
 * The contract asserted here:
 *   1. bendTurnDegrees carries the sign, and is bit-for-bit the old
 *      `180 - angle` for any non-negative angle (so unsigned callers are
 *      untouched).
 *   2. The reconstructed cross-section is CONGRUENT to the 2D point list
 *      it came from — same leg lengths, same signed bend angles — rather
 *      than merely "about the right size."
 *   3. Labels carry the correct sign and match the 2D canvas's own
 *      `.toFixed(0)` formatting exactly.
 */

const EPS = 1e-9;

/** Reid's failing case, exactly as reported. */
const W_PROFILE = {
  legs: [21.75, 16.25, 15.9375, 22.1875],
  bends: [-50, 51, -53],
};

/** A plain L: two legs, one 90-degree corner. */
const L_PROFILE = {
  legs: [6, 4],
  bends: [90],
};

/**
 * A Z: two bends of OPPOSITE handedness and equal magnitude. The
 * canonical shape the unsigned reconstruction gets wrong — unsigned, both
 * bends turn the same way and the Z closes into a U.
 */
const Z_PROFILE = {
  legs: [5, 3, 5],
  bends: [90, -90],
};

/** Bends in the {leftLeg, rightLeg, angle} shape ProfileViewer3D passes. */
function toViewerBends(profile: { legs: number[]; bends: number[] }) {
  return profile.bends.map((angle, i) => ({
    leftLeg: profile.legs[i],
    rightLeg: profile.legs[i + 1],
    angle,
  }));
}

function legLengths(points: ProfileGeometryPoint[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push(Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y));
  }
  return out;
}

function interiorAngles(points: ProfileGeometryPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    out.push(signedInteriorAngleDeg(points[i - 1], points[i], points[i + 1]));
  }
  return out;
}

/**
 * The 2D canvas is y-DOWN; the 3D viewer renders these points in a y-UP
 * frame (three.js XY). Reproducing a y-down walk in a y-up frame mirrors
 * it, which negates every signed angle — that mirror is exactly what makes
 * the 3D render LOOK like the 2D drawing rather than its reflection. So
 * congruence is checked as: same leg lengths, and signed angles equal
 * under one consistent global sign flip.
 */
function expectCongruentToCanvas(
  reconstructed: ProfileGeometryPoint[],
  expectedLegs: number[],
  expectedCanvasAngles: number[]
) {
  const legs = legLengths(reconstructed);
  expect(legs.length).toBe(expectedLegs.length);
  legs.forEach((len, i) => expect(len).toBeCloseTo(expectedLegs[i], 9));

  const angles = interiorAngles(reconstructed);
  expect(angles.length).toBe(expectedCanvasAngles.length);
  angles.forEach((a, i) => expect(a).toBeCloseTo(-expectedCanvasAngles[i], 9));
}

describe('bendTurnDegrees — turn direction per bend', () => {
  it('is bit-for-bit the old `180 - angle` for every non-negative angle', () => {
    for (let a = 0; a <= 180; a += 0.5) {
      expect(bendTurnDegrees(a)).toBe(180 - a);
    }
  });

  it('negates the turn for a negatively-signed bend', () => {
    expect(bendTurnDegrees(-50)).toBe(-bendTurnDegrees(50));
    expect(bendTurnDegrees(-90)).toBe(-bendTurnDegrees(90));
    expect(bendTurnDegrees(-179)).toBe(-bendTurnDegrees(179));
  });

  it('treats +/-180 as no turn at all', () => {
    expect(bendTurnDegrees(180)).toBe(0);
    expect(bendTurnDegrees(-180)).toBe(-0);
    expect(Math.abs(bendTurnDegrees(-180))).toBe(0);
  });

  it('treats a 0 interior angle as a full 180 fold-back, not "no bend"', () => {
    // Math.sign(0) === 0 would collapse the product to 0, which means the
    // OPPOSITE of what a 0 interior angle means.
    expect(bendTurnDegrees(0)).toBe(180);
  });
});

describe('buildCrossSectionPoints — W profile (Reid 2026-09-29 failing case)', () => {
  const bends = toViewerBends(W_PROFILE);

  it('alternates turn direction, one turn per bend, matching each bend sign', () => {
    const turns = W_PROFILE.bends.map(bendTurnDegrees);
    expect(turns.map(Math.sign)).toEqual([-1, 1, -1]);
    // Magnitudes are the supplements: 130, 129, 127.
    expect(turns.map((t) => Math.abs(t))).toEqual([130, 129, 127]);
  });

  it('reconstructs a cross-section congruent to the 2D drawing', () => {
    const points = buildCrossSectionPoints(bends);
    expect(points.length).toBe(W_PROFILE.legs.length + 1);
    expectCongruentToCanvas(points, W_PROFILE.legs, W_PROFILE.bends);
  });

  it('REGRESSION: the unsigned reconstruction curls instead of zig-zagging', () => {
    // This is the pre-fix behavior, reproduced by stripping the signs.
    const unsigned = bends.map((b) => ({ ...b, angle: Math.abs(b.angle) }));
    const curled = buildCrossSectionPoints(unsigned);
    const turns = interiorAngles(curled).map(Math.sign);
    // Every turn the same way — a curl, not a W.
    expect(new Set(turns).size).toBe(1);

    // And the fixed path is NOT that: it genuinely alternates.
    const fixed = interiorAngles(buildCrossSectionPoints(bends)).map(Math.sign);
    expect(new Set(fixed).size).toBe(2);
    expect(fixed).toEqual([1, -1, 1]);

    // The curl also closes the shape up: its first and last points end up
    // far closer together than the real W's do.
    const span = (pts: ProfileGeometryPoint[]) =>
      Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    expect(span(curled)).toBeLessThan(span(buildCrossSectionPoints(bends)));
  });

  it('labels carry the correct sign and match the 2D canvas format exactly', () => {
    expect(bends.map((b) => formatBendAngleLabel(b.angle))).toEqual(['-50°', '51°', '-53°']);
    // Re-derived from the reconstructed cross-section itself (negated for
    // the y-up frame), the labels come back identical to the 2D ones.
    const redisplayed = interiorAngles(buildCrossSectionPoints(bends)).map((a) => formatBendAngleLabel(-a));
    expect(redisplayed).toEqual(['-50°', '51°', '-53°']);
  });
});

describe('buildCrossSectionPoints — L profile', () => {
  const bends = toViewerBends(L_PROFILE);

  it('turns exactly once, in the direction its single bend sign gives', () => {
    expect(bendTurnDegrees(90)).toBe(90);
    expect(bendTurnDegrees(-90)).toBe(-90);
  });

  it('reconstructs a cross-section congruent to the 2D drawing', () => {
    const points = buildCrossSectionPoints(bends);
    expect(points.length).toBe(3);
    expectCongruentToCanvas(points, L_PROFILE.legs, L_PROFILE.bends);
  });

  it('mirrors when the bend sign flips, keeping the same leg lengths', () => {
    const right = buildCrossSectionPoints(bends);
    const left = buildCrossSectionPoints(bends.map((b) => ({ ...b, angle: -b.angle })));
    expect(legLengths(left)).toEqual(legLengths(right));
    expect(interiorAngles(left)[0]).toBeCloseTo(-interiorAngles(right)[0], 9);
  });

  it('labels carry the correct sign', () => {
    expect(formatBendAngleLabel(90)).toBe('90°');
    expect(formatBendAngleLabel(-90)).toBe('-90°');
  });
});

describe('buildCrossSectionPoints — Z profile', () => {
  const bends = toViewerBends(Z_PROFILE);

  it('turns opposite ways on its two bends', () => {
    const turns = Z_PROFILE.bends.map(bendTurnDegrees);
    expect(turns).toEqual([90, -90]);
    expect(Math.sign(turns[0])).toBe(-Math.sign(turns[1]));
  });

  it('reconstructs a cross-section congruent to the 2D drawing', () => {
    const points = buildCrossSectionPoints(bends);
    expect(points.length).toBe(4);
    expectCongruentToCanvas(points, Z_PROFILE.legs, Z_PROFILE.bends);
  });

  it('ends up parallel to where it started — a Z, not a U', () => {
    const points = buildCrossSectionPoints(bends);
    const firstLeg = { x: points[1].x - points[0].x, y: points[1].y - points[0].y };
    const lastLeg = { x: points[3].x - points[2].x, y: points[3].y - points[2].y };
    // Same heading (cross product ~0, dot product positive) after two
    // equal-and-opposite 90s.
    expect(firstLeg.x * lastLeg.y - firstLeg.y * lastLeg.x).toBeCloseTo(0, 9);
    expect(firstLeg.x * lastLeg.x + firstLeg.y * lastLeg.y).toBeGreaterThan(0);
  });

  it('REGRESSION: unsigned, the same Z folds back into a U', () => {
    const unsigned = buildCrossSectionPoints(bends.map((b) => ({ ...b, angle: Math.abs(b.angle) })));
    const firstLeg = { x: unsigned[1].x - unsigned[0].x, y: unsigned[1].y - unsigned[0].y };
    const lastLeg = { x: unsigned[3].x - unsigned[2].x, y: unsigned[3].y - unsigned[2].y };
    // Anti-parallel: the two 90s stacked instead of cancelling.
    expect(firstLeg.x * lastLeg.x + firstLeg.y * lastLeg.y).toBeLessThan(0);
  });

  it('labels carry the correct sign', () => {
    expect(bends.map((b) => formatBendAngleLabel(b.angle))).toEqual(['90°', '-90°']);
  });
});

describe('signedInteriorAngleDeg', () => {
  it('reads 180 for three collinear points (no bend)', () => {
    expect(signedInteriorAngleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(180);
  });

  it('is equal and opposite for mirrored corners', () => {
    const up = signedInteriorAngleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    const down = signedInteriorAngleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: -1 });
    expect(Math.abs(up)).toBeCloseTo(90, 9);
    expect(down).toBeCloseTo(-up, 9);
  });

  it('stays within (-180, 180]', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const a = signedInteriorAngleDeg(
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: Math.cos(rad), y: Math.sin(rad) }
      );
      expect(a).toBeGreaterThan(-180 - EPS);
      expect(a).toBeLessThanOrEqual(180 + EPS);
    }
  });
});

describe('computeProfilePoints — unsigned callers are unaffected', () => {
  it('produces byte-identical output for an all-non-negative bend list', () => {
    // The pre-lr-02 walk, reimplemented literally.
    const legacy = (bends: { legIn: number; nextLegIn: number; bendAngleDegrees: number }[]) => {
      const pts = [{ x: 0, y: 0 }];
      let heading = 0;
      let cur = { x: 0, y: 0 };
      for (const b of bends) {
        cur = {
          x: cur.x + Math.cos((heading * Math.PI) / 180) * b.legIn,
          y: cur.y + Math.sin((heading * Math.PI) / 180) * b.legIn,
        };
        pts.push(cur);
        heading += 180 - b.bendAngleDegrees;
      }
      const last = bends[bends.length - 1];
      cur = {
        x: cur.x + Math.cos((heading * Math.PI) / 180) * last.nextLegIn,
        y: cur.y + Math.sin((heading * Math.PI) / 180) * last.nextLegIn,
      };
      pts.push(cur);
      return pts;
    };

    const unsignedBends = [
      { legIn: 21.75, nextLegIn: 16.25, bendAngleDegrees: 50 },
      { legIn: 16.25, nextLegIn: 15.9375, bendAngleDegrees: 51 },
      { legIn: 15.9375, nextLegIn: 22.1875, bendAngleDegrees: 53 },
      { legIn: 22.1875, nextLegIn: 4, bendAngleDegrees: 0 },
      { legIn: 4, nextLegIn: 3, bendAngleDegrees: 180 },
    ];
    expect(computeProfilePoints(unsignedBends).points).toEqual(legacy(unsignedBends));
  });
});
