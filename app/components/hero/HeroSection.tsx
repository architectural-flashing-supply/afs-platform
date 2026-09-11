'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// ProfileRotation is a Three.js/WebGL scene (app/components/hero/ProfileRotation.tsx)
// that touches the canvas/window at import time — same reason HailViewMap is loaded
// this way (app/hailview/page.tsx) — so it must be client-only.
const ProfileRotation = dynamic(() => import('@/app/components/hero/ProfileRotation'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-afs-bg-overlay" />,
});

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyPreference = (reduceMotion: boolean) => {
      setVideoEnabled(!reduceMotion);
      if (reduceMotion) videoRef.current?.pause();
    };

    applyPreference(motionQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => applyPreference(e.matches);
    motionQuery.addEventListener('change', handleChange);
    return () => motionQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-afs-bg-dim">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster="/images/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        {/* Sources are only attached once mounted and reduced-motion has been
            checked, so the poster is always what paints first — no video byte
            fetch competes with it for LCP. */}
        {videoEnabled && (
          <>
            <source src="/videos/hero-metal-fabrication.webm" type="video/webm" />
            <source src="/videos/hero-metal-fabrication.mp4" type="video/mp4" />
          </>
        )}
      </video>

      <div className="absolute inset-0 bg-gradient-to-br from-afs-bg-dim/70 via-afs-bg-dim/45 to-afs-bg-dim/60" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center gap-12 px-6 py-28 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-col justify-center md:w-1/2">
          <h1 className="font-display leading-none text-afs-chrome-high text-5xl sm:text-6xl md:text-7xl lg:text-[7rem]">
            SHOW US THE DETAIL. WE&apos;LL FORM IT.
          </h1>

          <p className="mt-6 max-w-lg font-body text-lg text-afs-chrome-mid md:text-xl">
            Custom architectural metal flashing, fabricated to exact specification in
            Texas and delivered nationwide.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/design-studio"
              className="rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
            >
              Start a Quote
            </Link>
            <Link
              href="#shop-floor"
              className="rounded border border-[var(--afs-border)] px-8 py-4 font-label text-sm font-semibold text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface"
            >
              See How It&apos;s Made
            </Link>
          </div>
        </div>

        <div className="h-[260px] w-full md:h-[480px] md:w-1/2">
          <ProfileRotation className="h-full w-full" />
        </div>
      </div>
    </section>
  );
}
