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
            // object-cover (not object-contain): a follow-up pass explicitly
            // asked for the video to fill the phone screen edge-to-edge --
            // object-contain's letterboxing (source is 1920x1080 landscape,
            // this screen is ~9:19.5 portrait) read as "tiny" with most of
            // the frame empty. This does crop the sides of the landscape
            // source to fill the portrait screen -- a real trade-off,
            // reverting the object-contain fix from a prior pass -- but
            // it's what that pass's spec explicitly called for.
            //
            // object-[25%_center] (not the object-cover default of center
            // center): the video's actual subjects sit left-of-center in
            // frame in all 3 concatenated segments (verified by extracting
            // and inspecting frames) -- a dead-center crop shows blank
            // background for the sketch-photo and FlashDraft-canvas
            // segments (the canvas segment's crop was 100% empty grid, no
            // diagram visible at all) and clips most of the worker in the
            // shop-floor segment. 25% keeps each segment's real subject in
            // frame instead of empty background.
            className="absolute inset-0 h-full w-full object-cover object-[25%_center]"
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
