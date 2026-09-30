import { describe, it, expect } from 'vitest';
import { canvasSignature, hasUnsavedCanvasWork, type CanvasState } from './unsaved-work';
import { geometryFingerprint } from './geometry-fingerprint';

const L: CanvasState = {
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ],
  hemStart: null,
  hemEnd: null,
};

const clone = (s: CanvasState): CanvasState => JSON.parse(JSON.stringify(s)) as CanvasState;

describe('canvasSignature', () => {
  it('is stable across an identical redraw', () => {
    expect(canvasSignature(L)).toBe(canvasSignature(clone(L)));
  });

  it('changes when a point moves', () => {
    const moved = clone(L);
    moved.points[2].y = 3.5;
    expect(canvasSignature(moved)).not.toBe(canvasSignature(L));
  });

  it('changes when a hem is added, and again when its gap changes', () => {
    const hemmed = clone(L);
    hemmed.hemEnd = { type: 'open', lengthIn: 0.5, gapIn: 0.125, kick: 'inside' };
    expect(canvasSignature(hemmed)).not.toBe(canvasSignature(L));

    const widened = clone(hemmed);
    widened.hemEnd!.gapIn = 0.25;
    expect(canvasSignature(widened)).not.toBe(canvasSignature(hemmed));
  });

  it('ignores noise below a ten-thousandth of an inch', () => {
    const noisy = clone(L);
    noisy.points[1].x = 4 + 1e-9;
    expect(canvasSignature(noisy)).toBe(canvasSignature(L));
  });

  it('DOES notice a whole-profile move — which the shape fingerprint deliberately does not', () => {
    const moved: CanvasState = { ...clone(L), points: L.points.map((p) => ({ x: p.x + 10, y: p.y + 10 })) };
    // This is the reason unsaved-work has its own signature: a drag across
    // the canvas is a change worth saving, and the shape hash is blind to it
    // on purpose (rotation/translation invariance, see geometry-fingerprint).
    expect(geometryFingerprint(moved)).toBe(geometryFingerprint(L));
    expect(canvasSignature(moved)).not.toBe(canvasSignature(L));
  });
});

describe('hasUnsavedCanvasWork', () => {
  it('is false for an empty canvas', () => {
    expect(hasUnsavedCanvasWork({ points: [], hemStart: null, hemEnd: null }, null)).toBe(false);
  });

  it('is false for a single stray point — that is not a profile', () => {
    expect(hasUnsavedCanvasWork({ points: [{ x: 1, y: 1 }], hemStart: null, hemEnd: null }, null)).toBe(false);
  });

  it('is TRUE for a drawing that has never been saved', () => {
    expect(hasUnsavedCanvasWork(L, null)).toBe(true);
  });

  it('is false immediately after a save', () => {
    expect(hasUnsavedCanvasWork(L, canvasSignature(L))).toBe(false);
  });

  it('is true again after the smallest real edit following a save', () => {
    const saved = canvasSignature(L);
    const edited = clone(L);
    edited.points[2].y = 3.001;
    expect(hasUnsavedCanvasWork(edited, saved)).toBe(true);
  });

  it('is true when only a hem changed after a save', () => {
    const saved = canvasSignature(L);
    const edited = clone(L);
    edited.hemStart = { type: 'smashed', lengthIn: 0.375, gapIn: 0, kick: 'outside' };
    expect(hasUnsavedCanvasWork(edited, saved)).toBe(true);
  });
});
