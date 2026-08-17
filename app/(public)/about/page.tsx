import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About | AFS Architectural Flashing Supply',
  description:
    'Founded by artisans with a vision for excellence. Decades of expertise in custom metal fabrication — coping caps, base flashing, and custom architectural sheet metal.',
};

const EQUIPMENT = [
  {
    name: 'Thalmann Verda ZR150 Folder',
    detail: 'Unlimited profiles',
    body:
      'CNC-driven folding technology capable of producing virtually any custom flashing profile to tight tolerances, without the fixed-tooling limits of a traditional brake.',
  },
  {
    name: 'Schlebach Quadro Roll Former',
    detail: 'High-volume roll forming',
    body:
      'Continuous roll forming for long-run profiles, delivering consistent dimensional accuracy across large orders.',
  },
  {
    name: 'Mobile Fabrication',
    detail: 'On-site capability',
    body:
      'Field-deployable fabrication equipment for jobsite runs where transporting finished long-length material isn’t practical.',
  },
];

const SUPPLIERS = ['Englert', 'Revere', 'McElroy Metal', 'Unimet', 'Drexel', 'PAC-CLAD'];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      {/* Hero */}
      <section className="metal-edge metal-edge-red px-6 pt-20 pb-16 text-center border-b border-afs-border">
        <p className="eyebrow-label text-sm tracking-widest mb-3">About AFS</p>
        <h1 className="font-display text-6xl md:text-[6rem] text-afs-chrome-high leading-none mb-6">
          BUILT BY ARTISANS
        </h1>
        <p className="font-body text-afs-chrome-mid text-xl max-w-2xl mx-auto">
          Founded by artisans with a vision for excellence. Decades of expertise in custom metal fabrication.
        </p>
      </section>

      {/* Story + photography placeholder */}
      <section className="max-w-[1280px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="font-heading text-3xl font-bold text-afs-chrome-high mb-4">Our Story</h2>
          <p className="font-body text-base text-afs-chrome-mid leading-relaxed mb-4">
            Founded by artisans with a vision for excellence, AFS has spent decades building a reputation for
            precision custom metal fabrication. What started as hands-on sheet metal craft has grown into a
            full-scale operation without losing the standard that built it: every piece fabricated to exact
            specification, every order treated like the only one on the shop floor.
          </p>
          <p className="font-body text-base text-afs-chrome-mid leading-relaxed">
            Today AFS fabricates coping caps, base flashing, counter flashing, step flashing, drip edge, gravel
            stop, and custom architectural profiles in copper, aluminum, galvanized steel, stainless, and
            Galvalume &mdash; built to SMACNA standards and shipped nationwide.
          </p>
        </div>
        <div
          className="h-80 rounded metal-edge metal-edge-red bg-gradient-to-br from-afs-bg-surface via-afs-bg-raised to-afs-bg-dim border border-afs-border flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="font-label text-xs text-afs-chrome-dim uppercase tracking-widest">
            Shop Photography Coming Soon
          </span>
        </div>
      </section>

      {/* Equipment */}
      <section className="bg-afs-bg-raised border-y border-afs-border">
        <div className="max-w-[1280px] mx-auto px-6 py-16">
          <h2 className="font-heading text-3xl font-bold text-afs-chrome-high text-center mb-2">
            Fabrication Equipment
          </h2>
          <p className="font-body text-sm text-afs-chrome-mid text-center max-w-xl mx-auto mb-12">
            Precision equipment built for custom work, not a fixed catalog.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {EQUIPMENT.map((item) => (
              <div
                key={item.name}
                className="metal-edge metal-edge-red bg-afs-bg-base border border-afs-border rounded p-8"
              >
                <span className="inline-block eyebrow-label text-xs tracking-widest border border-afs-crimson rounded px-2 py-1 mb-4">
                  {item.detail}
                </span>
                <h3 className="font-heading text-xl text-afs-chrome-high mb-3">{item.name}</h3>
                <p className="font-body text-sm text-afs-chrome-mid leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supplier partners */}
      <section className="max-w-[1280px] mx-auto px-6 py-16">
        <h2 className="font-heading text-3xl font-bold text-afs-chrome-high text-center mb-2">
          Material Partners
        </h2>
        <p className="font-body text-sm text-afs-chrome-mid text-center max-w-xl mx-auto mb-12">
          AFS sources and fabricates using material from leading manufacturers.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {SUPPLIERS.map((supplier) => (
            <span
              key={supplier}
              className="font-heading text-xl md:text-2xl text-afs-chrome-base hover:text-afs-chrome-high transition-colors"
            >
              {supplier}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-afs-crimson">
        <div className="max-w-[860px] mx-auto px-6 py-16 text-center">
          <h2 className="font-heading text-3xl font-bold text-white mb-3">Ready to Get a Quote?</h2>
          <p className="font-body text-base text-white/85 mb-8">
            Upload a drawing or submit a quote request &mdash; no phone call required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/upload"
              className="bg-white text-afs-crimson font-label font-semibold px-8 py-3 rounded text-sm hover:bg-white/90 transition-colors"
            >
              Upload a Drawing
            </Link>
            <Link
              href="/quote"
              className="border border-white text-white font-label font-semibold px-8 py-3 rounded text-sm hover:bg-white/10 transition-colors"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
