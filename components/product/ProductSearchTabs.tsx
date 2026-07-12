'use client';

import { useState } from 'react';
import ProductCatalogBrowser from './ProductCatalogBrowser';
import AIProductFinder from '@/components/ai/AIProductFinder';
import type { CatalogCategory } from '@/lib/data/catalog';

type SearchMode = 'browse' | 'describe';

const TABS: { mode: SearchMode; label: string }[] = [
  { mode: 'browse', label: 'Browse Products' },
  { mode: 'describe', label: 'Find by Description' },
];

export default function ProductSearchTabs({ categories }: { categories: CatalogCategory[] }) {
  const [mode, setMode] = useState<SearchMode>('browse');

  return (
    <div>
      <div className="flex justify-center gap-2 mb-10">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setMode(tab.mode)}
            className={`font-label text-sm font-semibold px-6 py-2.5 rounded transition-colors ${
              mode === tab.mode
                ? 'bg-afs-crimson text-white'
                : 'border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'browse' ? <ProductCatalogBrowser mode="catalog" categories={categories} /> : <AIProductFinder />}
    </div>
  );
}
