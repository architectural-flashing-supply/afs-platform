/**
 * computeHemScreenGeometry — the ONE description of where a hem sits on
 * screen, shared by the draw loop (renderHemAt) and by FlashDraft's
 * "press the hem to extend from this end" hit-test (CLAUDE.md rule #13).
 *
 * These assertions exist because the two used to be able to disagree: the
 * drawing knew the glyph reaches well past the fold tip, and nothing else did.
 * At the default zoom an Open 1 7/8" hem draws a 37.5px connecting line and
 * then a 67.5px hook — the glyph is the LONGER half — so a hit area that
 * stopped at the fold tip would miss most of what a user can see and press.
 */
import { describe, it, expect } from 'vitest';
import { computeHemScreenGeometry, type ScenePoint, type ScreenPoint } from './draw-profile-scene';
import {
  hemGlyphOutwardExtentPx,
  HEM_HOOK_LENGTH_FACTOR,
  HEM_TEARDROP_BULB_R_FACTOR,
  HEM_TEARDROP_CENTER_DIST_FACTOR,
} from './hem-glyph';
import type { Hem } from '@/lib/types/profile';

const PIXELS_PER_INCH = 20;

// The identity-ish mapping page.tsx uses at zoom 1 with no pan, around a
// canvas centre of (400, 300): uniform positive scale plus a translation, no
// axis flip — which is what lets the world-space hem direction be used
// directly as the glyph's screen rotation.
function makeWorldToScreen(zoom: number) {
  return (p: ScenePoint): ScreenPoint => ({
    x: p.x * PIXELS_PER_INCH * zoom + 400,
    y: p.y * PIXELS_PER_INCH * zoom + 300,
  });
}

function openHem(lengthIn: number): Hem {
  return { type: 'open', lengthIn, gapIn: 0.375, kick: 'inside' };
}

function geometryFor(hem: Hem, zoom = 1, gauge = '', thicknessIn = 0.032) {
  // A hem on points[0] of a profile whose first leg runs +x: the hem must
  // therefore run -x, away from the neighbour.
  return computeHemScreenGeometry({
    hem,
    endpoint: { x: 0, y: 0 },
    neighbor: { x: 5, y: 0 },
    worldToScreen: makeWorldToScreen(zoom),
    pixelsPerInch: PIXELS_PER_INCH,
    zoom,
    gauge,
    thicknessIn,
  });
}

describe('hemGlyphOutwardExtentPx', () => {
  it('reports the hook run for open and smashed, and the bulb for teardrop', () => {
    expect(hemGlyphOutwardExtentPx('open', 20)).toBe(20 * HEM_HOOK_LENGTH_FACTOR);
    expect(hemGlyphOutwardExtentPx('smashed', 20)).toBe(20 * HEM_HOOK_LENGTH_FACTOR);
    expect(hemGlyphOutwardExtentPx('teardrop', 20)).toBe(
      20 * (HEM_TEARDROP_CENTER_DIST_FACTOR + HEM_TEARDROP_BULB_R_FACTOR)
    );
  });

  it('is always a real outward reach, never zero', () => {
    for (const type of ['open', 'smashed', 'teardrop'] as const) {
      expect(hemGlyphOutwardExtentPx(type, 10)).toBeGreaterThan(0);
    }
  });
});

describe('computeHemScreenGeometry', () => {
  it('runs AWAY from the endpoint\'s neighbour', () => {
    const g = geometryFor(openHem(1.875));
    expect(g.endpoint).toEqual({ x: 400, y: 300 });
    // Neighbour is at +x, so the hem goes -x and stays on the leg's own line.
    expect(g.foldTip.x).toBeLessThan(g.endpoint.x);
    expect(g.foldTip.y).toBeCloseTo(g.endpoint.y, 10);
    expect(g.angleRad).toBeCloseTo(Math.PI, 10);
  });

  it('puts the fold tip at exactly hem.lengthIn of real material', () => {
    const g = geometryFor(openHem(1.875));
    expect(g.endpoint.x - g.foldTip.x).toBeCloseTo(1.875 * PIXELS_PER_INCH, 10);
  });

  it('carries the VISIBLE end past the fold tip by the glyph\'s own reach', () => {
    const hem = openHem(1.875);
    const g = geometryFor(hem);
    const expectedReach = hemGlyphOutwardExtentPx('open', g.radiusPx);
    expect(g.foldTip.x - g.glyphEnd.x).toBeCloseTo(expectedReach, 10);
    // The point of this test: the drawn glyph is the longer half, so a hit
    // area ending at the fold tip would cover well under half the hem.
    expect(expectedReach).toBeGreaterThan(g.endpoint.x - g.foldTip.x);
  });

  it('scales the whole hem with zoom', () => {
    const a = geometryFor(openHem(1.875), 1);
    const b = geometryFor(openHem(1.875), 2);
    expect(a.endpoint.x - a.glyphEnd.x).toBeGreaterThan(0);
    expect(b.endpoint.x - b.glyphEnd.x).toBeCloseTo(2 * (a.endpoint.x - a.glyphEnd.x), 10);
  });

  it('applies the MIN_READABLE_R floor so a very short hem is still grabbable', () => {
    // 0.05" at zoom 1 is 1px of real glyph radius; the floor lifts it to 10px,
    // which is what the canvas actually draws — and therefore what the press
    // has to be measured against.
    const g = geometryFor(openHem(0.05));
    expect(g.radiusPx).toBe(10);
    expect(g.endpoint.x - g.glyphEnd.x).toBeCloseTo(0.05 * PIXELS_PER_INCH + 10 * HEM_HOOK_LENGTH_FACTOR, 10);
  });

  it('sizes a teardrop from thickness, not from hem length', () => {
    const short = geometryFor({ type: 'teardrop', lengthIn: 0.5, gapIn: 0, kick: 'inside' }, 1, '24', 0.0239);
    const long = geometryFor({ type: 'teardrop', lengthIn: 4, gapIn: 0, kick: 'inside' }, 1, '24', 0.0239);
    // Same curl on both — growing Hem Length moves the curl further out along
    // a longer connecting line, it does not balloon the curl.
    expect(long.radiusPx).toBe(short.radiusPx);
    // ...and the longer hem really does reach further overall.
    expect(long.endpoint.x - long.glyphEnd.x).toBeGreaterThan(short.endpoint.x - short.glyphEnd.x);
  });

  it('survives a degenerate zero-length leg without producing NaN', () => {
    const g = computeHemScreenGeometry({
      hem: openHem(1),
      endpoint: { x: 2, y: 2 },
      neighbor: { x: 2, y: 2 },
      worldToScreen: makeWorldToScreen(1),
      pixelsPerInch: PIXELS_PER_INCH,
      zoom: 1,
      gauge: '',
      thicknessIn: 0.032,
    });
    for (const v of [g.endpoint.x, g.endpoint.y, g.foldTip.x, g.foldTip.y, g.glyphEnd.x, g.glyphEnd.y, g.radiusPx]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
