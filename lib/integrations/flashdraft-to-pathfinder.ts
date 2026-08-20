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
import type { MachineProfile, MachineProfileBend, MachineProfileHem } from '@/lib/integrations/pathfinder-edge';

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
}

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

// SIGNED TURN-FROM-HEADING angle at `curr`, in degrees, range (-180, 180]
// — 0° means the path keeps going straight through `curr`, matching the
// turtle-graphics semantics of PathfinderEdge's own [Straight, Angle,
// Straight, Angle, Straight...] feature-list convention (confirmed live,
// 2026-08-19: pushing this file's prior version — which sent the INTERIOR
// angle instead, 180° = straight through, same formula as app/studio/
// draft/page.tsx's signedAngleBetween — rendered a simple 4-leg
// right-angle staircase as a self-intersecting/impossible shape in
// PathfinderEdge, not just a mirrored one, which is what distinguishes
// "wrong turn-vs-interior angle model" from "right model, wrong sign").
// `interiorSigned` below is kept as an explicit intermediate step (it's
// exactly signedAngleBetween's own value, for traceability) rather than
// collapsing the two formulas into one; `turn = interiorSigned + 180°`
// wrapped is the conversion from interior-angle to turn-angle.
// CONFIRMED live, 2026-08-19, with a real push + Reid's own visual check
// of a non-90° profile (turns +60°/-120°, profileId 32911527, catalog
// 20115): rendered as a clean three-segment shape, correct 10" leg
// lengths, two distinct non-overlapping vertices, no self-intersection —
// the all-90° test that found the interior-vs-turn-angle bug couldn't by
// itself confirm sign polarity for a non-90° bend (90° coincidentally
// makes interior-angle and turn-angle differ by sign only); this test
// could and did.
function bendAngleAt(prev: FlashDraftPointInput, curr: FlashDraftPointInput, next: FlashDraftPointInput): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  if ((v1.x === 0 && v1.y === 0) || (v2.x === 0 && v2.y === 0)) return 0;
  const interiorSigned = wrapDeg(((Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)) * 180) / Math.PI);
  return wrapDeg(interiorSigned + 180);
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

export function flashDraftToMachineProfile(input: FlashDraftProfileInput): MachineProfile {
  const { points, material } = input;
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
  };
}
