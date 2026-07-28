import type { Metadata } from 'next';
import ResourcesBrowser from '@/components/resources/ResourcesBrowser';

export const metadata: Metadata = {
  title: 'Industry Resources | Architectural Flashing Supply — Division 7 References & Standards',
  description:
    'Comprehensive architectural sheet metal and roofing industry resources including SMACNA, NRCA, SPRI standards, ASTM material specifications, building codes, and Division 7 references for architects and contractors.',
};

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <section className="metal-edge metal-edge-red px-6 pt-20 pb-10 text-center border-b border-afs-border">
        <h1 className="font-heading text-afs-crimson text-5xl md:text-6xl font-bold leading-none mb-4">
          INDUSTRY RESOURCES
        </h1>
        <p className="font-body text-afs-chrome-mid text-lg max-w-2xl mx-auto mb-4">
          Curated references for architects, specifiers, and contractors working with architectural
          sheet metal and Division 07
        </p>
        <p className="text-xs text-afs-chrome-mid max-w-2xl mx-auto">
          AFS provides these links as a courtesy. All linked resources are owned by their respective
          organizations. AFS is not affiliated with any of the organizations listed.
        </p>
      </section>

      <div className="pt-12">
        <ResourcesBrowser />
      </div>
    </main>
  );
}
