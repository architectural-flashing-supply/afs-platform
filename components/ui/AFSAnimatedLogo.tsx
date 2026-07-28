'use client';

import { useEffect, useState } from 'react';

// Web Audio API synthesis — no audio files. A tough metal "clang" (low
// thump + bright metallic ring + a sharp impact click) for each of the
// real logo's chrome frame pieces slamming into place.
function synthesizeMetalClang(audioCtx: AudioContext, impactFrequency: number, startTime: number) {
  // Low thump — the weight of the impact. Kept in the ~90-140Hz range
  // (not the ~35-45Hz a naive "low" multiplier lands on) because most
  // laptop/phone speakers roll off steeply below ~100Hz and would render
  // anything lower essentially silent.
  const thumpOsc = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thumpOsc.connect(thumpGain);
  thumpGain.connect(audioCtx.destination);
  thumpOsc.type = 'triangle';
  thumpOsc.frequency.setValueAtTime(impactFrequency, startTime);
  thumpOsc.frequency.exponentialRampToValueAtTime(impactFrequency * 0.6, startTime + 0.15);
  thumpGain.gain.setValueAtTime(0, startTime);
  thumpGain.gain.linearRampToValueAtTime(0.85, startTime + 0.004);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
  thumpOsc.start(startTime);
  thumpOsc.stop(startTime + 0.3);

  // Metallic ring — a bright present-midrange partial, not a thin high
  // whistle, layered on top of the thump.
  const ringOsc = audioCtx.createOscillator();
  const ringGain = audioCtx.createGain();
  ringOsc.connect(ringGain);
  ringGain.connect(audioCtx.destination);
  ringOsc.type = 'sine';
  ringOsc.frequency.setValueAtTime(impactFrequency * 3.2, startTime);
  ringOsc.frequency.exponentialRampToValueAtTime(impactFrequency * 1.6, startTime + 0.12);
  ringGain.gain.setValueAtTime(0, startTime);
  ringGain.gain.linearRampToValueAtTime(0.4, startTime + 0.003);
  ringGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
  ringOsc.start(startTime);
  ringOsc.stop(startTime + 0.22);

  // Sharp impact click — a brief, bright filtered noise burst at the
  // onset for the "metal on metal" snap.
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
  noiseFilter.frequency.value = impactFrequency * 8;
  noiseFilter.Q.value = 0.9;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseGain.gain.setValueAtTime(0, startTime);
  noiseGain.gain.linearRampToValueAtTime(0.45, startTime + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);
  noiseSource.start(startTime);
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

// public/afs-logo.png's REAL pixel dimensions, read directly from the
// file's PNG IHDR chunk (1536x1024) — DESIGN_TOKENS.md's "2404x1080"
// asset note is stale/wrong, do not trust it for this component.
const LOGO_NATURAL_ASPECT = 1536 / 1024;

// Five pieces traced from afs-logo.png's OWN existing chrome bevel band
// around "AFS" — found by decoding the PNG's raw pixel data (no image-
// editing tool available in this environment) and scanning rows/columns
// for the frame's dark inner panel and, separately, the distinct
// brushed-chrome underline bar sitting between the frame and
// "ARCHITECTURAL" (confirmed as its own contiguous gray band, y=63.5-
// 73%, independent of the frame above it). The top and bottom halves of
// the main frame are each further bisected at their x=50% crossing so
// every quadrant plus the underline lands as its own piece. Points are
// [xPercent, yPercent] of the logo's own box. Deliberately generous on
// outer edges and inner/letter sides: every piece and the static base
// are crops of the SAME source image, so a slight over-cut just
// re-reveals identical pixels once landed.
const BAND_PIECES: Array<{ points: Array<[number, number]>; clangFrequency: number }> = [
  {
    // top-left
    points: [[2, 46], [27, 10], [50, 9], [50, 17.3], [30, 16], [7, 47]],
    clangFrequency: 130,
  },
  {
    // top-right
    points: [[50, 9], [97, 7], [99, 40], [92, 42], [90, 20], [50, 17.3]],
    clangFrequency: 140,
  },
  {
    // bottom-right
    points: [[50, 62.9], [85, 64], [99, 45], [92, 47], [83, 63], [50, 61.9]],
    clangFrequency: 115,
  },
  {
    // bottom-left
    points: [[2, 52], [20, 62], [50, 62.9], [50, 61.9], [24, 61], [7, 53]],
    clangFrequency: 110,
  },
  {
    // underline bar, below the frame, above "ARCHITECTURAL"
    points: [[14, 65], [87, 63], [89, 73], [12, 75]],
    clangFrequency: 120,
  },
];
const FALL_STAGGER_S = 0.25;
const FALL_DURATION_S = 0.3;

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
  width = 176,
  height = 117,
  loop = false,
  className,
  muted = false,
}: AFSAnimatedLogoProps) {
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    // Best-effort: try to unlock audio the instant this mounts, so sound
    // plays on page load if the browser allows it (e.g. Chrome grants
    // autoplay audio after enough prior engagement with the site). Most
    // fresh, first-ever visits will still be silently blocked by browser
    // autoplay policy no matter what code runs — no page can override
    // that — so the click/keydown unlock below remains the guaranteed path.
    unlockAudio();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!loop) return;
    const id = window.setInterval(() => setPlayKey((k) => k + 1), 3200);
    return () => window.clearInterval(id);
  }, [loop]);

  // Each piece lands in sequence, one at a time, its own clang firing the
  // instant it lands.
  useEffect(() => {
    if (muted) return;
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      BAND_PIECES.forEach((piece, i) => {
        synthesizeMetalClang(ctx, piece.clangFrequency, t0 + i * FALL_STAGGER_S + FALL_DURATION_S);
      });
    } catch {
      // Fail silently — a blocked/closed AudioContext shouldn't break the
      // visual animation.
    }
  }, [playKey, muted]);

  const replay = () => {
    if (!loop) setPlayKey((k) => k + 1);
  };

  const handleClick = () => {
    unlockAudio();
    replay();
  };

  // Fit the logo's own natural aspect ratio inside the width/height box
  // (same math `object-contain` does) so the five frame pieces below land
  // against the logo's real rendered edges, not the outer box's edges.
  const outerAspect = width / height;
  const widthConstrained = LOGO_NATURAL_ASPECT > outerAspect;
  const boxWidth = widthConstrained ? width : height * LOGO_NATURAL_ASPECT;
  const boxHeight = widthConstrained ? width / LOGO_NATURAL_ASPECT : height;

  const holeSubpaths = BAND_PIECES.map((piece) => toPathD(piece.points, boxWidth, boxHeight)).join(' ');
  const baseClipPath = `path(evenodd, "M 0 0 L ${boxWidth.toFixed(1)} 0 L ${boxWidth.toFixed(1)} ${boxHeight.toFixed(1)} L 0 ${boxHeight.toFixed(1)} Z ${holeSubpaths}")`;

  const smokeDelay = BAND_PIECES.length * FALL_STAGGER_S + FALL_DURATION_S;

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
            animation-duration: ${FALL_DURATION_S}s;
          }
          @keyframes afs-smoke-puff {
            0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
            25% { opacity: 0.55; }
            100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
          }
          .afs-smoke-puff {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 26%;
            height: 26%;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(210,212,218,0.85) 0%, rgba(210,212,218,0.4) 45%, rgba(210,212,218,0) 75%);
            filter: blur(1.5px);
            opacity: 0;
            animation: afs-smoke-puff 0.7s ease-out both;
            pointer-events: none;
          }
        `}</style>

        {/* Static base: the real logo, minus the five chrome-piece
            regions (evenodd hole) — always visible immediately. */}
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
          {BAND_PIECES.map((piece, i) => (
            <img
              key={i}
              src="/afs-logo.png"
              alt=""
              aria-hidden="true"
              className="afs-logo-band"
              style={{
                objectFit: 'contain',
                clipPath: toPolygon(piece.points),
                animationDelay: `${i * FALL_STAGGER_S}s`,
              }}
            />
          ))}

          {/* Puff of smoke once every piece has landed. Five staggered
              circles, not one, for a slightly organic burst rather than a
              single perfect ring. */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="afs-smoke-puff"
              style={{
                animationDelay: `${smokeDelay + i * 0.03}s`,
                marginLeft: `${(i - 2) * 4}%`,
                marginTop: `${(i % 2 === 0 ? -1 : 1) * 3}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
