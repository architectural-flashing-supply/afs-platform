'use client';

import { useEffect, useRef, useState } from 'react';
import RevealOnScroll from './RevealOnScroll';

// Proof stats sourced from governance docs, not invented:
// - 9 materials (2026-09-19 revision pass, item 8): lib/data/catalog.ts's
//   real ALL_MATERIALS/GAUGES_BY_MATERIAL catalog -- Galvanized Steel,
//   Galvanized Galvalume, Copper, Lead Coated Copper, Anodized Aluminum,
//   Stainless Steel, Zinc, Kynar 500 (Painted Steel), Vintage Steel. The
//   prior "5" was CLAUDE.md's older, simplified fabrication list, not the
//   full catalog this site's own configurator actually offers.
// - "Custom Profiles" (not a profile count): the 25-entry canonical_profiles
//   catalog (SCHEMA.md's CANONICAL PROFILE LIBRARY TABLE) is a starter
//   library, not a ceiling -- FlashDraft draws any custom geometry, so
//   leading with a specific number undersold that. The private
//   machine_profiles shop job history (911 profiles, only 70 public) is
//   real customer project data and still not for site copy either way.
// - Nationwide delivery: lib/chatbot/knowledge/afs-company.ts's
//   company-service-area entry -- "ships nationwide within North America."
const STATS = [
  { value: '9', label: 'Materials Fabricated' },
  { value: 'Unlimited', label: 'Custom Profiles' },
  { value: 'Nationwide', label: 'Delivery Footprint' },
] as const;

export default function ShopFloorProof() {
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

  // Below-the-fold section -- defer attaching the video <source> tags
  // (below) until it scrolls near the viewport so this byte download never
  // competes with the hero's LCP poster or other above-the-fold requests.
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

  return (
    <section ref={sectionRef} className="relative min-h-[60svh] w-full overflow-hidden bg-afs-bg-dim">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster="/images/shop-floor-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        {/* Sources are only attached once mounted and reduced-motion has been
            checked, so the poster is always what paints first -- with
            reduced motion the video never gets a source and the poster is
            the only thing that ever renders. */}
        {videoEnabled && (
          <>
            <source src="/videos/shop-floor-loop.webm" type="video/webm" />
            <source src="/videos/shop-floor-loop.mp4" type="video/mp4" />
          </>
        )}
      </video>

      <div className="absolute inset-0 bg-afs-bg-dim/70" />

      <div className="relative z-10 mx-auto flex min-h-[60svh] max-w-6xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <div>
          <h2 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
            Where precision meets production
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-body text-lg text-afs-chrome-mid md:text-xl">
            Fabricated in Burnet, Texas, and shipped nationwide across North
            America.
          </p>
        </div>

        <RevealOnScroll as="dl" className="grid w-full max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <dt className="order-2 mt-2 font-label text-xs font-medium uppercase tracking-widest text-afs-chrome-mid">
                {stat.label}
              </dt>
              <dd className="order-1 font-display text-5xl leading-none text-afs-chrome-high md:text-6xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </RevealOnScroll>
      </div>
    </section>
  );
}
