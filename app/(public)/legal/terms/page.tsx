import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Sale | AFS Architectural Flashing Supply',
  description: 'AFS Architectural Flashing Supply terms of sale.',
};

export default function TermsOfSalePage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="max-w-[860px] mx-auto px-6 py-24 text-center">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">Legal</p>
        <h1 className="font-display text-5xl text-afs-chrome-high leading-none mb-6">TERMS OF SALE</h1>
        <div className="metal-edge metal-edge-red bg-afs-bg-raised border border-afs-border rounded p-10">
          <p className="font-body text-base text-afs-chrome-mid leading-relaxed">
            Terms of Sale coming soon. Contact{' '}
            <a
              href="mailto:tricia@architecturalflashingsupply.com"
              className="text-afs-crimson hover:text-afs-crimson-hover transition-colors"
            >
              tricia@architecturalflashingsupply.com
            </a>{' '}
            with questions.
          </p>
        </div>
      </div>
    </main>
  );
}
