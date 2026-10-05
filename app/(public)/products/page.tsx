import type { Metadata } from 'next';
import ProductCatalog from '@/components/product/ProductCatalog';
import { getCatalogSections } from '@/lib/data/products-page';

export const metadata: Metadata = {
  title: 'Products | AFS Architectural Flashing Supply',
  description:
    'Architectural sheet metal flashing and trim — coping caps and cleats, drip edge and gravel stop, fascia and rake, valley, base and counter flashing, trim and closures, and roofing panels. Copper, aluminum, galvanized steel, stainless, and Galvalume. Every product drives to a formal quote request.',
};

/**
 * The public product catalog.
 *
 * Built from `lib/data/product-renders.manifest.json` — the reviewed inventory
 * of the Drexel Metals renderings. The data layer
 * (`lib/data/products-page.ts`) decides what is publishable, what each product
 * is called and what order the categories go in; this page only renders it.
 *
 * NO PRICES. AFS is an RFQ platform: a customer never sees a dollar amount
 * before AFS issues them a formal quote (CLAUDE.md rule #1). There is no cart,
 * no "from $X", and no Configurator link on this page.
 */
export default function ProductsPage() {
  const sections = getCatalogSections();
  const productCount = sections.reduce((sum, section) => sum + section.products.length, 0);

  return (
    /* Layer 1, the lightest: a warm off-white page under the gunmetal header. */
    <main className="min-h-screen bg-afs-bg-light">
      <div className="mx-auto max-w-[1400px] px-4 pb-6 pt-12 sm:px-6">
        <p className="mb-3 font-label text-sm uppercase tracking-widest text-afs-crimson">
          Product Catalog
        </p>
        <h1 className="mb-4 font-display text-5xl font-bold leading-none text-afs-ink-900 sm:text-6xl">
          PRODUCTS
        </h1>
        <p className="max-w-3xl font-body text-base text-afs-ink-900">
          Architectural sheet metal flashing and trim, fabricated to your drawings. Open any product
          to see its profile; where we hold the geometry you can take it straight into FlashDraft and
          design from it. Every product here leads to a formal quote request — never a checkout.
        </p>
        <p className="mt-3 font-data text-xs uppercase tracking-wide text-afs-ink-700">
          {productCount} products across {sections.length} categories
        </p>
      </div>

      <ProductCatalog sections={sections} />
    </main>
  );
}
