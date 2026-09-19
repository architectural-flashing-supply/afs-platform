'use client';

import { useEffect, useRef, useState } from 'react';

// Phone-mockup video used by FieldAppStory's below-the-fold "Photo to Quote"
// section, kept as its own component for its autoplay/reduced-motion/
// intersection-observer logic.
//
// 2026-09-19 revision: converted from a single continuous clip into a real
// 3-clip sequential playlist, one clip per step (previously one clip
// divided into three decorative time-windows -- see git history). All
// three source files are pre-rendered to this frame's own 9:16 (1080x1920)
// display aspect already (field-app.mp4's own comment below still applies
// to clip 1; field-step-2/3 were supplied already matching it) -- never
// re-cropped or scaled in CSS, just object-cover with zero crop to do.
//
// field-app.mp4/webm (clip 1): Reid's real ~6s handheld field clip (source:
// "hp 1.mp4", a Pixel 10 Pro shot of himself photographing a hand-drawn
// flashing sketch with his phone -- casual and shaky on purpose, left as
// shot). The source file was stored landscape (1920x1080) with a -90 deg
// rotation flag in its display matrix -- browsers are inconsistent about
// honoring that metadata for playback (this is what actually caused the
// long-standing "notch upside down" / not-filling-the-frame bug: earlier
// passes kept adjusting this component's CSS, but the actual defect was in
// the source file, not the layout). Re-encoded once via ffmpeg with the
// rotation physically baked into the pixels, into a real, upright,
// rotation-metadata-free 1080x1920 file.
interface Clip {
  webm: string;
  mp4: string;
  poster: string;
}

const CLIPS: Clip[] = [
  { webm: '/videos/field-app.webm', mp4: '/videos/field-app.mp4', poster: '/images/field-app-poster.jpg' },
  {
    webm: '/videos/field-step-2.webm',
    mp4: '/videos/field-step-2.mp4',
    poster: '/images/field-step-2-poster.jpg',
  },
  {
    webm: '/videos/field-step-3.webm',
    mp4: '/videos/field-step-3.mp4',
    poster: '/images/field-step-3-poster.jpg',
  },
];

export default function PhoneMockupVideo({
  onActiveStepChange,
}: {
  onActiveStepChange?: (step: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null]);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeClip, setActiveClip] = useState(0);
  const videoEnabled = isNearViewport && !reducedMotion;

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyPreference = (reduceMotion: boolean) => {
      setReducedMotion(reduceMotion);
      if (reduceMotion) videoRefs.current.forEach((v) => v?.pause());
    };

    applyPreference(motionQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => applyPreference(e.matches);
    motionQuery.addEventListener('change', handleChange);
    return () => motionQuery.removeEventListener('change', handleChange);
  }, []);

  // Defers loading the video sources until the component nears the viewport,
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

  // Drives both the initial kick-off (videoEnabled false -> true, activeClip
  // still 0) and every subsequent clip advance: play the active clip from
  // its own start, pause the rest. All three <video> elements are always
  // mounted with real sources once videoEnabled (see JSX below), so the
  // next clip is already buffering during the current one's playback --
  // "preload the next clip" is satisfied by never tearing sources down
  // between clips, not by a separate preload step.
  useEffect(() => {
    if (!videoEnabled) return;
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeClip) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeClip, videoEnabled]);

  useEffect(() => {
    onActiveStepChange?.(activeClip);
  }, [activeClip, onActiveStepChange]);

  const handleEnded = (i: number) => {
    if (i !== activeClip) return; // stray event guard -- only the active clip actually plays
    setActiveClip((c) => (c + 1) % CLIPS.length);
  };

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

        {/* All three clips stacked, always mounted once enabled -- only
            opacity differs, so switching the active clip crossfades
            (transition-opacity) instead of ever showing a black frame. */}
        {CLIPS.map((clip, i) => (
          <video
            key={clip.mp4}
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            // object-cover is safe here (no crop trade-off): every clip's
            // own canvas is rendered at this exact 9:16 aspect already, so
            // there's nothing left to crop -- no scale transforms, no
            // shrunken renditions.
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${
              activeClip === i ? 'opacity-100' : 'opacity-0'
            }`}
            poster={clip.poster}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onEnded={() => handleEnded(i)}
          >
            {videoEnabled && (
              <>
                <source src={clip.webm} type="video/webm" />
                <source src={clip.mp4} type="video/mp4" />
              </>
            )}
          </video>
        ))}
      </div>
    </div>
  );
}
