'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import RevealOnScroll from '../home/RevealOnScroll';

/**
 * HOME HERO — one continuous cinematic composition.
 *
 * Desktop: the fabrication video occupies the left ~63% and dissolves into a
 * deep navy canvas through a wide horizontal gradient (no vertical seam).
 * The blueprint is atmosphere only: very low opacity, masked so it is
 * strongest in the empty bottom-right corner and absent behind the type.
 * Mobile: video on top, fading down into the navy content block.
 *
 * Locked decisions respected (see homepage-redesign memory): shop-floor video
 * stays the hero visual, no rotating 3D profile, logo rail and the client
 * carousel directly below are untouched.
 */
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
    <section
      aria-label="AFS — custom architectural metal, where architecture becomes metal"
      className="relative isolate w-full overflow-hidden bg-afs-navy-950"
    >
      {/* ---------------------------------------------------------- VIDEO */}
      <div className="relative h-[46vh] min-h-[280px] max-h-[440px] w-full overflow-hidden lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:max-h-none lg:w-[74%]">
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
          {videoEnabled && (
            <>
              <source src="/videos/hero-metal-fabrication.webm" type="video/webm" />
              <source src="/videos/hero-metal-fabrication.mp4" type="video/mp4" />
            </>
          )}
        </video>

        {/* Readability scrim for the statement, bottom-up so the machine stays bright. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-afs-navy-950/75 via-afs-navy-950/10 to-transparent" />

        {/* THE seam-killer: wide horizontal dissolve from footage into navy (desktop). */}
        <div className="hero-seam pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] lg:block" />

        {/* Mobile: dissolve the bottom of the video into the content block. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-afs-navy-950 lg:hidden" />

        <div className="absolute bottom-0 left-0 z-10 px-6 pb-10 lg:px-12 lg:pb-16">
          <p className="font-label text-sm font-bold uppercase tracking-[0.24em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            Architectural &bull; Commercial &bull; Custom
          </p>
          <p className="mt-3 font-display uppercase leading-[0.95] text-afs-chrome-high drop-shadow-lg text-[clamp(2rem,4.2vw,3.5rem)]">
            <span className="block">Custom Metal</span>
            <span className="block">Fabrication.</span>
          </p>
        </div>
      </div>

      {/* Faint depth: slight vignette so the type field feels lit from the video side. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,transparent_40%,theme(colors.afs.navy-950/60%)_100%)]"
      />

      {/* The AFS profile (115 degree bends, open hems turned inward, 14 3/4" base) drawing itself on its side with FlashDraft-style dimensions. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 170 235"
        className="hero-trace pointer-events-none absolute right-3 top-1/2 hidden w-[clamp(230px,21vw,360px)] -translate-y-1/2 text-afs-chrome-mid min-[1280px]:block"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g stroke="var(--afs-crimson)" strokeWidth="2.25">
          <path className="ht-stroke ht-s1" pathLength="1" d="M47.0 20.1L38.8 16.3A1.75 1.75 0 0 1 40.3 13.2L130.0 55.0" />
          <path className="ht-stroke ht-s2" pathLength="1" d="M130.0 55.0L130.0 173.0" />
          <path className="ht-stroke ht-s3" pathLength="1" d="M130.0 173.0L40.3 214.8A1.75 1.75 0 0 1 38.8 211.7L47.0 207.9" />
        </g>
        <circle className="ht-fade ht-j1" cx="130.0" cy="55.0" r="3" fill="var(--afs-crimson)" />
        <circle className="ht-fade ht-j2" cx="130.0" cy="173.0" r="3" fill="var(--afs-crimson)" />
        <path className="ht-stroke ht-arc1" pathLength="1" stroke="var(--afs-crimson)" strokeWidth="1.25" d="M130.0 71.0A16 16 0 0 1 115.5 48.2" />
        <path className="ht-stroke ht-arc2" pathLength="1" stroke="var(--afs-crimson)" strokeWidth="1.25" d="M130.0 157.0A16 16 0 0 0 115.5 179.8" />
        <text className="ht-fade ht-t2a ht-lbl" x="104.6" y="24.6" textAnchor="middle">{'10 7/8"'}</text>
        <text className="ht-fade ht-t1 ht-lbl" x="122.0" y="117.0" textAnchor="end">{'14 3/4"'}</text>
        <text className="ht-fade ht-t2b ht-lbl" x="104.6" y="213.4" textAnchor="middle">{'10 7/8"'}</text>
        <text className="ht-fade ht-at1 ht-lbl ht-sm" x="106.0" y="77.0" textAnchor="end">{'115\u00B0'}</text>
        <text className="ht-fade ht-at2 ht-lbl ht-sm" x="106.0" y="161.0" textAnchor="end">{'115\u00B0'}</text>
        <text className="ht-fade ht-hka ht-lbl ht-xs" x="45.0" y="8.3" textAnchor="middle">{'OPEN 7/16" GAP'}</text>
        <text className="ht-fade ht-hkb ht-lbl ht-xs" x="45.0" y="225.7" textAnchor="middle">{'OPEN 7/16" GAP'}</text>
      </svg>

      {/* ----------------------------------------------------------- COPY */}
      <div className="relative z-10 flex flex-col justify-center px-6 pb-14 pt-4 lg:ml-auto lg:min-h-[clamp(560px,82vh,860px)] lg:w-[42%] lg:py-20 lg:pl-10 lg:pr-0">
        <RevealOnScroll durationMs={600} staggerMs={120} className="max-w-lg">
          <h1 className="font-display uppercase leading-[0.95] text-afs-chrome-high text-[clamp(2.2rem,3.9vw,3.5rem)]">
            <span className="block">Where</span>
            <span className="block">Architecture</span>
            <span className="block">Becomes Metal.</span>
          </h1>

          <div className="mt-6 h-px w-16 bg-afs-crimson" aria-hidden="true" />

          <p className="mt-6 max-w-md font-body text-lg leading-relaxed text-afs-chrome-mid">Precision Made. Project Ready.</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4 lg:flex-col lg:items-start">
            <Link
              href="/quote"
              className="min-h-[48px] w-full rounded-sm bg-afs-crimson px-8 sm:w-auto lg:w-full lg:max-w-[16rem] py-3.5 text-center font-label text-sm font-semibold uppercase tracking-[0.14em] text-white metal-edge-red shadow-crimson transition-colors duration-200 hover:bg-afs-crimson-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start Your Project
            </Link>
            <Link
              href="/products"
              className="min-h-[48px] w-full rounded-sm bg-afs-accent-blue sm:w-auto lg:w-full lg:max-w-[16rem] px-8 py-3.5 text-center font-label text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-lg transition-colors duration-200 hover:bg-afs-info-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View Our Work
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
