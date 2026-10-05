'use client';

import Image from 'next/image';
import { useCallback, useId, useRef, useState } from 'react';
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

  // The 320px popover is centred on a 192px tile, so tiles near either viewport
  // edge would push it off-screen. Measure on activation and nudge it back in.
  const activate = useCallback(() => {
    const el = tileRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const half = 160 + 8;
      const vw = document.documentElement.clientWidth;
      setShiftX(Math.max(half - cx, 0) - Math.max(cx + half - vw, 0));
    }
    setActive(true);
  }, []);

  const open = useCallback(() => onOpen(product), [onOpen, product]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    },
    [open]
  );

  return (
    <div
      ref={tileRef}
      className="relative"
      style={{ width: TILE_SIZE_PX }}
      onMouseEnter={activate}
      onMouseLeave={() => setActive(false)}
    >
      <button
        type="button"
        onClick={open}
        onKeyDown={onKeyDown}
        onFocus={activate}
        onBlur={() => setActive(false)}
        aria-describedby={active ? popoverId : undefined}
        className="group block w-full cursor-pointer rounded border border-afs-border-catalog bg-afs-bg-lane p-2 text-left transition-colors hover:bg-afs-bg-catalog-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-afs-bg-light-raised"
      >
        <span className="relative block overflow-hidden rounded" style={{ height: TILE_SIZE_PX - 48 }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            loading="lazy"
            sizes="192px"
            className="object-contain p-1"
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
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 hidden w-[320px] rounded border border-afs-border-catalog bg-afs-bg-catalog-pop p-4 shadow-xl [@media(hover:hover)]:block"
        >
          <div className="relative h-[200px] w-full overflow-hidden rounded">
            {product.geometryMatch || product.hasSchematicPreview ? (
              <ProductProfilePreview3D
                profileType={product.geometryMatch}
                schematicProductId={product.hasSchematicPreview ? product.id : null}
                productName={product.name}
                minHeightPx={0}
                className="h-full w-full"
              />
            ) : (
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="320px"
                className="object-contain p-2"
              />
            )}
          </div>

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
