'use client';

import { useEffect, useRef, useState } from 'react';

// Web Audio API synthesis — no audio files. A metallic "clink" for each
// chrome bar slamming into place, and a brushed-metal "shimmer" under the
// finishing shine sweep.
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

// public/afs-logo.png's real pixel dimensions (DESIGN_TOKENS.md §9) — used
// to size the logo's own box so the chrome bars land flush against its
// actual edges instead of an outer box with mismatched aspect ratio.
const LOGO_NATURAL_ASPECT = 2404 / 1080;

// Explicit-instruction literal hex values — same precedent as NavBar's
// `backgroundColor: '#C0001A'` active-pill style (CLAUDE.md rule #4). This
// is a brushed-chrome bar gradient, not derived from a single afs-* token;
// each stop mirrors a real chrome-scale token (chrome-dim/silver/high).
const FRAME_GRADIENT =
  'linear-gradient(90deg, #7A8299 0%, #C8D0E0 35%, #FFFFFF 50%, #C8D0E0 65%, #7A8299 100%)';
const FRAME_THICKNESS = 4;

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
    const id = window.setInterval(() => setPlayKey((k) => k + 1), 1800);
    return () => window.clearInterval(id);
  }, [loop]);

  // Four bars slam in clockwise (top, right, bottom, left), each landing
  // with its own clink; a shimmer/shine caps the sequence once the frame
  // has closed around the logo.
  useEffect(() => {
    if (isMuted) return;
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      synthesizeMetalClink(ctx, 2100, t0 + 0.22);
      synthesizeMetalClink(ctx, 2300, t0 + 0.37);
      synthesizeMetalClink(ctx, 1900, t0 + 0.52);
      synthesizeMetalClink(ctx, 2000, t0 + 0.67);
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

  // Fit the logo's own natural aspect ratio inside the width/height box
  // (same math `object-contain` does) so the frame bars below are placed
  // against the logo's real rendered edges, not the outer box's edges.
  const outerAspect = width / height;
  const widthConstrained = LOGO_NATURAL_ASPECT > outerAspect;
  const boxWidth = widthConstrained ? width : height * LOGO_NATURAL_ASPECT;
  const boxHeight = widthConstrained ? width / LOGO_NATURAL_ASPECT : height;

  return (
    <div
      className={`relative inline-block ${className ?? ''}`}
      style={{ width, height }}
      onMouseEnter={handleReplay}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: boxWidth,
          height: boxHeight,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <style>{`
          @keyframes afs-bar-top-in {
            from { transform: translateY(-${FRAME_THICKNESS + 24}px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes afs-bar-bottom-in {
            from { transform: translateY(${FRAME_THICKNESS + 24}px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes afs-bar-left-in {
            from { transform: translateX(-${FRAME_THICKNESS + 24}px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes afs-bar-right-in {
            from { transform: translateX(${FRAME_THICKNESS + 24}px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .afs-logo-bar {
            position: absolute;
            background: ${FRAME_GRADIENT};
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
            animation-fill-mode: both;
            animation-duration: 0.22s;
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
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
            opacity: 0;
            animation: afs-logo-shine-sweep 0.4s ease-in-out 0.8s forwards,
                       afs-logo-shine-fade-in 0.4s linear 0.8s forwards;
            pointer-events: none;
          }
        `}</style>

        <img
          src="/afs-logo.png"
          alt="AFS — Architectural Flashing Supply"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />

        <div key={playKey}>
          <div
            className="afs-logo-bar"
            style={{
              top: -FRAME_THICKNESS,
              left: -FRAME_THICKNESS,
              right: -FRAME_THICKNESS,
              height: FRAME_THICKNESS,
              animationName: 'afs-bar-top-in',
              animationDelay: '0s',
            }}
          />
          <div
            className="afs-logo-bar"
            style={{
              bottom: -FRAME_THICKNESS,
              left: -FRAME_THICKNESS,
              right: -FRAME_THICKNESS,
              height: FRAME_THICKNESS,
              animationName: 'afs-bar-bottom-in',
              animationDelay: '0.3s',
            }}
          />
          <div
            className="afs-logo-bar"
            style={{
              left: -FRAME_THICKNESS,
              top: 0,
              bottom: 0,
              width: FRAME_THICKNESS,
              background: FRAME_GRADIENT.replace('90deg', '180deg'),
              animationName: 'afs-bar-left-in',
              animationDelay: '0.45s',
            }}
          />
          <div
            className="afs-logo-bar"
            style={{
              right: -FRAME_THICKNESS,
              top: 0,
              bottom: 0,
              width: FRAME_THICKNESS,
              background: FRAME_GRADIENT.replace('90deg', '180deg'),
              animationName: 'afs-bar-right-in',
              animationDelay: '0.15s',
            }}
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
