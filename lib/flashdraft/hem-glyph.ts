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
//   Teardrop: the flange bent PAST 180 degrees into a closed loop —
//     an apex at the tip with two tangent lines running to a circle,
//     forming a single unbroken knot rather than two disconnected
//     primitives.
function drawHookGlyph(ctx: CanvasRenderingContext2D, R: number, gapFraction: number): void {
  const Lh = R * 1.8; // flat/outward length — long enough to read as "a long piece", not a stub
  const gap = R * gapFraction;
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
  R: number = HEM_GLYPH_R
): void {
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angleRad);
  ctx.strokeStyle = HEM_LINE_COLOR;
  ctx.fillStyle = HEM_LINE_COLOR;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (type === 'open') {
    drawHookGlyph(ctx, R, 0.7); // clearly visible gap
  } else if (type === 'smashed') {
    drawHookGlyph(ctx, R, 0.12); // near-zero gap, reads as flush/crushed
  } else {
    // Teardrop — exact tangent-line-to-circle construction. Apex at the
    // tip (0,0), circle at distance d along +x with radius r. d > r
    // guarantees the two tangent lines and the arc between them cannot
    // self-intersect.
    const d = R * 0.3;
    const r = R * 0.22;
    const angleC = Math.acos(r / d);
    const angUpper = Math.PI - angleC;
    const angLower = Math.PI + angleC;
    const cx = d;
    const cy = 0;
    const tux = cx + r * Math.cos(angUpper);
    const tuy = cy + r * Math.sin(angUpper);
    const tlx = cx + r * Math.cos(angLower);
    const tly = cy + r * Math.sin(angLower);
    ctx.lineWidth = HEM_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tux, tuy);
    ctx.arc(cx, cy, r, angUpper, angLower - 2 * Math.PI, true);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
