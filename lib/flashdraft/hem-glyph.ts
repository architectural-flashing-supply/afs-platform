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

// Local coordinate convention, which EVERY call site must normalize to
// before calling this function: origin (0,0) = the true hem location (tip
// point for endpoint hems, drag-back point for leg-mid hems). +x = outward
// past the true end (hypothetical — no material there). -x = backward,
// toward the vertex, where the leg's actual material exists. Every shape
// below is built entirely in -x territory as a result.
//
// Shapes are derived directly from a real PathfinderEdge reference
// screenshot and hand-drawn sketches, as literal coordinates — not
// reinterpreted from the type names:
//   Open: a capsule/stadium parallel to the leg, offset a clearly visible
//     0.3R off the centerline — never touches the leg line.
//   Smashed: the same capsule construction pressed nearly flush (0.05R
//     offset — unchanged, it's what makes this read correctly as
//     "nearly flush against the leg" in the real canvas rendering, where
//     the true fold lines are drawn right next to it), but shorter
//     (0.6R vs Open's 1.1R, widened from the original 0.8R) AND
//     noticeably thinner-stroked (0.16R vs Open's 0.3R) than Open. That
//     offset difference alone isn't visible where there's no reference
//     leg line drawn next to the icon in isolation (the popup buttons,
//     the 20x debug view) — confirmed via audit screenshot that Open and
//     Smashed read as near-identical short red dashes at real popup
//     button scale. Length and line-weight are both cues that stay
//     visible with no reference line at all, so they're what carries the
//     distinction in every rendering context, not just the real canvas.
//   Teardrop: one continuous stroked path — a tail departing the leg's own
//     line, curling into a tight closed loop, ending back near its own
//     entry curve (a knot, not a stick-and-separate-ball lollipop).
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
    ctx.lineWidth = R * 0.3; // 2x the 0.15R cap radius — a round-capped line IS a stadium/pill
    ctx.beginPath();
    ctx.moveTo(0, R * 0.3);
    ctx.lineTo(-R * 1.1, R * 0.3);
    ctx.stroke();
  } else if (type === 'smashed') {
    // Thinner (0.16R vs Open's 0.3R) AND shorter (0.6R vs Open's 1.1R) —
    // two independent cues that read even with no reference leg line next
    // to the icon (offset alone doesn't, see this function's doc comment).
    ctx.lineWidth = R * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, R * 0.05);
    ctx.lineTo(-R * 0.6, R * 0.05);
    ctx.stroke();
  } else {
    const loopR = R * 0.35;
    const cx = -R * 0.35;
    const cy = R * 0.35;
    const entryX = cx - loopR; // point on the loop at angle PI
    const entryY = cy;
    ctx.lineWidth = R * 0.22;
    ctx.beginPath();
    ctx.moveTo(-R * 0.8, 0);
    ctx.bezierCurveTo(-R * 0.55, -R * 0.05, cx - loopR * 1.05, cy - loopR * 0.6, entryX, entryY);
    // Sweeps clockwise almost a full turn (2*PI - 0.6 rad) from the entry
    // point, ending just short of it — the "closing back near its own
    // starting curve" that reads as a rolled/curled knot.
    ctx.arc(cx, cy, loopR, Math.PI, Math.PI + Math.PI * 2 - 0.6, false);
    ctx.stroke();
  }
  ctx.restore();
}
