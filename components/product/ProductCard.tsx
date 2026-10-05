import Link from 'next/link';
import type { CatalogProduct } from '@/lib/data/catalog';
import StockBadge from './StockBadge';
import ProfileThumb from './ProfileThumb';

export default function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <div className="group bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden hover:border-afs-chrome-base transition-colors flex flex-col">
      <Link
        href={`/products/${product.categorySlug}/${product.slug}`}
        className="block aspect-[4/3] w-full"
        aria-label={`${product.name} details`}
      >
        <ProfileThumb
          slug={product.slug}
          profileType={product.profileType}
          fallbackLabel={product.categorySlug.replace(/-/g, ' ')}
          className="h-full w-full p-2"
        />
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim">
            {product.categorySlug.replace(/-/g, ' ')}
          </span>
          {product.sku && (
            <span className="font-data text-xs text-afs-chrome-dim">{product.sku}</span>
          )}
        </div>

        <Link href={`/products/${product.categorySlug}/${product.slug}`}>
          <h3 className="font-heading text-xl text-afs-chrome-high mb-1 hover:text-afs-crimson transition-colors">
            {product.name}
          </h3>
        </Link>

        <p className="font-body text-sm text-afs-chrome-mid mb-4">
          {product.materials.join(', ')}
        </p>

        <div className="flex items-center gap-3 mb-5">
          <StockBadge stockType={product.stockType} />
          <span className="font-data text-xs text-afs-chrome-dim">
            {product.leadTimeDays} day lead time
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Link
            href={`/quote?product=${product.slug}`}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-sm px-4 py-2.5 rounded transition-colors"
          >
            Request a Quote
          </Link>
          <Link
            href="/studio/draft"
            className="border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-afs-chrome-high text-center font-label text-sm px-4 py-2.5 rounded transition-colors"
          >
            Design in FlashDraft
          </Link>
        </div>
      </div>
    </div>
  );
}
