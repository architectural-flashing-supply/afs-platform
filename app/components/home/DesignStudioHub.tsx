'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';

interface DesignMethod {
  id: string;
  title: string;
  description: string;
  bestFor: string;
  href: string;
}

// Routes verified against SITEMAP.md and a direct read of app/ — not
// invented. Scan Plans and Quick Quote are documented there directly
// (/upload, /quote). Photo to Quote is NOT /upload — that route has no
// photo-specific mode; the real field-contractor camera-to-quote flow is
// /field/contractor (app/field/contractor/page.tsx, already linked from
// FieldAppStory.tsx). FlashDraft and Configurator are /studio/draft and
// /configure, both confirmed live in app/studio/page.tsx's own tab links.
const METHODS: DesignMethod[] = [
  {
    id: 'scan-plans',
    title: 'Scan Plans',
    description:
      'Upload a construction drawing in PDF, DWG, or DXF. AI extracts every profile, dimension, and quantity automatically.',
    bestFor: 'Best for full sets of construction drawings and blueprint takeoffs.',
    href: '/upload',
  },
  {
    id: 'photo-to-quote',
    title: 'Photo to Quote',
    description:
      'Snap a photo of existing flashing from the jobsite. AI identifies the profile type and material — you enter the measurements.',
    bestFor: 'Best for field contractors and superintendents on-site with no drawings on hand.',
    href: '/field/contractor',
  },
  {
    id: 'flashdraft',
    title: 'FlashDraft',
    description:
      'Draw your exact profile on a canvas and specify dimensions precisely. Matched against our machine library for instant fabrication.',
    bestFor: "Best for custom or unusual profiles that don't match a standard catalog shape.",
    href: '/studio/draft',
  },
  {
    id: 'configurator',
    title: 'Configurator',
    description: 'Pick a standard profile and enter exact dimensions. A live diagram updates as you type.',
    bestFor: 'Best for standard profiles where you already know the exact dimensions.',
    href: '/configure',
  },
  {
    id: 'quick-quote',
    title: 'Quick Quote',
    description:
      'Select profile types, materials, and quantities from a guided wizard. We follow up with formal pricing.',
    bestFor: "Best for multiple items, or when you'd rather describe than draw.",
    href: '/quote',
  },
];

const DEFAULT_INDEX = 2; // FlashDraft

export default function DesignStudioHub() {
  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_INDEX);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAndFocus = (index: number) => {
    setSelectedIndex(index);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % METHODS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + METHODS.length) % METHODS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = METHODS.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      selectAndFocus(nextIndex);
    }
  };

  const selected = METHODS[selectedIndex];

  return (
    <section id="design-studio" className="bg-afs-bg-base py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
            Five Ways to Start
          </h2>
          <p className="mt-4 font-body text-base text-afs-chrome-mid md:text-lg">
            Pick the method that fits what you have. Every path leads to a formal AFS quote.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Design Studio methods"
          className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:gap-4 sm:overflow-visible sm:pb-0"
        >
          {METHODS.map((method, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={method.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`design-studio-tab-${method.id}`}
                aria-selected={isSelected}
                aria-controls="design-studio-panel"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectAndFocus(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`flex w-[220px] shrink-0 snap-center flex-col rounded border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson sm:w-auto ${
                  isSelected
                    ? 'border-afs-crimson bg-afs-bg-raised metal-edge-red'
                    : 'border-[var(--afs-border)] bg-afs-bg-raised hover:bg-afs-bg-surface'
                }`}
              >
                <span className="font-heading text-lg text-afs-chrome-high">{method.title}</span>
                <span className="mt-1 font-body text-xs text-afs-chrome-mid">{method.description}</span>
              </button>
            );
          })}
        </div>

        <div
          id="design-studio-panel"
          role="tabpanel"
          aria-labelledby={`design-studio-tab-${selected.id}`}
          className="mt-8 rounded border border-[var(--afs-border)] bg-afs-bg-raised p-8 metal-edge"
        >
          <h3 className="font-heading text-2xl text-afs-chrome-high">{selected.title}</h3>
          <p className="mt-3 max-w-2xl font-body text-base text-afs-chrome-mid">{selected.description}</p>
          <p className="mt-3 font-label text-sm font-semibold uppercase tracking-wide text-afs-chrome-mid">
            {selected.bestFor}
          </p>
          <Link
            href={selected.href}
            aria-label={`Start ${selected.title}`}
            className="mt-6 inline-block rounded bg-afs-crimson px-8 py-3.5 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
          >
            Start
          </Link>
        </div>
      </div>
    </section>
  );
}
