import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Design Studio | AFS Architectural Flashing Supply',
  description:
    'Five ways to spec your flashing: scan a construction drawing, photograph existing flashing, draw your exact profile with FlashDraft, configure a standard profile with exact dimensions, or build a quick quote.',
};

interface StudioTab {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  icon: React.ReactNode;
}

const TABS: StudioTab[] = [
  {
    title: 'Scan to Quote',
    body: 'Upload construction drawings in PDF, DWG, or DXF. AI extracts every profile, dimension, and quantity automatically.',
    ctaLabel: 'Upload a Drawing',
    ctaHref: '/upload',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 2.25H6a2.25 2.25 0 00-2.25 2.25v15A2.25 2.25 0 006 21.75h12a2.25 2.25 0 002.25-2.25v-15A2.25 2.25 0 0018 2.25h-3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 2.25v3a.75.75 0 00.75.75h4.5A.75.75 0 0015 5.25v-3M8 12h8M8 15.5h8M8 8.5h3" />
      </svg>
    ),
  },
  {
    title: 'Photo to Quote',
    body: 'Photograph existing flashing in the field. AI identifies profile type and material. You enter site measurements.',
    ctaLabel: 'Upload Photos',
    ctaHref: '/upload/photo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.25 2.25 0 018.978 4.5h6.044a2.25 2.25 0 012.151 1.675l.107.376a1.5 1.5 0 001.436 1.099h.594c1.036 0 1.875.84 1.875 1.875v10.126c0 1.035-.84 1.875-1.875 1.875H4.75A1.875 1.875 0 012.875 19.65V9.525c0-1.036.84-1.875 1.875-1.875h.594a1.5 1.5 0 001.436-1.099l.047-.376z" />
        <circle cx="12" cy="14" r="3.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'FlashDraft',
    body: 'Draw your exact profile on a canvas. Specify dimensions precisely. Matched against our machine library for instant fabrication.',
    ctaLabel: 'Open FlashDraft',
    ctaHref: '/studio/draft',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l3-3 3 2 4-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a1.5 1.5 0 012.121 2.121L11 13.25l-3 .75.75-3 7.75-7.5z" />
      </svg>
    ),
  },
  {
    title: 'Custom Configurator',
    body: 'Pick a standard profile and enter exact dimensions. Live diagram updates as you type.',
    ctaLabel: 'Open Configurator',
    ctaHref: '/configure',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5l4.5-4.5 3 3 4.5-6 5 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20.25h18M6 20.25v-3M12 20.25v-2M17 20.25v-4" />
      </svg>
    ),
  },
  {
    title: 'Quick Quote',
    body: 'Know what you need? Select profile types, materials, and quantities. We follow up with formal pricing.',
    ctaLabel: 'Build a Quote',
    ctaHref: '/quote',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6a1.5 1.5 0 011.5 1.5v.75h-9v-.75a1.5 1.5 0 011.5-1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 5.25H6A1.5 1.5 0 004.5 6.75v13.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V6.75a1.5 1.5 0 00-1.5-1.5h-1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h8M8 14h8M8 17h5" />
      </svg>
    ),
  },
];

export default function DesignStudioPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="px-6 pt-14 pb-10 text-center">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">Design Studio</p>
        <h1 className="font-display text-6xl text-afs-chrome-high leading-none mb-4">Design Studio</h1>
        <p className="font-body text-afs-chrome-mid text-base max-w-xl mx-auto">
          Five ways to spec your flashing. One destination.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-10 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {TABS.map((tab) => (
          <div
            key={tab.title}
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-4 flex flex-col"
          >
            <div className="text-afs-crimson mb-3">{tab.icon}</div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-1.5">{tab.title}</h2>
            <p className="font-body text-xs text-afs-chrome-mid mb-4 flex-1">{tab.body}</p>
            <Link
              href={tab.ctaHref}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-xs px-3 py-2 rounded transition-colors"
            >
              {tab.ctaLabel}
            </Link>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Profile Library</h2>
            <p className="font-body text-sm text-afs-chrome-mid">
              Browse every profile in our machine library, compare up to three side by side, and load one straight into FlashDraft.
            </p>
          </div>
          <Link
            href="/studio/library"
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-sm px-5 py-2.5 rounded transition-colors shrink-0"
          >
            Browse Profile Library
          </Link>
        </div>
      </div>
    </main>
  );
}
