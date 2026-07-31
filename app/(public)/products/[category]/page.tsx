import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductCatalogBrowser from '@/components/product/ProductCatalogBrowser';
import { CATEGORIES, getCategory, getProductsByCategory } from '@/lib/data/catalog';
import { withLiveStock } from '@/lib/data/product-stock';
import { createClient } from '@/lib/supabase/server';

interface CategoryPageParams {
  params: { category: string };
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export function generateMetadata({ params }: CategoryPageParams): Metadata {
  const category = getCategory(params.category);
  if (!category) {
    return { title: 'Products | AFS Architectural Flashing Supply' };
  }
  return {
    title: `${category.name} | AFS Architectural Flashing Supply`,
    description: category.shortDescription,
  };
}

export default async function CategoryPage({ params }: CategoryPageParams) {
  const category = getCategory(params.category);
  if (!category) notFound();

  const supabase = await createClient();
  const products = await withLiveStock(supabase, getProductsByCategory(category.slug));

  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="max-w-[1400px] mx-auto px-6 pt-8">
        <nav className="font-body text-xs text-afs-chrome-dim mb-8" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-afs-chrome-mid transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/products" className="hover:text-afs-chrome-mid transition-colors">Products</Link>
          <span className="mx-2">/</span>
          <span className="text-afs-chrome-mid">{category.name}</span>
        </nav>

        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">
          {category.tagline}
        </p>
        <h1 className="font-display text-5xl text-afs-chrome-high leading-none mb-4">
          {category.name.toUpperCase()}
        </h1>
        <p className="font-body text-afs-chrome-mid text-base max-w-2xl mb-2">
          {category.description}
        </p>
        <p className="font-data text-xs text-afs-chrome-dim uppercase tracking-wide mb-8">
          {products.length} products in this category
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 pb-16">
        <ProductCatalogBrowser mode="category" category={category} products={products} />
      </div>
    </main>
  );
}
