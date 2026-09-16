'use client';

import { useEffect, useRef, useState } from 'react';

// Phone-mockup video used by FieldAppStory's below-the-fold "Photo to Quote"
// section, kept as its own component for its autoplay/reduced-motion/
// intersection-observer logic.
//
// -portrait variants (not the original 1920x1080 landscape three-step-
// process.mp4/.webm): a blurred, scaled-up copy of the same footage fills
// the portrait canvas behind a full, uncropped, centered copy of the
// original frame -- built once via ffmpeg (split -> one branch scale+crop+
// blur+darken to cover the canvas, the other branch scale to fit the canvas
// with no crop, overlaid centered). This was the only way to show the full
// frame (the person's hand and phone are outside the video's own centered
// safe area, and the FlashDraft-canvas segment's diagram sits left-of-
// center) inside a portrait phone screen without either cropping content
// out (object-cover) or leaving big empty letterbox bars (object-contain)
// -- both were tried in prior passes and neither actually solved it.
const videoSources = {
  webm: '/videos/three-step-process-portrait.webm',
  mp4: '/videos/three-step-process-portrait.mp4',
};

// Segment boundaries in the concatenated 6s source -- see
// FieldAppStory.tsx's STEPS array; each 2s segment corresponds to one step.
const STEP_DURATION_S = 2;

export default function PhoneMockupVideo({
  onActiveStepChange,
}: {
  onActiveStepChange?: (step: number) => void;
}) {
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

  useEffect(() => {
    if (!onActiveStepChange) return;
    const video = videoRef.current;
    if (!video) return;

    let lastStep = -1;
    const handleTimeUpdate = () => {
      const step = Math.min(2, Math.floor(video.currentTime / STEP_DURATION_S));
      if (step !== lastStep) {
        lastStep = step;
        onActiveStepChange(step);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [onActiveStepChange]);

  return (
    <div ref={wrapRef} className="flex w-full justify-center">
      {/* CSS-only phone device frame -- no third-party image asset */}
      <div className="relative aspect-[9/19.5] w-[260px] rounded-[2.5rem] border-[6px] border-afs-bg-overlay bg-afs-bg-dim p-2 shadow-raised metal-edge">
        <div className="absolute left-1/2 top-3 z-10 h-[6px] w-[70px] -translate-x-1/2 rounded-full bg-afs-bg-dim" />
        <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-afs-bg-dim">
          <video
            ref={videoRef}
            // object-cover is safe here (no crop trade-off): the -portrait
            // source's own canvas aspect already matches this frame almost
            // exactly (1080x2340 vs. this container's 9:19.5), so there's
            // nothing left to crop.
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
