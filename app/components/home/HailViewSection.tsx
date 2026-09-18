'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface HailViewSectionProps {
  videoUrl?: string;
}

const ACTION_CLASS =
  'flex flex-1 items-center justify-center rounded border border-transparent bg-afs-crimson px-6 py-4 text-center font-label text-sm font-semibold tracking-wide text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover';

const SECONDARY_ACTION_CLASS =
  'flex flex-1 items-center justify-center rounded border-2 border-afs-chrome-high px-6 py-4 text-center font-label text-sm font-semibold tracking-wide text-afs-chrome-high transition-colors hover:bg-white/10';

export default function HailViewSection({ videoUrl }: HailViewSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  // DATA BLOCKER: no real hail-strike footage exists yet (see
  // CLAUDE.md's Data Blockers table). videoUrl is wired as a real prop so
  // dropping a file at that path later "just works" -- until then, or if
  // the source 404s, this falls back to a static storm-graphic panel
  // instead of a broken/blank video.
  const [videoFailed, setVideoFailed] = useState(!videoUrl);

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
    // videoEnabled gates whether the <video> is even in the DOM (see
    // showVideo below), so this must re-run once it mounts -- attaching
    // on [videoUrl] alone misses it, since that effect fires before the
    // element exists.
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const handleError = () => setVideoFailed(true);
    video.addEventListener('error', handleError);
    return () => video.removeEventListener('error', handleError);
  }, [videoUrl, videoEnabled]);

  const showVideo = videoEnabled && videoUrl && !videoFailed;

  return (
    <section className="relative w-full bg-black">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch md:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 md:px-12 md:py-24">
          <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
            HailView
          </p>
          <h2 className="mt-3 font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl">
            Hail Damages Metal Roofs. We Show You the Payout.
          </h2>
          <p className="mt-6 max-w-md font-body text-lg text-afs-chrome-mid">
            AFS cross-references real storm data against your address to score
            the likelihood your metal roof qualifies for a full insurance
            replacement -- before you file a claim.
          </p>
        </div>

        <div className="relative flex min-h-[420px] flex-col md:min-h-0">
          <div className="relative flex-1 overflow-hidden bg-afs-bg-dim">
            {showVideo ? (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-contain"
                src={videoUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,theme(colors.afs.bg-raised)_0%,theme(colors.afs.bg-dim)_100%)] px-6 text-center">
                <svg
                  className="h-16 w-16 text-afs-chrome-mid"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.5 15a4.5 4.5 0 0 1 .5-8.98A6 6 0 0 1 18.5 8.5 4 4 0 0 1 18 16.5H7a.5.5 0 0 1-.5-1.5Z"
                  />
                  <path strokeLinecap="round" d="M9 18.5 8 21M13 18.5l-1 2.5M17 18.5l-1 2.5" />
                </svg>
                <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-chrome-mid">
                  Storm footage coming soon
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 bg-afs-bg-dim p-6 sm:flex-row md:px-12 md:py-8">
            <Link href="/design-studio" className={ACTION_CLASS}>
              Start a Quote
            </Link>
            <Link href="/contact" className={SECONDARY_ACTION_CLASS}>
              Talk to AFS
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
