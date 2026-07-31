import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductDetailView from '@/components/product/ProductDetailView';
import { PRODUCTS, getCategory, getProduct } from '@/lib/data/catalog';
import { withLiveStock } from '@/lib/data/product-stock';
import { createClient } from '@/lib/supabase/server';

interface ProductPageParams {
  params: { category: string; slug: string };
}

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ category: p.categorySlug, slug: p.slug }));
}

export function generateMetadata({ params }: ProductPageParams): Metadata {
  const product = getProduct(params.category, params.slug);
  if (!product) {
    return { title: 'Products | AFS Architectural Flashing Supply' };
  }
  return {
    title: `${product.name} | AFS Architectural Flashing Supply`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: ProductPageParams) {
  const category = getCategory(params.category);
  const staticProduct = getProduct(params.category, params.slug);
  if (!category || !staticProduct) notFound();

  const supabase = await createClient();
  const [product] = await withLiveStock(supabase, [staticProduct]);

  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="max-w-[1400px] mx-auto px-6 pt-8">
        <nav className="font-body text-xs text-afs-chrome-dim mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-afs-chrome-mid transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/products" className="hover:text-afs-chrome-mid transition-colors">Products</Link>
          <span className="mx-2">/</span>
          <Link href={`/products/${category.slug}`} className="hover:text-afs-chrome-mid transition-colors">
            {category.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-afs-chrome-mid">{product.name}</span>
        </nav>
      </div>

      <ProductDetailView category={category} product={product} />
    </main>
  );
}
