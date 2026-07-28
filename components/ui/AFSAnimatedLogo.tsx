'use client';

import { useEffect, useId, useRef, useState } from 'react';

// Web Audio API synthesis — no audio files. Exact spec supplied for the two
// sounds AFSAnimatedLogo plays: a metallic "clink" as each letter finishes
// drawing, and a brushed-metal "shimmer" under the shine sweep.
function synthesizeMetalClink(audioCtx: AudioContext, frequency: number, startTime: number) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, startTime + 0.08);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
  osc.start(startTime);
  osc.stop(startTime + 0.15);
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

const MUTED_STORAGE_KEY = 'afs-logo-muted';

function readStoredMuted(fallback: boolean): boolean {
  try {
    const stored = window.sessionStorage.getItem(MUTED_STORAGE_KEY);
    return stored === null ? fallback : stored === '1';
  } catch {
    return fallback;
  }
}

// Explicit-instruction literal hex/keyword values — same precedent as
// NavBar's `backgroundColor: '#C0001A'` active-pill style (CLAUDE.md rule
// #4, "explicit instruction" carve-out already used elsewhere in this
// codebase). The stroke color and shine-gradient stops were supplied
// verbatim by the prompt, not derived from the afs-* Tailwind token system.
const LOGO_STROKE = '#B8BFD0';
const LOGO_STROKE_TRANSPARENT = 'rgba(184, 191, 208, 0)';

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
  const gradientBaseId = useId().replace(/[:]/g, '');
  const [isMuted, setIsMuted] = useState(muted);
  const [playKey, setPlayKey] = useState(0);
  const unlockedRef = useRef(false);

  useEffect(() => {
    setIsMuted(readStoredMuted(muted));
    // Only read the stored override once, on mount — `muted` itself is a
    // default, not a controlled value this effect should keep re-syncing to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (unlockedRef.current) return;
    const unlock = () => {
      unlockedRef.current = true;
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // Fail silently — sound stays off, animation is unaffected.
        });
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!loop) return;
    const id = window.setInterval(() => setPlayKey((k) => k + 1), 1600);
    return () => window.clearInterval(id);
  }, [loop]);

  useEffect(() => {
    if (isMuted) return;
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      synthesizeMetalClink(ctx, 2100, t0 + 0.25);
      synthesizeMetalClink(ctx, 1900, t0 + 0.5);
      synthesizeMetalClink(ctx, 2300, t0 + 0.75);
      synthesizeShimmer(ctx, t0 + 0.8);
    } catch {
      // Fail silently — a blocked/closed AudioContext shouldn't break the
      // visual animation.
    }
  }, [playKey, isMuted]);

  const handleReplay = () => {
    if (!loop) setPlayKey((k) => k + 1);
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

  const gradientId = `afs-shine-${gradientBaseId}`;

  return (
    <div
      className={`relative inline-block ${className ?? ''}`}
      style={{ width, height }}
      onMouseEnter={handleReplay}
    >
      <svg
        key={playKey}
        width={width}
        height={height}
        viewBox="0 0 200 60"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="AFS — Architectural Flashing Supply"
      >
        <style>{`
          .afs-logo-a path, .afs-logo-f path, .afs-logo-s path {
            stroke: ${LOGO_STROKE};
            stroke-width: 3;
            stroke-linecap: round;
            fill: none;
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
          }
          .afs-logo-a path {
            animation: afs-logo-draw 0.25s ease-out 0s forwards,
                       afs-logo-fill 0.2s ease-out 0.25s forwards;
          }
          .afs-logo-f path {
            animation: afs-logo-draw 0.25s ease-out 0.25s forwards,
                       afs-logo-fill 0.2s ease-out 0.5s forwards;
          }
          .afs-logo-s path {
            animation: afs-logo-draw 0.25s ease-out 0.5s forwards,
                       afs-logo-fill 0.2s ease-out 0.75s forwards;
          }
          @keyframes afs-logo-draw {
            from { stroke-dashoffset: 1; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes afs-logo-fill {
            from { fill: ${LOGO_STROKE_TRANSPARENT}; }
            to { fill: ${LOGO_STROKE}; }
          }
        `}</style>

        <defs>
          <linearGradient id={gradientId}>
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="-2 0; 3 0"
              dur="0.4s"
              begin="0.8s"
              fill="freeze"
            />
          </linearGradient>
        </defs>

        <g className="afs-logo-a">
          <path pathLength={1} d="M32 8 L10 52" />
          <path pathLength={1} d="M32 8 L54 52" />
          <path pathLength={1} d="M18 35 L46 35" />
        </g>
        <g className="afs-logo-f">
          <path pathLength={1} d="M70 8 L70 52" />
          <path pathLength={1} d="M70 8 L108 8" />
          <path pathLength={1} d="M70 30 L100 30" />
        </g>
        <g className="afs-logo-s">
          <path
            pathLength={1}
            d="M172 16 C172 10 165 6 155 6 C140 6 128 12 128 22 C128 32 140 35 155 38 C168 41 174 46 174 54 C174 62 162 58 150 58 C138 58 128 54 128 48"
          />
        </g>

        <rect x="0" y="0" width="200" height="60" fill={`url(#${gradientId})`} pointerEvents="none" />
      </svg>

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
