'use client';

import { useEffect, useRef } from 'react';
import type { HemType } from '@/lib/types/profile';
import { drawHemGlyph, HEM_GLYPH_R } from '@/lib/flashdraft/hem-glyph';

// Standalone debug view for FlashDraft's hem cross-section glyphs — calls
// the EXACT SAME drawHemGlyph() used by the real canvas draw loop and the
// hem-type-selector popup (both in app/studio/draft/page.tsx), just at
// 15x HEM_GLYPH_R, so what's on screen here is exactly what real users
// see, only much larger. No reimplementation of the shapes themselves.
//
// Reach this at /studio/hem-debug.

// An explicit multiple of the canonical HEM_GLYPH_R, same pattern
// HEM_ICON_GLYPH_R uses in app/studio/draft/page.tsx's HemGlyphIcon — every
// call-site scale derives from the one base constant so none of them can
// silently drift apart from each other in a future edit.
const DEBUG_SCALE = 15;
const DEBUG_R = HEM_GLYPH_R * DEBUG_SCALE;

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 180;
// Every glyph lives entirely in local +x (see drawHemGlyph's own doc
// comment) when drawn at angleRad=0, spanning up to Lh = DEBUG_R*1.8 = 162px
// rightward (Open/Smashed) or cx+r = DEBUG_R*1.65 = 148.5px rightward
// (Teardrop's far circle edge), and roughly ±DEBUG_R*0.7 = 63px above/below
// the tip — so the anchor sits toward the left and vertical center of the
// canvas, leaving enough room on all three sides for the shape to render
// uncropped at this scale.
const ANCHOR = { x: 30, y: 85 };

const HEM_TYPES: { type: HemType; label: string }[] = [
  { type: 'open', label: 'Open' },
  { type: 'smashed', label: 'Smashed' },
  { type: 'teardrop', label: 'Teardrop' },
];

function HemDebugCanvas({ type }: { type: HemType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawHemGlyph(ctx, ANCHOR, 0, type, DEBUG_R);
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: '1px solid #DDDDDD' }}
    />
  );
}

export default function HemDebugPage() {
  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', padding: 40 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111111', marginBottom: 4 }}>
        FlashDraft Hem Glyph Debug
      </h1>
      <p style={{ fontSize: 13, color: '#555555', marginBottom: 32 }}>
        Each shape below is rendered by the actual production <code>drawHemGlyph()</code> (from{' '}
        <code>lib/flashdraft/hem-glyph.ts</code>), at {DEBUG_SCALE}x the normal <code>HEM_GLYPH_R</code>{' '}
        scale (R = {DEBUG_R}px instead of {HEM_GLYPH_R}px). Not a reimplementation — this is exactly
        what real users see, just much bigger.
      </p>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 40 }}>
        {HEM_TYPES.map(({ type, label }) => (
          <div key={type} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111111', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </span>
            <HemDebugCanvas type={type} />
          </div>
        ))}
      </div>
    </div>
  );
}
