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
 * `legIn`/`nextLegIn` reflect FlashDraft's own inch-native call sites,
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
 *
 * SIGN (lr-02, 2026-09-29). `bendAngleDegrees` may be SIGNED. FlashDraft's
 * own 2D canvas labels every bend with `signedAngleBetween(v1, v2)` (see
 * lib/flashdraft/draw-profile-scene.ts's angle-indicator loop) — a signed
 * interior angle in (-180, 180], where the sign is the fold's handedness.
 * The 3D path fed this function the UNSIGNED `bendAngleAt` (Math.acos, so
 * 0..180 by construction) instead, which discarded that handedness and
 * made every bend turn the same way: Reid's 2D "W" (legs 21 3/4, 16 1/4,
 * 15 15/16, 22 3/16; bends -50, +51, -53) walked as three same-direction
 * turns and closed into a curled triangle. See bendTurnDegrees below for
 * the turn rule; for a non-negative angle it is bit-for-bit the previous
 * `180 - angle`, so every existing unsigned caller (BendSequenceDiagram,
 * the machine-library match views, loadFromLibrary) is unaffected.
 */

/**
 * Turtle turn (change of heading) for one bend, from its signed interior
 * angle. `interiorDeg` is the value FlashDraft's 2D canvas labels:
 * magnitude = the included angle between the two legs (180 = straight
 * through, 90 = a right-angle corner, 0 = folded flat back), sign = which
 * way the fold goes.
 *
 * Rule: `sign(interior) * (180 - |interior|)`.
 *  - interior +180 or -180 (straight through) -> 0. No turn either way.
 *  - interior  +90 -> +90, interior -90 -> -90. Equal and opposite, which
 *    is the whole point: a W alternates instead of curling.
 *  - interior 0 (a flat hairpin) has no handedness to read, so JS's
 *    `Math.sign(0) === 0` would collapse the product to 0 — "no bend,"
 *    the opposite of what 0 means. Treated as positive here so it stays
 *    the +180 full fold-back the unsigned path already produced.
 *
 * The resulting polyline is the mirror (about y) of the same walk in
 * FlashDraft's own y-DOWN canvas frame — which is exactly right, because
 * every consumer of these points renders them in a y-UP frame (three.js
 * XY for ProfileViewer3D, an SVG with a flipped viewBox for
 * BendSequenceDiagram). Mirroring a y-down walk into a y-up frame is what
 * makes the rendered shape match what the user drew, rather than its
 * reflection.
 */
export function bendTurnDegrees(interiorDeg: number): number {
  const sign = interiorDeg < 0 ? -1 : 1;
  return sign * (180 - Math.abs(interiorDeg));
}

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
    heading += bendTurnDegrees(bend.bendAngleDegrees ?? 180);
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

/**
 * Signed interior angle at an interior point of a 2D point list, in
 * degrees, range (-180, 180]. This is THE bend angle FlashDraft's 2D
 * canvas prints: lib/flashdraft/draw-profile-scene.ts's angle-indicator
 * loop labels every bend with exactly this value, via the identical
 * `signedAngleBetween(v1, v2)` math on the same two leg vectors.
 *
 * Magnitude is the included angle between the incoming and outgoing legs
 * (180 = dead straight, 90 = a right-angle corner, small = a tight fold);
 * the sign is the fold's handedness. Feed it to bendTurnDegrees above to
 * walk the profile back out as a polyline.
 *
 * Shared (lr-02) so the 2D canvas, the draft page's 3D feed and anything
 * else that has to agree on "what angle is this bend" read one
 * implementation rather than three. The PathfinderEdge encoder is
 * deliberately NOT a caller: it has its own signed convention, matched to
 * AMS Controls' published spec rather than to FlashDraft's screen frame.
 */
export function signedInteriorAngleDeg(
  prev: ProfileGeometryPoint,
  curr: ProfileGeometryPoint,
  next: ProfileGeometryPoint
): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  let deg = ((Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)) * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  return deg;
}

/**
 * The on-screen text for one bend angle. Shared (lr-02) between the 2D
 * canvas and the 3D viewer so the two can never drift: `.toFixed(0)`, not
 * `Math.round`, because the two disagree on negative halves
 * (`Math.round(-50.5)` is -50; `(-50.5).toFixed(0)` is "-51") and the 3D
 * labels are required to match the 2D labels exactly, sign included.
 */
export function formatBendAngleLabel(angleDeg: number): string {
  return `${angleDeg.toFixed(0)}°`;
}

/**
 * Cross-section polyline for one profile, reconstructed from its bend
 * list — the single entry point the 3D viewers (ProfileViewer3D and,
 * through it, SubmitConfirmation3DModal and MatchedProfile3DModal) use to
 * turn a bend sequence back into the shape the user drew.
 *
 * Thin wrapper over computeProfilePoints that resolves each bend's
 * defaults the way ProfileViewer3D always has (`|| fallback`, falsy-based,
 * so a literal 0 angle reads as "missing" and becomes 180 = straight
 * through) while letting a NEGATIVE angle — truthy — pass through with its
 * sign intact.
 */
export function buildCrossSectionPoints(
  bends: { leftLeg: number; rightLeg: number; angle: number }[]
): ProfileGeometryPoint[] {
  return computeProfilePoints(
    bends.map((b) => ({
      legIn: b.leftLeg || 0,
      nextLegIn: b.rightLeg || 0,
      bendAngleDegrees: b.angle || 180,
    }))
  ).points;
}
