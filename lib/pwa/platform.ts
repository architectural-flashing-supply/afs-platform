'use client';

// Platform detection for the "Install Field App" button (2026-09-19
// revision pass, item 4). Pure functions, no React -- callable from an
// event handler at click-time rather than cached in state, since none of
// this changes during a session.

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as "MacIntel" with touch support -- the classic UA
  // sniff alone misses iPads entirely.
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// "Desktop/laptop (no touch / wide viewport)" per the spec -- a touch
// laptop at a narrow width still counts as mobile-like, but anything
// non-touch, or wide regardless of touch (e.g. a touch-screen desktop
// monitor), gets the QR modal instead of a camera-flow navigation.
export function isDesktopForInstall(): boolean {
  if (typeof window === 'undefined') return false;
  return !isTouchDevice() || window.matchMedia('(min-width: 1024px)').matches;
}
