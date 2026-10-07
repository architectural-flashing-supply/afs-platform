'use client';

import { useCallback, useMemo, useState } from 'react';
import ProductModal from '@/components/product/ProductModal';
import ProductSearchBox from '@/components/product/ProductSearchBox';
import ProductTile, { TILE_SIZE_PX } from '@/components/product/ProductTile';
import { categoryAnchorId, type CatalogProduct, type CatalogSection } from '@/lib/data/products-page';

export interface ProductCatalogProps {
  sections: CatalogSection[];
}

/**
 * The Products page body: a sticky category jump-nav with counts, a name
 * search, and one section per category in the order the data layer fixed.
 *
 * The filter UI is a search box and nothing else. Material and gauge filters
 * are deliberately absent — the manifest has no material or gauge data, and a
 * filter that silently matches nothing is worse than no filter. See
 * docs/PRODUCT_PAGE_NOTES.md.
 */
export default function ProductCatalog({ sections }: ProductCatalogProps) {
  const [query, setQuery] = useState('');
  const [openProduct, setOpenProduct] = useState<CatalogProduct | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections
      .map((section) => ({
        ...section,
        products: section.products.filter((p) => p.name.toLowerCase().includes(needle)),
      }))
      .filter((section) => section.products.length > 0);
  }, [sections, query]);

  const total = useMemo(
    () => visible.reduce((sum, section) => sum + section.products.length, 0),
    [visible]
  );

  const onOpen = useCallback((product: CatalogProduct) => setOpenProduct(product), []);
  const onClose = useCallback(() => setOpenProduct(null), []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
      {/* STICKY JUMP NAV + SEARCH */}
      <div className="sticky top-0 z-20 -mx-4 mb-8 border-b border-afs-border-catalog bg-afs-bg-light/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Product categories" className="min-w-0 lg:flex-1">
            <ul
              className="grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(var(--afs-cat-cols),minmax(0,1fr))]"
              style={{ ['--afs-cat-cols' as string]: Math.ceil(sections.length / 2) }}
            >
              {sections.map((section) => (
                <li key={section.category}>
                  <a
                    href={`#${categoryAnchorId(section.category)}`}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded border border-afs-border-catalog bg-afs-bg-light-raised px-3 py-2 font-label text-xs uppercase tracking-wide text-afs-ink-900 transition-colors hover:bg-afs-bg-lane focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-afs-bg-light"
                  >
                    {section.category}
                    <span className="font-data text-afs-ink-700">{section.products.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <ProductSearchBox sections={sections} query={query} onQueryChange={setQuery} />
        </div>
      </div>

      {total === 0 ? (
        <p className="py-16 text-center font-body text-base text-afs-ink-900">
          No products match “{query}”.
        </p>
      ) : null}

      {visible.map((section) => (
        <section
          key={section.category}
          id={categoryAnchorId(section.category)}
          /* Layer 2: a category band sits darker than the page. */
          className="mb-8 scroll-mt-28 rounded border border-afs-border-catalog bg-afs-bg-light-raised p-4 sm:p-6"
        >
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-display text-2xl font-bold leading-tight text-afs-ink-900 sm:text-3xl">
              {section.category}
            </h2>
            <span className="font-data text-sm text-afs-ink-700">
              {section.products.length} {section.products.length === 1 ? 'product' : 'products'}
            </span>
          </div>

          {/*
            At 375px this is a single column (one 192px tile fits with margin);
            above that it fills as many 192px tracks as there is room for.
          */}
          <div
            className="grid justify-center gap-4 sm:justify-start"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_SIZE_PX}px, ${TILE_SIZE_PX}px))` }}
          >
            {section.products.map((product) => (
              <ProductTile key={product.id} product={product} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}

      {openProduct ? <ProductModal product={openProduct} onClose={onClose} /> : null}
    </div>
  );
}
