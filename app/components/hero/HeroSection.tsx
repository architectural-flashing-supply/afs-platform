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

        <div className="flex flex-col justify-center space-y-6 px-6 py-16 md:space-y-8 md:px-12 md:py-16">
          <div>
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-chrome-mid">
              Custom Metal Fabrication
            </p>
            <h1 className="mt-3 font-display leading-none text-afs-chrome-high text-4xl sm:text-5xl md:text-[4rem]">
              From Concept to Delivery. Fast.
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg text-afs-chrome-mid">
              Whether you&apos;re an architect, contractor, or GC — AFS handles unlimited
              custom profiles with proven speed and precision.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/quote"
                className="rounded bg-afs-crimson px-8 py-4 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
              >
                Start Your Project
              </Link>
              <Link
                href="/about/services"
                className="rounded border border-afs-border px-8 py-4 text-center font-label text-sm font-semibold text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface"
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
    </section>
  );
}
