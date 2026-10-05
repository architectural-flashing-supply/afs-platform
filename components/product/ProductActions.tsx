'use client';

import { useCallback } from 'react';
import {
  profilePointsFor,
  FLASHDRAFT_HANDOFF_KEY,
  FLASHDRAFT_LOAD_URL,
} from '@/lib/data/product-geometry';
import type { CatalogProduct } from '@/lib/data/products-page';

/**
 * The two buttons on an enlarged product.
 *
 * Sized to their label — never full-width on desktop. They stretch only at the
 * narrowest breakpoint, where a 375px column has no room for two side-by-side
 * targets and a tap target still has to clear 44px.
 *
 * There is no price, no cart and no Configurator link here, and there never
 * should be: AFS is an RFQ platform (CLAUDE.md rule #1) and the Configurator
 * was deliberately removed from these pages.
 */

const BUTTON_BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded px-5 py-2.5 ' +
  'font-label text-sm uppercase tracking-wide transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-afs-bg-catalog-pop';

/** White on crimson measures 6.5:1 — see DESIGN_TOKENS.md §8.1. */
const PRIMARY = `${BUTTON_BASE} bg-afs-crimson text-white hover:bg-afs-crimson-hover`;
/** ink-900 on the popover is 13.8:1; the border clears the 3:1 non-text rule. */
const SECONDARY = `${BUTTON_BASE} border border-afs-border-catalog bg-afs-bg-light text-afs-ink-900 hover:bg-afs-bg-light-raised`;

export function quoteHref(productName: string): string {
  return `/quote?product=${encodeURIComponent(productName)}`;
}

export interface ProductActionsProps {
  product: CatalogProduct;
  /** Marks the buttons inert for a decorative duplicate (the hover popover's twin). */
  tabbable?: boolean;
}

export default function ProductActions({ product, tabbable = true }: ProductActionsProps) {
  /**
   * "Select & Design" opens FlashDraft on this exact profile.
   *
   * The handoff is the one FlashDraft already supports: the final point array
   * goes into localStorage under the key FlashDraft reads, then we navigate to
   * `?loadCanonical=1`. Established by CanonicalProfileBrowser; points rather
   * than bends on purpose, because reconstructing from bends assumes every bend
   * turns the same way and mangles alternating folds.
   *
   * If localStorage is unavailable (private mode, blocked storage), FlashDraft's
   * own handler no-ops on the missing key and the user lands on an empty canvas
   * rather than an error — the same degradation the canonical browser accepts.
   */
  const openInFlashDraft = useCallback(() => {
    if (!product.geometryMatch) return;
    try {
      const points = profilePointsFor(product.geometryMatch);
      window.localStorage.setItem(FLASHDRAFT_HANDOFF_KEY, JSON.stringify(points));
    } catch {
      // Storage blocked — fall through and still open FlashDraft.
    }
    window.location.href = FLASHDRAFT_LOAD_URL;
  }, [product.geometryMatch]);

  const tabIndex = tabbable ? undefined : -1;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {product.geometryMatch ? (
        <button
          type="button"
          onClick={openInFlashDraft}
          className={PRIMARY}
          tabIndex={tabIndex}
          aria-hidden={tabbable ? undefined : true}
        >
          Select &amp; Design
        </button>
      ) : null}

      <a
        href={quoteHref(product.name)}
        className={SECONDARY}
        tabIndex={tabIndex}
        aria-hidden={tabbable ? undefined : true}
      >
        Request a Quote
      </a>
    </div>
  );
}
