'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import ProductActions from '@/components/product/ProductActions';
import ProductProfilePreview3D from '@/components/product/ProductProfilePreview3D';
import type { CatalogProduct } from '@/lib/data/products-page';

/** ~2in on a typical display. The grid tracks are sized from this. */
export const TILE_SIZE_PX = 192;

export interface ProductTileProps {
  product: CatalogProduct;
  onOpen: (product: CatalogProduct) => void;
}

/**
 * One product in the grid.
 *
 * HOVER or KEYBOARD FOCUS enlarges it IN PLACE. The enlargement is an
 * absolutely positioned popover anchored to the tile, so the tile itself never
 * changes size and the grid never reflows — no layout shift, which is the whole
 * point of doing it this way rather than scaling the cell.
 *
 * CLICK or TAP opens the modal instead. Touch devices get no hover state at all
 * (the popover is behind `@media (hover: hover)`), so a tap is unambiguous
 * rather than a "first tap hovers, second tap clicks" trap.
 */
export default function ProductTile({ product, onOpen }: ProductTileProps) {
  const [active, setActive] = useState(false);
  const popoverId = useId();
  const tileRef = useRef<HTMLDivElement | null>(null);
  const [shiftX, setShiftX] = useState(0);
  // After a click the popover must stay away until the pointer has actually left and
  // come back - otherwise returning focus to the tile (or the pointer still resting on
  // it) re-opens it and it only goes away when you click somewhere else.
  // Holds the pointer position of the click that opened the modal (NaN for a keyboard open).
  // A hover that arrives at that same spot is the browser re-firing mouseenter once the modal
  // overlay is removed, not the user coming back, so it is ignored. Only a real re-entry from
  // elsewhere (or any other key press, for keyboard users) clears it.
  const suppressRef = useRef<{ x: number; y: number } | null>(null);
  // Set when the page scrolls. The tile under a stationary pointer changes while scrolling, so a
  // hover popover must not open (or stay open) until the pointer really moves again.
  const scrollHoldRef = useRef(false);

  // The 320px popover is centred on a 192px tile, so tiles near either viewport
  // edge would push it off-screen. Measure on activation and nudge it back in.
  const activate = useCallback((pos?: { x: number; y: number }) => {
    if (pos && scrollHoldRef.current) return;
    const s = suppressRef.current;
    if (s) {
      if (!pos) return; // focus, not pointer
      if (!Number.isNaN(s.x) && Math.hypot(pos.x - s.x, pos.y - s.y) < 6) return;
      suppressRef.current = null;
    }
    const el = tileRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const half = 310 + 8;
      const vw = document.documentElement.clientWidth;
      setShiftX(Math.max(half - cx, 0) - Math.max(cx + half - vw, 0));
    }
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const dismiss = () => {
      scrollHoldRef.current = true;
      setActive(false);
    };
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('touchmove', dismiss, { passive: true });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('touchmove', dismiss);
      window.removeEventListener('resize', dismiss);
    };
  }, [active]);

  const open = useCallback((pos?: { x: number; y: number }) => {
    suppressRef.current = pos ?? { x: Number.NaN, y: Number.NaN };
    setActive(false);
    onOpen(product);
  }, [onOpen, product]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      } else {
        suppressRef.current = null;
      }
    },
    [open]
  );

  return (
    <div
      ref={tileRef}
      className="relative"
      style={{ width: TILE_SIZE_PX }}
      onMouseEnter={(event) => activate({ x: event.clientX, y: event.clientY })}
      onMouseMove={(event) => {
        if (scrollHoldRef.current && Math.abs(event.movementX) + Math.abs(event.movementY) > 0) {
          scrollHoldRef.current = false;
          activate({ x: event.clientX, y: event.clientY });
        }
      }}
      onMouseLeave={() => {
        scrollHoldRef.current = false;
        setActive(false);
      }}
    >
      <button
        type="button"
        onClick={(event) => open({ x: event.clientX, y: event.clientY })}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          // Keyboard focus only. Programmatic focus restored after the modal closes is not a hover.
          if (event.currentTarget.matches(':focus-visible')) activate();
        }}
        onBlur={() => setActive(false)}
        aria-describedby={active ? popoverId : undefined}
        className="group block w-full cursor-pointer rounded border border-afs-border-catalog bg-afs-bg-lane p-2 text-left transition-colors hover:bg-afs-bg-catalog-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-afs-bg-light-raised"
      >
        <span className="relative block overflow-hidden rounded" style={{ height: TILE_SIZE_PX - 48, background: product.imageBg }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            loading="lazy"
            sizes="192px"
            className="object-contain"
          />
        </span>
        <span className="mt-2 block truncate font-body text-sm font-semibold text-afs-ink-900">
          {product.name}
        </span>
      </button>

      {/*
        The enlarged card. Absolutely positioned and pointer-events-none, so it
        can never intercept the click that opens the modal and can never push a
        grid cell. Desktop hover only — `hidden @media(hover:hover) ? block` is
        expressed with Tailwind's `hover-hover` variant below via `hidden
        [@media(hover:hover)]:block`, keeping touch devices on tap-to-open.
      */}
      {active ? (
        <div
          id={popoverId}
          role="tooltip"
          style={{ transform: `translate(calc(-50% + ${shiftX}px), -50%)` }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 hidden w-[620px] rounded border border-afs-border-catalog bg-afs-bg-catalog-pop p-4 shadow-xl [@media(hover:hover)]:block"
        >
          {(() => {
            const has3D = Boolean(product.geometryMatch || product.hasSchematicPreview);
            return (
              <div className={`grid gap-2 ${has3D ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="relative h-[280px] w-full overflow-hidden rounded" style={{ background: product.imageBg }}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="300px"
                    className="object-contain p-1"
                  />
                </div>
                {has3D ? (
                  <div className="relative h-[280px] w-full overflow-hidden rounded">
                    <ProductProfilePreview3D
                      profileType={product.geometryMatch}
                      schematicProductId={product.hasSchematicPreview ? product.id : null}
                      productName={product.name}
                      minHeightPx={0}
                      className="h-full w-full"
                    />
                  </div>
                ) : null}
              </div>
            );
          })()}

          <p className="mt-3 font-body text-base font-semibold text-afs-ink-900">{product.name}</p>

          <div className="mt-3">
            {/* Decorative twin of the real buttons — the modal carries the
                operable ones, so these stay out of the tab order. */}
            <ProductActions product={product} tabbable={false} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
