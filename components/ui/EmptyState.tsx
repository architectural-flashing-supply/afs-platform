import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  accent?: 'crimson' | 'copper';
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
  accent = 'crimson',
}: EmptyStateProps) {
  const accentClass =
    accent === 'copper'
      ? 'bg-afs-copper hover:bg-afs-copper-hover'
      : 'bg-afs-crimson hover:bg-afs-crimson-hover';

  return (
    <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
      <h3 className="font-heading text-xl text-afs-chrome-high mb-2">{title}</h3>
      <p className="font-body text-sm text-afs-chrome-mid mb-6 max-w-md mx-auto">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="flex gap-4 justify-center flex-wrap">
          {actionLabel && actionHref && (
            <Link
              href={actionHref}
              className={`${accentClass} text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors`}
            >
              {actionLabel}
            </Link>
          )}
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
