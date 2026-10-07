'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CatalogSection } from '@/lib/data/products-page';

export interface ProductSearchBoxProps {
  sections: CatalogSection[];
  query: string;
  onQueryChange: (value: string) => void;
}

interface Suggestion {
  name: string;
  category: string;
  rank: number;
}

const MAX_SUGGESTIONS = 8;

/**
 * Product search with an autofill dropdown: as the visitor types, matching
 * profile names (prefix matches first) appear under the box. Picking one fills
 * the box. A side card says "Don't see your profile? Design it in FlashDraft."
 * once they have typed enough to be looking for something specific.
 */
export default function ProductSearchBox({ sections, query, onQueryChange }: ProductSearchBoxProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [cardDismissed, setCardDismissed] = useState(false);

  const suggestions = useMemo<Suggestion[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const section of sections) {
      for (const product of section.products) {
        const lower = product.name.toLowerCase();
        if (!lower.includes(needle)) continue;
        const key = `${lower}|${section.category}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: product.name, category: section.category, rank: lower.startsWith(needle) ? 0 : 1 });
      }
    }
    out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
    return out.slice(0, MAX_SUGGESTIONS);
  }, [sections, query]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (query.trim() === '') setCardDismissed(false);
  }, [query]);

  const choose = (name: string) => {
    onQueryChange(name);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (suggestions.length === 0 ? -1 : (i + 1) % suggestions.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (suggestions.length === 0 ? -1 : (i <= 0 ? suggestions.length - 1 : i - 1)));
    } else if (event.key === 'Enter' && open && active >= 0 && suggestions[active]) {
      event.preventDefault();
      choose(suggestions[active].name);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && suggestions.length > 0;
  const showCard = query.trim().length >= 2 && !cardDismissed;

  return (
    <div ref={wrapRef} className="relative lg:w-[300px] lg:shrink-0">
      <label htmlFor="product-search" className="sr-only">
        Search products by name
      </label>
      <div className="flex">
        <input
          ref={inputRef}
          id="product-search"
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products"
          className="min-h-[44px] min-w-0 flex-1 rounded-l border border-r-0 border-afs-crimson bg-afs-bg-light-raised px-3 py-2 font-body text-sm text-afs-ink-900 placeholder:text-afs-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson"
        />
        <button
          type="button"
          aria-label="Search products"
          onClick={() => {
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="inline-flex min-h-[44px] w-12 items-center justify-center rounded-r bg-afs-crimson text-white transition-colors hover:bg-afs-crimson-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-afs-ink-900"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13l4.5 4.5" />
          </svg>
        </button>
      </div>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded border border-afs-border-catalog bg-afs-bg-light-raised shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.category}-${s.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(s.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 font-body text-sm text-afs-ink-900 ${
                i === active ? 'bg-afs-bg-lane' : ''
              }`}
            >
              <span className="min-w-0 truncate">{s.name}</span>
              <span className="shrink-0 font-data text-xs uppercase tracking-wide text-afs-ink-700">{s.category}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {showCard ? (
        <aside
          role="status"
          className="afs-slide-in-right fixed right-4 top-36 z-40 w-[min(18rem,calc(100vw-2rem))] rounded border border-afs-crimson bg-afs-navy-900 p-4 shadow-2xl"
        >
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setCardDismissed(true)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded text-afs-chrome-mid hover:text-white"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
          <p className="pr-6 font-heading text-base font-bold text-white">Don't see your profile?</p>
          <p className="mt-1 font-body text-sm text-afs-chrome-mid">
            Draw it yourself and get a formal quote - no part number needed.
          </p>
          <Link
            href="/design-studio"
            className="mt-3 inline-flex min-h-[40px] items-center rounded-sm bg-afs-crimson px-4 py-2 font-label text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-afs-crimson-hover"
          >
            Design it in FlashDraft
          </Link>
        </aside>
      ) : null}
    </div>
  );
}
