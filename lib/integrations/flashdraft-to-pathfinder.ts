/**
 * Thin adapter: FlashDraft's own drawn-profile state (the same points /
 * hemStart / hemEnd / material / gauge already used to compute the
 * Profile Info Panel's Blank Width / Bend Count / Hem Count in
 * app/studio/draft/page.tsx) -> the MachineProfile shape
 * lib/integrations/pathfinder-edge.ts's pushProfileToPathfinder() already
 * accepts. Converts geometry only — never touches PathfinderEdge's own
 * request/response handling, auth, or feature-array construction
 * (buildFeatures in pathfinder-edge.ts owns that, including turning
 * hemStart/hemEnd into real OpenHem/ClosedHem/TearDropHem features).
 */

import type { HemType, HemKick } from '@/lib/types/profile';
import type {
  MachineProfile,
  MachineProfileBend,
  MachineProfileHem,
  PaintedSide,
} from '@/lib/integrations/pathfinder-edge';

const MM_PER_INCH = 25.4;

export interface FlashDraftPointInput {
  x: number;
  y: number;
  radius?: number | null;
}

export interface FlashDraftHemInput {
  type: HemType;
  gapIn: number;
  lengthIn: number;
  kick: HemKick;
}

export interface FlashDraftProfileInput {
  profileName: string;
  points: FlashDraftPointInput[];
  material: string | null;
  thicknessIn: number;
  hemStart?: FlashDraftHemInput | null;
  hemEnd?: FlashDraftHemInput | null;
  // Job-identity intake fields + finish (migration 018, afs-jf-003) — passed
  // straight through to the returned MachineProfile, which is where
  // pushProfileToPathfinder composes them into the outgoing `description`.
  clientBusinessName?: string | null;
  clientName?: string | null;
  poNumber?: string | null;
  requestedBy?: string | null;
  finish?: string | null;
  // FlashDraft's own paint-face selection (app/studio/draft/page.tsx's
  // `paintFace` state). null/undefined means the part is not painted, which
  // maps to the spec's paintedSide "None".
  paintFace?: FlashDraftPaintFace | null;
}

// Mirrors lib/utils/paint-appearance.ts's PaintFace. Declared structurally
// here rather than imported so this adapter keeps depending only on types,
// matching how HemType/HemKick are already handled above.
export type FlashDraftPaintFace = 'up' | 'down';

// Same fallback radius-by-material rule as app/studio/draft/page.tsx's
// own defaultBendRadiusIn — duplicated rather than imported. This
// codebase's established precedent (see approve-quote-request/route.ts's
// own bendAngleFromPoints comment) is to duplicate small pure functions
// across the client-page/server-route boundary rather than import a
// 'use client' page component into a server route module.
function defaultBendRadiusIn(material: string | null): number {
  const m = material ?? '';
  if (/copper|zinc/i.test(m)) return 0.75;
  if (/aluminu?m/i.test(m)) return 0.375;
  return 0.5;
}

function dist(a: FlashDraftPointInput, b: FlashDraftPointInput): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function wrapDeg(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

// SIGNED INTERIOR angle at `curr`, in degrees, range (-180, 180] — 180°
// (or its canonical wrap, since wrapDeg never returns -180) means the
// path keeps going straight through `curr` (no bend); the sign follows
// which side the bend opens toward, same cross-product-equivalent
// atan2-difference logic this codebase has used throughout (unchanged
// here — only the post-processing of that raw value changed).
//
// THIRD revision of this function's semantics, replacing the SECOND
// (turtle turn-from-heading, `turn = interiorSigned + 180°` wrapped).
// Evidence for the second revision (profileId 32911527, a 60°/-120°
// three-segment chevron, Reid confirmed "clean, correct leg lengths, no
// self-intersection") turned out NOT to discriminate between the turn
// and interior models: leg lengths, vertex count, and self-intersection
// are all invariant under a supplement swap (60/120 or 120/60 both
// produce *some* clean chevron), so that test couldn't tell the two
// models apart. The decisive evidence is a single-bend, angle-explicit
// test: profileId 32912069, a FlashDraft "V" drawn with a real interior
// angle of 45° (confirmed on FlashDraft's own canvas), pushed under the
// turn-angle formula (which sent |135|, the supplement of 45) — and
// rendered in PathfinderEdge as ~135°, the supplement of the intended
// 45°, not 45° itself. That is a direct, single-variable confirmation
// that PathfinderEdge wants the signed INTERIOR angle, not a turn-angle
// conversion of it.
//
// NOTE: the staircase test that originally motivated the second revision
// (profileId 32911526, sent raw un-converted `interiorSigned`, reported
// as "self-intersecting/impossible") stays UNEVALUATED as of this
// revision — that report was never independently visually confirmed by
// a session, only relayed from a chat message, and it has not been
// re-checked. It is NOT re-explained by this revision and is flagged,
// not swept aside, in STATE_OF_THE_BUILD.md / SESSION_STATE.md.
//
// Formula: `sign(turn) * (180 - abs(turn))`, where `turn` is this same
// function's second-revision output (`interiorSigned + 180°`, wrapped) —
// algebraically equal to `-interiorSigned` everywhere except the turn=0
// boundary (see below). Computed via `turn` rather than collapsed to
// `-interiorSigned` directly so the relationship to the prior (now
// superseded) turn-angle revision stays traceable in the diff/history.
//
// BOUNDARY at abs(turn) = 180 (interiorSigned = 0 — a hairpin, the two
// legs pointing in exactly opposite directions, folded flat onto each
// other): `sign(turn) * (180 - 180) = 0` regardless of whether turn is
// +180 or -180 (wrapDeg's own convention means it never actually returns
// -180, only +180, but the formula is 0 either way). 0 is the correct,
// intentional output here — a perfectly flat hairpin fold has no
// meaningful handedness to sign in 2D.
//
// BOUNDARY at turn = 0 (interiorSigned = 180 — prev/curr/next exactly
// collinear, no bend at all): the literal formula breaks here, since
// JS's `Math.sign(0) === 0` collapses the whole product to 0 — which
// would be WRONG (0 means "hairpin fold," the opposite degenerate case;
// a dead-straight point must emit 180, "no bend"). Handled as an
// explicit special case below rather than shipped as a silent zero.
function bendAngleAt(prev: FlashDraftPointInput, curr: FlashDraftPointInput, next: FlashDraftPointInput): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  if ((v1.x === 0 && v1.y === 0) || (v2.x === 0 && v2.y === 0)) return 0;
  const interiorSigned = wrapDeg(((Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)) * 180) / Math.PI);
  const turn = wrapDeg(interiorSigned + 180);
  if (turn === 0) return 180;
  return Math.sign(turn) * (180 - Math.abs(turn));
}

// PathfinderEdge's BEND angle for the corner at `curr`, in the spec's own
// orientation and sign convention (spec p.1: "the amount to bend", - for
// right/clockwise, + for left/counter-clockwise).
//
// Computed directly from the two segment headings rather than derived from
// the interior angle, because the turn between headings IS the bend angle —
// no 180-minus-interior step, no boundary special cases, nothing to get
// backwards.
//
// The negation is the un-mirroring step. FlashDraft world coordinates are
// y-DOWN (app/studio/draft/page.tsx's worldToScreen applies no y flip), so
// an atan2 difference in this space has the opposite handedness from the
// spec's. Without it PathfinderEdge renders the part mirrored, which is
// exactly what AFS profiles have been doing.
//
// Worked check against the spec's own 3" U-channel example (p.1), drawn in
// y-down world coords as (0,-3) -> (0,0) -> (3,0) -> (3,-3): both corners
// come out +90, giving [Straight(3), Angle(90), Straight(3), Angle(90),
// Straight(3)] — the spec's exact feature list.
export function specBendAngleAt(
  prev: FlashDraftPointInput,
  curr: FlashDraftPointInput,
  next: FlashDraftPointInput
): number {
  const headingIn = Math.atan2(curr.y - prev.y, curr.x - prev.x);
  const headingOut = Math.atan2(next.y - curr.y, next.x - curr.x);
  const turn = wrapDeg(((headingOut - headingIn) * 180) / Math.PI);
  // -0 is a real JS value and would serialise as `-0`; normalise it away.
  return turn === 0 ? 0 : -turn;
}

// FlashDraft's paint face -> the spec's paintedSide, which is defined
// (p.5) as the left (Positive) or right (Negative) side of the FIRST
// segment in the feature list.
//
// FlashDraft draws its painted-side stripe by offsetting along the segment
// normal (-dy, dx) in its y-DOWN world space, with paintFace 'up' taking
// the +1 sign (lib/flashdraft/draw-profile-scene.ts:279-286). In y-down
// coordinates that normal points to the RIGHT of travel, so 'up' is the
// spec's Negative and 'down' is Positive.
//
// UNCONFIRMED VISUALLY, exactly like hemDirection's kick mapping: the
// left/right derivation above is sound, but nobody has yet checked a pushed
// painted part against PathfinderEdge's own render to confirm which face
// FlashDraft's 'up' label actually means to an operator. Flagged in
// STATE_OF_THE_BUILD.md.
export function toPaintedSide(paintFace: FlashDraftPaintFace | null | undefined): PaintedSide {
  if (!paintFace) return 'None';
  return paintFace === 'up' ? 'Negative' : 'Positive';
}

function toMachineProfileHem(input: FlashDraftHemInput | null | undefined): MachineProfileHem | null {
  if (!input) return null;
  return {
    type: input.type,
    lengthMm: input.lengthIn * MM_PER_INCH,
    gapMm: input.gapIn * MM_PER_INCH,
    kick: input.kick,
  };
}

// F-01 (audit 2026-09-24). This adapter previously propagated non-finite
// coordinates silently: dist() uses Math.hypot, so one NaN or Infinity in
// produced NaN blankWidthMm, NaN leg lengths and a NaN bend angle, with no
// throw anywhere. Those then passed pathfinder-edge's `<= 0` guards (false
// for NaN) and serialised to `null` in the POST.
//
// This is validated HERE, not only at the API route, because the route is
// not the only caller — app/api/admin/command-center/approve-quote-request/
// route.ts builds profiles from stored quote_request line items, where the
// geometry came out of the database rather than off a live canvas and is
// equally unvalidated. Guarding the shared adapter covers both.
function assertFinitePoints(points: FlashDraftPointInput[]): void {
  points.forEach((p, i) => {
    if (!p || typeof p !== 'object' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new Error(
        `Point ${i + 1} has non-finite coordinates (x=${String(p?.x)}, y=${String(p?.y)}) — cannot build a machine profile.`
      );
    }
    if (p.radius !== undefined && p.radius !== null && !Number.isFinite(p.radius)) {
      throw new Error(`Point ${i + 1} has a non-finite bend radius (${String(p.radius)}).`);
    }
  });
}

function assertFiniteHem(hem: FlashDraftHemInput | null | undefined, label: string): void {
  if (!hem) return;
  if (typeof hem !== 'object' || !Number.isFinite(hem.lengthIn) || !Number.isFinite(hem.gapIn)) {
    throw new Error(
      `${label} hem has non-finite dimensions (lengthIn=${String(hem?.lengthIn)}, gapIn=${String(hem?.gapIn)}).`
    );
  }
}

export function flashDraftToMachineProfile(input: FlashDraftProfileInput): MachineProfile {
  const { points, material } = input;
  assertFinitePoints(points);
  assertFiniteHem(input.hemStart, 'Start');
  assertFiniteHem(input.hemEnd, 'End');
  const hemStart = toMachineProfileHem(input.hemStart);
  const hemEnd = toMachineProfileHem(input.hemEnd);

  // Plain leg-length total — no hem allowance baked in here. Once a hem
  // is present it becomes a real feature (see buildFeatures), carrying
  // its own leader-Straight length from hem.lengthMm; adding an allowance
  // on top of that here would double-count the hem's material.
  let blankWidthIn = 0;
  for (let i = 0; i < points.length - 1; i++) {
    blankWidthIn += dist(points[i], points[i + 1]);
  }

  // Same leftLeg/rightLeg-per-interior-point convention as approve-quote-
  // request/route.ts's buildBendsFromPoints and page.tsx's own viewerBends
  // effect — one MachineProfileBend per interior point.
  const bends: MachineProfileBend[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const radiusIn = points[i].radius ?? defaultBendRadiusIn(material);
    bends.push({
      stepNumber: i,
      leftLegMm: dist(points[i - 1], points[i]) * MM_PER_INCH,
      rightLegMm: dist(points[i], points[i + 1]) * MM_PER_INCH,
      bendAngleDegrees: bendAngleAt(points[i - 1], points[i], points[i + 1]),
      // The value PathfinderEdge actually receives. bendAngleDegrees above
      // stays the interior angle because that is what the database and every
      // geometry summary already store — see MachineProfileBend's own doc.
      specBendAngleDegrees: specBendAngleAt(points[i - 1], points[i], points[i + 1]),
      radiusMm: radiusIn * MM_PER_INCH,
    });
  }

  return {
    id: 'flashdraft-live-draw',
    nameEn: input.profileName,
    profileNumber: `FD-${Date.now().toString(36).toUpperCase()}`,
    blankWidthMm: blankWidthIn * MM_PER_INCH,
    bends,
    hemStart,
    hemEnd,
    clientBusinessName: input.clientBusinessName ?? null,
    clientName: input.clientName ?? null,
    poNumber: input.poNumber ?? null,
    requestedBy: input.requestedBy ?? null,
    finish: input.finish ?? null,
    paintedSide: toPaintedSide(input.paintFace),
  };
}
