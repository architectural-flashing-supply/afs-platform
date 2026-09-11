'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Phone screen plays a short 0-7s cut of the same hero clip used in
// HeroSection (app/components/hero/HeroSection.tsx) -- looping the
// timeupdate handler back to 0 keeps it to a 6-8s cut without a second
// trimmed video asset.
const CLIP_END_SECONDS = 7;

const STEPS = [
  {
    number: '01',
    text: 'Snap a photo of the detail',
  },
  {
    number: '02',
    // AI identifies profile type and material only -- SPEC_PHOTO_TO_QUOTE_AI.md
    // is explicit that dimensions are never extracted from photos and must
    // always be entered from site measurements.
    text: 'AI identifies the profile and material',
  },
  {
    number: '03',
    text: 'Your quote request is submitted to AFS',
  },
];

export default function FieldAppStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoEnabled = isNearViewport && !reducedMotion;

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyPreference = (reduceMotion: boolean) => {
      setReducedMotion(reduceMotion);
      if (reduceMotion) videoRef.current?.pause();
    };

    applyPreference(motionQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => applyPreference(e.matches);
    motionQuery.addEventListener('change', handleChange);
    return () => motionQuery.removeEventListener('change', handleChange);
  }, []);

  // This section sits below the fold -- the video's <source> tags (below)
  // are only rendered once it scrolls near the viewport, so the byte
  // download never competes with the hero's LCP poster or other above-the-
  // fold requests.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime >= CLIP_END_SECONDS) {
      video.currentTime = 0;
    }
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-afs-bg-base py-20 md:py-28">
      {/* Real jobsite installation detail (flashing-1.jpg, per
          public/legacy-site-photos/MANIFEST.md: "angled receiver/counterflashing
          bracket fastened over a metal roof panel against a stucco wall -- real
          installation detail, not a staged product shot"), used as a low-opacity
          background accent -- the crimson CTA stays the loudest element per
          DESIGN_TOKENS.md's "one loud element per viewport" rule. */}
      <Image
        src="/legacy-site-photos/homepage-categories/flashing-1.jpg"
        alt=""
        fill
        aria-hidden="true"
        className="object-cover opacity-[0.08]"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-afs-bg-base/90" />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 md:flex-row md:items-center md:gap-16">
        <div className="flex w-full justify-center md:w-2/5">
          {/* CSS-only phone device frame -- no third-party image asset */}
          <div className="relative aspect-[9/19.5] w-[260px] rounded-[2.5rem] border-[6px] border-afs-bg-overlay bg-afs-bg-dim p-2 shadow-raised metal-edge">
            <div className="absolute left-1/2 top-3 z-10 h-[6px] w-[70px] -translate-x-1/2 rounded-full bg-afs-bg-dim" />
            <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-afs-bg-dim">
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                poster="/images/hero-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                aria-hidden="true"
              >
                {videoEnabled && (
                  <>
                    <source src="/videos/hero-metal-fabrication.webm" type="video/webm" />
                    <source src="/videos/hero-metal-fabrication.mp4" type="video/mp4" />
                  </>
                )}
              </video>
            </div>
          </div>
        </div>

        <div className="w-full md:w-3/5">
          <h2 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
            Photo to Quote from the jobsite
          </h2>

          <ol className="mt-10 flex flex-col gap-6">
            {STEPS.map((step) => (
              <li key={step.number} className="flex items-start gap-4">
                <span className="font-data text-sm font-medium text-afs-crimson">
                  {step.number}
                </span>
                <span className="font-body text-lg text-afs-chrome-mid md:text-xl">
                  {step.text}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href="/field/contractor"
              className="rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
            >
              Open the Field App
            </Link>
            <Link
              href="/field/contractor"
              className="font-label text-sm font-semibold text-afs-chrome-mid underline underline-offset-4 transition-colors hover:text-afs-chrome-high"
            >
              Install as an app
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
