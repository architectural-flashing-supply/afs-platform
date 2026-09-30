import { describe, it, expect } from 'vitest';
import {
  geometryFingerprint,
  canonicalGeometryString,
  type FingerprintPoint,
} from './geometry-fingerprint';

/**
 * Part 2 fingerprint tests. The property under test: profiles that would come
 * off the machine as the same part group together; profiles that would not,
 * do not.
 */

/** An L: 10" up, 6" right. */
const L: FingerprintPoint[] = [
  { x: 0, y: 0 },
  { x: 0, y: 10 },
  { x: 6, y: 10 },
];

/** A Z. */
const Z: FingerprintPoint[] = [
  { x: 0, y: 0 },
  { x: 0, y: 8 },
  { x: 5, y: 8 },
  { x: 5, y: 14 },
];

/** Reid's W (this month's real case). */
const W: FingerprintPoint[] = [
  { x: -24.275, y: -9.125 },
  { x: -23.725, y: 9.475 },
  { x: -18.275, y: 1.675 },
  { x: -13.075, y: 14.525 },
  { x: -10.925, y: -16.425 },
];

function rotate(points: FingerprintPoint[], deg: number): FingerprintPoint[] {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}
function translate(points: FingerprintPoint[], dx: number, dy: number): FingerprintPoint[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
function mirrorX(points: FingerprintPoint[]): FingerprintPoint[] {
  return points.map((p) => ({ x: -p.x, y: p.y }));
}
function reverse(points: FingerprintPoint[]): FingerprintPoint[] {
  return points.slice().reverse();
}

describe('geometryFingerprint — same shape groups together', () => {
  it.each([
    ['L', L],
    ['Z', Z],
    ['W', W],
  ])('%s is invariant under translation', (_name, pts) => {
    expect(geometryFingerprint({ points: translate(pts, 137.5, -42.25) })).toBe(
      geometryFingerprint({ points: pts }),
    );
  });

  it.each([
    ['L', L],
    ['Z', Z],
    ['W', W],
  ])('%s is invariant under rotation', (_name, pts) => {
    const base = geometryFingerprint({ points: pts });
    for (const deg of [17, 90, 180, 271, 359]) {
      expect(geometryFingerprint({ points: rotate(pts, deg) })).toBe(base);
    }
  });

  it.each([
    ['L', L],
    ['Z', Z],
    ['W', W],
  ])('%s is invariant under mirroring', (_name, pts) => {
    expect(geometryFingerprint({ points: mirrorX(pts) })).toBe(geometryFingerprint({ points: pts }));
  });

  it.each([
    ['L', L],
    ['Z', Z],
    ['W', W],
  ])('%s is invariant under point-order reversal (drawn the other way)', (_name, pts) => {
    expect(geometryFingerprint({ points: reverse(pts) })).toBe(geometryFingerprint({ points: pts }));
  });

  it('is invariant under rotation + mirror + reversal combined', () => {
    const mangled = reverse(mirrorX(rotate(translate(W, -300, 88), 43)));
    expect(geometryFingerprint({ points: mangled })).toBe(geometryFingerprint({ points: W }));
  });

  it('ignores naming — the fingerprint is geometry only', () => {
    // There is no name input at all; this documents that by construction.
    expect(geometryFingerprint({ points: Z })).toBe(geometryFingerprint({ points: Z.map((p) => ({ ...p })) }));
  });

  it('groups two drawings that differ by less than 1/64 inch', () => {
    const nudged = Z.map((p, i) => (i === 1 ? { x: p.x, y: p.y + 0.004 } : p));
    expect(geometryFingerprint({ points: nudged })).toBe(geometryFingerprint({ points: Z }));
  });

  it('hems swap correctly when the profile is reversed', () => {
    const fwd = geometryFingerprint({
      points: Z,
      hemStart: { type: 'open', gapIn: 0.875 },
      hemEnd: { type: 'smashed', gapIn: 0 },
    });
    const back = geometryFingerprint({
      points: reverse(Z),
      hemStart: { type: 'smashed', gapIn: 0 },
      hemEnd: { type: 'open', gapIn: 0.875 },
    });
    expect(back).toBe(fwd);
  });
});

describe('geometryFingerprint — different shapes do NOT group', () => {
  it('separates L, Z and W', () => {
    const fps = [L, Z, W].map((p) => geometryFingerprint({ points: p }));
    expect(new Set(fps).size).toBe(3);
  });

  it('separates a changed leg length', () => {
    const longer = Z.map((p, i) => (i === 3 ? { x: p.x, y: p.y + 2 } : p));
    expect(geometryFingerprint({ points: longer })).not.toBe(geometryFingerprint({ points: Z }));
  });

  it('separates a changed bend angle', () => {
    const bent = Z.map((p, i) => (i === 2 ? { x: p.x + 3, y: p.y + 3 } : p));
    expect(geometryFingerprint({ points: bent })).not.toBe(geometryFingerprint({ points: Z }));
  });

  it('separates a differing hem type', () => {
    const a = geometryFingerprint({ points: Z, hemStart: { type: 'open', gapIn: 0.875 } });
    const b = geometryFingerprint({ points: Z, hemStart: { type: 'smashed', gapIn: 0.875 } });
    expect(a).not.toBe(b);
  });

  it('separates a differing hem gap', () => {
    const a = geometryFingerprint({ points: Z, hemStart: { type: 'open', gapIn: 0.875 } });
    const b = geometryFingerprint({ points: Z, hemStart: { type: 'open', gapIn: 1.1875 } });
    expect(a).not.toBe(b);
  });

  it('separates "has a hem" from "has no hem"', () => {
    const a = geometryFingerprint({ points: Z, hemStart: { type: 'open', gapIn: 0.5 } });
    const b = geometryFingerprint({ points: Z });
    expect(a).not.toBe(b);
  });

  it('separates a mirrored profile from a genuinely different one with the same legs', () => {
    // Same three leg lengths, but the second bend turns the other way, so
    // this is a real U vs Z distinction, not a mirror.
    const U: FingerprintPoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 8 },
      { x: 5, y: 8 },
      { x: 5, y: 2 },
    ];
    expect(geometryFingerprint({ points: U })).not.toBe(geometryFingerprint({ points: Z }));
  });
});

describe('geometryFingerprint — degenerate input', () => {
  it('returns null for fewer than two points', () => {
    expect(geometryFingerprint({ points: [] })).toBeNull();
    expect(geometryFingerprint({ points: [{ x: 1, y: 1 }] })).toBeNull();
  });

  it('returns null for non-finite coordinates rather than hashing NaN', () => {
    expect(geometryFingerprint({ points: [{ x: 0, y: 0 }, { x: NaN, y: 3 }] })).toBeNull();
    expect(geometryFingerprint({ points: [{ x: 0, y: 0 }, { x: Infinity, y: 3 }] })).toBeNull();
  });

  it('is a stable 16-char hex string', () => {
    const fp = geometryFingerprint({ points: W })!;
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(geometryFingerprint({ points: W })).toBe(fp);
  });

  it('exposes a readable canonical form for debugging', () => {
    const canonical = canonicalGeometryString({ points: L })!;
    expect(canonical).toMatch(/^L:.*;A:.*;H:none\|none$/);
  });
});
