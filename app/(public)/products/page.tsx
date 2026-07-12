import type { Metadata } from 'next';
import ProductSearchTabs from '@/components/product/ProductSearchTabs';
import { CATEGORIES } from '@/lib/data/catalog';

export const metadata: Metadata = {
  title: 'Products | AFS Architectural Flashing Supply',
  description:
    'Custom fabricated sheet metal flashing — roofing, scuppers, fascia, copings and cleats, siding and walls, custom fabrications, and window and door flashing. Copper, aluminum, galvanized steel, stainless, and Galvalume.',
};

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="px-6 pt-14 pb-8 text-center">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">
          Product Catalog
        </p>
        <h1 className="font-display text-6xl text-afs-crimson font-bold leading-none mb-4">PRODUCTS</h1>
        <p className="font-body text-black font-bold text-base max-w-2xl mx-auto mb-2">
          Custom fabricated sheet metal flashing — every profile, every material. Every product on this
          page drives to a formal quote request.
        </p>
        <p className="font-data text-xs text-afs-chrome-dim uppercase tracking-wide">
          {CATEGORIES.length} profile categories available
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 pb-16" style={{ backgroundColor: '#B8BEC8' }}>
        <ProductSearchTabs categories={CATEGORIES} />
      </div>
    </main>
  );
}
