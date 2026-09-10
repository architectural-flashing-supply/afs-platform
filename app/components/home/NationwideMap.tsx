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

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ALL_LOCATIONS } from './nationwide-locations';

const NationwideMapLeaflet = dynamic(() => import('./NationwideMapLeaflet'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-afs-bg-overlay" />,
});

export default function NationwideMap() {
  return (
    <section id="nationwide" className="bg-afs-bg-base py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
          Texas Made. Nationally Delivered.
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
          Fabricated in Burnet. Shipped Anywhere in the US.
        </h2>

        <div className="mt-12 h-[320px] w-full overflow-hidden rounded border border-[var(--afs-border)] metal-edge md:h-[420px]">
          <NationwideMapLeaflet />
        </div>

        {/* Keyboard-accessible fallback list — same locations plotted on the
            map above, reachable without pointer interaction with the map
            (Leaflet markers/popups are not reliably keyboard-operable). */}
        <div className="mt-6">
          <h3 className="font-label text-xs font-semibold uppercase tracking-widest text-afs-chrome-dim">
            Locations
          </h3>
          <ul className="mt-3 space-y-2">
            {ALL_LOCATIONS.map((location) => (
              <li key={location.id} className="font-body text-sm text-afs-chrome-mid">
                {location.href ? (
                  <Link href={location.href} className="hover:text-afs-chrome-high hover:underline">
                    {location.name}
                  </Link>
                ) : (
                  location.name
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
