'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import RevealOnScroll from './RevealOnScroll';

interface HailViewSectionProps {
  videoUrl?: string;
  webmUrl?: string;
  posterUrl?: string;
}

const ACTION_CLASS =
  'flex w-full items-center justify-center rounded border border-transparent bg-afs-crimson px-6 py-4 text-center font-label text-sm font-semibold tracking-wide text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover';

export default function HailViewSection({ videoUrl, webmUrl, posterUrl }: HailViewSectionProps) {
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
    <section className="relative w-full bg-black">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch md:grid-cols-2">
        <RevealOnScroll className="flex flex-col justify-center px-6 py-16 md:px-12 md:py-24">
          <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
            HailView&trade;
          </p>
          <h2 className="mt-3 font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl">
            Insurance replacement probability — engineered for metal roofing.
          </h2>
          <p className="mt-6 max-w-md font-body text-lg text-afs-chrome-mid">
            HailView analyzes hail size, verified strike proximity, storm intensity, roof location, metal type,
            gauge, and other damage variables to calculate the probability of an insurance-replacement outcome.
          </p>
          <p className="mt-4 max-w-md font-body text-base text-afs-chrome-mid">
            Not simply hail detection. Decision intelligence built for metal roofs and exterior building systems.
          </p>
        </RevealOnScroll>

        <div className="relative flex flex-col items-center justify-center gap-6 bg-afs-bg-dim px-6 py-12 md:px-12">
          <div className="relative aspect-[490/940] h-[70vh] max-h-[820px] w-auto overflow-hidden rounded">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              poster={posterUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            >
              {videoEnabled && webmUrl && <source src={webmUrl} type="video/webm" />}
              {videoEnabled && videoUrl && <source src={videoUrl} type="video/mp4" />}
            </video>
          </div>

          <div className="w-full max-w-sm">
            <p className="mb-4 text-center font-body text-sm text-afs-chrome-mid">
              See the confirmed hail dates near your property before you file, inspect, or estimate.
            </p>
            <Link href="/hailview" className={ACTION_CLASS}>
              Check My Address
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
