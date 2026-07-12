import Link from 'next/link';
import { generateProfileSVG, slugToProfileType } from '@/lib/utils/profile-svg';

export interface SavedConfig {
  id: string;
  name: string | null;
  profileName: string;
  profileSlug: string | null;
  materialName: string | null;
  gaugeLabel: string | null;
  width: number | null;
  height: number | null;
  legA: number | null;
  legB: number | null;
  lengthFt: number | null;
  quantity: number | null;
  updatedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDimensions(config: SavedConfig): string {
  const parts: string[] = [];
  if (config.width) parts.push(`${config.width}"W`);
  if (config.height) parts.push(`${config.height}"H`);
  if (config.legA) parts.push(`${config.legA}"A`);
  if (config.legB) parts.push(`${config.legB}"B`);
  return parts.length > 0 ? parts.join(' × ') : '—';
}

export default function SavedConfigCard({ config }: { config: SavedConfig }) {
  const profileType = slugToProfileType(config.profileSlug);
  const svgMarkup = profileType
    ? generateProfileSVG({
        profileType,
        width: config.width,
        height: config.height,
        legA: config.legA,
        legB: config.legB,
      })
    : null;

  return (
    <div
      className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge metal-edge-copper overflow-hidden flex flex-col sm:flex-row"
      data-testid="saved-config-card"
    >
      <div className="sm:w-[160px] shrink-0 bg-afs-bg-dim flex items-center justify-center p-4">
        {svgMarkup ? (
          <div className="w-full aspect-square" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
        ) : (
          <span className="font-label text-xs text-afs-chrome-dim text-center">{config.profileName}</span>
        )}
      </div>

      <div className="flex-1 p-5 flex flex-col">
        <h3 className="font-heading text-lg text-afs-chrome-high mb-1">{config.name || config.profileName}</h3>
        <p className="font-body text-sm text-afs-chrome-mid mb-2">
          {[config.materialName, config.gaugeLabel].filter(Boolean).join(' — ') || '—'}
        </p>
        <p className="font-data text-xs text-afs-copper mb-1">{formatDimensions(config)}</p>
        {config.lengthFt != null && config.quantity != null && (
          <p className="font-data text-xs text-afs-chrome-mid mb-2">
            {config.lengthFt} ft × Qty {config.quantity}
          </p>
        )}
        <p className="font-body text-xs text-afs-chrome-dim mb-4">Saved {formatDate(config.updatedAt)}</p>

        <div className="mt-auto flex gap-3">
          <Link
            href={`/quote?step=4&from_config=${config.id}`}
            className="flex-1 text-center bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold text-sm px-4 py-2.5 rounded transition-colors"
          >
            Reorder
          </Link>
          <Link
            href={`/configure?saved=${config.id}`}
            className="flex-1 text-center border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-afs-chrome-high font-label font-semibold text-sm px-4 py-2.5 rounded transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
