import type { Metadata } from 'next';
import Link from 'next/link';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';

export const metadata: Metadata = {
  title: 'The Architect’s Platform | AFS Architectural Flashing Supply',
  description:
    'CSI Division 07 spec sections, CAD and Revit details, finish palettes, and custom profile libraries — everything needed to specify AFS products.',
};

interface FeatureCard {
  title: string;
  description: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
}

const ICON_CLASS = 'w-6 h-6 text-afs-copper';

const FEATURE_CARDS: FeatureCard[] = [
  {
    title: 'AI Spec Writer',
    description: 'CSI Division 07 spec sections in minutes.',
    href: '/architects/spec-writer',
    badge: 'Architect account required',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6M9 8h1m8-4H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7l-5-5z" />
      </svg>
    ),
  },
  {
    title: 'CAD Library',
    description: 'DWG, DXF, and Revit families for every profile.',
    href: '/architects/cad-library',
    badge: 'Browse free, download with account',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16v14H4zM4 9h16M9 9v10" />
      </svg>
    ),
  },
  {
    title: 'Finish Palette',
    description: 'Digital color chips and downloadable palettes.',
    href: '/architects/finish-palette',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h10a2 2 0 002-2v-2a2 2 0 00-2-2h-2.5M7 9h.01" />
      </svg>
    ),
  },
  {
    title: 'Custom Profiles',
    description: 'Your past custom profiles, searchable and reorderable.',
    href: '/architects/custom-profiles',
    badge: 'Account required',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 14h6v6H4z" />
      </svg>
    ),
  },
];

const WHY_SPEC_AFS = [
  {
    title: 'Quality and Industry Standards',
    body: 'Fabricated in-house to SMACNA Sheet Metal Manual practices, with every profile engineered for the wind uplift and drainage requirements of your project.',
  },
  {
    title: 'Speed of Delivery',
    body: 'Structured quote requests move straight into fabrication scheduling — no phone tag between the estimator and the shop floor.',
  },
  {
    title: 'Technical Support',
    body: 'Spec language, CAD details, and installation guidance come directly from the shop that builds the product, not a distributor reselling someone else’s catalog.',
  },
];

export default function ArchitectsPage() {
  return (
    <ArchitectShell>
      <section className="metal-edge metal-edge-copper px-6 pt-20 pb-16 text-center border-b border-afs-border">
        <ArchitectEyebrow>For Architects &amp; Specifiers</ArchitectEyebrow>
        <h1 className="font-display text-6xl md:text-[6rem] text-afs-chrome-high leading-none mb-6">
          THE ARCHITECT&apos;S PLATFORM
        </h1>
        <p className="font-body text-afs-chrome-mid text-xl max-w-2xl mx-auto mb-10">
          Spec language, CAD details, Revit families, and material data. Everything needed to specify AFS
          products in your drawings.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/architects/spec-writer"
            className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors"
          >
            Generate a Spec Section
          </Link>
          <Link
            href="/architects/cad-library"
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-8 py-3 rounded text-sm transition-colors"
          >
            Browse CAD Library
          </Link>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="metal-edge metal-edge-copper block bg-afs-bg-raised border border-afs-border rounded p-8 hover:border-afs-copper transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded bg-[var(--afs-copper-ghost)] flex items-center justify-center">
                  {card.icon}
                </div>
                {card.badge && (
                  <span className="inline-flex items-center gap-2 border border-afs-copper rounded font-label text-xs px-2 py-1 text-afs-copper whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-afs-copper" />
                    {card.badge}
                  </span>
                )}
              </div>
              <h3 className="font-heading text-2xl text-afs-chrome-high mb-2">{card.title}</h3>
              <p className="font-body text-sm text-afs-chrome-mid">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-afs-bg-raised border-y border-afs-border">
        <div className="max-w-[1280px] mx-auto px-6 py-16">
          <h2 className="font-heading text-3xl font-bold text-afs-chrome-high text-center mb-12">
            Why Architects Spec AFS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {WHY_SPEC_AFS.map((item) => (
              <div key={item.title} className="border-l-2 border-afs-copper pl-6">
                <h3 className="font-heading text-lg text-afs-chrome-high mb-2">{item.title}</h3>
                <p className="font-body text-sm text-afs-chrome-mid leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[860px] mx-auto px-6 py-20 text-center">
        <h2 className="font-heading text-3xl font-bold text-afs-chrome-high mb-3">
          Create a free architect account
        </h2>
        <p className="font-body text-base text-afs-chrome-mid mb-8">
          Access spec generation, CAD downloads, and direct technical support.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap mb-4">
          <Link
            href="/register"
            className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors"
          >
            Register as Architect
          </Link>
        </div>
        <p className="font-body text-sm text-afs-chrome-mid">
          Already have an account?{' '}
          <Link href="/login" className="text-afs-copper hover:text-afs-copper-hover">
            Sign In
          </Link>
        </p>
      </section>
    </ArchitectShell>
  );
}
