'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef } from 'react';
import ProductActions from '@/components/product/ProductActions';
import ProductProfilePreview3D from '@/components/product/ProductProfilePreview3D';
import type { CatalogProduct } from '@/lib/data/products-page';

/** Everything focusable we trap between. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export interface ProductModalProps {
  product: CatalogProduct;
  onClose: () => void;
}

/**
 * The click/tap view: the same content as the hover popover, at a size that
 * works on a phone, with the operable buttons.
 *
 * Esc closes, focus is trapped inside while open, the page behind is
 * scroll-locked, and focus returns to whatever opened it.
 */
export default function ProductModal({ product, onClose }: ProductModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Remember what had focus, and give focus to the dialog.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => restoreFocusRef.current?.focus?.();
  }, []);

  // Scroll lock. The previous inline value is restored rather than cleared, so
  // this cannot stomp a lock something else already set.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-afs-bg-dim/70 p-4"
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        // Backdrop click closes; a drag that starts inside does not.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded border border-afs-border-catalog bg-afs-bg-catalog-pop p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-bold leading-tight text-afs-ink-900">
            {product.name}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-afs-border-catalog bg-afs-bg-light text-xl leading-none text-afs-ink-900 transition-colors hover:bg-afs-bg-light-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-afs-bg-catalog-pop"
          >
            ×
          </button>
        </div>

        <div className="relative mt-4 h-[260px] w-full overflow-hidden rounded sm:h-[320px]">
          {product.geometryMatch ? (
            <ProductProfilePreview3D
              profileType={product.geometryMatch}
              productName={product.name}
              className="h-full w-full"
            />
          ) : (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 90vw, 520px"
              className="object-contain p-3"
            />
          )}
        </div>

        <p className="mt-3 font-data text-xs uppercase tracking-wide text-afs-ink-700">
          {product.category}
        </p>

        <div className="mt-4">
          <ProductActions product={product} />
        </div>
      </div>
    </div>
  );
}
