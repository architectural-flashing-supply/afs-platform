'use client';

// hp-013 — Continental US map: the AFS HQ pin (Burnet, TX) plus a
// "Nationwide delivery" radius ring. No project pins are plotted — see
// nationwide-locations.ts for why (no CaseStudies project has a real,
// documented location in specs/, legacy-site content, or
// STATE_OF_THE_BUILD.md; this prompt's instruction is to not invent one).
//
// Leaflet/OpenStreetMap, reused from components/hailview/HailViewMap.tsx —
// no new map dependency, no API key required. Split into NationwideMapLeaflet
// (this file's dynamic-imported child) because react-leaflet touches
// `window`/`document` at import time and breaks Next's SSR pass otherwise;
// this file must stay a Client Component for next/dynamic's `ssr: false` to
// be legal at all (disallowed from Server Components).
//
// hpa-005 — deliberately NOT gated behind an IntersectionObserver the way
// FieldAppStory/ShopFloorProof's videos are: tests/e2e/homepage.spec.ts's
// "NationwideMap renders the HQ marker" test asserts the map and its tile
// layer are visible right after page.goto('/'), with no scroll -- viewport-
// gating this mount would leave [data-testid="nationwide-map"] out of the
// DOM for that test and fail it. next/dynamic's ssr:false already keeps
// Leaflet out of the server bundle and off the main chunk, which is the
// lazy-loading available here without breaking that contract.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ALL_LOCATIONS } from './nationwide-locations';
import RevealOnScroll from './RevealOnScroll';

const NationwideMapLeaflet = dynamic(() => import('./NationwideMapLeaflet'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-afs-bg-overlay" />,
});

export default function NationwideMap() {
  return (
    <section id="nationwide" className="bg-afs-bg-light py-20 md:py-28">
      <RevealOnScroll className="mx-auto max-w-6xl px-6">
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
          Texas Made. Nationally Delivered.
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl md:text-6xl">
          Fabricated in Burnet. Shipped Anywhere in the US.
        </h2>

        {/* Keyboard-accessible fallback for the map's marker(s) below --
            Leaflet markers/popups aren't reliably keyboard-operable -- kept
            to a single small line under the title rather than a separate
            "Locations" section, so the map (not the address) is what fills
            this section. */}
        <p className="mt-3 font-body text-sm text-afs-ink-700">
          {ALL_LOCATIONS.map((location, i) => (
            <span key={location.id}>
              {i > 0 && ', '}
              {location.href ? (
                <Link href={location.href} className="hover:text-afs-ink-900 hover:underline">
                  {location.name}
                </Link>
              ) : (
                location.name
              )}
            </span>
          ))}
        </p>

        <div className="mt-8 h-[500px] w-full overflow-hidden rounded border border-afs-border-light metal-edge md:h-[560px]">
          <NationwideMapLeaflet />
        </div>
      </RevealOnScroll>
    </section>
  );
}
