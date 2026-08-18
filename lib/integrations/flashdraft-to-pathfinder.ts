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

// Interior bend angle at `curr`, in degrees — identical formula to
// app/studio/draft/page.tsx's bendAngleAt / approve-quote-request/
// route.ts's bendAngleFromPoints (kept duplicated for the same reason).
function bendAngleAt(prev: FlashDraftPointInput, curr: FlashDraftPointInput, next: FlashDraftPointInput): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
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
