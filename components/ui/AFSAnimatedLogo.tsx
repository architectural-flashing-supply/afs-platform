'use client';

import { useEffect, useState } from 'react';

// Web Audio API synthesis — no audio files. A tough metal "clang" (low
// thump + bright metallic ring + a sharp impact click) for each half of
// the real logo's chrome frame slamming into place, and a soft "shimmer"
// under the finishing shine.
function synthesizeMetalClang(audioCtx: AudioContext, frequency: number, startTime: number) {
  // Low thump — the weight of the impact.
  const thumpOsc = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thumpOsc.connect(thumpGain);
  thumpGain.connect(audioCtx.destination);
  thumpOsc.type = 'triangle';
  thumpOsc.frequency.setValueAtTime(frequency * 0.22, startTime);
  thumpOsc.frequency.exponentialRampToValueAtTime(frequency * 0.12, startTime + 0.18);
  thumpGain.gain.setValueAtTime(0, startTime);
  thumpGain.gain.linearRampToValueAtTime(0.5, startTime + 0.004);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
  thumpOsc.start(startTime);
  thumpOsc.stop(startTime + 0.25);

  // Metallic ring — layered on top, brighter and shorter.
  const ringOsc = audioCtx.createOscillator();
  const ringGain = audioCtx.createGain();
  ringOsc.connect(ringGain);
  ringGain.connect(audioCtx.destination);
  ringOsc.type = 'sine';
  ringOsc.frequency.setValueAtTime(frequency, startTime);
  ringOsc.frequency.exponentialRampToValueAtTime(frequency * 0.5, startTime + 0.1);
  ringGain.gain.setValueAtTime(0, startTime);
  ringGain.gain.linearRampToValueAtTime(0.22, startTime + 0.003);
  ringGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);
  ringOsc.start(startTime);
  ringOsc.stop(startTime + 0.16);

  // Sharp impact click — a brief filtered noise burst at the very onset.
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.02);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noiseSource = audioCtx.createBufferSource();
  const noiseFilter = audioCtx.createBiquadFilter();
  const noiseGain = audioCtx.createGain();
  noiseSource.buffer = buffer;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = frequency * 1.5;
  noiseFilter.Q.value = 1.2;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseGain.gain.setValueAtTime(0, startTime);
  noiseGain.gain.linearRampToValueAtTime(0.25, startTime + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.03);
  noiseSource.start(startTime);
}

function synthesizeShimmer(audioCtx: AudioContext, startTime: number) {
  const bufferSize = audioCtx.sampleRate * 0.04;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.08;
  }
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = 4000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);
  source.start(startTime);
}

// Lazily created on first user interaction (browsers block AudioContext
// output before a real gesture) and shared across every AFSAnimatedLogo
// instance on the page, so a second logo doesn't spawn a second context.
type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctor) return null;
    sharedAudioCtx = new Ctor();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// A hover (mouseenter) is never accepted by browsers as an audio-unlock
// gesture — only a real click/keypress is. This unlocks + resumes the
// context synchronously inside a real click handler, so there's at least
// one interaction on this component guaranteed to produce sound, not just
// "works after you happen to click something else first."
function unlockAudio(): void {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Fail silently — sound stays off, animation is unaffected.
    });
  }
}

const MUTED_STORAGE_KEY = 'afs-logo-muted';

function readStoredMuted(fallback: boolean): boolean {
  try {
    const stored = window.sessionStorage.getItem(MUTED_STORAGE_KEY);
    return stored === null ? fallback : stored === '1';
  } catch {
    return fallback;
  }
}

// public/afs-logo.png's REAL pixel dimensions, read directly from the
// file's PNG IHDR chunk (1536x1024) — DESIGN_TOKENS.md's "2404x1080"
// asset note is stale/wrong, do not trust it for this component.
const LOGO_NATURAL_ASPECT = 1536 / 1024;

// Polygons below trace the two halves of afs-logo.png's OWN existing
// chrome bevel band around "AFS" — found by decoding the PNG's raw pixel
// data (no image-editing tool available in this environment) and scanning
// rows for the dark inner panel that sits directly inside the frame, then
// adding a margin for the frame's outer edge. Points are [xPercent,
// yPercent] of the logo's own box. Deliberately generous on the outer
// edge and the inner/letter side: both the falling pieces and the static
// base are crops of the SAME source image, so a slight over-cut just
// re-reveals identical pixels once landed — the only real precision
// needed is enough overlap that no gap in the band goes uncovered.
const TOP_BAND: Array<[number, number]> = [
  [2, 46], [27, 10], [97, 7], [99, 40], [92, 42], [90, 20], [30, 16], [7, 47],
];
const BOTTOM_BAND: Array<[number, number]> = [
  [2, 52], [22, 68], [86, 74], [99, 45], [92, 47], [83, 66], [25, 65], [7, 53],
];

function toPolygon(points: Array<[number, number]>): string {
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

function toPathD(points: Array<[number, number]>, boxWidth: number, boxHeight: number): string {
  return (
    points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${((x / 100) * boxWidth).toFixed(1)} ${((y / 100) * boxHeight).toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

interface AFSAnimatedLogoProps {
  width?: number;
  height?: number;
  loop?: boolean;
  className?: string;
  muted?: boolean;
}

export default function AFSAnimatedLogo({
  width = 200,
  height = 60,
  loop = false,
  className,
  muted = false,
}: AFSAnimatedLogoProps) {
  const [isMuted, setIsMuted] = useState(muted);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    setIsMuted(readStoredMuted(muted));
    // Only read the stored override once, on mount — `muted` itself is a
    // default, not a controlled value this effect should keep re-syncing to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Bonus unlock: a click ANYWHERE on the page (nav links, buttons,
    // etc.) also counts, so a hover-replay after that has sound too.
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!loop) return;
    const id = window.setInterval(() => setPlayKey((k) => k + 1), 1800);
    return () => window.clearInterval(id);
  }, [loop]);

  // Top half lands first, bottom half a beat later, each with its own
  // clang; a shimmer caps it once the frame has closed.
  useEffect(() => {
    if (isMuted) return;
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      synthesizeMetalClang(ctx, 180, t0 + 0.3);
      synthesizeMetalClang(ctx, 150, t0 + 0.5);
      synthesizeShimmer(ctx, t0 + 0.7);
    } catch {
      // Fail silently — a blocked/closed AudioContext shouldn't break the
      // visual animation.
    }
  }, [playKey, isMuted]);

  const replay = () => {
    if (!loop) setPlayKey((k) => k + 1);
  };

  const handleClick = () => {
    unlockAudio();
    replay();
  };

  const toggleMuted = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(MUTED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Storage unavailable (private browsing, etc.) — mute still applies
        // for this page view.
      }
      return next;
    });
  };

  // Fit the logo's own natural aspect ratio inside the width/height box
  // (same math `object-contain` does) so the two frame pieces below land
  // against the logo's real rendered edges, not the outer box's edges.
  const outerAspect = width / height;
  const widthConstrained = LOGO_NATURAL_ASPECT > outerAspect;
  const boxWidth = widthConstrained ? width : height * LOGO_NATURAL_ASPECT;
  const boxHeight = widthConstrained ? width / LOGO_NATURAL_ASPECT : height;

  const baseClipPath = `path(evenodd, "M 0 0 L ${boxWidth.toFixed(1)} 0 L ${boxWidth.toFixed(1)} ${boxHeight.toFixed(1)} L 0 ${boxHeight.toFixed(1)} Z ${toPathD(TOP_BAND, boxWidth, boxHeight)} ${toPathD(BOTTOM_BAND, boxWidth, boxHeight)}")`;

  return (
    <div
      className={`relative inline-block ${className ?? ''}`}
      style={{ width, height }}
      onMouseEnter={replay}
      onClick={handleClick}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: boxWidth,
          height: boxHeight,
          transform: 'translate(-50%, -50%)',
          cursor: 'pointer',
        }}
      >
        <style>{`
          @keyframes afs-band-fall {
            from { transform: translateY(-70px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .afs-logo-band {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            animation-name: afs-band-fall;
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
            animation-fill-mode: both;
            animation-duration: 0.3s;
          }
          @keyframes afs-logo-shine-sweep {
            from { transform: translateX(-120%) skewX(-12deg); }
            to { transform: translateX(220%) skewX(-12deg); }
          }
          @keyframes afs-logo-shine-fade-in {
            0%, 79% { opacity: 0; }
            80% { opacity: 1; }
            100% { opacity: 1; }
          }
          .afs-logo-shine {
            position: absolute;
            top: 0;
            left: 0;
            width: 40%;
            height: 100%;
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%);
            opacity: 0;
            animation: afs-logo-shine-sweep 0.4s ease-in-out 0.7s forwards,
                       afs-logo-shine-fade-in 0.4s linear 0.7s forwards;
            pointer-events: none;
          }
        `}</style>

        {/* Static base: the real logo, minus the two chrome-band regions
            (evenodd hole) — always visible immediately. */}
        <img
          src="/afs-logo.png"
          alt="AFS — Architectural Flashing Supply"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            clipPath: baseClipPath,
          }}
        />

        <div key={playKey}>
          {/* Top half of the logo's own chrome band, falling in. */}
          <img
            src="/afs-logo.png"
            alt=""
            aria-hidden="true"
            className="afs-logo-band"
            style={{ objectFit: 'contain', clipPath: toPolygon(TOP_BAND), animationDelay: '0s' }}
          />
          {/* Bottom half, falling in a beat later. */}
          <img
            src="/afs-logo.png"
            alt=""
            aria-hidden="true"
            className="afs-logo-band"
            style={{ objectFit: 'contain', clipPath: toPolygon(BOTTOM_BAND), animationDelay: '0.2s' }}
          />

          <div className="afs-logo-shine" />
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleMuted();
        }}
        aria-label={isMuted ? 'Unmute logo sound' : 'Mute logo sound'}
        className="absolute bottom-0 right-0 text-[10px] leading-none opacity-40 hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer p-0.5"
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
