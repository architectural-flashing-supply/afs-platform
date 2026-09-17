'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const HERO_LABEL_SWITCH_S = 10.5;

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
      <div className="grid min-h-[560px] grid-cols-1 items-stretch md:grid-cols-2">
        <div className="relative min-h-[320px] w-full overflow-hidden flex flex-col justify-center px-6 md:px-12">
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

          <div className="absolute bottom-6 left-6 z-10 rounded bg-afs-bg-dim/80 px-4 py-2 backdrop-blur-sm">
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
              {activeLabel === 'feed-bend' ? 'Feed + Bend' : 'Release'}
            </p>
          </div>

          <div className="relative z-20 max-w-sm">
            <h2 className="font-display text-3xl md:text-4xl leading-tight text-white drop-shadow-lg">
              Built for the<br />people who build.
            </h2>
          </div>
        </div>

        <div
          className="relative flex flex-col justify-center overflow-hidden bg-cover bg-center px-6 py-16 md:px-12 md:py-16"
          style={{ backgroundImage: "url('/images/blueprint.webp')" }}
        >
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
              Whether you're an architect, contractor, or GC — AFS handles unlimited
              custom profiles with proven speed and precision.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/quote"
                className="rounded bg-afs-crimson px-8 py-4 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
              >
                Start Your Project
              </Link>
              <Link
                href="/design-studio"
                className="rounded border-2 border-afs-chrome-high px-8 py-4 text-center font-label text-sm font-semibold text-afs-chrome-high transition-colors hover:bg-white/10"
              >
                View Our Work
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
