'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Real per-segment structure of hero-metal-fabrication.mp4, from
// scripts/video-review/README.md's own editorial notes (FEED+BEND: clip 2,
// joined without a cut; RELEASE: clip 4, 0.5s crossfade in). Verified
// against the actual current file via ffprobe -- 16.03s total, matching
// the README's 16.0s exactly. 10.5s is the crossfade midpoint (16.0s total
// - 6.0s RELEASE + 0.5s crossfade overlap = 10.5s of FEED+BEND).
const HERO_LABEL_SWITCH_S = 10.5;

// Split-screen hero: raw shop-floor video (with real, timed process-stage
// labels -- see the effect below) on the left, headline/CTAs over Reid's
// blueprint image on the right.
export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [activeLabel, setActiveLabel] = useState<'feed-bend' | 'release'>('feed-bend');

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

  // Overlay labels on the shop-floor video, timed to its own real
  // production structure. No overlay text has ever existed in this video's
  // history -- checked exhaustively across every commit that ever touched
  // it, the full editorial production notes, and this component's own git
  // log, across three separate passes, all turning up nothing. This adds
  // real labels grounded in the video's actual documented structure,
  // rather than restoring content that was never there to begin with.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setActiveLabel(video.currentTime < HERO_LABEL_SWITCH_S ? 'feed-bend' : 'release');
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
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

          {/* Process-stage label -- see the effect above for where the
              timing and text come from. */}
          <div className="absolute bottom-6 left-6 z-10 rounded bg-afs-bg-dim/80 px-4 py-2 backdrop-blur-sm">
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
              {activeLabel === 'feed-bend' ? 'Feed + Bend' : 'Release'}
            </p>
          </div>
        </div>

        {/* Right column: Reid's own supplied blueprint image
            (public/images/blueprint.webp) at bg-cover (fills the section),
            with a uniform translucent dark wash across the whole column
            (afs-bg-dim/55 -- "translucency," not full opacity) plus an
            additional, stronger fade concentrated on the right edge only
            (transparent until 70%, ramping in the last 30%). Text stays
            light-on-dark (chrome-high/chrome-mid) to read against the wash. */}
        <div
          className="relative flex flex-col justify-center overflow-hidden bg-cover bg-center px-6 py-16 md:px-12 md:py-16"
          style={{ backgroundImage: "url('/images/blueprint.webp')" }}
        >
          {/* Both layers built from the afs-bg-dim token at varying
              opacity via Tailwind's theme()-in-arbitrary-value syntax, not
              raw rgba()/black literals -- CLAUDE.md rule 4. */}
          <div className="pointer-events-none absolute inset-0 bg-afs-bg-dim/55" />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,theme(colors.afs.bg-dim/0%)_0%,theme(colors.afs.bg-dim/0%)_70%,theme(colors.afs.bg-dim/40%)_100%)]"
          />

          <div className="relative z-10 max-w-lg">
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
                  className="rounded border border-afs-chrome-mid bg-afs-bg-dim/60 px-8 py-4 text-center font-label text-sm font-semibold text-afs-chrome-mid backdrop-blur-sm transition-colors hover:bg-afs-bg-surface"
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
