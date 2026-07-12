'use client';

import { useState } from 'react';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import EmptyState from '@/components/ui/EmptyState';

type Category = 'standards' | 'installation' | 'specification' | 'faq';

const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: 'standards', label: 'Standards' },
  { key: 'installation', label: 'Installation' },
  { key: 'specification', label: 'Specification' },
  { key: 'faq', label: 'FAQs' },
];

// Articles are CMS-driven — see SPEC_ARCHITECTURAL_RESOURCE_CENTER.md.
// No content has been published yet (checklist #59, #77 pending); every category
// renders the empty state until admin-authored articles exist.
const ARTICLES: Record<Category, never[]> = {
  standards: [],
  installation: [],
  specification: [],
  faq: [],
};

export default function ArchitecturalResourceCenterPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('standards');
  const articles = ARTICLES[activeCategory];

  return (
    <ArchitectShell>
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="mb-10 text-center">
          <ArchitectEyebrow>Architectural Resource Center</ArchitectEyebrow>
          <h1 className="font-display text-6xl text-afs-ink-900 leading-none mb-4">TECHNICAL RESOURCES</h1>
          <p className="font-body text-afs-ink-700 text-base max-w-2xl mx-auto">
            Standards references, installation guidance, and specification writing resources for AFS
            architectural flashing.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-10 border-b border-afs-chrome-dim flex-wrap">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveCategory(tab.key)}
              className={`font-label text-sm px-6 py-3 border-b-2 transition-colors ${
                activeCategory === tab.key
                  ? 'border-afs-copper text-afs-ink-900'
                  : 'border-transparent text-afs-ink-700 hover:text-afs-ink-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          {articles.length === 0 ? (
            <EmptyState
              title="Content Being Prepared"
              description="Check back soon. Our technical team is preparing resources for this category."
            />
          ) : null}
        </div>
      </div>
    </ArchitectShell>
  );
}
