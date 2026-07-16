'use client';

import { useEffect, useRef, useState } from 'react';
import { hitTest } from '@/lib/flashdraft/geometry';
import { renderAll, type HoverTarget } from '@/lib/flashdraft/renderer';
import type { CanvasPoint, FlashDraftAction, FlashDraftState } from '@/lib/flashdraft/types';

const HIT_RADIUS_PX = 12;

interface FlashDraftCanvasProps {
  state: FlashDraftState;
  dispatch: React.Dispatch<FlashDraftAction>;
  onSizeChange?: (width: number, height: number) => void;
}

export default function FlashDraftCanvas({ state, dispatch, onSizeChange }: FlashDraftCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spaceDownRef = useRef(false);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [canvasHeight, setCanvasHeight] = useState(440);
  const [hover, setHover] = useState<HoverTarget | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      setCanvasWidth(width);
      setCanvasHeight(height);
      onSizeChange?.(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderAll(ctx, state, canvasWidth, canvasHeight, hover);
  }, [state, canvasWidth, canvasHeight, hover]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') spaceDownRef.current = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceDownRef.current = false;
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function getPixelFromEvent(e: React.PointerEvent<HTMLCanvasElement>): CanvasPoint {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dispatch({ type: 'POINTER_DOWN', pixel: getPixelFromEvent(e), buttons: e.buttons, spaceDown: spaceDownRef.current });
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const pixel = getPixelFromEvent(e);
    dispatch({ type: 'POINTER_MOVE', pixel });

    // Hover is presentation-only (which leg/bend to highlight, what cursor
    // to show) — tracked locally rather than dispatched so it doesn't
    // round-trip the reducer/history on every mouse move.
    if (state.interaction.type === 'IDLE' || state.interaction.type === 'SELECTED_LEG' || state.interaction.type === 'SELECTED_BEND' || state.interaction.type === 'SELECTED_HEM') {
      const hit = hitTest(pixel, state.profile.geometry, state.transform, HIT_RADIUS_PX);
      if (hit.type === 'bend' && hit.id) setHover({ type: 'bend', id: hit.id });
      else if (hit.type === 'leg' && hit.id) setHover({ type: 'leg', id: hit.id });
      else setHover(null);
    } else {
      setHover(null);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dispatch({ type: 'POINTER_UP', pixel: getPixelFromEvent(e) });
  }

  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    onPointerUp(e);
  }

  function onPointerLeave() {
    setHover(null);
    dispatch({ type: 'POINTER_LEAVE' });
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    dispatch({ type: 'WHEEL', pixel: { x: e.clientX - rect.left, y: e.clientY - rect.top }, deltaY: e.deltaY });
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    dispatch({ type: 'DOUBLE_CLICK', pixel: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
  }

  let cursor = 'default';
  if (state.interaction.type === 'PANNING' || state.interaction.type === 'DRAGGING_BEND') cursor = 'grabbing';
  else if (hover?.type === 'bend') cursor = 'grab';
  else if (state.interaction.type === 'DRAWING' || state.interaction.type === 'DRAWING_HEM') cursor = 'crosshair';

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor, display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}
