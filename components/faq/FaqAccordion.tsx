'use client';

import { useMemo, useState } from 'react';
import type { FaqCategory } from '@/lib/data/faq';

interface FaqAccordionProps {
  categories: FaqCategory[];
}

function questionKey(categoryIndex: number, questionIndex: number): string {
  return `${categoryIndex}-${questionIndex}`;
}

export default function FaqAccordion({ categories }: FaqAccordionProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleQuestion = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;

    return categories
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (entry) => entry.q.toLowerCase().includes(term) || entry.a.toLowerCase().includes(term)
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [categories, search]);

  return (
    <div className="max-w-3xl mx-auto px-6 pb-20">
      <div className="mb-10">
        <label htmlFor="faq-search" className="sr-only">
          Search frequently asked questions
        </label>
        <input
          id="faq-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions — e.g. copper, coping cap, lead time…"
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
        />
      </div>

      {filteredCategories.length === 0 && (
        <p className="font-body text-sm text-afs-chrome-mid text-center">
          No questions match &ldquo;{search}&rdquo;. Try a different term, or contact us directly.
        </p>
      )}

      <div className="flex flex-col gap-10">
        {filteredCategories.map((category) => {
          const categoryIndex = categories.findIndex((c) => c.category === category.category);
          return (
            <section key={category.category}>
              <h2 className="font-heading text-2xl font-semibold text-afs-chrome-high mb-4 pb-2 border-b border-afs-border">
                {category.category}
              </h2>
              <div className="flex flex-col gap-2">
                {category.questions.map((entry, questionIndex) => {
                  const key = questionKey(categoryIndex, questionIndex);
                  const isOpen = expanded.has(key);
                  return (
                    <div
                      key={key}
                      className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleQuestion(key)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-label text-sm font-semibold text-afs-chrome-high hover:bg-afs-bg-surface transition-colors"
                      >
                        <span>{entry.q}</span>
                        <span
                          className={`shrink-0 text-afs-crimson transition-transform ${isOpen ? 'rotate-45' : ''}`}
                          aria-hidden="true"
                        >
                          +
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 font-body text-sm leading-relaxed text-afs-chrome-mid">
                          {entry.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
