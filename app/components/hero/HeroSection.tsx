'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

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

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-6 pb-16 pt-28 md:justify-center md:px-10 md:pb-28">
        <div className="flex max-w-3xl flex-col justify-center">
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
      </div>
    </section>
  );
}
