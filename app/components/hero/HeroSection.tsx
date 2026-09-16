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
      {/* min-h-[560px] (was 700px): at 700px, the hero + fixed 80px header
          left almost nothing above the fold for ClientCarousel below it on
          a typical ~900px viewport -- see that component's own comment. */}
      <div className="grid min-h-[560px] grid-cols-1 items-stretch md:grid-cols-2">
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

        {/* Right column: light palette (a deliberate break from the dark
            gunmetal used everywhere else) over Reid's own supplied
            blueprint image (public/images/blueprint.webp -- English-
            language, replacing a prior pass's Unsplash pick that turned
            out to be a Dutch-language archival scan). The fade overlay
            below goes most of the way to opaque white by the time it
            reaches the copy, since the image is a deep blue, not "light
            blue" -- otherwise afs-ink-900 text wouldn't have safe contrast
            against it. Left edge (near the video seam) stays closer to the
            raw image; text/CTAs sit under a near-solid white wash. */}
        <div
          className="relative flex flex-col justify-center overflow-hidden bg-afs-chrome-high bg-cover bg-center px-6 py-16 md:px-12 md:py-16"
          style={{ backgroundImage: "url('/images/blueprint.webp')" }}
        >
          {/* Fade overlay built from the afs-chrome-high token (== #FFFFFF)
              at varying opacity via Tailwind's theme()-in-arbitrary-value
              syntax, not a raw rgba()/white literal -- CLAUDE.md rule 4. */}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,theme(colors.afs.chrome-high/25%)_0%,theme(colors.afs.chrome-high/94%)_55%,theme(colors.afs.chrome-high/97%)_100%)]"
          />

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
