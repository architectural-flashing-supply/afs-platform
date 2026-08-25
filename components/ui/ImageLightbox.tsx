'use client';

import { useEffect, useRef, useState } from 'react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SCALE_STEP = 0.35;

/**
 * Full-viewport, zoomable/pannable image viewer — for inspecting fine detail
 * (a hand-drawn dimension, a damaged seam, small text) in a source photo or
 * drawing at full resolution. components/ui/Modal.tsx is a small fixed-size
 * dialog and deliberately not reused here; this needs the whole viewport.
 * Scale 1 shows the image at native resolution capped only by the viewport
 * (never upscaled); scroll/pinch or the +/- controls zoom in further, and
 * the image pans by dragging once zoomed past scale 1.
 */
export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(MIN_SCALE);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev - e.deltaY * 0.0015)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (scale <= MIN_SCALE || !containerRef.current) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
    setDragging(true);
    containerRef.current.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !containerRef.current) return;
    containerRef.current.scrollLeft = dragRef.current.scrollLeft - (e.clientX - dragRef.current.startX);
    containerRef.current.scrollTop = dragRef.current.scrollTop - (e.clientY - dragRef.current.startY);
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-end gap-2 p-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="font-label text-lg text-white bg-white/10 hover:bg-white/20 rounded w-9 h-9 disabled:opacity-30"
        >
          −
        </button>
        <span className="font-data text-xs text-white/70 w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="font-label text-lg text-white bg-white/10 hover:bg-white/20 rounded w-9 h-9 disabled:opacity-30"
        >
          +
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="font-label text-sm text-white bg-white/10 hover:bg-white/20 rounded px-4 py-2 ml-2"
        >
          Close ✕
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center select-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ cursor: scale > MIN_SCALE ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            maxWidth: scale === MIN_SCALE ? '100%' : 'none',
            maxHeight: scale === MIN_SCALE ? '100%' : 'none',
          }}
        />
      </div>
    </div>
  );
}
