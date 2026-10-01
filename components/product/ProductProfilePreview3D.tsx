'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  profileBendsFor,
  profileBlankWidthMm,
  PREVIEW_MATERIAL,
  PREVIEW_GAUGE,
  PREVIEW_THICKNESS_MM,
} from '@/lib/data/product-geometry';
import type { ProfileType } from '@/lib/utils/profile-svg';

/**
 * ONE slow rotation, then stop. Never a loop.
 *
 * 18 seconds for a full 360 degrees. Both numbers are derived from this one
 * constant so they can never disagree: three.js OrbitControls expresses
 * autoRotateSpeed as (60 / seconds-per-revolution), which is the convention
 * ProfileViewer3D's own prop already documents.
 */
export const PRODUCT_ROTATION_SECONDS = 18;
const AUTO_ROTATE_SPEED = 60 / PRODUCT_ROTATION_SECONDS;
const AUTO_ROTATE_DURATION_MS = PRODUCT_ROTATION_SECONDS * 1000;

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
  profileType: ProfileType;
  productName: string;
  className?: string;
}

export default function ProductProfilePreview3D({
  profileType,
  productName,
  className,
}: ProductProfilePreview3DProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const bends = profileBendsFor(profileType);
  const blankWidth = profileBlankWidthMm(profileType);

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
        // Reduced motion: no rotation at all, just the static shape.
        autoRotateSpeed={prefersReducedMotion ? 0 : AUTO_ROTATE_SPEED}
        autoRotateDurationMs={prefersReducedMotion ? 0 : AUTO_ROTATE_DURATION_MS}
        className="h-full w-full"
      />
    </div>
  );
}
