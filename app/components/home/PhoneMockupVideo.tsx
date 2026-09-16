'use client';

import { useEffect, useRef, useState } from 'react';

// Phone-mockup video used by FieldAppStory's below-the-fold "Photo to Quote"
// section, kept as its own component for its autoplay/reduced-motion/
// intersection-observer logic.
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

  // Defers loading the video source until the component nears the viewport,
  // since this section renders below the fold.
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
            // object-contain (not object-cover): the source footage is
            // 1920x1080 (16:9 landscape), while this phone screen is
            // roughly 9:19.5 (portrait) -- object-cover was scaling the
            // landscape video up to fill that much taller/narrower frame,
            // cropping most of the width away and reading as an extreme,
            // disorienting zoom. object-contain shows the whole frame,
            // letterboxed against the screen's own bg-afs-bg-dim above and
            // below, rather than an unrecognizable crop.
            className="absolute inset-0 h-full w-full object-contain"
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
