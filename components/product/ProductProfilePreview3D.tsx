'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  bendsFromPoints,
  blankWidthMmFromPoints,
  profileBendsFor,
  profileBlankWidthMm,
  PREVIEW_MATERIAL,
  PREVIEW_GAUGE,
  PREVIEW_THICKNESS_MM,
} from '@/lib/data/product-geometry';
import { previewShapeFor, type PreviewHem } from '@/lib/data/product-preview-shapes';
import type { Hem } from '@/lib/types/profile';
import type { ProfileType } from '@/lib/utils/profile-svg';

/**
 * ONE slow rotation, then stop. Never a loop.
 *
 * 18 seconds for a full 360 degrees. Both numbers are derived from this one
 * constant so they can never disagree: three.js OrbitControls expresses
 * autoRotateSpeed as (60 / seconds-per-revolution), which is the convention
 * ProfileViewer3D's own prop already documents.
 */
export const PRODUCT_ROTATION_SECONDS = 30;

/**
 * The 3D viewer is loaded only when a card is actually enlarged — it pulls in
 * three.js, which has no business in the initial payload of a catalog page
 * showing 35 thumbnails. `ssr: false` because it needs a real WebGL context.
 *
 * If WebGL is refused (a shop tablet's blacklisted driver, a kiosk browser, a
 * remote-desktop session), ProfileViewer3D degrades to its own 2D cross-section
 * rather than leaving an empty panel — CLAUDE.md rule #31. `fallbackTone` is
 * 'light' because this page's surfaces are light, not gunmetal.
 */
const ProfileViewer3D = dynamic(() => import('@/components/studio/ProfileViewer3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-data text-xs uppercase tracking-wide text-afs-ink-700">
        Loading 3D view…
      </span>
    </div>
  ),
});

/**
 * Honours prefers-reduced-motion. Read in an effect rather than at module load
 * so the server and the first client render agree (no hydration mismatch), and
 * so a viewer who changes the OS setting mid-session is picked up.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return prefersReduced;
}

export interface ProductProfilePreview3DProps {
  /**
   * Real fabrication geometry. Mutually exclusive with `schematicProductId`:
   * exactly one of the two says what to draw.
   */
  profileType?: ProfileType | null;
  /**
   * A product id with a SCHEMATIC shape traced from its rendering
   * (lib/data/product-preview-shapes.ts). Drawn with the dimensions control
   * hidden and no labels, because its proportions are read off a picture rather
   * than measured — labelling them would show a customer invented numbers.
   */
  schematicProductId?: string | null;
  productName: string;
  className?: string;
  /**
   * Passed straight through to ProfileViewer3D's own height floor. A caller
   * that sizes the canvas itself passes 0, so the viewer fills that slot rather
   * than rendering at its 500px default inside a shorter, clipping box.
   */
  minHeightPx?: number;
}

/**
 * A traced hem -> the viewer's own Hem. `foldSide` is read looking along the
 * polyline TOWARD the free end (y-down, as traced); the viewer's `kick` is
 * 'outside' = the +normal of the leg's own direction. HEM_LEFT_IS_OUTSIDE is the
 * single place that handedness is decided - it was set by checking a hemmed
 * product against its rendering, not assumed.
 */
const HEM_LEFT_IS_OUTSIDE = true;
function toViewerHem(h: PreviewHem | undefined, which: 'start' | 'end'): Hem | null {
  if (!h) return null;
  // At the START the viewer measures the normal along the leg heading AWAY from the end,
  // which is the reverse of "toward the free end", so left/right swap.
  const leftWins = which === 'end' ? HEM_LEFT_IS_OUTSIDE : !HEM_LEFT_IS_OUTSIDE;
  const outside = h.foldSide === 'left' ? leftWins : !leftWins;
  return { type: h.type, kick: outside ? 'outside' : 'inside', lengthIn: h.lengthIn, gapIn: h.gapIn };
}

export default function ProductProfilePreview3D({
  profileType,
  schematicProductId,
  productName,
  className,
  minHeightPx,
}: ProductProfilePreview3DProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const schematic = schematicProductId ? previewShapeFor(schematicProductId) : null;
  // Real geometry wins whenever it exists; a trace only fills a gap.
  const isSchematic = !profileType && schematic !== null;

  const bends = profileType
    ? profileBendsFor(profileType)
    : schematic
      ? bendsFromPoints(schematic.points)
      : [];
  const blankWidth = profileType
    ? profileBlankWidthMm(profileType)
    : schematic
      ? blankWidthMmFromPoints(schematic.points)
      : 0;

  if (bends.length === 0) return null;

  // The viewer lays the first leg along +X. Rotate back to the traced direction so the profile sits the
  // same way up as its Drexel rendering (traced points are y-down, the viewer is y-up).
  const orientationRad =
    isSchematic && schematic && schematic.points.length > 1
      ? Math.atan2(-(schematic.points[1].y - schematic.points[0].y), schematic.points[1].x - schematic.points[0].x)
      : 0;

  return (
    <div className={className}>
      <ProfileViewer3D
        bends={bends}
        blankWidth={blankWidth}
        material={PREVIEW_MATERIAL}
        gauge={PREVIEW_GAUGE}
        thicknessMm={PREVIEW_THICKNESS_MM}
        profileName={productName}
        fallbackTone="light"
        minHeightPx={minHeightPx}
        hideDimensions={isSchematic}
        defaultDimensionsOn={false}
        perforatedSegments={schematic?.perforatedSegments}
        hemStart={isSchematic ? toViewerHem(schematic?.hemStart, 'start') : null}
        hemEnd={isSchematic ? toViewerHem(schematic?.hemEnd, 'end') : null}
        // Reduced motion: no rotation at all, just the static shape.
        autoRotateSpeed={0}
        autoRotateDurationMs={0}
        singleTurnMs={prefersReducedMotion ? 0 : PRODUCT_ROTATION_SECONDS * 1000}
        cameraDirection={[0.42, 0.3, 1]}
        orientationRad={orientationRad}
        className="h-full w-full"
      />
    </div>
  );
}
