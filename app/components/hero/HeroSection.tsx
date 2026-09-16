'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Split-screen hero: raw shop-floor video on the left, headline/CTAs on the
// right. The phone-mockup video (three-step-process) lives below the fold
// in FieldAppStory instead -- see that file's own comment.
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
    <section className="relative w-full overflow-hidden bg-afs-bg-base">
      <div className="grid min-h-[700px] grid-cols-1 items-stretch md:grid-cols-2">
        <div className="relative min-h-[320px] w-full overflow-hidden">
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
            {/* Sources are only attached once mounted and reduced-motion has
                been checked, so the poster is always what paints first -- no
                video byte fetch competes with it for LCP. */}
            {videoEnabled && (
              <>
                <source src="/videos/hero-metal-fabrication.webm" type="video/webm" />
                <source src="/videos/hero-metal-fabrication.mp4" type="video/mp4" />
              </>
            )}
          </video>
        </div>

        {/* Right column: light/white palette (a deliberate break from the
            dark gunmetal used everywhere else) with a faint architectural
            blueprint grid behind the copy. No external photo asset exists
            for this (public/images has no blueprint stock), so the grid is
            a self-contained inline SVG pattern instead of a background-image
            -- afs-* tokens throughout via `currentColor`/`stop-color`, no
            hardcoded hex per CLAUDE.md rule 4. */}
        <div className="relative flex flex-col justify-center overflow-hidden bg-white px-6 py-16 md:px-12 md:py-16">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full text-afs-ink-900/[0.06]"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern id="hero-blueprint-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M 20 0 L 20 80 M 40 0 L 40 80 M 60 0 L 60 80 M 0 20 L 80 20 M 0 40 L 80 40 M 0 60 L 80 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-blueprint-grid)" />
          </svg>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-white to-afs-chrome-silver/10" />

          <div className="relative z-10">
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
              Custom Metal Fabrication
            </p>
            <h1 className="mt-3 font-display leading-none text-afs-ink-900 text-4xl sm:text-5xl md:text-[4rem]">
              From Concept to Delivery. Fast.
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg text-afs-ink-700">
              Whether you&apos;re an architect, contractor, or GC — AFS handles unlimited
              custom profiles with proven speed and precision.
            </p>
          </div>

          <div className="relative z-10 mt-8 flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/quote"
                className="rounded bg-afs-crimson px-8 py-4 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
              >
                Start Your Project
              </Link>
              <Link
                href="/about/services"
                className="rounded border border-afs-ink-700 px-8 py-4 text-center font-label text-sm font-semibold text-afs-ink-700 transition-colors hover:bg-afs-chrome-silver/20"
              >
                View Our Work
              </Link>
            </div>

            <p className="max-w-md font-body text-sm text-afs-ink-700/70">
              Upload drawings, request quotes, or explore our custom fabrication
              capabilities.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
