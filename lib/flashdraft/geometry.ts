/**
 * Shared bend-sequence -> 2D polyline "turtle graphics" reconstruction,
 * extracted from three previously-independent, near-identical copies
 * (components/studio/BendSequenceDiagram.tsx's `reconstructPoints`,
 * components/studio/ProfileViewer3D.tsx's `buildProfilePoints`, and
 * app/studio/draft/page.tsx's inline `loadFromLibrary` walk) per
 * GEOMETRY_AUDIT.md, which traced all three and confirmed both that they
 * implement the identical algorithm and that the algorithm itself is
 * correct: walk each bend's leg in the current heading, then turn by the
 * supplementary bend angle, repeat, then walk the final bend's trailing
 * leg. `bendAngleDegrees` is the interior/included angle at the bend —
 * 180° means the two legs continue in a straight line (no turn), 90°
 * means a right-angle corner, 0° means the second leg folds flat back on
 * top of the first — so the turtle changes heading by the *supplement*
 * of that angle (`180 - angle`), the correct relationship between an
 * interior angle and a turtle's turn angle for a polyline walk.
 *
 * Unit-agnostic: leg lengths only scale the result linearly and heading
 * changes never depend on their magnitude, so any consistent unit works.
 * `legIn`/`nextLegIn` reflect FlashDraft's own inch-native call site (see
 * app/api/studio/match-profile/route.ts's own comment on that convention),
 * not a hard requirement — the two mm-based call sites
 * (BendSequenceDiagram, ProfileViewer3D) pass mm values straight through
 * unconverted and get mm-unit points back, which is what preserves their
 * exact prior output bit-for-bit (no mm<->in conversion, and therefore no
 * floating-point rounding, is introduced by centralizing this math).
 *
 * Default handling: `legIn`/`nextLegIn` default to 0 and
 * `bendAngleDegrees` defaults to 180 (straight through) when null or
 * undefined, via `??`. A caller that needs to instead treat a literal 0
 * as "missing" (ProfileViewer3D's pre-existing `bend.angle || 180`
 * semantics, which differs from `??` only when the value is exactly 0)
 * must resolve that default itself before calling this function — passing
 * an already-resolved, non-null value here is a no-op against this
 * function's own `??` default, so each caller's edge-case behavior is
 * preserved exactly rather than silently normalized across all three.
 */

export interface ProfileGeometryBend {
  legIn: number | null;
  nextLegIn: number | null;
  bendAngleDegrees: number | null;
}

export interface ProfileGeometryPoint {
  x: number;
  y: number;
}

export function computeProfilePoints(bends: ProfileGeometryBend[]): { points: ProfileGeometryPoint[] } {
  const points: ProfileGeometryPoint[] = [{ x: 0, y: 0 }];
  let heading = 0;
  let current: ProfileGeometryPoint = { x: 0, y: 0 };

  for (const bend of bends) {
    const leg = bend.legIn ?? 0;
    current = {
      x: current.x + Math.cos((heading * Math.PI) / 180) * leg,
      y: current.y + Math.sin((heading * Math.PI) / 180) * leg,
    };
    points.push(current);
    heading += 180 - (bend.bendAngleDegrees ?? 180);
  }

  if (bends.length > 0) {
    const last = bends[bends.length - 1];
    const leg = last.nextLegIn ?? 0;
    current = {
      x: current.x + Math.cos((heading * Math.PI) / 180) * leg,
      y: current.y + Math.sin((heading * Math.PI) / 180) * leg,
    };
    points.push(current);
  }

  return { points };
}
