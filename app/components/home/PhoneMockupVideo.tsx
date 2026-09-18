'use client';

import { useEffect, useRef, useState } from 'react';

// Phone-mockup video used by FieldAppStory's below-the-fold "Photo to Quote"
// section, kept as its own component for its autoplay/reduced-motion/
// intersection-observer logic.
//
// field-app.mp4/webm: Reid's real ~6s handheld field clip (source: "hp 1.mp4",
// a Pixel 10 Pro shot of himself photographing a hand-drawn flashing sketch
// with his phone -- casual and shaky on purpose, left as shot). The source
// file is stored landscape (1920x1080) with a -90 deg rotation flag in its
// display matrix -- browsers are inconsistent about honoring that metadata
// for playback (this is what actually caused the long-standing "notch
// upside down" / not-filling-the-frame bug: earlier passes kept adjusting
// this component's CSS, but the actual defect was in the source file, not
// the layout). Re-encoded once via ffmpeg with the rotation physically
// baked into the pixels (`-vf scale=1080:1920`, matching ffprobe's own
// auto-rotate behavior) into a real, upright, rotation-metadata-free
// 1080x1920 (9:16) file -- so it matches this frame's own aspect exactly
// (see the frame div below) and object-cover has zero crop to do, no
// letterboxing, no scaling down.
const videoSources = {
  webm: '/videos/field-app.webm',
  mp4: '/videos/field-app.mp4',
};

// This is now one continuous ~6s clip (not three distinct staged shots),
// so this just divides it into three equal highlight windows for the STEPS
// list in FieldAppStory.tsx -- it's decorative pacing, not a claim that the
// video visually depicts each step.
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
      {/* CSS-only phone device frame -- no third-party image asset. No
          padding between the border and the video (a previous p-2 bezel +
          separate inner rounded div left a visible gap all the way around
          the video, reading as a small box floating inside the frame) --
          the border itself is the only thing between the video and the
          frame edge, and overflow-hidden clips the video to the same
          rounded corners as the border. */}
      <div className="relative aspect-[9/16] w-[360px] overflow-hidden rounded-[2.5rem] border-[6px] border-afs-bg-overlay bg-afs-bg-dim shadow-raised metal-edge">
        {/* Camera notch -- top, matching a real device's front camera
            cutout. */}
        <div className="absolute left-1/2 top-3 z-10 h-[6px] w-[70px] -translate-x-1/2 rounded-full bg-afs-bg-dim" />
        {/* Home indicator -- bottom, thin bar. Over the light background of
            this video's footage (paper/desk), afs-bg-dim would nearly
            vanish, so this one is a translucent white to stay legible
            against either a light or dark frame. */}
        <div className="absolute bottom-2 left-1/2 z-10 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-white/70" />
        <video
          ref={videoRef}
          // object-cover is safe here (no crop trade-off): field-app.mp4's
          // own canvas (1080x1920) is rendered at this exact 9:16 aspect,
          // so there's nothing left to crop.
          className="absolute inset-0 h-full w-full object-cover"
          poster="/images/field-app-poster.jpg"
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
  );
}
