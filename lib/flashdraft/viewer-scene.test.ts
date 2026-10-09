import { describe, it, expect } from 'vitest';
import {
  PIXELS_PER_INCH,
  DOC_WIDTH,
  DOC_LABEL_STYLE,
  VIEWER_DISPLAY,
  FLASHDRAFT_CANVAS_COLORS,
  V8_CONTRACT_DRAWING_COLORS,
  computeFitView,
  fitPaddingPx,
  defaultBendRadiusIn,
  developedWidthIn,
  isGauge18OrThicker,
  renderSavedProfileScene,
  signedAngleBetween,
  type SavedProfileGeometry,
} from './viewer-scene';
import { drawProfileScene, SHOP_SNAPSHOT_LABEL_STYLE } from './draw-profile-scene';

import { signedInteriorAngleDeg } from './geometry';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import { hemAllowanceIn } from '@/lib/types/profile';
import { blankWidthInFromPoints } from '@/lib/pricing/quote-inputs';
import { formatInches } from '@/lib/utils/format-inches';

/**
 * THE GEOMETRY-FIDELITY TEST, and the facts around it.
 *
 * The V8 viewer's whole claim is that it does not draw — it hands saved
 * geometry to `drawProfileScene`, the one renderer FlashDraft's own canvas uses.
 * A claim like that is worth exactly as much as the thing that checks it, so
 * this file checks it by RECORDING THE CANVAS CALL STREAM twice, for three real
 * saved-profile shapes, and asserting the two streams are identical:
 *
 *   A. `renderSavedProfileScene(..., size: 'fullsize')` — the viewer's path.
 *   B. `drawProfileScene(...)` called directly with FlashDraft's own static-
 *      render parameters, assembled here independently (the same assembly
 *      `buildShopSnapshotImage` does in app/studio/draft/page.tsx).
 *
 * WHY A CALL STREAM RATHER THAN PIXELS. There is no canvas in this test
 * environment, and installing one would make the test depend on a rasteriser's
 * antialiasing. The call stream is stricter than a bitmap comparison anyway: it
 * catches a difference in a colour, a font size, a line width, a dash pattern, a
 * transform or a label's exact text, each as its own mismatch, and it says which
 * call differs rather than how many pixels did.
 *
 * WHAT IT WOULD CATCH, concretely. A viewer that quietly used a different fit
 * padding, a different palette, a different label scale, a different bend-radius
 * precedence, or a thickness derived from the wrong gauge — every one of those
 * moves at least one recorded call. It is also the test that fails if somebody
 * "simplifies" the viewer by giving it its own drawing loop, because a second
 * implementation cannot reproduce this stream by accident.
 *
 * AND IT CANNOT PASS ON AN EMPTY STREAM. Two identical empty recordings would
 * satisfy "A equals B" perfectly, so each shape is also asserted to have really
 * drawn: its segment length labels, its interior-angle labels and its hem
 * labels are looked for by text in the recorded `fillText` calls. That is the
 * premise half of the same discipline lib/design/placeholder-contrast.test.ts
 * applies to contrast.
 */

/* ───────────────────────────── the recorder ─────────────────────────────── */

type Call = string;

function recordingContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const num = (v: unknown) => (typeof v === 'number' ? v.toFixed(4) : JSON.stringify(v));
  const target: Record<string, unknown> = {};

  const methods = [
    'arc', 'beginPath', 'clearRect', 'closePath', 'fill', 'fillRect', 'fillText',
    'lineTo', 'moveTo', 'restore', 'rotate', 'save', 'scale', 'setLineDash',
    'setTransform', 'stroke', 'translate',
  ];
  for (const m of methods) {
    target[m] = (...args: unknown[]) => {
      calls.push(`${m}(${args.map(num).join(',')})`);
    };
  }
  // measureText is read by the label code; a deterministic width keeps the
  // recording comparable without pretending to be a real font metric.
  target.measureText = (t: string) => ({ width: String(t).length * 7 });

  const ctx = new Proxy(target, {
    get(t, prop: string) {
      return t[prop];
    },
    set(t, prop: string, value) {
      // Property WRITES are part of the stream: fillStyle, strokeStyle, font,
      // lineWidth, lineCap, lineJoin, textAlign, textBaseline. A viewer drawing
      // the same shape in a different colour differs only here.
      calls.push(`${prop}=${String(value)}`);
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
}

/* ─────────────────────── three real saved-profile shapes ────────────────── */

/**
 * Shapes chosen to exercise what actually varies: hem count, hem type, bend
 * handedness and a stored per-bend radius list. Coordinates are inches in
 * FlashDraft's own y-DOWN canvas frame, which is how they are saved.
 */
const PROFILES: { name: string; material: string; gauge: string; geometry: SavedProfileGeometry }[] = [
  {
    // A coping cap: four bends, a hem at each end. The two-hem case.
    name: 'Coping Cap 6 in',
    material: 'Galvalume',
    gauge: '24 ga',
    geometry: {
      points: [
        { x: -3, y: 2 },
        { x: -3, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
      ],
      hemStart: { type: 'open', lengthIn: 0.5, gapIn: 0.1875, kick: 'outside' },
      hemEnd: { type: 'open', lengthIn: 0.5, gapIn: 0.1875, kick: 'outside' },
      bendRadiiIn: null,
    },
  },
  {
    // A Z-bar: two bends of OPPOSITE handedness, no hems. The sign case
    // (CLAUDE.md rule #12) — the one that rendered as a curled triangle when a
    // bend angle lost its sign.
    name: 'Z-Bar 1.5 x 3 x 1.5',
    material: 'Aluminum',
    gauge: '0.040',
    geometry: {
      points: [
        { x: -3, y: -1.5 },
        { x: -1.5, y: -1.5 },
        { x: -1.5, y: 1.5 },
        { x: 0, y: 1.5 },
      ],
      hemStart: null,
      hemEnd: null,
      bendRadiiIn: null,
    },
  },
  {
    // A five-point custom with a stored per-bend radius list and one teardrop
    // hem — the case where the radius precedence and the teardrop glyph's own
    // thickness-driven size both matter.
    name: 'Custom 4-bend with teardrop',
    material: 'Copper',
    gauge: '18 ga',
    geometry: {
      points: [
        { x: -4, y: 1.25 },
        { x: -2, y: -0.75 },
        { x: 0.5, y: 1.5 },
        { x: 2.75, y: -0.5 },
        { x: 4.5, y: 0.75, radius: 0.9 },
      ],
      hemStart: null,
      hemEnd: { type: 'teardrop', lengthIn: 0.375, gapIn: 0.0625, kick: 'inside' },
      bendRadiiIn: [0.6, 0.7, 0.8, 0.9],
    },
  },
];

const MM_PER_INCH = 25.4;
const W = 1100;
const H = 620;

/**
 * FlashDraft's own static-render parameters, assembled independently — but
 * driven by the camera the viewer actually used.
 *
 * WHY THE CAMERA IS SHARED AND NOT COMPARED. The viewer's FRAMING is
 * deliberately NOT FlashDraft's: the editor fits a 600x440 canvas with 60px of
 * padding and a 0.25 zoom floor, and a 56px thumbnail needs neither. Asserting
 * the two cameras match would assert the opposite of the design, and an earlier
 * version of this test did exactly that — it went red the moment the framing
 * was fixed, for the framing being fixed.
 *
 * What this comparison is FOR is everything else: that the viewer draws through
 * `drawProfileScene` rather than a second algorithm of its own, in FlashDraft's
 * palette, at FlashDraft's shop-snapshot label style, with FlashDraft's
 * bend-radius precedence and its gauge-derived thickness. Hold the camera equal
 * and every one of those shows up as a differing call.
 *
 * The framing has its own test below, which is the one that would have caught
 * the cropping.
 */
function flashDraftStream(
  p: (typeof PROFILES)[number],
  cam: { zoom: number; pan: { x: number; y: number } },
): Call[] {
  const { ctx, calls } = recordingContext();
  const thicknessIn = gaugeToThicknessMm(p.gauge) / MM_PER_INCH;
  const radii = p.geometry.bendRadiiIn ?? null;
  drawProfileScene({
    ctx,
    cssWidth: W,
    cssHeight: H,
    points: p.geometry.points,
    hemStart: p.geometry.hemStart,
    hemEnd: p.geometry.hemEnd,
    worldToScreen: (q) => ({
      x: q.x * PIXELS_PER_INCH * cam.zoom + cam.pan.x + W / 2,
      y: q.y * PIXELS_PER_INCH * cam.zoom + cam.pan.y + H / 2,
    }),
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    pixelsPerInch: PIXELS_PER_INCH,
    zoom: cam.zoom,
    gauge: p.gauge,
    thicknessIn,
    getEffectiveRadius: (i) => p.geometry.points[i]?.radius ?? radii?.[i - 1] ?? defaultBendRadiusIn(p.material),
    isGauge18OrThicker,
    signedAngleBetween,
    colors: FLASHDRAFT_CANVAS_COLORS,
    labelStyle: SHOP_SNAPSHOT_LABEL_STYLE,
    drawGrid: true,
    drawUiIndicators: true,
  });
  return calls;
}

function viewerStream(
  p: (typeof PROFILES)[number],
  size: 'thumb' | 'hover' | 'enlarged' | 'fullsize' = 'fullsize',
  w = W,
  h = H,
): {
  calls: Call[];
  all: Call[];
  cam: { zoom: number; pan: { x: number; y: number } };
  doc: { w: number; h: number };
} {
  const { ctx, calls } = recordingContext();
  const result = renderSavedProfileScene({
    ctx,
    displayWidth: w,
    displayHeight: h,
    geometry: p.geometry,
    material: p.material,
    gauge: p.gauge,
    size,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  });
  expect(result, 'a real profile must render, not return null').not.toBeNull();
  // DROP THE MEASUREMENT PASS. Before drawing anything, the viewer measures the
  // widest label it is about to draw so the fit can reserve room for it
  // (`measureLabelReservePx`), and setting a font to measure it is a recorded
  // ctx write. That is not drawing — `drawProfileScene` opens with `clearRect`,
  // so the scene is everything from there on. Comparing the measurement too
  // would make this test fail for the viewer knowing something FlashDraft's
  // editor does not need to know.
  const start = calls.findIndex((c) => c.startsWith('clearRect('));
  return {
    calls: start >= 0 ? calls.slice(start) : calls,
    // THE UNSLICED STREAM, for anything that needs the transform. The slice
    // above drops the document-to-display `setTransform` along with the
    // measurement pass, and a bounds check that loses it reads document
    // coordinates as display ones — 754px "outside" a 56px box for a drawing
    // that fits perfectly.
    all: calls,
    cam: { zoom: result!.zoom, pan: result!.pan },
    doc: { w: result!.docWidth, h: result!.docHeight },
  };
}

function textsDrawn(calls: Call[]): string[] {
  return calls
    .filter((c) => c.startsWith('fillText('))
    .map((c) => {
      const m = c.match(/^fillText\("((?:[^"\\]|\\.)*)"/);
      return m ? JSON.parse(`"${m[1]}"`) : '';
    });
}

/* ──────────────────────────────── the tests ─────────────────────────────── */

describe('V8 ProfileViewer geometry fidelity', () => {
  it('the full-size label style is FlashDraft\'s own shop-snapshot style', () => {
    // The two paths compared below can only be identical if this holds, and
    // asserting it separately makes a drift here say what it is rather than
    // showing up as hundreds of differing font= calls.
    expect(DOC_LABEL_STYLE).toEqual(SHOP_SNAPSHOT_LABEL_STYLE);
  });

  for (const p of PROFILES) {
    it(`draws "${p.name}" with the identical canvas call stream as FlashDraft's renderer`, () => {
      const { calls: viewer, cam } = viewerStream(p);
      const flashdraft = flashDraftStream(p, cam);

      // PREMISE: something was really drawn. Two empty streams would match.
      expect(viewer.length).toBeGreaterThan(50);
      expect(viewer.filter((c) => c.startsWith('fillText(')).length).toBeGreaterThan(0);

      expect(viewer).toEqual(flashdraft);
    });

    it(`labels every leg, every bend and every hem of "${p.name}"`, () => {
      const texts = textsDrawn(viewerStream(p).calls);

      // One interior-angle label per bend. The bends are the interior vertices.
      const bendCount = Math.max(p.geometry.points.length - 2, 0);
      const angleLabels = texts.filter((t) => t.includes('°'));
      expect(angleLabels, `${p.name}: one angle label per bend`).toHaveLength(bendCount);

      // Each angle label must be the SIGNED interior angle rule #12 defines —
      // not an unsigned magnitude, which is the lr-02 bug.
      for (let i = 1; i < p.geometry.points.length - 1; i += 1) {
        const expected = `${signedInteriorAngleDeg(
          p.geometry.points[i - 1],
          p.geometry.points[i],
          p.geometry.points[i + 1],
        ).toFixed(0)}°`;
        expect(angleLabels, `${p.name}: bend ${i} must be labelled ${expected}`).toContain(expected);
      }

      // ONE LENGTH LABEL PER DRAWN SEGMENT. `formatInches` writes them, so each
      // carries a double-prime.
      const segmentLabels = texts.filter((t) => t.includes('\"') && !/^(OPEN|TEARDROP|SMASHED)/.test(t));
      expect(
        segmentLabels.length,
        `${p.name}: one length label per drawn segment`,
      ).toBe(p.geometry.points.length - 1);

      // ONE HEM LABEL PER HEM — and this is where the one renderer and the V8
      // contract DO NOT AGREE, which is why the expectation below describes
      // FlashDraft rather than the contract.
      //
      // FlashDraft labels a hem by its TYPE: `OPEN 3/16" gap`, `TEARDROP`,
      // `SMASHED`. The V8 contract labels it by its FOLD LENGTH: `0.5" hem`.
      // Neither is a superset of the other — the contract's label does not say
      // which kind of hem it is, and FlashDraft's does not say how far it folds
      // back. The full-size view the shop reads needs both.
      //
      // IT IS NOT FIXED HERE, deliberately. Adding a label inside
      // `drawProfileScene` changes what FlashDraft's own live editing canvas
      // draws, which is Reid's tool and his call; and V8 phase 0 builds the
      // harness and the audit, not screens. So the gap is RECORDED: in
      // docs/COMMAND_CENTER_V8_AUDIT.md as a phase 2 item, and here as an
      // assertion of exactly what is drawn today, which will have to be updated
      // by whoever closes it. tests/visual/v8-interaction-gate.spec.ts already
      // demands the contract's form and will fail on the live screen until then
      // — that failure is the gate working, not a gate to relax.
      const hemLabels = texts.filter((t) => /^(OPEN|TEARDROP|SMASHED)/.test(t));
      const hemCount = (p.geometry.hemStart ? 1 : 0) + (p.geometry.hemEnd ? 1 : 0);
      expect(hemLabels, `${p.name}: one label per hem`).toHaveLength(hemCount);
      for (const h of [p.geometry.hemStart, p.geometry.hemEnd]) {
        if (!h) continue;
        expect(hemLabels.some((t) => t.startsWith(h.type.toUpperCase()))).toBe(true);
      }
      // THE GAP, ASSERTED SO IT CANNOT BE CLOSED WITHOUT NOTICING: no hem label
      // carries the hem's FOLD LENGTH today, which is the number the contract's
      // own `0.5" hem` label is. When phase 2 adds it, this assertion fails and
      // whoever added it updates this test — which is the point of writing the
      // gap down as a test rather than only as a sentence in a document.
      for (const h of [p.geometry.hemStart, p.geometry.hemEnd]) {
        if (!h) continue;
        const foldLength = formatInches(h.lengthIn);
        expect(
          hemLabels.some((t) => t.includes(foldLength)),
          `${p.name}: FlashDraft's hem label does not state the ${foldLength} fold length (contract wants it — phase 2)`,
        ).toBe(false);
      }
    });
  }

  it('refuses to draw anything from fewer than two points', () => {
    const { ctx, calls } = recordingContext();
    for (const points of [[], [{ x: 1, y: 1 }]]) {
      const r = renderSavedProfileScene({
        ctx,
        displayWidth: W,
        displayHeight: H,
        geometry: { points, hemStart: null, hemEnd: null },
        material: 'Aluminum',
        gauge: '0.040',
        size: 'fullsize',
        fontFamily: 'monospace',
      });
      expect(r).toBeNull();
    }
    // AND IT DREW NOTHING. A null return with a half-drawn canvas behind it
    // would still put a stray mark on a screen that reaches a bending machine.
    expect(calls).toEqual([]);
  });

  /**
   * REID'S RULE 4, AS AN ASSERTION: "no hem glyph, hem caption, dimension,
   * angle or label may be omitted from the thumbnail, hover, enlarged or
   * full-size view."
   *
   * This is THE test that rule exists for. It renders each profile at all four
   * sizes and asserts the set of drawn strings is IDENTICAL — not similar, not
   * a superset, identical. A previous pass dropped the hem caption from the
   * enlarged view to make it fit, and nothing failed; this is what would have.
   *
   * It also counts the drawn MARKS (segments, arcs, rings, glyph strokes), so
   * turning off a glyph rather than a label is caught by the same test.
   */
  it('drops NOTHING at any size — identical labels and marks, thumbnail to full', () => {
    const SIZES: ('thumb' | 'hover' | 'enlarged' | 'fullsize')[] = ['thumb', 'hover', 'enlarged', 'fullsize'];
    for (const p of PROFILES) {
      const perSize = SIZES.map((size) => {
        const box = VIEWER_DISPLAY[size].px;
        const { all } = viewerStream(p, size, box, Math.round((box * 620) / DOC_WIDTH));
        // Every stroked path the renderer emits, EXCEPT the drafting grid —
        // which is background texture, is the one legitimate per-size
        // difference, and has its own test below. Counting it here would make
        // this test fail for the grid rather than for a dropped mark.
        let pen = '';
        let strokes = 0;
        for (const c of all) {
          if (c.startsWith('strokeStyle=')) pen = c.slice('strokeStyle='.length);
          else if (c === 'stroke()' && pen !== FLASHDRAFT_CANVAS_COLORS.grid) strokes += 1;
        }
        return { size, texts: textsDrawn(all).sort(), strokes, arcs: all.filter((c) => c.startsWith('arc(')).length };
      });

      const first = perSize[0];
      for (const other of perSize.slice(1)) {
        expect(
          other.texts,
          `${p.name}: "${other.size}" draws different labels from "${first.size}" — ` +
            `missing ${JSON.stringify(first.texts.filter((t) => !other.texts.includes(t)))}, ` +
            `extra ${JSON.stringify(other.texts.filter((t) => !first.texts.includes(t)))}`,
        ).toEqual(first.texts);
        expect(other.arcs, `${p.name}: "${other.size}" draws a different number of arcs`).toBe(first.arcs);
        expect(other.strokes, `${p.name}: "${other.size}" draws a different number of strokes`).toBe(
          first.strokes,
        );
      }

      // PREMISE: there is something to drop. A profile that drew no labels at
      // all would satisfy "identical at every size" perfectly.
      expect(first.texts.length, `${p.name}: nothing was labelled`).toBeGreaterThan(0);
      const hems = (p.geometry.hemStart ? 1 : 0) + (p.geometry.hemEnd ? 1 : 0);
      if (hems > 0) {
        expect(
          first.texts.filter((t) => /^(OPEN|TEARDROP|SMASHED)/.test(t)).length,
          `${p.name}: the hem caption must survive at EVERY size, including the thumbnail`,
        ).toBe(hems);
      }
    }
  });

  it('paints the drafting grid only where it is readable, which omits nothing about the part', () => {
    // The grid is background texture, not information about the profile — the
    // one thing that may legitimately differ by size. At thumbnail scale it is
    // a grey wash over the drawing. Dropping it omits no dimension, angle, hem
    // or label, which is what rule 4 protects.
    const p = PROFILES[0];
    const grid = (size: 'thumb' | 'hover' | 'enlarged' | 'fullsize') => {
      const box = VIEWER_DISPLAY[size].px;
      const { all } = viewerStream(p, size, box, Math.round((box * 620) / DOC_WIDTH));
      return all.some((c) => c === `strokeStyle=${FLASHDRAFT_CANVAS_COLORS.grid}`);
    };
    expect(grid('thumb')).toBe(false);
    expect(grid('hover')).toBe(false);
    expect(grid('enlarged')).toBe(true);
    expect(grid('fullsize')).toBe(true);
  });

});

describe('the drawing stays inside its canvas', () => {
  const SIZES: { size: 'thumb' | 'hover' | 'enlarged' | 'fullsize'; w: number; h: number }[] = [
    { size: 'thumb', w: 56, h: 56 },
    { size: 'thumb', w: 110, h: 110 },
    { size: 'hover', w: 420, h: 237 },
    { size: 'enlarged', w: 760, h: 428 },
    { size: 'fullsize', w: 1100, h: 620 },
  ];

  /**
   * Every (x, y) the stream positions geometry at, in CANVAS coordinates,
   * excluding full-canvas ops.
   *
   * THE TRANSFORM STACK IS NOT OPTIONAL HERE. The hem glyphs are drawn inside a
   * `translate` + `rotate` so their construction can be written in local
   * coordinates (hem-glyph.ts's "+x = outward past the true end"). A first
   * version of this helper read those local coordinates as canvas ones and
   * reported the teardrop's bulb — local `arc(21, 0, 8.4)` — as 8.4px off the
   * top of the canvas, at every size, for a drawing that was correct. A bounds
   * check that ignores the transform does not check bounds.
   */
  function drawnPoints(calls: Call[], w: number, h: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    // [a, b, c, d, e, f] — the same 2x3 the canvas uses.
    let m2: number[] = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    const mul = (m: number[], n: number[]) => [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
    const apply = (x: number, y: number) => ({
      x: m2[0] * x + m2[2] * y + m2[4],
      y: m2[1] * x + m2[3] * y + m2[5],
    });
    /** Scale factor the current transform applies to a radius. */
    const radiusScale = () => Math.max(Math.hypot(m2[0], m2[1]), Math.hypot(m2[2], m2[3]));

    for (const c of calls) {
      let t = c.match(/^save\(\)$/);
      if (t) {
        stack.push([...m2]);
        continue;
      }
      if (/^restore\(\)$/.test(c)) {
        m2 = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        continue;
      }
      t = c.match(/^setTransform\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)$/);
      if (t) {
        m2 = t.slice(1).map(Number);
        continue;
      }
      t = c.match(/^translate\(([-\d.]+),([-\d.]+)\)$/);
      if (t) {
        m2 = mul(m2, [1, 0, 0, 1, Number(t[1]), Number(t[2])]);
        continue;
      }
      t = c.match(/^rotate\(([-\d.]+)\)$/);
      if (t) {
        const a = Number(t[1]);
        m2 = mul(m2, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
        continue;
      }
      t = c.match(/^scale\(([-\d.]+),([-\d.]+)\)$/);
      if (t) {
        m2 = mul(m2, [Number(t[1]), 0, 0, Number(t[2]), 0, 0]);
        continue;
      }
      let m = c.match(/^(?:moveTo|lineTo)\(([-\d.]+),([-\d.]+)\)$/);
      if (m) {
        pts.push(apply(Number(m[1]), Number(m[2])));
        continue;
      }
      // arc(x, y, r, ...) — the circle's extent, not just its centre.
      m = c.match(/^arc\(([-\d.]+),([-\d.]+),([-\d.]+),/);
      if (m) {
        const [x, y, r] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const centre = apply(x, y);
        const rr = r * radiusScale();
        pts.push({ x: centre.x - rr, y: centre.y - rr }, { x: centre.x + rr, y: centre.y + rr });
        continue;
      }
      // Skip clearRect/fillRect of the whole canvas — that IS the canvas.
      m = c.match(/^fillRect\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)$/);
      if (m) {
        const [x, y, rw, rh] = m.slice(1).map(Number);
        if (!(x <= 0.01 && y <= 0.01 && rw >= w - 0.01 && rh >= h - 0.01)) {
          pts.push(apply(x, y), apply(x + rw, y + rh));
        }
      }
    }
    return pts;
  }

  for (const { size, w, h } of SIZES) {
    for (const p of PROFILES) {
      it(`keeps "${p.name}" inside a ${w}x${h} ${size}`, () => {
        const { all } = viewerStream(p, size, w, h);
        const pts = drawnPoints(all, w, h);
        expect(pts.length, 'nothing was drawn at all').toBeGreaterThan(4);

        // The GRID is drawn across the whole canvas by design and is clipped by
        // it; it is not content that can be "cropped". Only grid lines sit
        // exactly on the bounds, so a small tolerance separates them from a
        // profile running off the edge.
        const tol = 1.5;
        const bad = pts.filter((q) => q.x < -tol || q.y < -tol || q.x > w + tol || q.y > h + tol);
        const worst = bad
          .map((q) => Math.max(-q.x, -q.y, q.x - w, q.y - h))
          .reduce((a, b) => Math.max(a, b), 0);
        expect(
          bad.length,
          `${bad.length} drawn point(s) fall outside the ${w}x${h} canvas, worst by ${worst.toFixed(1)}px — the drawing is cropped`,
        ).toBe(0);
      });
    }
  }

  it('a text anchor leaves room for its own string', () => {
    // Anchors are centred, so the string needs half its width either side. The
    // recording fake measures 7px per character, which is what the viewer's own
    // reserve was computed from in this environment — so the two agree.
    for (const { size, w, h } of SIZES) {
      for (const p of PROFILES) {
        const { all: calls, doc } = viewerStream(p, size, w, h);
        // A label set to 0px draws nothing, but the `fillText` call is still
        // recorded — that is how `VIEWER_SIZES.thumb` suppresses its labels
        // without the one renderer needing a labels-off flag. Tracking the
        // font in force is what separates "drawn and clipped" from "not drawn".
        let fontPx = 0;
        for (const c of calls) {
          const f = c.match(/^font=(?:bold )?([\d.]+)px/);
          if (f) fontPx = Number(f[1]);
          const m = c.match(/^fillText\("((?:[^"\\]|\\.)*)",([-\d.]+),([-\d.]+)\)/);
          if (!m || fontPx <= 0) continue;
          const text = JSON.parse(`"${m[1]}"`) as string;
          const [x, y] = [Number(m[2]), Number(m[3])];
          const width = text.length * 7;
          // ALIGNMENT MATTERS. Dimension labels are centred on what they
          // annotate, so half the string sits either side of the anchor. A hem
          // CAPTION is left-aligned outward from the fold, so its whole width
          // extends to the right of the anchor. Treating them alike understates
          // a caption's reach by half its length.
          const isCaption = /^(OPEN|TEARDROP|SMASHED)/.test(text);
          const left = isCaption ? x : x - width / 2;
          const right = isCaption ? x + width : x + width / 2;
          // CHECKED IN DOCUMENT SPACE. Labels are composed at document scale
          // and the whole document is then scaled uniformly, so a label that
          // fits the document fits every display size; checking display pixels
          // would compare a document-space width against a scaled box.
          expect(
            left > -8 && right < doc.w + 8 && y > -8 && y < doc.h + 8,
            `${size} doc ${doc.w.toFixed(0)}x${doc.h.toFixed(0)} "${p.name}": label ${JSON.stringify(text)} spans ${left.toFixed(0)}..${right.toFixed(0)} and does not fit`,
          ).toBe(true);
        }
      }
    }
  });

  it('draws the fixed-size UI marks at EVERY size, including the thumbnail', () => {
    // The reverse of what this test used to assert. Rule 4 (2026-10-09) says
    // nothing may be omitted at any size, and the uniform-scale design makes
    // that true by construction: the 20px arc and the 8px ring are composed at
    // document scale and shrink with everything else, so they no longer
    // dominate a small box the way they did when they were fixed in DISPLAY
    // pixels.
    const p = PROFILES[2]; // 4 bends and a hem — plenty of marks to find
    const ringOrArc = (calls: Call[]) =>
      calls.filter((c) => /^arc\([-\d.]+,[-\d.]+,(8\.0000|20\.0000),/.test(c)).length;

    const atThumb = ringOrArc(viewerStream(p, 'thumb', 110, 110).all);
    expect(atThumb, 'the thumbnail must still draw the arcs and rings').toBeGreaterThan(0);
    expect(ringOrArc(viewerStream(p, 'hover', 420, 237).all)).toBe(atThumb);
    expect(ringOrArc(viewerStream(p, 'enlarged', 760, 428).all)).toBe(atThumb);
    expect(ringOrArc(viewerStream(p, 'fullsize', 1100, 620).all)).toBe(atThumb);
  });
});

describe('facts moved out of FlashDraft, not copied', () => {
  it('signedAngleBetween is rule #12\'s own function, delegated', () => {
    const cases: [{ x: number; y: number }, { x: number; y: number }][] = [
      [{ x: 1, y: 0 }, { x: 0, y: 1 }],
      [{ x: 1, y: 0 }, { x: 0, y: -1 }],
      [{ x: 1, y: 0 }, { x: -1, y: 0 }],
      [{ x: 0.5, y: -0.5 }, { x: -0.5, y: -0.5 }],
    ];
    for (const [v1, v2] of cases) {
      expect(signedAngleBetween(v1, v2)).toBe(signedInteriorAngleDeg(v1, { x: 0, y: 0 }, v2));
    }
    // Opposite handedness must come back equal and opposite — the property that
    // makes a W alternate instead of curling (rule #12).
    expect(signedAngleBetween({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(
      -signedAngleBetween({ x: 1, y: 0 }, { x: 0, y: -1 }),
    );
  });

  it('isGauge18OrThicker reads only a "<n> ga" label', () => {
    expect(isGauge18OrThicker('18 ga')).toBe(true);
    expect(isGauge18OrThicker('16ga')).toBe(true);
    expect(isGauge18OrThicker('24 ga')).toBe(false);
    // A decimal aluminium thickness is not a gauge label and must not be read
    // as one — `0.040` would parse to 0 and read as "thicker than 18".
    expect(isGauge18OrThicker('0.040')).toBe(false);
    expect(isGauge18OrThicker('')).toBe(false);
  });

  it('defaultBendRadiusIn is per material family', () => {
    expect(defaultBendRadiusIn('Copper')).toBe(0.75);
    expect(defaultBendRadiusIn('Zinc')).toBe(0.75);
    expect(defaultBendRadiusIn('Aluminum')).toBe(0.375);
    expect(defaultBendRadiusIn('Galvalume')).toBe(0.5);
    // FOUND WHILE WRITING THIS TEST, and left alone: the regex is
    // `/aluminu?m/i`, which matches "aluminum" and "aluminm" but NOT the
    // British "aluminium" — that spelling falls through to the 0.5 in default
    // instead of aluminium's 0.375 in. `lib/data/catalog.ts` uses the American
    // spelling, so no catalogue material hits it today; a hand-typed or
    // imported material could. Asserted as it behaves, recorded in
    // docs/COMMAND_CENTER_V8_AUDIT.md, and not changed in a phase whose job is
    // the harness — altering a default bend radius changes what the machine is
    // told to do.
    expect(defaultBendRadiusIn('Aluminium')).toBe(0.5);
  });

  it('computeFitView centres the shape and never leaves its clamp', () => {
    const pts = [{ x: -3, y: 2 }, { x: 3, y: -2 }];
    const { zoom, pan } = computeFitView(pts, 1100, 620, 60);
    expect(zoom).toBeGreaterThanOrEqual(0.25);
    expect(zoom).toBeLessThanOrEqual(4);
    // Centroid of the bounding box maps to the canvas centre.
    const cx = 0 * PIXELS_PER_INCH * zoom + pan.x + 1100 / 2;
    const cy = 0 * PIXELS_PER_INCH * zoom + pan.y + 620 / 2;
    expect(cx).toBeCloseTo(550, 6);
    expect(cy).toBeCloseTo(310, 6);
    // A tiny shape is clamped up, not zoomed to infinity.
    expect(computeFitView([{ x: 0, y: 0 }, { x: 0.001, y: 0 }], 1100, 620, 60).zoom).toBeLessThanOrEqual(4);
  });
});

describe('developed width', () => {
  it('is the polyline girth plus what each hem folds back', () => {
    for (const p of PROFILES) {
      const thicknessIn = gaugeToThicknessMm(p.gauge) / MM_PER_INCH;
      const expected =
        (blankWidthInFromPoints(p.geometry.points) as number) +
        hemAllowanceIn(p.geometry.hemStart, thicknessIn) +
        hemAllowanceIn(p.geometry.hemEnd, thicknessIn);
      expect(developedWidthIn(p.geometry, p.gauge)).toBeCloseTo(expected, 10);
    }
  });

  it('a hemmed profile measures wider than its bare polyline, and an unhemmed one does not', () => {
    const coping = PROFILES[0];
    const zbar = PROFILES[1];
    expect(developedWidthIn(coping.geometry, coping.gauge) as number).toBeGreaterThan(
      blankWidthInFromPoints(coping.geometry.points) as number,
    );
    expect(developedWidthIn(zbar.geometry, zbar.gauge)).toBeCloseTo(
      blankWidthInFromPoints(zbar.geometry.points) as number,
      10,
    );
  });

  it('is null when there is no polyline to measure', () => {
    expect(developedWidthIn({ points: [], hemStart: null, hemEnd: null }, '24 ga')).toBeNull();
    expect(developedWidthIn({ points: [{ x: 0, y: 0 }], hemStart: null, hemEnd: null }, '24 ga')).toBeNull();
  });
});

describe('the V8 contract palette is recorded but not in force', () => {
  it('differs from FlashDraft\'s, which is the divergence the audit records', () => {
    // If these ever become equal, the PENDING REID question in
    // docs/COMMAND_CENTER_V8_AUDIT.md has been answered by an edit rather than
    // by a decision — this test is here to make that visible.
    expect(V8_CONTRACT_DRAWING_COLORS.profile).not.toBe(FLASHDRAFT_CANVAS_COLORS.profile);
    expect(V8_CONTRACT_DRAWING_COLORS.hemLine).not.toBe(FLASHDRAFT_CANVAS_COLORS.hemLine);
    expect(V8_CONTRACT_DRAWING_COLORS.angleArc).not.toBe(FLASHDRAFT_CANVAS_COLORS.angleArc);
  });

  it('is not what the viewer actually draws with', () => {
    const p = PROFILES[0];
    const { ctx, calls } = recordingContext();
    renderSavedProfileScene({
      ctx, displayWidth: W, displayHeight: H, geometry: p.geometry, material: p.material,
      gauge: p.gauge, size: 'fullsize', fontFamily: 'monospace',
    });
    expect(calls.some((c) => c === `strokeStyle=${FLASHDRAFT_CANVAS_COLORS.profile}`)).toBe(true);
    expect(calls.some((c) => c === `strokeStyle=${V8_CONTRACT_DRAWING_COLORS.profile}`)).toBe(false);
  });
});
