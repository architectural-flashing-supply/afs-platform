'use client';

import dynamic from 'next/dynamic';

// three.js stays out of the initial payload; the visual is decoration only.
const ProductsHeroDripEdge = dynamic(() => import('@/components/product/ProductsHeroDripEdge'), { ssr: false });

export default function ProductsHeroDripEdgeLoader() {
  return <ProductsHeroDripEdge />;
}
