import Link from 'next/link';
import type { CatalogCategory } from '@/lib/data/catalog';

export default function CategoryCard({ category }: { category: CatalogCategory }) {
  return (
    <div className="group bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden hover:border-afs-chrome-base transition-colors flex flex-col">
      <Link href={`/products/${category.slug}`} className={`block h-40 relative bg-gradient-to-br ${category.gradientClass} bg-afs-bg-raised`}>
        <span className="absolute inset-0 flex items-end p-5">
          <span className="font-display text-3xl text-afs-chrome-high tracking-wide leading-none">
            {category.name.toUpperCase()}
          </span>
        </span>
      </Link>

      <div className="p-5 flex flex-col flex-1">
        <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-2">
          {category.tagline}
        </p>
        <p className="font-body text-sm text-afs-chrome-mid mb-5 flex-1">
          {category.shortDescription}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/quote"
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-sm px-4 py-2.5 rounded transition-colors"
          >
            Request a Quote
          </Link>
          <Link
            href={`/products/${category.slug}`}
            className="border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-afs-chrome-high text-center font-label text-sm px-4 py-2.5 rounded transition-colors"
          >
            View Products →
          </Link>
        </div>
      </div>
    </div>
  );
}
