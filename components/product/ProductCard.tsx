import Link from 'next/link';
import type { CatalogProduct } from '@/lib/data/catalog';
import StockBadge from './StockBadge';

export default function ProductCard({ product }: { product: CatalogProduct }) {
  const configureHref = product.profileType ? `/configure?profile=${product.profileType}` : '/configure';

  return (
    <div className="group bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden hover:border-afs-chrome-base transition-colors flex flex-col">
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-label text-xs uppercase tracking-wide text-afs-crimson">
            {product.categorySlug.replace(/-/g, ' ')}
          </span>
          {product.sku && (
            <span className="font-data text-xs text-afs-ink-700">{product.sku}</span>
          )}
        </div>

        <Link href={`/products/${product.categorySlug}/${product.slug}`}>
          <h3 className="font-heading text-xl text-afs-ink-900 mb-1 hover:text-afs-crimson transition-colors">
            {product.name}
          </h3>
        </Link>

        <p className="font-body text-sm text-afs-ink-700 mb-3">
          {product.materials.join(', ')}
        </p>

        <div className="flex items-center gap-3 mb-3">
          <StockBadge stockType={product.stockType} />
          <span className="font-data text-xs text-afs-ink-700">
            {product.leadTimeDays} day lead time
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <Link
            href={`/quote?product=${product.slug}`}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-sm px-3 py-2 rounded transition-colors"
          >
            Request a Quote
          </Link>
          <Link
            href={configureHref}
            className="border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface hover:text-afs-ink-900 text-center font-label text-sm px-3 py-2 rounded transition-colors"
          >
            Configure
          </Link>
        </div>
      </div>
    </div>
  );
}
