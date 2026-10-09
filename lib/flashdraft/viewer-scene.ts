import { drawProfileScene, type DrawSceneLabelStyle, type DrawScenePaintState, type ProfileSceneColors, type ScenePoint } from './draw-profile-scene';
import { signedInteriorAngleDeg } from './geometry';
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
 * `PADDING_PX` is a SCREEN padding, 60px at any size, which is why a 110px
 * thumbnail needs the smaller value below rather than this one: 60px of
 * padding on each side of a 110px box leaves nothing to draw in.
 */
export function computeFitView(
  points: ViewerPoint[],
  canvasWidth: number,
  canvasHeight: number,
  paddingPx = 60,
): { zoom: number; pan: { x: number; y: number } } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const widthIn = Math.max(Math.max(...xs) - Math.min(...xs), 0.5);
  const heightIn = Math.max(Math.max(...ys) - Math.min(...ys), 0.5);
  const availW = canvasWidth - paddingPx * 2;
  const availH = canvasHeight - paddingPx * 2;
  const nextZoom = Math.max(
    0.25,
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
export type ViewerSize = 'thumb' | 'enlarged' | 'fullsize';

interface SizeSpec {
  label: DrawSceneLabelStyle;
  paddingPx: number;
  drawGrid: boolean;
}

export const VIEWER_SIZES: Record<ViewerSize, SizeSpec> = {
  thumb: {
    // ZERO-PIXEL FONTS, DELIBERATELY. `drawProfileScene` always labels what it
    // draws — there is no "labels off" flag, and adding one would mean editing
    // the one renderer for the benefit of one caller. A 0px font draws nothing,
    // which is the right answer here: a 110px box cannot carry five dimension
    // labels legibly, and illegible numbers beside a profile read as numbers
    // somebody could act on. The thumbnail identifies the shape; every number
    // is one click away.
    label: { segmentFontPx: 0, angleFontPx: 0, hemFontPx: 0, bold: false },
    paddingPx: 10,
    drawGrid: false,
  },
  enlarged: {
    label: { segmentFontPx: 13, angleFontPx: 12, hemFontPx: 11, bold: true },
    paddingPx: 34,
    drawGrid: false,
  },
  fullsize: {
    label: { segmentFontPx: 21, angleFontPx: 19, hemFontPx: 17.5, bold: true },
    paddingPx: 60,
    drawGrid: true,
  },
};

export interface RenderSavedProfileParams {
  ctx: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  geometry: SavedProfileGeometry;
  material: string;
  gauge: string;
  size: ViewerSize;
  fontFamily: string;
  /** Omit to skip the painted-side stripe. */
  paint?: DrawScenePaintState;
}

/**
 * Draw one saved profile onto `ctx`. The ONLY drawing entry point the V8
 * viewer has, and it draws by calling `drawProfileScene`.
 *
 * Returns the camera it used, so a caller that needs to place something in
 * screen space (an overlay label, a hit test) can ask rather than re-derive.
 *
 * NOTHING IS INVENTED WHEN GEOMETRY IS THIN. Fewer than two points is not a
 * profile — there is no segment to draw and no length to label — so it draws
 * nothing and says so by returning `null`. The component turns that into the
 * explicit "No saved drawing" state. A one-point "profile" rendered as a dot
 * would be a drawing of something nobody drew, on a screen whose next button
 * reaches a bending machine.
 */
export function renderSavedProfileScene(
  params: RenderSavedProfileParams,
): { zoom: number; pan: { x: number; y: number }; pixelsPerInch: number } | null {
  const { ctx, cssWidth, cssHeight, geometry, material, gauge, size, fontFamily, paint } = params;
  if (!geometry.points || geometry.points.length < 2) return null;

  const spec = VIEWER_SIZES[size];
  const { zoom, pan } = computeFitView(geometry.points, cssWidth, cssHeight, spec.paddingPx);
  const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;
  const radii = geometry.bendRadiiIn ?? null;

  const points: ScenePoint[] = geometry.points.map((p) => ({ x: p.x, y: p.y, radius: p.radius }));

  drawProfileScene({
    ctx,
    cssWidth,
    cssHeight,
    points,
    hemStart: geometry.hemStart,
    hemEnd: geometry.hemEnd,
    worldToScreen: (p) => ({
      x: p.x * PIXELS_PER_INCH * zoom + pan.x + cssWidth / 2,
      y: p.y * PIXELS_PER_INCH * zoom + pan.y + cssHeight / 2,
    }),
    fontFamily,
    pixelsPerInch: PIXELS_PER_INCH,
    zoom,
    gauge,
    thicknessIn,
    // A saved point's own radius wins; then the saved per-bend list
    // FlashDraft wrote at submit time; then the material default. Same
    // precedence FlashDraft's own `getEffectiveRadius` applies, extended by
    // the stored list, which the editor reads from component state instead.
    getEffectiveRadius: (i: number) =>
      points[i]?.radius ?? radii?.[i - 1] ?? defaultBendRadiusIn(material),
    isGauge18OrThicker,
    signedAngleBetween,
    colors: FLASHDRAFT_CANVAS_COLORS,
    labelStyle: spec.label,
    drawGrid: spec.drawGrid,
    paint,
  });

  return { zoom, pan, pixelsPerInch: PIXELS_PER_INCH };
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
