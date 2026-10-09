import {
  drawProfileScene,
  hemGlyphExtentPx,
  hemCaptionOffsetPx,
  UI_INDICATOR_EXTENT_PX,
  type DrawSceneLabelStyle,
  type DrawScenePaintState,
  type ProfileSceneColors,
  type ScenePoint,
} from './draw-profile-scene';
import { signedInteriorAngleDeg } from './geometry';
import { formatInches } from '@/lib/utils/format-inches';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import { hemAllowanceIn, type Hem } from '@/lib/types/profile';
import { blankWidthInFromPoints } from '@/lib/pricing/quote-inputs';

/**
 * RENDERING A SAVED FLASHDRAFT PROFILE OUTSIDE FLASHDRAFT — one entry point,
 * and no second drawing algorithm anywhere.
 *
 * components/admin/v8/ProfileViewer.tsx needs to draw a profile that was saved
 * days ago, at three sizes, on a screen that has no editor, no zoom state and
 * no pan state. `drawProfileScene` already draws a FlashDraft profile — it is
 * what the live canvas draws with and what the shop snapshot is rendered with
 * (afs-fl-017) — but it takes the editor's own camera and material helpers as
 * parameters, because the editor is where they live.
 *
 * This module supplies exactly those parameters for a NON-INTERACTIVE render,
 * and nothing else. It does not draw. The pixels still come from
 * `drawProfileScene`, so the Command Center and the FlashDraft canvas cannot
 * disagree about a segment, an angle's sign (CLAUDE.md rule #12), a hem's fold
 * (rule #13) or how an inch is written.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EVERY FACT IN HERE WAS MOVED, NOT COPIED.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * `PIXELS_PER_INCH`, `computeFitView`, `isGauge18OrThicker`,
 * `defaultBendRadiusIn`, `signedAngleBetween` and the canvas colour constant
 * were all defined privately inside `app/studio/draft/page.tsx`. They are now
 * defined HERE and imported BACK by that file, which is why FlashDraft's own
 * rendering is unchanged to the pixel: it calls the same functions it used to
 * declare.
 *
 * Re-declaring them here instead would have been the easy path and the wrong
 * one. Two copies of "is this gauge 18 or thicker" is two answers to a
 * question about whether a bend radius warning fires, and the one the shop
 * sees would be whichever file somebody edited last. The project has the scar:
 * GEOMETRY_AUDIT.md traced three independent copies of the turtle walk before
 * `geometry.ts` existed.
 *
 * `signedAngleBetween` is a DELEGATION, not an implementation. It takes two
 * vectors where `signedInteriorAngleDeg` takes three points, so it hands the
 * vectors to that function as a triangle about the origin — the identical
 * atan2 difference, computed by rule #12's own module rather than beside it.
 */

export interface ViewerPoint {
  x: number;
  y: number;
  radius?: number;
}

/** Saved FlashDraft geometry, exactly as `saved_configurations.dimensions` and `quote_requests.line_items[]` store it. */
export interface SavedProfileGeometry {
  points: ViewerPoint[];
  hemStart: Hem | null;
  hemEnd: Hem | null;
  /** One per interior bend, as FlashDraft itself writes it. */
  bendRadiiIn?: number[] | null;
}

/** FlashDraft's world scale: 20 screen pixels to the inch at zoom 1. */
export const PIXELS_PER_INCH = 20;

const MM_PER_INCH = 25.4;

/**
 * The material's default inside bend radius, in inches.
 *
 * Moved out of app/studio/draft/page.tsx unchanged. A saved point may carry
 * its own `radius`; this is what a point without one means.
 */
export function defaultBendRadiusIn(material: string): number {
  if (/copper|zinc/i.test(material)) return 0.75;
  if (/aluminu?m/i.test(material)) return 0.375;
  return 0.5;
}

/**
 * Is this gauge 18 or thicker? Moved out of app/studio/draft/page.tsx
 * unchanged. `drawProfileScene` uses it to decide whether a bend is drawn with
 * a real radius arc rather than a sharp corner.
 */
export function isGauge18OrThicker(gauge: string): boolean {
  const match = gauge.trim().match(/^(\d+)\s*ga$/i);
  if (!match) return false;
  return parseInt(match[1], 10) <= 18;
}

/**
 * Signed angle from `v1` to `v2`, in degrees, range (-180, 180].
 *
 * Delegates to `signedInteriorAngleDeg` (CLAUDE.md rule #12's one owner of
 * what a bend angle means) by treating the two vectors as a triangle about the
 * origin. Moved out of app/studio/draft/page.tsx, which now imports it.
 */
export function signedAngleBetween(v1: { x: number; y: number }, v2: { x: number; y: number }): number {
  return signedInteriorAngleDeg(v1, { x: 0, y: 0 }, v2);
}

/**
 * FlashDraft's own fit-to-content camera. Moved out of
 * app/studio/draft/page.tsx unchanged — it is what its "Fit to screen" button
 * and its template loader both use, so a saved profile is framed in the
 * Command Center exactly as FlashDraft frames it.
 *
 * `paddingPx` is a SCREEN padding, 60px by default, which is why a small
 * thumbnail must pass its own: 60px on each side of a 110px box leaves nothing
 * to draw in.
 *
 * `minZoom` DEFAULTS TO FlashDraft's OWN 0.25 so the editor is unchanged — its
 * "Fit to screen" should never zoom out past a quarter scale on a 600x440
 * canvas. **That floor is wrong for a thumbnail**, and visibly so: a 29in
 * profile needs about 0.15 to fit a 56px box, the floor forced 0.25, and the
 * drawing ran off every edge. A read-only viewer passes a far smaller floor
 * because "too small to read" is the honest outcome there, and "cropped" is
 * not — a cropped profile is a different shape, confidently drawn.
 */
export function computeFitView(
  points: ViewerPoint[],
  canvasWidth: number,
  canvasHeight: number,
  paddingPx = 60,
  minZoom = 0.25,
): { zoom: number; pan: { x: number; y: number } } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const widthIn = Math.max(Math.max(...xs) - Math.min(...xs), 0.5);
  const heightIn = Math.max(Math.max(...ys) - Math.min(...ys), 0.5);
  const availW = canvasWidth - paddingPx * 2;
  const availH = canvasHeight - paddingPx * 2;
  const nextZoom = Math.max(
    minZoom,
    Math.min(4, Math.min(availW / (widthIn * PIXELS_PER_INCH), availH / (heightIn * PIXELS_PER_INCH))),
  );
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    zoom: nextZoom,
    pan: { x: -centerX * PIXELS_PER_INCH * nextZoom, y: -centerY * PIXELS_PER_INCH * nextZoom },
  };
}

/**
 * The 2D canvas colours FlashDraft draws with.
 *
 * CANVAS_COLORS EXCEPTION (CLAUDE.md rule #4, DESIGN_TOKENS.md §10): a canvas
 * 2D context's `fillStyle`/`strokeStyle` cannot consume a Tailwind class or a
 * CSS custom property, so these mirror the afs-* token values as literal hex.
 * Moved here from app/studio/draft/page.tsx, which imports it back, so the
 * editor and the Command Center viewer draw a profile in one palette rather
 * than two that drift.
 */
export const FLASHDRAFT_CANVAS_COLORS: ProfileSceneColors & {
  dragLabelBg: string;
  dragLabelText: string;
} = {
  background: '#C4C4C4',
  grid: 'rgba(17, 17, 17, 0.08)',
  profile: '#C0001A',
  profileSelected: '#2563EB',
  point: '#C0001A',
  ink: '#111111',
  dragLabelBg: 'rgba(17, 17, 17, 0.92)',
  dragLabelText: '#FFFFFF',
  angleArc: '#C0001A',
  angleArcWarn: '#D32F2F',
  hemLine: '#C0001A',
};

/**
 * The three sizes a saved profile is shown at, and what each one shows.
 *
 * The contract (docs/design/command-center-v8/) is explicit that the
 * thumbnail is an identifier, the enlarged view is a look, and the full-size
 * view is the one the shop reads numbers off. So the label sizes differ and
 * the grid is dropped below full size — a 0.25in grid at thumbnail scale is
 * a grey wash, not information.
 *
 * `fullsize` reuses SHOP_SNAPSHOT_LABEL_STYLE's proportions for the same
 * reason that style exists: the full-size view is what gets read from a few
 * feet away at the machine.
 */
/**
 * THE VIEWER DRAWS ONE CANONICAL DOCUMENT AND SCALES IT. NOTHING IS EVER
 * DROPPED AT ANY SIZE.
 *
 * Reid's rule 4 (2026-10-09): "no hem glyph, hem caption, dimension, angle or
 * label may be omitted from the thumbnail, hover, enlarged or full-size view.
 * If a label does not fit, change the canvas, padding or size until it does."
 * It was written because the previous pass dropped the hem caption from the
 * enlarged view to make it fit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY PER-SIZE LABEL STYLES WERE THE WRONG SHAPE ENTIRELY.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The old design gave each size its own font sizes and its own on/off switches,
 * so "what is shown" differed per size and the only way to make something fit
 * was to turn it off. That is the structure that produced the defect: it made
 * dropping a label the easy move and the one the code was shaped for.
 *
 * This draws the profile ONCE, into a canonical document whose width is always
 * `DOC_WIDTH`, with every label and every mark present — and then applies a
 * single uniform `ctx.scale()` so the whole document lands at whatever display
 * size the caller asked for. A thumbnail is therefore a TRUE MINIATURE of the
 * full-size view: the same drawing, the same labels, the same glyphs, smaller.
 * At 110px the text is tiny, which is what a miniature is for; hover and the
 * enlarged view are one gesture away and legible.
 *
 * NOTHING CAN BE DROPPED BY CONSTRUCTION, because there is no longer anywhere
 * to drop it from — one render, one set of labels, one scale factor.
 * `lib/flashdraft/viewer-scene.test.ts`'s "nothing is dropped at any size"
 * test asserts the drawn-string set is IDENTICAL at every size.
 *
 * THE BITMAP STAYS SMALL. The scale is applied to the context, not by
 * rasterising a big canvas and shrinking it — a 110px thumbnail allocates a
 * 110px bitmap, not a 1100px one. Twenty cards on a Workbench would otherwise
 * cost tens of megabytes.
 *
 * THE DOCUMENT TAKES THE CALLER'S ASPECT so nothing is letterboxed: width is
 * fixed and height follows the requested box. A square thumbnail gets a square
 * document, a wide plate a wide one, and the fit runs once against that.
 */
export const DOC_WIDTH = 1100;

/**
 * The one label style, at document scale. These are FlashDraft's own
 * shop-snapshot sizes (`SHOP_SNAPSHOT_LABEL_STYLE`), which is what the
 * full-size view has always used and what the fidelity test compares against.
 */
export const DOC_LABEL_STYLE: DrawSceneLabelStyle = {
  segmentFontPx: 21,
  angleFontPx: 19,
  hemFontPx: 17.5,
  bold: true,
};

/**
 * Display tiers, kept ONLY as a name for a default pixel size and for whether
 * the drafting grid is painted. They no longer decide what is drawn.
 *
 * The grid is the one thing that legitimately differs: it is a background
 * texture rather than information about the profile, and at thumbnail scale it
 * is a grey wash over the drawing. Dropping it omits nothing about the part.
 */
export type ViewerSize = 'thumb' | 'hover' | 'enlarged' | 'fullsize';

export const VIEWER_DISPLAY: Record<ViewerSize, { px: number; grid: boolean }> = {
  thumb: { px: 110, grid: false },
  hover: { px: 420, grid: false },
  enlarged: { px: 760, grid: true },
  fullsize: { px: 1100, grid: true },
};

/** The smallest zoom the fit may use. One value — the document is one size. */
const DOC_MIN_ZOOM = 0.02;

/**
 * HOW MUCH SCREEN SPACE THE SCENE USES OUTSIDE THE POINT BOUNDING BOX.
 *
 * THIS IS THE BUG THE SCREENSHOTS FOUND, and it is worth stating plainly
 * because it is invisible to every test that does not rasterise:
 * `computeFitView` fits the POINTS. `drawProfileScene` then draws a great deal
 * that is NOT a point and does NOT scale with zoom — a 20px angle arc, its
 * label another 12px beyond that, an 8px endpoint ring, a hem glyph with a
 * 10-14px floor, and dimension text whose width depends on the string, not on
 * the profile. On FlashDraft's 600x440 canvas with 60px of padding, all of that
 * fits in the slack. On a 110px thumbnail it does not, and on the 420px
 * enlarged view the segment label `3 15/16"` was clipped clean off the right
 * edge.
 *
 * So the padding is DERIVED from what will actually be drawn rather than being
 * a constant somebody tuned once. Each term below corresponds to a real mark:
 *
 *   arcs + angle labels   ANGLE_ARC_RADIUS_PX (20) + 12, only with indicators
 *   endpoint rings        8, only with indicators
 *   hem glyphs            `hemGlyphExtentPx`, the renderer's OWN formula — a
 *                         teardrop reaches R * 2.1 with a 14px floor on R, so
 *                         a flat 14 left it 8.4px outside the canvas at every
 *                         size. A constant overflow that does not change with
 *                         the box is the signature of a fixed-pixel mark.
 *   dimension text        `measuredLabelHalfWidthPx` — the REAL half-width of
 *                         the widest string this scene will actually draw,
 *                         from `ctx.measureText`. A first attempt estimated it
 *                         as `fontPx * 2.4` and `3 15/16"` was still clipped at
 *                         the right edge of the enlarged view: a guess at glyph
 *                         widths is a guess, and the canvas context that knows
 *                         the answer is already in the caller's hand. See
 *                         `measureLabelReservePx`.
 *
 * CAPPED AT 30% OF THE SMALLER SIDE. Without the cap a box could reserve more
 * than it has and the drawing would collapse to nothing — swapping a cropped
 * profile for an invisible one, which is not an improvement. The cap cannot
 * bind in practice any more: this is measured against the CANONICAL DOCUMENT,
 * which is 1100px wide whatever the display size, so there is always room.
 */
export function fitPaddingPx(
  cssWidth: number,
  cssHeight: number,
  hemExtentPx: number,
  measuredLabelHalfWidthPx = 0,
): number {
  const indicators = Math.max(
    UI_INDICATOR_EXTENT_PX.angleArcAndLabel,
    UI_INDICATOR_EXTENT_PX.endHandle,
  );

  const wanted = Math.max(indicators, measuredLabelHalfWidthPx, hemExtentPx) + 4;
  const cap = Math.min(cssWidth, cssHeight) * 0.3;
  return Math.max(2, Math.min(wanted, cap));
}

/**
 * The points the FIT should consider — the real ones, plus where each hem's
 * fold actually reaches.
 *
 * A hem is drawn from its endpoint outward along the leg's own direction by
 * `hem.lengthIn`, in WORLD units, so it makes the shape genuinely bigger. The
 * glyph on its tip is screen-sized and is handled by `fitPaddingPx`; this is
 * the part that scales, and leaving it out meant a hemmed profile was fitted
 * as if its hems were not there and then drawn with them.
 *
 * Direction is taken from the endpoint's own neighbour, which is the same
 * vector `renderHemAt` uses, so the two cannot disagree about which way a fold
 * goes.
 */
function hemBoundsPoints(geometry: SavedProfileGeometry): ViewerPoint[] {
  const pts = geometry.points;
  const out: ViewerPoint[] = [...pts];
  const reach = (from: ViewerPoint, toward: ViewerPoint, lengthIn: number): ViewerPoint | null => {
    const dx = from.x - toward.x;
    const dy = from.y - toward.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len === 0) return null;
    return { x: from.x + (dx / len) * lengthIn, y: from.y + (dy / len) * lengthIn };
  };
  if (geometry.hemStart && pts.length >= 2) {
    const p = reach(pts[0], pts[1], geometry.hemStart.lengthIn);
    if (p) out.push(p);
  }
  if (geometry.hemEnd && pts.length >= 2) {
    const p = reach(pts[pts.length - 1], pts[pts.length - 2], geometry.hemEnd.lengthIn);
    if (p) out.push(p);
  }
  return out;
}

/**
 * The real half-width of the widest label this scene will draw, in screen px.
 *
 * Every dimension string is CENTRED on what it labels, so half of it overhangs
 * the thing it annotates, and that overhang is what runs off the edge. The
 * strings are knowable before anything is drawn — they are `formatInches` of
 * each segment, the signed angle at each bend, and the hem captions — and the
 * canvas context can measure them exactly. So it measures them, rather than
 * multiplying the font size by a number somebody picked.
 *
 * Returns 0 when the size draws no labels at all (the thumbnail), because then
 * there is nothing to reserve for.
 *
 * `ctx` is saved and restored: this runs BEFORE the scene is drawn and must not
 * leave a font set behind it.
 */
function measureLabelReservePx(
  ctx: CanvasRenderingContext2D,
  geometry: SavedProfileGeometry,
  fontFamily: string,
): number {
  const { segmentFontPx, angleFontPx, hemFontPx, bold } = DOC_LABEL_STYLE;

  const pts = geometry.points;
  const strings: { text: string; px: number }[] = [];

  for (let i = 0; i < pts.length - 1; i += 1) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    strings.push({ text: formatInches(len), px: segmentFontPx });
  }
  for (let i = 1; i < pts.length - 1; i += 1) {
    const deg = signedInteriorAngleDeg(pts[i - 1], pts[i], pts[i + 1]);
    strings.push({ text: `${deg.toFixed(0)}°`, px: angleFontPx });
  }
  // The hem captions draw-profile-scene.ts actually writes.
  for (const hem of [geometry.hemStart, geometry.hemEnd]) {
    if (!hem) continue;
    const text =
      hem.type === 'open'
        ? `OPEN ${formatInches(hem.gapIn)} gap`
        : hem.type === 'teardrop'
          ? 'TEARDROP'
          : 'SMASHED';
    strings.push({ text, px: hemFontPx });
  }

  ctx.save();
  let widest = 0;
  for (const s of strings) {
    if (s.px <= 0) continue;
    ctx.font = `${bold ? 'bold ' : ''}${s.px}px ${fontFamily}`;
    widest = Math.max(widest, ctx.measureText(s.text).width);
  }
  ctx.restore();
  return widest / 2;
}

/** The widest hem caption this scene will draw, measured. 0 when none is drawn. */
function measureHemCaptionWidthPx(
  ctx: CanvasRenderingContext2D,
  geometry: SavedProfileGeometry,
  fontFamily: string,
): number {
  const { hemFontPx, bold } = DOC_LABEL_STYLE;
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${hemFontPx}px ${fontFamily}`;
  let widest = 0;
  for (const hem of [geometry.hemStart, geometry.hemEnd]) {
    if (!hem) continue;
    const text =
      hem.type === 'open'
        ? `OPEN ${formatInches(hem.gapIn)} gap`
        : hem.type === 'teardrop'
          ? 'TEARDROP'
          : 'SMASHED';
    widest = Math.max(widest, ctx.measureText(text).width);
  }
  ctx.restore();
  return widest;
}

export interface RenderSavedProfileParams {
  ctx: CanvasRenderingContext2D;
  /** The DISPLAY box in CSS pixels. The document is scaled to fit it. */
  displayWidth: number;
  displayHeight: number;
  geometry: SavedProfileGeometry;
  material: string;
  gauge: string;
  /** Picks the default display size and whether the drafting grid is painted. */
  size: ViewerSize;
  fontFamily: string;
  /** Device pixel ratio. The backing store is display x dpr; the document scales on top. */
  dpr?: number;
  /** Omit to skip the painted-side stripe. */
  paint?: DrawScenePaintState;
}

/**
 * Draw one saved profile onto `ctx`. The ONLY drawing entry point the V8
 * viewer has, and it draws by calling `drawProfileScene`.
 *
 * ONE DOCUMENT, SCALED. The scene is always composed at `DOC_WIDTH` across,
 * with every label, every glyph and every mark present, and a single uniform
 * `ctx.scale()` lands it in the caller's display box. A thumbnail is the same
 * drawing as the full-size view, smaller — never a reduced one. See the
 * DOC_WIDTH block above for why per-size label styles were removed.
 *
 * Returns the camera in DOCUMENT coordinates plus the scale applied, so a
 * caller that needs to place something in screen space can ask rather than
 * re-derive.
 *
 * NOTHING IS INVENTED WHEN GEOMETRY IS THIN. Fewer than two points is not a
 * profile — there is no segment to draw and no length to label — so it draws
 * nothing and says so by returning `null`. The component turns that into the
 * explicit "No saved drawing" state. A one-point "profile" rendered as a dot
 * would be a drawing of something nobody drew, on a screen whose next button
 * reaches a bending machine.
 */
export function renderSavedProfileScene(params: RenderSavedProfileParams): {
  zoom: number;
  pan: { x: number; y: number };
  pixelsPerInch: number;
  /** Document-to-display scale. 1 at full size. */
  scale: number;
  docWidth: number;
  docHeight: number;
} | null {
  const {
    ctx,
    displayWidth,
    displayHeight,
    geometry,
    material,
    gauge,
    size,
    fontFamily,
    dpr = 1,
    paint,
  } = params;
  if (!geometry.points || geometry.points.length < 2) return null;
  if (displayWidth <= 0 || displayHeight <= 0) return null;

  // The document takes the caller's ASPECT so nothing is letterboxed, and its
  // width is always DOC_WIDTH so the label sizes, the arc radii and the hem
  // glyph floors all mean the same thing at every display size.
  const scale = displayWidth / DOC_WIDTH;
  const docWidth = DOC_WIDTH;
  const docHeight = displayHeight / scale;

  // One uniform transform: device pixels per document unit. Everything the
  // renderer draws in "screen" pixels is really document pixels, and shrinks
  // together.
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

  const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;
  // A hem is drawn from its endpoint OUTWARD by its own fold length, in world
  // units, so it genuinely enlarges the shape — fold that into the points the
  // fit is computed over rather than trying to absorb it as screen padding.
  const fitPoints = hemBoundsPoints(geometry);
  const labelReserve = measureLabelReservePx(ctx, geometry, fontFamily);
  const hemCaptionWidth = measureHemCaptionWidthPx(ctx, geometry, fontFamily);

  // TWO PASSES, because the hem glyph's size depends on the zoom and the zoom
  // depends on how much room the glyph needs. More zoom means a bigger glyph
  // means less room means less zoom — a contraction, so one iteration from a
  // floor-only estimate settles it. A single pass left a teardrop outside the
  // canvas; looping to convergence would be a loop to save a few tenths of a
  // pixel on a drawing nobody measures with calipers.
  const hemExtentAt = (zoom: number) => {
    const opts = { pixelsPerInch: PIXELS_PER_INCH, zoom, thicknessIn, gauge };
    const reach = (hem: typeof geometry.hemStart) =>
      hem
        ? Math.max(
            hemGlyphExtentPx(hem, opts),
            // The caption is LEFT-aligned beyond the glyph, so its whole width
            // sticks out, not half of it.
            hemCaptionOffsetPx(hem, opts) + hemCaptionWidth,
          )
        : 0;
    return Math.max(reach(geometry.hemStart), reach(geometry.hemEnd));
  };

  const first = computeFitView(
    fitPoints,
    docWidth,
    docHeight,
    fitPaddingPx(docWidth, docHeight, hemExtentAt(0), labelReserve),
    DOC_MIN_ZOOM,
  );
  const { zoom, pan } = computeFitView(
    fitPoints,
    docWidth,
    docHeight,
    fitPaddingPx(docWidth, docHeight, hemExtentAt(first.zoom), labelReserve),
    DOC_MIN_ZOOM,
  );
  const radii = geometry.bendRadiiIn ?? null;

  const points: ScenePoint[] = geometry.points.map((p) => ({ x: p.x, y: p.y, radius: p.radius }));

  drawProfileScene({
    ctx,
    cssWidth: docWidth,
    cssHeight: docHeight,
    points,
    hemStart: geometry.hemStart,
    hemEnd: geometry.hemEnd,
    worldToScreen: (p) => ({
      x: p.x * PIXELS_PER_INCH * zoom + pan.x + docWidth / 2,
      y: p.y * PIXELS_PER_INCH * zoom + pan.y + docHeight / 2,
    }),
    fontFamily,
    pixelsPerInch: PIXELS_PER_INCH,
    zoom,
    gauge,
    thicknessIn,
    // A saved point's own radius wins; then the saved per-bend list FlashDraft
    // wrote at submit time; then the material default. Same precedence
    // FlashDraft's own `getEffectiveRadius` applies, extended by the stored
    // list, which the editor reads from component state instead.
    getEffectiveRadius: (i: number) =>
      points[i]?.radius ?? radii?.[i - 1] ?? defaultBendRadiusIn(material),
    isGauge18OrThicker,
    signedAngleBetween,
    colors: FLASHDRAFT_CANVAS_COLORS,
    labelStyle: DOC_LABEL_STYLE,
    drawGrid: VIEWER_DISPLAY[size].grid,
    drawUiIndicators: true,
    paint,
  });

  return { zoom, pan, pixelsPerInch: PIXELS_PER_INCH, scale, docWidth, docHeight };
}

/**
 * THE V8 CONTRACT'S OWN DRAWING PALETTE — recorded, NOT YET APPLIED.
 *
 * The approved mockups draw a profile in four inks, named in their own legend:
 * blue segments, amber hems, green interior angles, dark-slate dimension text,
 * plus a red shop note. FlashDraft draws the same profile in crimson on grey
 * (`FLASHDRAFT_CANVAS_COLORS` above, afs-fl-019), and `drawProfileScene` — the
 * one renderer, which V8 must not duplicate — takes the palette as a parameter.
 *
 * So the two can be reconciled by passing this object instead, and the
 * drawing would then look like the contract. IT IS NOT PASSED ANYWHERE YET,
 * deliberately: changing the colours FlashDraft's own editing canvas draws in
 * is a decision about the tool Reid uses every day, and doing it as a side
 * effect of a Command Center port is how a change nobody asked for ships.
 *
 * The question — does the Command Center viewer adopt the contract's palette
 * while the FlashDraft editor keeps crimson, or do both move? — is listed in
 * docs/COMMAND_CENTER_V8_AUDIT.md as PENDING REID. Until he decides, the viewer
 * draws in FlashDraft's palette and the difference is a stated divergence
 * rather than an unnoticed one.
 */
export const V8_CONTRACT_DRAWING_COLORS: ProfileSceneColors = {
  background: '#FFFFFF',
  grid: 'rgba(16, 28, 44, 0.06)',
  profile: '#1553B3',
  profileSelected: '#2563EB',
  point: '#1553B3',
  ink: '#101C2C',
  angleArc: '#17703A',
  angleArcWarn: '#B3261E',
  hemLine: '#C26A00',
};

/** The contract's red shop-note ink. Used by the viewer's note banner, not by the drawing. */
export const V8_SHOP_NOTE_COLOR = '#B3261E';

/**
 * Developed width of a saved profile, in inches — the girth of the flat blank
 * before it is bent, INCLUDING what each hem folds back.
 *
 * Composed from two functions that already exist rather than from a new
 * formula: `blankWidthInFromPoints` (lib/pricing/quote-inputs.ts) walks the
 * polyline, and `hemAllowanceIn` (lib/types/profile.ts) is this codebase's one
 * answer for what a hem consumes. That composition is what FlashDraft's own
 * on-screen blank-width readout does (app/studio/draft/page.tsx), so the number
 * the Command Center prints is the number the person who drew it saw.
 *
 * NOTE, and it is a real discrepancy rather than a rounding one:
 * `lib/pricing/quote-inputs.ts` sets a job's `blankWidthIn` from
 * `blankWidthInFromPoints` ALONE, with no hem allowance — so a hemmed profile's
 * quoted blank is narrower than its drawn blank by up to 2 x lengthIn + gapIn
 * per end. Recorded in docs/COMMAND_CENTER_V8_AUDIT.md; not changed here,
 * because moving a number the price book divides by is a pricing decision.
 */
export function developedWidthIn(
  geometry: SavedProfileGeometry,
  gauge: string,
): number | null {
  const base = blankWidthInFromPoints(geometry.points);
  if (base === null) return null;
  const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;
  return base + hemAllowanceIn(geometry.hemStart, thicknessIn) + hemAllowanceIn(geometry.hemEnd, thicknessIn);
}
