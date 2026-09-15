/**
 * Draws one of the three hem cross-section glyphs (Open / Smashed /
 * Teardrop) on a canvas 2D context. Extracted from
 * app/studio/draft/page.tsx (FlashDraft's own draw loop and its
 * hem-type-selector popup buttons both call this) so that a standalone
 * debug view (app/studio/hem-debug/page.tsx) can call the EXACT SAME
 * function real users see, at a larger scale, rather than a
 * reimplementation that could silently drift from production.
 *
 * `ctx.fillStyle`/`ctx.strokeStyle` need a literal hex value here — a
 * canvas 2D context can't consume Tailwind classes or CSS custom
 * properties. This mirrors the CANVAS_COLORS.hemLine value in
 * app/studio/draft/page.tsx (the documented CANVAS_COLORS exception to
 * CLAUDE.md rule #4 — see DESIGN_TOKENS.md §10); kept as its own literal
 * here rather than importing CANVAS_COLORS so this module has no
 * dependency on the page component.
 */
import type { HemType } from '@/lib/types/profile';

const HEM_LINE_COLOR = '#C0001A'; // afs-crimson

export interface GlyphPoint {
  x: number;
  y: number;
}

// Fixed screen-pixel-size cross-section glyph radius, unscaled by zoom or
// real-world fold depth — at typical zoom the true-scale fold geometry
// renders only a few pixels wide, so without this every hem type reads as
// the same small dot next to the vertex marker.
export const HEM_GLYPH_R = 6;

const HEM_LINE_WIDTH = 2; // px, matches the leg stroke weight in page.tsx

// Local coordinate convention, which EVERY call site must normalize to
// before calling this function: origin (0,0) = the true hem location (tip
// point for endpoint hems, drag-back point for leg-mid hems). +x = outward
// past the true end. -x = backward, toward the vertex, into the leg's own
// material.
//
// Shapes are built spanning FROM the tip OUTWARD into +x territory — the
// hem's own fold material, real material added specifically for the hem
// (see lib/types/profile.ts's own hemAllowanceIn, which already accounts
// for exactly this extra material) — not backward over the leg.
// Construction follows SMACNA/press-brake hem definitions for Open and
// Smashed; Teardrop is drawn as a stylized icon rather than a literal
// cross-section (see the type==='teardrop' branch below for why and for
// the real 3D fold's own, differently-shaped, construction):
//   Open: a 180-degree bend, U cross-section, with a visible air gap
//     between the two flanges.
//   Smashed: the same topology as Open, with the gap collapsed toward
//     zero (crushed flush).
//   Teardrop: a closed oval, pointed at the tip and rounded at the free
//     end — chosen for icon legibility (Reid, 2026-09-15) over an earlier
//     open-hook/curl construction that more closely matched reference
//     photos of a real formed teardrop hem. See git history for that
//     construction if photographic accuracy is ever wanted here again.
function drawHookGlyph(ctx: CanvasRenderingContext2D, R: number, gapPx: number): void {
  const Lh = R * 1.8; // flat/outward length — long enough to read as "a long piece", not a stub
  const gap = gapPx; // absolute screen px, driven by the real Hem.gapIn — independent of R
  const r = gap / 2; // cap arc radius
  ctx.lineWidth = HEM_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Lh - r, 0);
  ctx.arc(Lh - r, r, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(0, gap);
  ctx.stroke();
}

// Fallback gap (as a fraction of R) used only when a caller doesn't pass an
// explicit gapPx — the real canvas draw loop always passes one, computed
// from the hem's own gapIn (see draw-profile-scene.ts), but preview-only
// callers with no live hem yet (the type-selector popup icons, the
// hem-debug page) previously all fell back to the SAME literal (R * 0.7)
// regardless of type, so Open and Smashed rendered as pixel-identical hooks
// — the two hem types differ ONLY by how closed their gap is, and a shared
// default erased that difference entirely. Resolving the fallback per-type
// here, in the one shared function, means every current and future
// preview-only call site gets a correct, distinct shape for free.
const OPEN_DEFAULT_GAP_FACTOR = 0.75; // ample daylight — reads as unmistakably open
const SMASHED_DEFAULT_GAP_FACTOR = 0.08; // crushed nearly flush, not literally 0 (keeps the fold's rounded cap visible instead of degenerating to a bare line)

export function drawHemGlyph(
  ctx: CanvasRenderingContext2D,
  tip: GlyphPoint,
  angleRad: number,
  type: HemType,
  R: number = HEM_GLYPH_R,
  mirror: boolean = false,
  gapPx?: number
): void {
  const resolvedGapPx =
    gapPx ?? R * (type === 'smashed' ? SMASHED_DEFAULT_GAP_FACTOR : OPEN_DEFAULT_GAP_FACTOR);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angleRad);
  // Mirrors the ENTIRE construction across its own local x-axis (the axis
  // angleRad already points along) — flips which SIDE of the leg line the
  // hook/loop curls toward (local +y vs -y) without touching local +x, so
  // it never reverses direction along the line itself. Applied once here,
  // before any drawing below, so it covers drawHookGlyph (open/smashed)
  // and the teardrop tangent-circle construction identically.
  if (mirror) ctx.scale(1, -1);
  ctx.strokeStyle = HEM_LINE_COLOR;
  ctx.fillStyle = HEM_LINE_COLOR;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (type === 'open' || type === 'smashed') {
    drawHookGlyph(ctx, R, resolvedGapPx);
  } else {
    // Teardrop — closed oval, pointed at the tip (local origin) and rounded
    // at the free/outward end. Reid's explicit call (2026-09-15), made
    // after reviewing this shape side by side against the prior open
    // hook/curl construction (which was itself a deliberate fix for an
    // even earlier closed-loop version — see git history for both): as a
    // TYPE-SELECTOR ICON, a shape that reads instantly as "a teardrop"
    // was judged more important here than matching the exact fold
    // topology visible in reference photos of a formed hem. This only
    // changes the 2D glyph (the popup icon, the hem-debug page, and the
    // schematic fold annotation drawn on FlashDraft's own 2D canvas) —
    // components/studio/ProfileViewer3D.tsx's buildTeardropFoldCenterline
    // still builds the real to-scale 3D fold geometry as an open hook/curl
    // for physical/material accuracy, which this glyph never drove
    // directly anyway (see that function's own doc comment); the two are
    // now intentionally different representations for different purposes,
    // not a drift bug.
    //
    // Built from exact tangent-line-to-circle geometry (not an
    // approximated bezier) so the point-to-round transition is a real
    // tangent with no kink: a straight run from the tip to each of the
    // bulb circle's two tangent points, then the long way around the
    // circle's far side between them, closing back at the tip.
    const bulbR = R * 0.55; // rounded end's radius, as a fraction of R
    const centerDist = R * 1.35; // tip-to-bulb-center distance, as a fraction of R (> bulbR so the tip sits outside the circle)
    const TEARDROP_LINE_WIDTH_FACTOR = 0.11;

    const cosBeta = bulbR / centerDist;
    const sinBeta = Math.sqrt(Math.max(0, centerDist * centerDist - bulbR * bulbR)) / centerDist;
    // The two points where a tangent line from the tip (0,0) touches the
    // bulb circle, symmetric about the local x-axis.
    const tanUpperX = centerDist - bulbR * cosBeta;
    const tanUpperY = bulbR * sinBeta;
    const tanLowerX = tanUpperX;
    const tanLowerY = -tanUpperY;
    const thetaUpper = Math.atan2(tanUpperY, tanUpperX - centerDist);
    const thetaLower = Math.atan2(tanLowerY, tanLowerX - centerDist);

    ctx.lineWidth = Math.max(1.5, R * TEARDROP_LINE_WIDTH_FACTOR);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tanUpperX, tanUpperY);
    // anticlockwise=true sweeps thetaUpper -> thetaLower the LONG way,
    // through the circle's far side (away from the tip) — the short way
    // would cut across near the tip and pinch the shape instead of
    // rounding it.
    ctx.arc(centerDist, 0, bulbR, thetaUpper, thetaLower, true);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
