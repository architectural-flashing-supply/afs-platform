import Link from 'next/link';
import type { CatalogCategory } from '@/lib/data/catalog';

export default function CategoryCard({ category }: { category: CatalogCategory }) {
  return (
    <div className="group bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden hover:border-afs-chrome-base transition-colors flex flex-col">
      <Link href={`/products/${category.slug}`} className={`block h-24 relative bg-gradient-to-br ${category.gradientClass} bg-afs-bg-raised`}>
        <span className="absolute inset-0 flex items-start p-3">
          <span className="font-display text-2xl text-afs-ink-900 tracking-wide leading-none">
            {category.name.toUpperCase()}
          </span>
        </span>
      </Link>

      <div className="p-3 flex flex-col flex-1">
        <p className="font-label text-xs uppercase tracking-wide text-afs-crimson mb-1.5">
          {category.tagline}
        </p>
        <p className="font-body text-sm text-afs-ink-700 mb-3 flex-1 line-clamp-2">
          {category.shortDescription}
        </p>
        <div className="flex flex-col gap-1.5">
          <Link
            href="/quote"
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-sm px-3 py-2 rounded transition-colors"
          >
            Request a Quote
          </Link>
          <Link
            href={`/products/${category.slug}`}
            className="border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface hover:text-afs-ink-900 text-center font-label text-sm px-3 py-2 rounded transition-colors"
          >
            View Products →
          </Link>
        </div>
      </div>
    </div>
  );
}
