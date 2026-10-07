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
      aria-label="AFS — custom architectural metal, from concept to delivery"
      className="relative isolate w-full overflow-hidden bg-afs-navy-950"
    >
      {/* ---------------------------------------------------------- VIDEO */}
      <div className="relative h-[46vh] min-h-[280px] max-h-[440px] w-full overflow-hidden lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:max-h-none lg:w-[63%]">
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
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[clamp(180px,26%,320px)] bg-gradient-to-r from-transparent via-afs-navy-900/55 to-afs-navy-950 lg:block" />

        {/* Mobile: dissolve the bottom of the video into the content block. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-afs-navy-950 lg:hidden" />

        <div className="absolute bottom-0 left-0 z-10 px-6 pb-10 lg:px-12 lg:pb-16">
          <p className="font-label text-xs font-semibold uppercase tracking-[0.28em] text-afs-chrome-mid">
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

      {/* The AFS profile (two open-hem legs, 14 3/4" base) drawing itself on its side, with FlashDraft-style dimensions. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 170 235"
        className="hero-trace pointer-events-none absolute right-4 top-1/2 hidden w-[min(232px,16vw)] -translate-y-1/2 text-afs-chrome-mid min-[1400px]:block"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g stroke="var(--afs-crimson)" strokeWidth="2.25">
          <path className="ht-stroke ht-s1" pathLength="1" d="M49.0 16.8L40.7 13.3L39.3 16.5L130.0 55.0" />
          <path className="ht-stroke ht-s2" pathLength="1" d="M130.0 55.0L130.0 173.0" />
          <path className="ht-stroke ht-s3" pathLength="1" d="M130.0 173.0L40.3 214.8L41.8 218.0L49.9 214.2" />
        </g>
        <g stroke="var(--afs-crimson)" strokeWidth="1.5" className="ht-fade ht-j">
          <circle cx="50.4" cy="21.2" r="4" />
          <circle cx="51.2" cy="209.8" r="4" />
        </g>
        <g fill="var(--afs-crimson)" className="ht-fade ht-j">
          <circle cx="130.0" cy="55.0" r="3" />
          <circle cx="130.0" cy="173.0" r="3" />
        </g>
        <path className="ht-stroke ht-arc1" pathLength="1" stroke="var(--afs-crimson)" strokeWidth="1.25" d="M130.0 71.0A16 16 0 0 1 115.3 48.7" />
        <path className="ht-stroke ht-arc2" pathLength="1" stroke="var(--afs-crimson)" strokeWidth="1.25" d="M130.0 157.0A16 16 0 0 0 115.5 179.8" />
        <text className="ht-fade ht-t1 ht-lbl" x="122.0" y="118.0" textAnchor="end">{'14 3/4"'}</text>
        <text className="ht-fade ht-t2 ht-lbl" x="104.2" y="26.1" textAnchor="middle">{'10 13/16"'}</text>
        <text className="ht-fade ht-t2 ht-lbl" x="104.6" y="213.4" textAnchor="middle">{'10 7/8"'}</text>
        <text className="ht-fade ht-at1 ht-lbl" x="106.0" y="77.0" textAnchor="end" style={{ fontSize: 11 }}>{'113\u00B0'}</text>
        <text className="ht-fade ht-at2 ht-lbl" x="106.0" y="161.0" textAnchor="end" style={{ fontSize: 11 }}>{'115\u00B0'}</text>
        <text className="ht-fade ht-hk ht-lbl" x="168" y="9" textAnchor="end" style={{ fontSize: 9 }}>{'OPEN 7/16" GAP'}</text>
        <text className="ht-fade ht-hk ht-lbl" x="168" y="231" textAnchor="end" style={{ fontSize: 9 }}>{'OPEN 7/16" GAP'}</text>
      </svg>

      {/* ----------------------------------------------------------- COPY */}
      <div className="relative z-10 flex flex-col justify-center px-6 pb-14 pt-4 lg:ml-auto lg:min-h-[clamp(560px,82vh,860px)] lg:w-[42%] lg:px-12 lg:py-20 lg:px-16">
        <RevealOnScroll durationMs={600} staggerMs={120} className="max-w-lg">
          <h1 className="font-display uppercase leading-[0.95] text-afs-chrome-high text-[clamp(2.6rem,5.6vw,4.75rem)]">
            <span className="block">From Concept</span>
            <span className="block">To Delivery.</span>
            <span className="block">Fast.</span>
          </h1>

          <div className="mt-6 h-px w-16 bg-afs-crimson" aria-hidden="true" />

          <p className="mt-6 max-w-md font-body text-lg leading-relaxed text-afs-chrome-mid">
            From architectural drawings to finished metal. Engineered, fabricated and
            delivered by AFS.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4 lg:flex-col lg:items-start">
            <Link
              href="/quote"
              className="min-h-[48px] w-full rounded-sm bg-afs-crimson px-8 sm:w-auto lg:w-full lg:max-w-[19rem] py-3.5 text-center font-label text-sm font-semibold uppercase tracking-[0.14em] text-white metal-edge-red shadow-crimson transition-colors duration-200 hover:bg-afs-crimson-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start Your Project
            </Link>
            <Link
              href="/products"
              className="min-h-[48px] w-full rounded-sm bg-afs-chrome-silver sm:w-auto lg:w-full lg:max-w-[19rem] px-8 py-3.5 text-center font-label text-sm font-semibold uppercase tracking-[0.14em] text-afs-navy-950 shadow-lg transition-colors duration-200 hover:bg-afs-chrome-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View Our Work
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
