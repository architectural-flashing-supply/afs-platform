'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { generateProfileSVG } from '@/lib/utils/profile-svg';
import { FINISHES, GAUGES_BY_MATERIAL, type CatalogCategory, type CatalogProduct } from '@/lib/data/catalog';
import StockBadge from './StockBadge';

type Tab = 'overview' | 'specifications' | 'installation' | 'documents';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'installation', label: 'Installation' },
  { key: 'documents', label: 'Technical Documents' },
];

export default function ProductDetailView({
  category,
  product,
}: {
  category: CatalogCategory;
  product: CatalogProduct;
}) {
  const [selectedMaterial, setSelectedMaterial] = useState(product.materials[0]);
  const [selectedGauge, setSelectedGauge] = useState<string | null>(null);
  const [selectedFinish, setSelectedFinish] = useState(FINISHES[0].name);
  const [tab, setTab] = useState<Tab>('overview');

  const gaugeOptions = useMemo(() => GAUGES_BY_MATERIAL[selectedMaterial] ?? [], [selectedMaterial]);
  const activeGauge = selectedGauge && gaugeOptions.includes(selectedGauge) ? selectedGauge : gaugeOptions[0] ?? null;

  const svgMarkup = useMemo(
    () => (product.profileType ? generateProfileSVG({ profileType: product.profileType }) : null),
    [product.profileType]
  );

  const configureHref = product.profileType
    ? `/configure?profile=${product.profileType}&material=${encodeURIComponent(selectedMaterial)}`
    : '/configure';

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-4">
        {/* LEFT — DIAGRAM */}
        <div>
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 min-h-[380px] flex items-center justify-center">
            {svgMarkup ? (
              <div className="w-full max-w-[380px] aspect-square" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            ) : (
              <div className={`w-full h-[320px] rounded bg-gradient-to-br ${category.gradientClass} bg-afs-bg-surface flex items-center justify-center`}>
                <span className="font-heading text-lg text-afs-chrome-mid px-6 text-center">
                  {product.name}
                </span>
              </div>
            )}
          </div>
          <p className="font-body text-xs text-afs-chrome-dim mt-3 text-center">
            Profile illustration — for reference only, not a fabrication drawing.
          </p>
        </div>

        {/* RIGHT — DETAILS */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            {product.sku && (
              <span className="font-data text-xs text-afs-chrome-dim border border-afs-chrome-dim rounded px-2 py-1">
                {product.sku}
              </span>
            )}
            <StockBadge stockType={product.stockType} size="lg" />
          </div>

          <h1 className="font-heading text-4xl font-bold text-afs-chrome-high mb-2">{product.name}</h1>
          <p className="font-body text-afs-chrome-mid mb-1">{selectedMaterial}{activeGauge ? ` — ${activeGauge}` : ''}</p>
          <p className="font-data text-sm text-afs-chrome-dim mb-6">
            Lead time: {product.leadTimeDays} business days
          </p>

          {product.rushEligible && (
            <div className="mb-6 border border-afs-crimson bg-[var(--afs-crimson-ghost)] rounded px-4 py-3">
              <p className="font-body text-sm text-afs-chrome-high">
                Rush fabrication available — mention it in your quote request.
              </p>
            </div>
          )}

          {product.materials.length > 1 && (
            <div className="mb-6">
              <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">
                Material
              </span>
              <div className="grid grid-cols-2 gap-2">
                {product.materials.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setSelectedMaterial(m); setSelectedGauge(null); }}
                    className={`font-label text-sm px-3 py-2.5 rounded border text-left transition-colors ${
                      m === selectedMaterial
                        ? 'bg-[var(--afs-crimson-ghost)] border-afs-crimson text-afs-chrome-high'
                        : 'bg-afs-bg-overlay border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gaugeOptions.length > 0 && (
            <div className="mb-6">
              <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">
                Gauge / Thickness
              </span>
              <div className="flex flex-wrap gap-2">
                {gaugeOptions.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGauge(g)}
                    className={`font-data text-sm px-3 py-1.5 rounded border transition-colors ${
                      g === activeGauge
                        ? 'bg-[var(--afs-crimson-ghost)] border-afs-crimson text-afs-chrome-high'
                        : 'bg-afs-bg-overlay border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">
              Finish
            </span>
            <div className="flex flex-wrap gap-3">
              {FINISHES.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelectedFinish(f.name)}
                  title={f.name}
                  className={`w-10 h-10 rounded border-2 transition-colors ${
                    f.name === selectedFinish ? 'border-afs-crimson' : 'border-afs-border'
                  }`}
                  style={{ backgroundColor: f.hex }}
                />
              ))}
            </div>
            <p className="font-body text-xs text-afs-chrome-mid mt-2">{selectedFinish}</p>
          </div>

          <div className="mb-8 bg-afs-bg-surface border border-afs-chrome-dim rounded p-4">
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">
              Dimension Reference
            </span>
            <dl className="grid grid-cols-1 gap-1.5">
              {product.dimensions.map((d) => (
                <div key={d.label} className="flex justify-between font-data text-sm">
                  <dt className="text-afs-chrome-mid">{d.label}</dt>
                  <dd className="text-afs-chrome-high">{d.value}</dd>
                </div>
              ))}
            </dl>
            <p className="font-body text-xs text-afs-chrome-dim mt-3">
              Reference ranges only — use the configurator to submit exact custom dimensions.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={`/quote?product=${product.slug}&profile=${category.slug}`}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold px-6 py-3.5 rounded text-sm transition-colors"
            >
              Request a Quote for This Product
            </Link>
            <Link
              href={configureHref}
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface text-center font-label font-semibold px-6 py-3.5 rounded text-sm transition-colors"
            >
              Configure Custom Dimensions
            </Link>
          </div>
        </div>
      </div>

      {/* BELOW FOLD — TABS */}
      <div className="mt-14">
        <div className="flex gap-6 border-b border-afs-chrome-dim mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`font-label text-sm uppercase tracking-wide px-1 pb-3 whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-afs-crimson text-afs-chrome-high'
                  : 'border-transparent text-afs-chrome-dim hover:text-afs-chrome-mid'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="max-w-3xl">
            <p className="font-body text-base text-afs-chrome-mid mb-6 leading-relaxed">{product.description}</p>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-3 block">
              Applications
            </span>
            <ul className="list-disc list-inside font-body text-sm text-afs-chrome-mid space-y-1.5">
              {product.applications.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'specifications' && (
          <div className="max-w-3xl">
            <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-afs-bg-surface">
                    <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                      Material
                    </th>
                    <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                      Compatible Gauges
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.materials.map((m) => (
                    <tr key={m} className="border-t border-afs-chrome-dim">
                      <td className="font-body text-afs-chrome-high px-4 py-3">{m}</td>
                      <td className="font-data text-afs-chrome-mid px-4 py-3">
                        {(GAUGES_BY_MATERIAL[m] ?? []).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-3 block">
              Dimension Ranges
            </span>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {product.dimensions.map((d) => (
                <div key={d.label} className="bg-afs-bg-surface border border-afs-chrome-dim rounded px-4 py-3">
                  <dt className="font-label text-xs uppercase text-afs-chrome-dim">{d.label}</dt>
                  <dd className="font-data text-sm text-afs-chrome-high">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {tab === 'installation' && (
          <div className="max-w-3xl">
            <p className="font-body text-sm text-afs-chrome-mid mb-4">
              Full field installation guidance for {product.name.toLowerCase()} is available in the AFS
              Architectural Resource Center, including fastening patterns, sealant details, and common
              mistakes to avoid.
            </p>
            <Link
              href={`/architects/guides/${category.slug}`}
              className="font-label text-sm text-afs-crimson hover:text-afs-crimson-hover transition-colors"
            >
              View full installation guide →
            </Link>
          </div>
        )}

        {tab === 'documents' && (
          <div className="max-w-3xl">
            <p className="font-body text-sm text-afs-chrome-mid mb-4">
              CAD details, Revit families, and data sheets for {category.name.toLowerCase()} are available
              in the AFS CAD/BIM Library. Downloads require a free AFS account.
            </p>
            <Link
              href="/architects/cad-library"
              className="font-label text-sm text-afs-crimson hover:text-afs-crimson-hover transition-colors"
            >
              Browse CAD Library →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
