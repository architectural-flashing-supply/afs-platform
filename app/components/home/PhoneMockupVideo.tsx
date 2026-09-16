'use client';

import { useEffect, useRef, useState } from 'react';

// Extracted from FieldAppStory.tsx (hp-005) so HeroSection's new split-screen
// layout (hpd-004) can reuse the exact same phone-mockup video without a
// second copy of this autoplay/reduced-motion/intersection-observer logic.
// FieldAppStory itself is now text-only -- see that file's own comment.
const videoSources = {
  webm: '/videos/three-step-process.webm',
  mp4: '/videos/three-step-process.mp4',
};

export default function PhoneMockupVideo() {
  const wrapRef = useRef<HTMLDivElement>(null);
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

  // Same near-viewport gate as the original FieldAppStory -- now placed
  // inside the hero (above the fold), this observer simply fires immediately
  // on mount instead of waiting for a scroll, so the gate is a no-op there
  // without needing a separate code path.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="flex w-full justify-center">
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
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            {videoEnabled && (
              <>
                <source src={videoSources.webm} type="video/webm" />
                <source src={videoSources.mp4} type="video/mp4" />
              </>
            )}
          </video>
        </div>
      </div>
    </div>
  );
}
