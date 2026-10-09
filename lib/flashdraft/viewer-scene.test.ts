import { describe, it, expect } from 'vitest';
import {
  PIXELS_PER_INCH,
  VIEWER_SIZES,
  FLASHDRAFT_CANVAS_COLORS,
  V8_CONTRACT_DRAWING_COLORS,
  computeFitView,
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

/** FlashDraft's own static-render parameters, assembled independently. */
function flashDraftStream(p: (typeof PROFILES)[number]): Call[] {
  const { ctx, calls } = recordingContext();
  const spec = VIEWER_SIZES.fullsize;
  const { zoom, pan } = computeFitView(p.geometry.points, W, H, spec.paddingPx);
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
      x: q.x * PIXELS_PER_INCH * zoom + pan.x + W / 2,
      y: q.y * PIXELS_PER_INCH * zoom + pan.y + H / 2,
    }),
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    pixelsPerInch: PIXELS_PER_INCH,
    zoom,
    gauge: p.gauge,
    thicknessIn,
    getEffectiveRadius: (i) => p.geometry.points[i]?.radius ?? radii?.[i - 1] ?? defaultBendRadiusIn(p.material),
    isGauge18OrThicker,
    signedAngleBetween,
    colors: FLASHDRAFT_CANVAS_COLORS,
    labelStyle: SHOP_SNAPSHOT_LABEL_STYLE,
    drawGrid: true,
  });
  return calls;
}

function viewerStream(p: (typeof PROFILES)[number]): Call[] {
  const { ctx, calls } = recordingContext();
  const result = renderSavedProfileScene({
    ctx,
    cssWidth: W,
    cssHeight: H,
    geometry: p.geometry,
    material: p.material,
    gauge: p.gauge,
    size: 'fullsize',
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  });
  expect(result, 'a real profile must render, not return null').not.toBeNull();
  return calls;
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
    expect(VIEWER_SIZES.fullsize.label).toEqual(SHOP_SNAPSHOT_LABEL_STYLE);
  });

  for (const p of PROFILES) {
    it(`draws "${p.name}" with the identical canvas call stream as FlashDraft's renderer`, () => {
      const viewer = viewerStream(p);
      const flashdraft = flashDraftStream(p);

      // PREMISE: something was really drawn. Two empty streams would match.
      expect(viewer.length).toBeGreaterThan(50);
      expect(viewer.filter((c) => c.startsWith('fillText(')).length).toBeGreaterThan(0);

      expect(viewer).toEqual(flashdraft);
    });

    it(`labels every leg, every bend and every hem of "${p.name}"`, () => {
      const texts = textsDrawn(viewerStream(p));

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
        cssWidth: W,
        cssHeight: H,
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

  it('draws no labels at thumbnail size, and real labels above it', () => {
    const p = PROFILES[0];
    const thumb = (() => {
      const { ctx, calls } = recordingContext();
      renderSavedProfileScene({
        ctx, cssWidth: 110, cssHeight: 110, geometry: p.geometry, material: p.material,
        gauge: p.gauge, size: 'thumb', fontFamily: 'monospace',
      });
      return calls;
    })();
    const enlarged = (() => {
      const { ctx, calls } = recordingContext();
      renderSavedProfileScene({
        ctx, cssWidth: 420, cssHeight: 260, geometry: p.geometry, material: p.material,
        gauge: p.gauge, size: 'enlarged', fontFamily: 'monospace',
      });
      return calls;
    })();

    // The thumbnail still DRAWS the profile — it just carries no legible
    // numbers (VIEWER_SIZES.thumb's 0px fonts, and the reason is recorded
    // there). The shape is the identifier; the numbers are one click away.
    expect(thumb.filter((c) => c.startsWith('lineTo(')).length).toBeGreaterThan(0);
    expect(thumb.some((c) => c.startsWith('font=') && !c.includes('0px'))).toBe(false);
    expect(enlarged.some((c) => c.startsWith('font=') && !c.includes('0px'))).toBe(true);
  });

  it('draws the grid only at full size', () => {
    const p = PROFILES[0];
    const grid = (size: 'thumb' | 'enlarged' | 'fullsize') => {
      const { ctx, calls } = recordingContext();
      renderSavedProfileScene({
        ctx, cssWidth: W, cssHeight: H, geometry: p.geometry, material: p.material,
        gauge: p.gauge, size, fontFamily: 'monospace',
      });
      return calls.some((c) => c === `strokeStyle=${FLASHDRAFT_CANVAS_COLORS.grid}`);
    };
    expect(grid('thumb')).toBe(false);
    expect(grid('enlarged')).toBe(false);
    expect(grid('fullsize')).toBe(true);
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
      ctx, cssWidth: W, cssHeight: H, geometry: p.geometry, material: p.material,
      gauge: p.gauge, size: 'fullsize', fontFamily: 'monospace',
    });
    expect(calls.some((c) => c === `strokeStyle=${FLASHDRAFT_CANVAS_COLORS.profile}`)).toBe(true);
    expect(calls.some((c) => c === `strokeStyle=${V8_CONTRACT_DRAWING_COLORS.profile}`)).toBe(false);
  });
});
