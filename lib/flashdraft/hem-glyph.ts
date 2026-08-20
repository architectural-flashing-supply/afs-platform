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
// Construction follows SMACNA/press-brake hem definitions:
//   Open: a 180-degree bend, U cross-section, with a visible air gap
//     between the two flanges.
//   Smashed: the same topology as Open, with the gap collapsed toward
//     zero (crushed flush).
//   Teardrop: an OPEN hook/curl, NOT a closed loop — confirmed against
//     five real photographs of formed teardrop hems on real sheet metal.
//     The material curves almost all the way around in a tight radius,
//     then a short free tail continues past the curl WITHOUT closing
//     back onto itself; a visible gap/opening remains between the tail
//     and the rest of the curl in every reference photo. (An earlier,
//     now-deleted construction built a closed tangent-circle loop —
//     wrong topology, not just wrong proportions; see git history if
//     that shape is ever needed for reference.)
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

export function drawHemGlyph(
  ctx: CanvasRenderingContext2D,
  tip: GlyphPoint,
  angleRad: number,
  type: HemType,
  R: number = HEM_GLYPH_R,
  mirror: boolean = false,
  gapPx: number = R * 0.7
): void {
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
    drawHookGlyph(ctx, R, gapPx);
  } else {
    // Teardrop — open hook/curl. sweepDeg/tailFrac are Reid-confirmed as
    // roughly right; TEARDROP_LINE_WIDTH_FACTOR and TAIL_DIVERGE_DEG below
    // are this pass's fixes, still flagged for live visual tuning against
    // his reference photos, NOT yet confirmed correct.
    const r = R * 0.8; // curl radius
    const sweepDeg = 310; // how far around the curl sweeps
    const tailFrac = 0.42; // free tail length as a fraction of r
    // Stroke weight as a fraction of R, NOT the flat HEM_LINE_WIDTH
    // Open/Smashed use (2px regardless of R) — at this shape's typical R
    // (MIN_TEARDROP_R=14 up to ~50+ at higher zoom/thickness) a flat 2px
    // reads anywhere from too-thick to too-thin depending on R, and at
    // the large R used for isolated/debug renders it reads as a fat
    // donut ring instead of a thin strip curling around empty space.
    const TEARDROP_LINE_WIDTH_FACTOR = 0.09; // within Reid's requested 0.08–0.10 range
    // How far the tail diverges INWARD (toward the circle's center) past
    // pure-tangent — a pure-tangent tail is invisible as a separate
    // element because it blends into the outer curl wall; diverging
    // inward opens daylight between the tail and the curl, matching the
    // gap visible in every one of Reid's reference photos.
    const TAIL_DIVERGE_DEG = 20;

    // Circle center directly above the origin so the curl starts tangent
    // to the incoming leg direction (smooth transition, no kink).
    const cx = 0;
    const cy = r;
    const thetaStart = (-90 * Math.PI) / 180; // this is the point (0,0)
    const thetaEnd = thetaStart + (sweepDeg * Math.PI) / 180;

    const arcEndX = cx + r * Math.cos(thetaEnd);
    const arcEndY = cy + r * Math.sin(thetaEnd);
    // Tangent direction at the arc's end, in the same increasing-theta
    // direction the arc was swept in.
    const tangentX = -Math.sin(thetaEnd);
    const tangentY = Math.cos(thetaEnd);
    // Rotate the tangent by TAIL_DIVERGE_DEG toward the circle's center —
    // rotating a tangent vector +90° (via the standard (x,y) -> (-y,x)
    // rotation) yields exactly the inward radial direction at that point,
    // so a partial rotation by TAIL_DIVERGE_DEG (< 90°) moves the tail
    // partway from pure-tangent toward center, not any other direction.
    const divergeRad = (TAIL_DIVERGE_DEG * Math.PI) / 180;
    const tailDirX = tangentX * Math.cos(divergeRad) - tangentY * Math.sin(divergeRad);
    const tailDirY = tangentX * Math.sin(divergeRad) + tangentY * Math.cos(divergeRad);
    const tailLen = tailFrac * r;

    ctx.lineWidth = R * TEARDROP_LINE_WIDTH_FACTOR;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(cx, cy, r, thetaStart, thetaEnd, false);
    ctx.lineTo(arcEndX + tailDirX * tailLen, arcEndY + tailDirY * tailLen);
    // No closePath — the tail ends in open space and must NOT reconnect
    // to (0,0) or anywhere else, unlike Open/Smashed and the old
    // closed-loop Teardrop.
    ctx.stroke();
  }
  ctx.restore();
}
