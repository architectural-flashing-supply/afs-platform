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

        {/* Right column: Reid's own supplied blueprint image
            (public/images/blueprint.webp), shown at its natural full
            extent (bg-contain, not bg-cover -- cover was scaling the
            1024x1024 square image up past the container's own bounds,
            cropping into the floor-plan detail and reading as "too zoomed
            in"). The edge fade below is intentionally minimal (right-edge
            only) per spec, but a minimal fade alone isn't enough for
            legibility here: the headline/subheading/CTAs span nearly the
            full column width, directly over the blueprint's own dense
            white linework and labels -- a first pass with a drop-shadow
            only was tried and was a real contrast failure (verified via
            screenshot, not assumed). The copy block instead sits on its
            own small contained scrim (a rounded, semi-transparent panel
            sized to the text, not a wash across the image) -- this keeps
            the blueprint the visual across most of the column while
            actually keeping the words readable. */}
        <div
          className="relative flex flex-col justify-center overflow-hidden bg-afs-bg-dim bg-contain bg-center bg-no-repeat px-6 py-16 md:px-12 md:py-16"
          style={{ backgroundImage: "url('/images/blueprint.webp')" }}
        >
          {/* Edge fade built from the afs-bg-dim token at varying opacity
              via Tailwind's theme()-in-arbitrary-value syntax, not a raw
              rgba() literal -- CLAUDE.md rule 4. Transparent until 80%,
              then ramps to solid only in the last 20% of the column. */}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,theme(colors.afs.bg-dim/0%)_0%,theme(colors.afs.bg-dim/0%)_80%,theme(colors.afs.bg-dim/70%)_100%)]"
          />

          <div className="relative z-10 max-w-lg rounded-lg bg-afs-bg-dim/80 p-6 backdrop-blur-sm">
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
              Custom Metal Fabrication
            </p>
            <h1 className="mt-3 font-display leading-none text-afs-chrome-high text-4xl sm:text-5xl md:text-[4rem]">
              From Concept to Delivery. Fast.
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg text-afs-chrome-mid">
              Whether you&apos;re an architect, contractor, or GC — AFS handles unlimited
              custom profiles with proven speed and precision.
            </p>

            <div className="mt-8 flex flex-col gap-8">
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/quote"
                  className="rounded bg-afs-crimson px-8 py-4 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
                >
                  Start Your Project
                </Link>
                <Link
                  href="/about/services"
                  className="rounded border border-afs-chrome-mid px-8 py-4 text-center font-label text-sm font-semibold text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface"
                >
                  View Our Work
                </Link>
              </div>

              <p className="max-w-md font-body text-sm text-afs-chrome-dim">
                Upload drawings, request quotes, or explore our custom fabrication
                capabilities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
