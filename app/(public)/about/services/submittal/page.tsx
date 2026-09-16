'use client';

import { useState } from 'react';
import Link from 'next/link';

// TODO: Replace with actual profile images from public/images/profiles/ once
// real photography exists (see CLAUDE.md's DATA BLOCKERS table -- product
// photography is listed there as not yet received). Until then these are
// gunmetal-to-crimson gradient placeholder cards, not real profile photos --
// no specific per-profile application claim (material, gauge, install site)
// is invented for any of them.
const PLACEHOLDER_PROFILE_COUNT = 24;
const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;

interface PlaceholderProfile {
  id: number;
  name: string;
}

const PLACEHOLDER_PROFILES: PlaceholderProfile[] = Array.from(
  { length: PLACEHOLDER_PROFILE_COUNT },
  (_, i) => ({ id: i + 1, name: `Profile ${String(i + 1).padStart(2, '0')}` })
);

const PROCESS_STEPS = [
  {
    title: 'Submit Project Requirements',
    description: 'Provide your project specifications, drawings, and submittal needs.',
  },
  {
    title: 'AFS Reviews & Plans',
    description: 'Our team designs the submittal package and fabricates samples.',
  },
  {
    title: 'Quality Control & Packaging',
    description: 'Every profile is inspected, tested, and professionally packaged.',
  },
  {
    title: 'Delivery',
    description: 'Complete submittal packages delivered to your project site or office.',
  },
];

export default function SubmittalServicesPage() {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [selectedProfile, setSelectedProfile] = useState<PlaceholderProfile | null>(null);

  const visibleProfiles = PLACEHOLDER_PROFILES.slice(0, visibleCount);
  const allLoaded = visibleCount >= PLACEHOLDER_PROFILES.length;

  return (
    <main className="bg-afs-bg-base">
      {/* Hero + breadcrumb */}
      <section className="bg-gradient-to-br from-afs-bg-dim to-afs-bg-base px-6 pb-16 pt-12">
        <div className="mx-auto max-w-4xl">
          <nav aria-label="Breadcrumb" className="font-label text-xs text-afs-chrome-dim">
            <Link href="/" className="hover:text-afs-chrome-mid">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/about/services" className="hover:text-afs-chrome-mid">Services</Link>
            <span className="mx-2">/</span>
            <span className="text-afs-chrome-mid">Submittal Services</span>
          </nav>

          <h1 className="mt-6 font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
            Architectural Submittal Services
          </h1>

          <div className="mt-6 flex flex-col gap-4 font-body text-lg text-afs-chrome-mid">
            <p>
              AFS provides comprehensive project submittal packages for commercial,
              architectural, and large-scale construction projects.
            </p>
            <p>
              Depending on project requirements, submittals may include custom profile
              samples, finish and color samples, product specifications, drawings,
              technical documentation, material selections, labeling, organization, and
              other project-specific documentation required for review and approval.
            </p>
            <p>
              Large projects may require the preparation of dozens of individual
              profiles and samples. Our team can manage the process from initial
              requirements through delivery of a complete, professionally organized
              submittal package.
            </p>
          </div>
        </div>
      </section>

      {/* Profile portfolio */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="font-heading text-3xl font-semibold text-afs-chrome-high sm:text-4xl">
          Our Portfolio of Profiles
        </h2>
        <p className="mt-3 max-w-2xl font-body text-base text-afs-chrome-mid">
          We&apos;ve designed and fabricated 60+ unique profiles for leading brands and
          institutions. Here&apos;s a selection of our work.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {visibleProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setSelectedProfile(profile)}
              className="group relative aspect-[3/2] overflow-hidden rounded border border-afs-border bg-gradient-to-br from-afs-bg-overlay to-afs-crimson/40 text-left transition-colors hover:border-afs-crimson"
            >
              <span className="absolute inset-0 flex items-center justify-center font-display text-xl text-afs-chrome-high">
                {profile.name}
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-afs-bg-dim/80 px-3 py-1.5 font-label text-[11px] uppercase tracking-wider text-afs-chrome-mid">
                Material — Gauge
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => Math.min(c + LOAD_MORE_STEP, PLACEHOLDER_PROFILES.length))}
            disabled={allLoaded}
            className="rounded border border-afs-border px-8 py-3 font-label text-sm font-semibold text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {allLoaded ? 'All Profiles Loaded' : 'Load More Profiles'}
          </button>
        </div>
      </section>

      {/* Detail modal */}
      {selectedProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedProfile.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setSelectedProfile(null)}
        >
          <div
            className="w-full max-w-lg border border-afs-border bg-afs-bg-raised p-8 metal-edge"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-square w-full overflow-hidden rounded bg-gradient-to-br from-afs-bg-overlay to-afs-crimson/40">
              <div className="flex h-full items-center justify-center font-display text-3xl text-afs-chrome-high">
                {selectedProfile.name}
              </div>
            </div>
            <h3 className="mt-6 font-heading text-2xl font-semibold text-afs-chrome-high">
              {selectedProfile.name}
            </h3>
            <p className="mt-1 font-label text-xs uppercase tracking-wider text-afs-chrome-mid">
              Material — Gauge
            </p>
            <p className="mt-4 font-body text-sm text-afs-chrome-mid">
              Application details for this profile are being finalized -- contact AFS
              for the full specification.
            </p>
            <button
              type="button"
              onClick={() => setSelectedProfile(null)}
              className="mt-8 rounded border border-afs-border px-6 py-3 font-label text-sm font-semibold text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Process timeline */}
      <section className="bg-afs-bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-heading text-3xl font-semibold text-afs-chrome-high sm:text-4xl">
            How Submittal Services Work
          </h2>

          <ol className="relative mt-12 flex flex-col gap-10">
            {/* Vertical connector rail behind the numbered circles. */}
            <div
              className="absolute left-4 top-4 bottom-4 w-0.5 bg-afs-chrome-dim"
              aria-hidden="true"
            />
            {PROCESS_STEPS.map((step, i) => (
              <li key={step.title} className="relative flex items-start gap-5">
                <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-afs-crimson font-data text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-afs-chrome-high">
                    {step.title}
                  </h3>
                  <p className="mt-1 font-body text-sm text-afs-chrome-mid">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
        <h3 className="font-heading text-2xl font-semibold text-afs-chrome-high">
          Custom-Quoted Service
        </h3>
        <p className="mx-auto mt-4 max-w-xl font-body text-base text-afs-chrome-mid">
          Submittal services are priced by project due to the wide variation in scope,
          quantity, complexity, materials, documentation requirements, and turnaround
          time.
        </p>
        <p className="mx-auto mt-4 max-w-xl font-body text-base text-afs-chrome-mid">
          Submit your project requirements and AFS will provide a detailed quote before
          work begins.
        </p>
        <Link
          href="/contact?service=submittal"
          className="mt-8 inline-block rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
        >
          Request a Submittal Quote
        </Link>
      </section>

      {/* No testimonial/case-study section -- no real quote or client
          attribution for submittal work has been provided, and inventing
          one attributed to a real company would be a fabricated
          endorsement. Skipped per this task's own fallback instruction
          ("If none available: Skip this section for now"). */}

      {/* Bottom CTA */}
      <section className="bg-afs-crimson py-16 text-center text-white">
        <h2 className="font-display text-3xl leading-none sm:text-4xl">
          Need Custom Submittal Services?
        </h2>
        <Link
          href="/contact?service=submittal"
          className="mt-8 inline-block rounded bg-white px-8 py-4 font-label text-sm font-semibold text-afs-crimson transition-colors hover:bg-white/90"
        >
          Request a Quote
        </Link>
      </section>
    </main>
  );
}
