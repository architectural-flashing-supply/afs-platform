import type { Metadata } from 'next';
import ProductCatalog from '@/components/product/ProductCatalog';
import ProductProfilePreview3D from '@/components/product/ProductProfilePreview3D';
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
  // The header shows the real T Style Drip Edge in the same 3D viewer the product popup uses.
  const hero = sections.flatMap((s) => s.products).find((p) => p.id === 't-style-drip-edge');

  return (
    /* Layer 1, the lightest: a warm off-white page under the gunmetal header. */
    <main className="min-h-screen bg-afs-bg-light">
      <div className="relative overflow-x-clip md:min-h-[19rem]">
        {hero && (hero.geometryMatch || hero.hasSchematicPreview) ? (
          <div className="absolute right-4 top-4 hidden h-72 w-[26rem] overflow-hidden rounded-lg md:block lg:right-6 lg:w-[34rem]">
            <ProductProfilePreview3D
              profileType={hero.geometryMatch}
              schematicProductId={hero.hasSchematicPreview ? hero.id : null}
              productName={hero.name}
              minHeightPx={0}
              className="h-full w-full"
            />
          </div>
        ) : null}
        <div className="relative mx-auto max-w-[1400px] px-4 pb-6 pt-12 sm:px-6">
        <h1 className="mb-4 font-display text-5xl font-bold leading-none text-afs-ink-900 sm:text-6xl">
          PRODUCTS
        </h1>
        <p className="max-w-md font-body text-base text-afs-ink-900">Browse the profiles. Open one to quote it or design from it.</p>
        </div>
      </div>

      <ProductCatalog sections={sections} />
    </main>
  );
}
