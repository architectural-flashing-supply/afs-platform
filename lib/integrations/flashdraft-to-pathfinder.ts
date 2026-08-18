/**
 * Thin adapter: FlashDraft's own drawn-profile state (the same points /
 * hemStart / hemEnd / material / gauge already used to compute the
 * Profile Info Panel's Blank Width / Bend Count / Hem Count in
 * app/studio/draft/page.tsx) -> the MachineProfile shape
 * lib/integrations/pathfinder-edge.ts's pushProfileToPathfinder() already
 * accepts. Converts geometry only — never touches PathfinderEdge's own
 * request/response handling, auth, or feature-array construction
 * (buildFeatures in pathfinder-edge.ts is untouched).
 *
 * Known gap, inherited from pathfinder-edge.ts's own buildFeatures (not
 * fixed here — out of this adapter's scope): hemStart/hemEnd are only
 * used for their blank-width MATERIAL ALLOWANCE (hemAllowanceIn), not as
 * real OpenHem/TearDropHem features — buildFeatures has no hem support
 * yet (see its own comment). A profile with a real hem pushed through
 * this adapter will have the correct total length but render on
 * PathfinderEdge as a plain straight/bent bar with no hem shape.
 */

import { hemAllowanceIn, type Hem, type HemType } from '@/lib/types/profile';
import type { MachineProfile, MachineProfileBend } from '@/lib/integrations/pathfinder-edge';

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

// `kick` doesn't affect hemAllowanceIn's math — a placeholder value here
// is fine. This Hem is only ever used for that one calculation below, it
// never reaches PathfinderEdge as a real feature (see this file's header).
function toHem(input: FlashDraftHemInput | null | undefined): Hem | null {
  if (!input) return null;
  return { type: input.type, gapIn: input.gapIn, lengthIn: input.lengthIn, kick: 'outside' };
}

export function flashDraftToMachineProfile(input: FlashDraftProfileInput): MachineProfile {
  const { points, material, thicknessIn } = input;
  const hemStart = toHem(input.hemStart);
  const hemEnd = toHem(input.hemEnd);

  // Same math as page.tsx's blankWidthInLive / viewerBlankWidthMm — leg
  // lengths plus each end's real hem material allowance.
  let blankWidthIn = 0;
  for (let i = 0; i < points.length - 1; i++) {
    blankWidthIn += dist(points[i], points[i + 1]);
  }
  blankWidthIn += hemAllowanceIn(hemStart, thicknessIn) + hemAllowanceIn(hemEnd, thicknessIn);

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
  };
}
