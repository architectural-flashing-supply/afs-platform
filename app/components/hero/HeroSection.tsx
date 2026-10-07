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

      {/* ------------------------------------------------ BLUEPRINT (mood) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[46vh] bg-cover bg-center opacity-[0.13] lg:inset-y-0 lg:left-auto lg:right-0 lg:top-0 lg:w-[50%]"
        style={{
          backgroundImage: "url('/images/blueprint.webp')",
          WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 100% 100%, black 0%, transparent 72%)',
          maskImage: 'radial-gradient(ellipse 85% 75% at 100% 100%, black 0%, transparent 72%)',
        }}
      />
      {/* Faint depth: slight vignette so the type field feels lit from the video side. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,transparent_40%,theme(colors.afs.navy-950/60%)_100%)]"
      />

      {/* A FlashDraft-style drawing that draws itself: crimson profile, ink dimensions. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="12 0 316 230"
        className="hero-trace pointer-events-none absolute bottom-8 left-[40%] hidden w-[min(280px,21vw)] lg:block"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className="ht-fade ht-panel">
          <rect x="12" y="0" width="316" height="230" rx="4" fill="var(--ht-bg)" fillOpacity="0.88" />
          <path
            d="M0 23H360M0 46H360M0 69H360M0 92H360M0 115H360M0 138H360M0 161H360M0 184H360M0 207H360M30 0V230M60 0V230M90 0V230M120 0V230M150 0V230M180 0V230M210 0V230M240 0V230M270 0V230M300 0V230M330 0V230"
            stroke="var(--ht-grid)"
            strokeWidth="1"
          />
        </g>
        <g stroke="var(--ht-red)" strokeWidth="2.25">
          <path className="ht-stroke ht-s1" pathLength="1" d="M70 168V86" />
          <path className="ht-stroke ht-s2" pathLength="1" d="M70 86H250" />
          <path className="ht-stroke ht-s3" pathLength="1" d="M250 86V168" />
          <path className="ht-stroke ht-hem" pathLength="1" d="M250 168C250 184 270 184 270 170" />
        </g>
        <g fill="var(--ht-red)" className="ht-fade ht-j">
          <circle cx="70" cy="168" r="3.5" />
          <circle cx="70" cy="86" r="3.5" />
          <circle cx="250" cy="86" r="3.5" />
          <circle cx="250" cy="168" r="3.5" />
        </g>
        <g stroke="var(--ht-ink)" strokeWidth="1">
          <path className="ht-stroke ht-d1" pathLength="1" d="M70 62H250M70 56V68M250 56V68" />
          <path className="ht-stroke ht-d2" pathLength="1" d="M42 86V168M36 86H48M36 168H48" />
          <path className="ht-stroke ht-d3" pathLength="1" d="M286 86V168M280 86H292M280 168H292" />
        </g>
        <path className="ht-stroke ht-arc" pathLength="1" stroke="var(--ht-red)" strokeWidth="1.25" d="M250 112A26 26 0 0 0 224 86" />
        <text className="ht-fade ht-t1 ht-lbl" x="160" y="52" textAnchor="middle">{'8 1/2"'}</text>
        <text className="ht-fade ht-t2 ht-lbl" x="28" y="131" textAnchor="middle" transform="rotate(-90 28 131)">{'4 1/2"'}</text>
        <text className="ht-fade ht-t3 ht-lbl" x="304" y="131" textAnchor="middle" transform="rotate(90 304 131)">{'3 3/4"'}</text>
        <text className="ht-fade ht-arct ht-lbl" x="211" y="116" textAnchor="middle">{'90\u00B0'}</text>
        <text className="ht-fade ht-tag ht-lbl" x="18" y="214" style={{ fontSize: 9, letterSpacing: '0.08em' }}>
          {'FLASHDRAFT  \u00B7  1/2" HEM  \u00B7  .032 ALUM'}
        </text>
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
              href="/design-studio"
              className="min-h-[48px] w-full rounded-sm border border-white/40 sm:w-auto lg:w-full lg:max-w-[19rem] bg-white/[0.04] px-8 py-3.5 text-center font-label text-sm font-semibold uppercase tracking-[0.14em] text-afs-chrome-high transition-colors duration-200 hover:border-white/70 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View Our Work
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
