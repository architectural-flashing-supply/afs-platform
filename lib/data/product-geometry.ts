/**
 * ProfileType -> the two geometry shapes the Products page needs.
 *
 * This file ADAPTS; it does not define geometry. The shapes come from
 * `buildGeometry` in `lib/utils/profile-svg.ts` (the one place that decides
 * what each ProfileType looks like) and every bend angle comes from
 * `signedInteriorAngleDeg` in `lib/flashdraft/geometry.ts` (the one place that
 * decides what a bend angle means — CLAUDE.md rule #12). Nothing here computes
 * an angle of its own, and nothing here hardcodes a profile.
 *
 * Two consumers, both on /products:
 *   - the 3D preview, which needs `ProfileBend[]` in MILLIMETRES, and
 *   - "Select & Design", which needs the point array in INCHES to hand off to
 *     FlashDraft through localStorage.
 */
import { buildGeometry, type ProfileType } from '@/lib/utils/profile-svg';
import { signedInteriorAngleDeg } from '@/lib/flashdraft/geometry';
import type { ProfileBend } from '@/components/studio/ProfileViewer3D';

const MM_PER_INCH = 25.4;

/**
 * The dimensions every preview is drawn at. `buildGeometry`'s own DEFAULTS are
 * private to that module, so these are stated here and are deliberately the
 * same values: a nominal, representative size.
 *
 * These are NOT the product's real dimensions — the manifest has none, because
 * the Drexel renderings carry no printed dimensions (see
 * docs/PRODUCT_MANIFEST.md). The preview shows the SHAPE of a profile, and the
 * page never prints a number from it, so no invented measurement reaches a
 * customer. A customer's real sizes are entered in FlashDraft or on the quote.
 */
const PREVIEW_DIMENSIONS_IN = { width: 12, height: 4, legA: 2, legB: 2 } as const;

export interface ProfilePoint {
  x: number;
  y: number;
}

/** The profile's cross-section polyline in inches, y-down (FlashDraft's frame). */
export function profilePointsFor(profileType: ProfileType): ProfilePoint[] {
  const { width, height, legA, legB } = PREVIEW_DIMENSIONS_IN;
  return buildGeometry(profileType, width, height, legA, legB).points.map((p) => ({
    x: p.x,
    y: p.y,
  }));
}

function distanceIn(a: ProfilePoint, b: ProfilePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * The bend list ProfileViewer3D consumes, in millimetres.
 *
 * Same construction as FlashDraft's own `viewerBends` (app/studio/draft:
 * one bend per INTERIOR point, legs measured either side of it, angle SIGNED).
 * The sign is load-bearing: lr-02 is on record as the bug where an unsigned
 * angle made every bend turn the same way and rendered a "W" as a curled
 * triangle. `radius` is 0 — these are schematic shapes with no material or
 * gauge behind them, and a made-up bend radius would be a fabrication number
 * nobody specified.
 *
 * A two-point profile (a single straight segment, e.g. a flat) has no interior
 * point, so it is represented as one 180-degree bend — dead straight — which is
 * what the viewer expects and matches FlashDraft's own single-segment handling.
 */
export function profileBendsFor(profileType: ProfileType): ProfileBend[] {
  const points = profilePointsFor(profileType);
  if (points.length < 2) return [];

  if (points.length === 2) {
    return [
      {
        leftLeg: distanceIn(points[0], points[1]) * MM_PER_INCH,
        rightLeg: 0,
        angle: 180,
        radius: 0,
      },
    ];
  }

  const bends: ProfileBend[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    bends.push({
      leftLeg: distanceIn(points[i - 1], points[i]) * MM_PER_INCH,
      rightLeg: distanceIn(points[i], points[i + 1]) * MM_PER_INCH,
      angle: signedInteriorAngleDeg(points[i - 1], points[i], points[i + 1]),
      radius: 0,
    });
  }
  return bends;
}

/** Flat width of the blank, in millimetres — the sum of every leg. */
export function profileBlankWidthMm(profileType: ProfileType): number {
  const points = profilePointsFor(profileType);
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += distanceIn(points[i], points[i + 1]);
  return total * MM_PER_INCH;
}

/**
 * localStorage key FlashDraft reads when it is opened with `?loadCanonical=1`.
 *
 * Established by `components/studio/CanonicalProfileBrowser.tsx`; the other
 * half lives in `app/studio/draft/page.tsx`'s `loadCanonicalFromHandoff`. The
 * handoff passes FINAL POINTS rather than bends on purpose — reconstructing
 * from bends assumes every bend turns the same direction, which mangles any
 * profile with alternating folds.
 */
export const FLASHDRAFT_HANDOFF_KEY = 'afs-flashdraft-canonical-points';

/** Where "Select & Design" sends the browser, once the points are handed off. */
export const FLASHDRAFT_LOAD_URL = '/studio/draft?loadCanonical=1';

/**
 * Nominal material and gauge labels for the 3D preview's own overlay.
 *
 * "Galvalume" exactly — never "Galvanized Galvalume", which is not a material
 * (there is an e2e guarding that spelling repo-wide). The manifest carries no
 * material or gauge data, so these describe the PREVIEW, not the product, and
 * the page does not present them as a specification.
 */
export const PREVIEW_MATERIAL = 'Galvalume';
export const PREVIEW_GAUGE = '24ga';
/** 24ga Galvalume nominal thickness, millimetres. */
export const PREVIEW_THICKNESS_MM = 0.61;
