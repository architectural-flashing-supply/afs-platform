/**
 * Shared FlashDraft profile-scene renderer (afs-fl-017).
 *
 * Both the live, on-screen /studio/draft editing canvas AND the offscreen
 * snapshot rendered at submit time (used as shop_profile_library.geometry_svg
 * — see buildGeometrySvg in
 * app/api/admin/command-center/approve-quote-request/route.ts) need to draw
 * the exact same profile — segments, painted-side stripe, points, angle
 * arcs, hem folds/glyphs, and their labels — from the exact same geometry.
 * Extracted here so that fact lives in exactly one place (the pattern this
 * codebase already follows for SHOP_PROFILE_LIBRARY_STATUSES,
 * compareShopProfileLibraryQueueOrder, and drawHemGlyph itself). The only
 * thing that legitimately differs between the two call sites is label font
 * size/weight — see DrawSceneLabelStyle below — and which interactive-only
 * overlays (hover/selection/drag-preview) apply, since none of those exist
 * at submit time.
 *
 * app/studio/draft/page.tsx calls drawProfileScene directly from its live
 * draw-loop effect with LIVE_CANVAS_LABEL_STYLE and its real interaction
 * state (completely unchanged visual behavior for the person actively
 * drawing). It calls renderShopSnapshotDataUri only at the moment of submit,
 * which draws the same scene onto a fresh offscreen canvas with
 * SHOP_SNAPSHOT_LABEL_STYLE (larger, bold) and no interaction overlays, then
 * exports it via toDataURL() — replacing the previous plain snapshot of the
 * visible canvas as the geometryImage value.
 */
import { drawHemGlyph } from './hem-glyph';
import { formatInches } from '@/lib/utils/format-inches';
import type { Hem, HemType } from '@/lib/types/profile';

export interface ScenePoint {
  x: number;
  y: number;
  radius?: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

// Only used inside this module's own draw loop (segment length labels) —
// page.tsx's own `dist` stays where it is; this is a private one-line
// primitive, not a second implementation of any real "fact."
function distWorld(a: ScenePoint, b: ScenePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface ProfileSceneColors {
  background: string;
  grid: string;
  profile: string;
  profileSelected: string;
  point: string;
  ink: string;
  angleArc: string;
  angleArcWarn: string;
  hemLine: string;
}

export interface DrawSceneLabelStyle {
  segmentFontPx: number;
  angleFontPx: number;
  hemFontPx: number;
  bold: boolean;
}

// Exactly the sizes/weight the draw loop used before afs-fl-017 — passed by
// the live, on-screen editing canvas so its rendering is byte-for-byte
// unchanged.
export const LIVE_CANVAS_LABEL_STYLE: DrawSceneLabelStyle = {
  segmentFontPx: 12,
  angleFontPx: 11,
  hemFontPx: 10,
  bold: false,
};

// Shop-floor-bound snapshots (afs-fl-017) render dimension/angle/hem labels
// roughly 1.75x larger and bold, so they're legible from a few feet away on
// the shop floor — mirrors generateProfileSVG's labelScale option for
// server-rendered items, applied here to FlashDraft's own labels.
export const SHOP_SNAPSHOT_LABEL_STYLE: DrawSceneLabelStyle = {
  segmentFontPx: 21,
  angleFontPx: 19,
  hemFontPx: 17.5,
  bold: true,
};

function labelFont(px: number, bold: boolean, fontFamily: string): string {
  return `${bold ? 'bold ' : ''}${px}px ${fontFamily}`;
}

export interface DrawSceneInteractionState {
  selectedSegment: number | null;
  hoveredSegment: number | null;
  draggingVertexIndex: number | null;
  hoveredVertex: number | null;
  selectedBendPoint: number | null;
  isDragDrawing: boolean;
  dragPreviewPoint: ScenePoint | null;
  dragAnchor: ScenePoint | null;
  prependDrag: boolean;
}

// No selection, hover, or in-progress drag — the state a submit-time
// offscreen snapshot always renders with (nothing is "currently being
// interacted with" in a static shop-floor image).
const NO_INTERACTION: DrawSceneInteractionState = {
  selectedSegment: null,
  hoveredSegment: null,
  draggingVertexIndex: null,
  hoveredVertex: null,
  selectedBendPoint: null,
  isDragDrawing: false,
  dragPreviewPoint: null,
  dragAnchor: null,
  prependDrag: false,
};

export interface DrawScenePaintState {
  paintFace: 'up' | 'down';
  resolvedPaintColor: string;
}

// Fixed screen-pixel constants private to this scene's own drawing — moved
// here unchanged from app/studio/draft/page.tsx (afs-fl-017), which no
// longer references them directly now that this drawing code lives here.
const GRID_INCHES = 0.25;
const ANGLE_ARC_RADIUS_PX = 20; // fixed, unscaled by zoom — a UI indicator, not to-scale geometry

// The fold glyph's screen radius is derived from the hem's own real-world
// lengthIn (converted to screen px via pixelsPerInch * zoom) rather than a
// fixed constant — a fixed-size glyph made increasing Hem Length only push
// the icon further away along a longer straight connecting line, never grow
// the fold shape itself, which read as "extending the leg" instead of
// growing the hem. HEM_GLYPH_LENGTH_SCALE is a tuning knob on top of the
// real 1:1 inch-to-glyph-size mapping (hem-glyph.ts's own internal
// proportions are already relative to R, so one scale factor grows/shrinks
// the whole shape) — starting at 1.0, a first pass Reid may want to adjust
// once seen live. MIN_READABLE_R is a floor so a very short hem length
// never becomes an illegibly tiny glyph.
const HEM_GLYPH_LENGTH_SCALE = 1.0;
const MIN_READABLE_R = 10; // px floor

// Teardrop is the one hem type this length-driven R formula is wrong for.
// Reid's reference photos of real formed material show the strip running
// flat and straight (that part IS hem.lengthIn, and stays so — see the
// connecting-line math below, unchanged) then rolling into a small, TIGHT,
// closed curl only at the very tip. The curl's own size reads as
// proportional to material thickness, not to how far the straight run
// extends — so growing Hem Length must not balloon the curl. TEARDROP_R
// derives R from effective thickness instead. TEARDROP_THICKNESS_TO_R is
// left as its own tuning constant, independent of hem-glyph.ts's tangent-
// circle radius ratio (currently R * 0.36, restored to Reid-confirmed
// proportions — see that file) — not re-derived from it, per explicit
// instruction not to change this constant.
//
// MIN_TEARDROP_R is a SEPARATE floor from MIN_READABLE_R/HEM_GLYPH_R:
// with no gauge selected (effectiveThicknessIn's 0.0625" fallback), the
// thickness-driven R collapsed to HEM_GLYPH_R (6px), which at the tangent-
// circle construction's proportions renders under 4px across — reads as a
// dot, not a closed loop, confirmed by Reid's live no-gauge test. Raised
// to a value empirically large enough for the loop to still read as a
// loop regardless of material thickness — same "guarantee legibility over
// strict proportionality" principle Open/Smashed's own MIN_READABLE_R
// already applies, just a different (smaller) floor value because
// Teardrop's curl is supposed to look tight, not like Open's hook.
const TEARDROP_THICKNESS_TO_R = 1 / 0.22;
const MIN_TEARDROP_R = 14; // px, empirically the smallest size the tangent-circle construction reads as a closed loop rather than a dot

export interface DrawProfileSceneParams {
  ctx: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  points: ScenePoint[];
  hemStart: Hem | null;
  hemEnd: Hem | null;
  worldToScreen: (p: ScenePoint) => ScreenPoint;
  fontFamily: string;
  pixelsPerInch: number;
  zoom: number;
  gauge: string;
  thicknessIn: number;
  getEffectiveRadius: (i: number) => number;
  isGauge18OrThicker: (gauge: string) => boolean;
  signedAngleBetween: (v1: ScenePoint, v2: ScenePoint) => number;
  colors: ProfileSceneColors;
  labelStyle: DrawSceneLabelStyle;
  /** Omit for a neutral render with no hover/selection/drag overlays. */
  interaction?: DrawSceneInteractionState;
  /** Omit to skip the painted-side stripe entirely. */
  paint?: DrawScenePaintState;
  /** Default true — the offscreen shop snapshot still shows the same drafting grid the live canvas does. */
  drawGrid?: boolean;
  /** Grid phase offset — the live canvas's own pan state. Defaults to {x:0,y:0} (the offscreen snapshot has no pan). */
  pan?: ScreenPoint;
}

/**
 * Draws one full FlashDraft profile — background/grid, segments + length
 * labels, painted-side stripe, points, angle arcs + labels, hem folds +
 * glyphs + labels — onto `ctx`. See module doc comment for why this is
 * shared between the live editing canvas and the offscreen shop snapshot.
 */
export function drawProfileScene(params: DrawProfileSceneParams): void {
  const {
    ctx,
    cssWidth,
    cssHeight,
    points,
    hemStart,
    hemEnd,
    worldToScreen,
    fontFamily,
    pixelsPerInch,
    zoom,
    gauge,
    thicknessIn,
    getEffectiveRadius,
    isGauge18OrThicker,
    signedAngleBetween,
    colors,
    labelStyle,
    interaction = NO_INTERACTION,
    paint,
    drawGrid = true,
    pan = { x: 0, y: 0 },
  } = params;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  if (drawGrid) {
    const step = GRID_INCHES * pixelsPerInch * zoom;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const offsetX = (pan.x + cssWidth / 2) % step;
    const offsetY = (pan.y + cssHeight / 2) % step;
    for (let x = offsetX; x < cssWidth; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssHeight);
      ctx.stroke();
    }
    for (let y = offsetY; y < cssHeight; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssWidth, y);
      ctx.stroke();
    }
  }

  if (points.length === 0 && !interaction.isDragDrawing) return;

  // Segments — leg dimension label in fractional inches.
  for (let i = 0; i < points.length - 1; i++) {
    const a = worldToScreen(points[i]);
    const b = worldToScreen(points[i + 1]);
    const isActive = interaction.selectedSegment === i || interaction.hoveredSegment === i;
    ctx.strokeStyle = interaction.selectedSegment === i ? colors.profileSelected : colors.profile;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const length = distWorld(points[i], points[i + 1]);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(labelStyle.segmentFontPx, labelStyle.bold, fontFamily);
    ctx.fillText(formatInches(length), midX + 6, midY - 6);
  }

  // Painted-side indicator (afs-fl-013) — see original comment in
  // page.tsx's draw loop for the normal/offset derivation this mirrors.
  if (points.length >= 2 && paint) {
    const screenPoints = points.map((p) => worldToScreen(p));
    const segNormal = (p: ScreenPoint, q: ScreenPoint) => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len, y: dx / len };
    };
    const sign = paint.paintFace === 'up' ? 1 : -1;
    const stripeOffsetPx = 8;
    const stripePoints = screenPoints.map((p, i) => {
      let nx: number;
      let ny: number;
      if (i === 0) {
        const n = segNormal(screenPoints[0], screenPoints[1]);
        nx = n.x;
        ny = n.y;
      } else if (i === screenPoints.length - 1) {
        const n = segNormal(screenPoints[i - 1], screenPoints[i]);
        nx = n.x;
        ny = n.y;
      } else {
        const n1 = segNormal(screenPoints[i - 1], screenPoints[i]);
        const n2 = segNormal(screenPoints[i], screenPoints[i + 1]);
        nx = n1.x + n2.x;
        ny = n1.y + n2.y;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
      }
      return { x: p.x + nx * stripeOffsetPx * sign, y: p.y + ny * stripeOffsetPx * sign };
    });
    ctx.save();
    ctx.strokeStyle = paint.resolvedPaintColor;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    stripePoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }

  // Live drag-in-progress segment.
  if (interaction.isDragDrawing && interaction.dragPreviewPoint && (points.length > 0 || interaction.dragAnchor)) {
    const anchor =
      points.length > 0
        ? interaction.prependDrag
          ? points[0]
          : points[points.length - 1]
        : interaction.dragAnchor!;
    const a = worldToScreen(anchor);
    const b = worldToScreen(interaction.dragPreviewPoint);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = colors.profile;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = colors.point;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Points (small dot at every vertex, including the two hem-able endpoints).
  points.forEach((p, i) => {
    const isHemmedEndpoint = (i === 0 && hemStart) || (i === points.length - 1 && hemEnd);
    if (isHemmedEndpoint) return;
    const s = worldToScreen(p);
    ctx.fillStyle = colors.point;
    ctx.beginPath();
    ctx.arc(s.x, s.y, i === interaction.draggingVertexIndex ? 12 : 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Angle indicators.
  const gaugeIsThick = isGauge18OrThicker(gauge);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const s = worldToScreen(curr);
    const effectiveRadius = getEffectiveRadius(i);
    const isTooTight = gaugeIsThick && effectiveRadius < thicknessIn * 1.5;
    const arcColor = isTooTight ? colors.angleArcWarn : colors.angleArc;

    const angleToPrev = Math.atan2(prev.y - curr.y, prev.x - curr.x);
    const angleToNext = Math.atan2(next.y - curr.y, next.x - curr.x);
    let sweep = angleToNext - angleToPrev;
    while (sweep <= -Math.PI) sweep += Math.PI * 2;
    while (sweep > Math.PI) sweep -= Math.PI * 2;

    const isSelected = interaction.selectedBendPoint === i;
    const isHovered = interaction.hoveredVertex === i;
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = isSelected || isHovered ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, ANGLE_ARC_RADIUS_PX, angleToPrev, angleToNext, sweep < 0);
    ctx.stroke();

    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const signedDeg = signedAngleBetween(v1, v2);
    const bisectorAngle = angleToPrev + sweep / 2;
    const labelX = s.x + Math.cos(bisectorAngle) * (ANGLE_ARC_RADIUS_PX + 12);
    const labelY = s.y + Math.sin(bisectorAngle) * (ANGLE_ARC_RADIUS_PX + 12);
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(labelStyle.angleFontPx, labelStyle.bold, fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${signedDeg.toFixed(0)}°`, labelX, labelY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (isSelected) {
      ctx.strokeStyle = colors.angleArc;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Local wrapper over the module-level drawHemGlyph.
  const drawHemGlyphHere = (
    tip: ScreenPoint,
    angleRad: number,
    type: HemType,
    R: number,
    mirror: boolean,
    gapPx: number
  ) => drawHemGlyph(ctx, tip, angleRad, type, R, mirror, gapPx);

  // Hem folds.
  const renderHemAt = (hem: Hem, endpointIdx: number, neighborIdx: number) => {
    const p = points[endpointIdx];
    const q = points[neighborIdx];
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const len = Math.hypot(dx, dy) || 1;
    const u = { x: dx / len, y: dy / len };
    const angleU = Math.atan2(u.y, u.x);

    const mirrorGlyph = hem.kick === 'outside';
    const gapPx = hem.gapIn * pixelsPerInch * zoom;

    ctx.strokeStyle = colors.hemLine;
    ctx.fillStyle = colors.hemLine;
    ctx.font = labelFont(labelStyle.hemFontPx, labelStyle.bold, fontFamily);

    if (hem.type === 'open') {
      const foldTip = { x: p.x + u.x * hem.lengthIn, y: p.y + u.y * hem.lengthIn };
      const sP = worldToScreen(p);
      const sFoldTip = worldToScreen(foldTip);
      const R = Math.max(MIN_READABLE_R, hem.lengthIn * pixelsPerInch * zoom * HEM_GLYPH_LENGTH_SCALE);

      ctx.strokeStyle = colors.hemLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sP.x, sP.y);
      ctx.lineTo(sFoldTip.x, sFoldTip.y);
      ctx.stroke();

      drawHemGlyphHere(sFoldTip, angleU, 'open', R, mirrorGlyph, gapPx);
      ctx.font = labelFont(labelStyle.hemFontPx, labelStyle.bold, fontFamily);
      ctx.fillText(`OPEN ${formatInches(hem.gapIn)} gap`, sFoldTip.x + R * 2 + 6, sFoldTip.y - 6);
    } else if (hem.type === 'teardrop') {
      const foldTip = { x: p.x + u.x * hem.lengthIn, y: p.y + u.y * hem.lengthIn };
      const sP = worldToScreen(p);
      const sFoldTip = worldToScreen(foldTip);
      const effectiveThicknessIn = gauge ? thicknessIn : 0.0625;
      const R = Math.max(MIN_TEARDROP_R, effectiveThicknessIn * pixelsPerInch * zoom * TEARDROP_THICKNESS_TO_R);

      ctx.strokeStyle = colors.hemLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sP.x, sP.y);
      ctx.lineTo(sFoldTip.x, sFoldTip.y);
      ctx.stroke();

      drawHemGlyphHere(sFoldTip, angleU, 'teardrop', R, mirrorGlyph, gapPx);
      ctx.font = labelFont(labelStyle.hemFontPx, labelStyle.bold, fontFamily);
      ctx.fillText('TEARDROP', sFoldTip.x + R * 2 + 6, sFoldTip.y - 6);
    } else {
      const foldTip = { x: p.x + u.x * hem.lengthIn, y: p.y + u.y * hem.lengthIn };
      const sP = worldToScreen(p);
      const sFoldTip = worldToScreen(foldTip);
      const R = Math.max(MIN_READABLE_R, hem.lengthIn * pixelsPerInch * zoom * HEM_GLYPH_LENGTH_SCALE);

      ctx.strokeStyle = colors.hemLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sP.x, sP.y);
      ctx.lineTo(sFoldTip.x, sFoldTip.y);
      ctx.stroke();

      drawHemGlyphHere(sFoldTip, angleU, 'smashed', R, mirrorGlyph, gapPx);
      ctx.font = labelFont(labelStyle.hemFontPx, labelStyle.bold, fontFamily);
      ctx.fillText('SMASHED', sFoldTip.x + R * 2 + 6, sFoldTip.y - 6);
    }
  };

  if (points.length >= 2) {
    if (hemStart) renderHemAt(hemStart, 0, 1);
    if (hemEnd) renderHemAt(hemEnd, points.length - 1, points.length - 2);
  }
}

export interface RenderShopSnapshotParams {
  cssWidth: number;
  cssHeight: number;
  points: ScenePoint[];
  hemStart: Hem | null;
  hemEnd: Hem | null;
  worldToScreen: (p: ScenePoint) => ScreenPoint;
  fontFamily: string;
  pixelsPerInch: number;
  zoom: number;
  gauge: string;
  thicknessIn: number;
  getEffectiveRadius: (i: number) => number;
  isGauge18OrThicker: (gauge: string) => boolean;
  signedAngleBetween: (v1: ScenePoint, v2: ScenePoint) => number;
  colors: ProfileSceneColors;
  paint?: DrawScenePaintState;
  pan?: ScreenPoint;
}

/**
 * Renders the profile onto a brand-new offscreen canvas (never attached to
 * the DOM, never shown to the person drawing) with SHOP_SNAPSHOT_LABEL_STYLE
 * and no interactive overlays, and returns it as a PNG data URI — the
 * geometryImage value for a shop-floor-bound submission. Called only at the
 * moment of submit (sendToPathfinder / submitQuoteRequest in
 * app/studio/draft/page.tsx), never during live drawing/editing.
 */
export function renderShopSnapshotDataUri(params: RenderShopSnapshotParams): string | null {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(params.cssWidth * dpr);
  canvas.height = Math.round(params.cssHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawProfileScene({
    ctx,
    cssWidth: params.cssWidth,
    cssHeight: params.cssHeight,
    points: params.points,
    hemStart: params.hemStart,
    hemEnd: params.hemEnd,
    worldToScreen: params.worldToScreen,
    fontFamily: params.fontFamily,
    pixelsPerInch: params.pixelsPerInch,
    zoom: params.zoom,
    gauge: params.gauge,
    thicknessIn: params.thicknessIn,
    getEffectiveRadius: params.getEffectiveRadius,
    isGauge18OrThicker: params.isGauge18OrThicker,
    signedAngleBetween: params.signedAngleBetween,
    colors: params.colors,
    labelStyle: SHOP_SNAPSHOT_LABEL_STYLE,
    paint: params.paint,
    pan: params.pan,
  });

  return canvas.toDataURL('image/png');
}
