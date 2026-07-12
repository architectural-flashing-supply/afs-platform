import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import { getCategory, GAUGES_BY_MATERIAL } from '@/lib/data/catalog';
import { generateProfileSVG, slugToProfileType } from '@/lib/utils/profile-svg';

interface SpecPageProps {
  params: { profileSlug: string };
}

export function generateMetadata({ params }: SpecPageProps): Metadata {
  const category = getCategory(params.profileSlug);
  const name = category?.name ?? params.profileSlug;
  return {
    title: `${name} Material Specification | AFS Architectural Flashing Supply`,
    description: `Material data, ASTM references, and specification support for ${name} — AFS Architectural Flashing Supply.`,
  };
}

export default function MaterialSpecPage({ params }: SpecPageProps) {
  const category = getCategory(params.profileSlug);
  if (!category) notFound();

  const profileType = category.profileType ?? slugToProfileType(category.slug);
  const svgMarkup = profileType ? generateProfileSVG({ profileType }) : null;

  return (
    <ArchitectShell>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <ArchitectEyebrow>Material Specification &amp; Data Sheet</ArchitectEyebrow>
        <h1 className="font-display text-6xl text-afs-chrome-high leading-none mb-4">
          {category.name.toUpperCase()}
        </h1>
        <p className="font-body text-afs-chrome-mid text-base max-w-2xl mb-10">{category.shortDescription}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge metal-edge-copper p-6 flex items-center justify-center">
            {svgMarkup ? (
              <div className="w-full max-w-[320px] aspect-square" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            ) : (
              <p className="font-body text-sm text-afs-chrome-dim text-center">
                Profile diagram not available for this category.
              </p>
            )}
          </div>

          <div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-4 uppercase tracking-wide">
              Compatible Materials
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-afs-chrome-dim">
                  <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-mid py-2">
                    Material
                  </th>
                  <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-mid py-2">
                    Gauge Range
                  </th>
                </tr>
              </thead>
              <tbody>
                {category.materials.map((m) => (
                  <tr key={m} className="border-b border-afs-chrome-dim last:border-b-0">
                    <td className="font-body text-afs-chrome-high py-2">{m}</td>
                    <td className="font-data text-xs text-afs-chrome-mid py-2">
                      {(GAUGES_BY_MATERIAL[m] ?? []).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
          <div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3 uppercase tracking-wide">
              ASTM References
            </h2>
            <p className="font-data text-sm text-afs-chrome-mid mb-2">ASTM B370, ASTM A653</p>
            <p className="font-body text-xs text-afs-chrome-dim">
              Confirmed material-specific ASTM references are being finalized and will replace this general
              reference list.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3 uppercase tracking-wide">
              SMACNA Reference
            </h2>
            <p className="font-body text-sm text-afs-chrome-mid">
              See the SMACNA Architectural Sheet Metal Manual, current edition, for flashing and trim
              fabrication and installation details applicable to this profile.
            </p>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3 uppercase tracking-wide">
            Application Guide
          </h2>
          <p className="font-body text-sm text-afs-chrome-mid leading-relaxed mb-4">{category.description}</p>
          <div className="flex gap-2 flex-wrap">
            {category.applications.map((a) => (
              <span
                key={a}
                className="font-label text-xs px-3 py-1.5 rounded border border-afs-chrome-dim text-afs-chrome-mid"
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-12 bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-2 uppercase tracking-wide">
            Data Sheet Downloads
          </h2>
          <p className="font-body text-sm text-afs-chrome-mid">
            Technical data sheets for this profile are in preparation and will be available here once
            received from our materials team.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3 uppercase tracking-wide">
            Related Products
          </h2>
          <Link
            href={`/products/${category.slug}`}
            className="font-body text-sm text-afs-copper hover:text-afs-copper-hover transition-colors"
          >
            View all {category.name} products →
          </Link>
        </div>

        <div className="metal-edge metal-edge-copper bg-afs-bg-raised border border-afs-border rounded p-8 text-center">
          <h2 className="font-heading text-xl text-afs-chrome-high mb-2">Generate a CSI Spec Section</h2>
          <p className="font-body text-sm text-afs-chrome-mid mb-6">
            Turn this profile and material data into a CSI Division 07 specification section in minutes.
          </p>
          <Link
            href={`/architects/spec-writer?profile=${category.slug}`}
            className="inline-block bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
          >
            Open Spec Writer
          </Link>
        </div>
      </div>
    </ArchitectShell>
  );
}
