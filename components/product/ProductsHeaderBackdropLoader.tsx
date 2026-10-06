'use client';

import dynamic from 'next/dynamic';

// three.js stays out of the initial payload; the backdrop is decoration only.
const ProductsHeaderBackdrop = dynamic(() => import('@/components/product/ProductsHeaderBackdrop'), { ssr: false });

export default function ProductsHeaderBackdropLoader() {
  return <ProductsHeaderBackdrop />;
}
