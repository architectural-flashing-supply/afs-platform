'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface Finish {
  id: string;
  name: string;
  manufacturer: string | null;
  colorCode: string | null;
  hexPreview: string | null;
  isStandard: boolean;
}

export default function FinishChip({ finish }: { finish: Finish }) {
  const [open, setOpen] = useState(false);
  const swatchColor = finish.hexPreview ?? 'var(--afs-chrome-dim)';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-2 group">
        <span
          className="w-20 h-20 rounded border border-afs-chrome-dim group-hover:border-afs-copper transition-colors block"
          style={{ backgroundColor: swatchColor }}
        />
        <span className="font-label text-sm text-afs-ink-700 group-hover:text-afs-ink-900 transition-colors text-center max-w-[100px]">
          {finish.name}
        </span>
        {!finish.isStandard && (
          <span className="font-data text-xs text-afs-copper">
            Special order
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--afs-bg-modal)] px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[420px] bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge metal-edge-copper p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <span
                  className="w-16 h-16 rounded border border-afs-chrome-dim shrink-0"
                  style={{ backgroundColor: swatchColor }}
                />
                <div>
                  <h2 className="font-heading text-xl text-afs-ink-900">{finish.name}</h2>
                  {finish.manufacturer && (
                    <p className="font-body text-sm text-afs-ink-700">{finish.manufacturer}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-afs-ink-700 hover:text-afs-ink-900"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <dl className="font-data text-sm text-afs-ink-900 space-y-2 mb-6">
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-ink-700">Color Code</dt>
                <dd>{finish.colorCode ?? '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-ink-700">Hex</dt>
                <dd>{finish.hexPreview ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-afs-ink-700">Availability</dt>
                <dd>{finish.isStandard ? 'Standard' : 'Special order'}</dd>
              </div>
            </dl>

            <Link
              href={`/contact?finish=${finish.id}`}
              className="block text-center bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              Request Sample
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
