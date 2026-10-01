import Link from 'next/link';

export type MetricStatus = 'success' | 'warning' | 'error' | 'neutral';

const STATUS_TEXT_CLASS: Record<MetricStatus, string> = {
  success: 'text-afs-success-on-dark',
  warning: 'text-afs-warning-on-dark',
  error: 'text-afs-danger-on-dark',
  neutral: 'text-afs-chrome-mid',
};

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  sublabelStatus?: MetricStatus;
  href: string;
  trend?: number[];
  progressPct?: number;
}

/** Minimal inline sparkline — no charting library in this project's dependency tree, and a 3-point trend doesn't need one. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 72;
  const height = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="shrink-0" aria-hidden="true">
      <polyline points={points} fill="none" className="stroke-afs-chrome-mid" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * "Subtle borders, not boxed cards" (spec's own design principle) — these
 * render as plain flex items separated by a vertical rule between them
 * (added by the parent grid via divide-x), not individually boxed panels.
 */
export default function MetricCard({ label, value, sublabel, sublabelStatus = 'neutral', href, trend, progressPct }: MetricCardProps) {
  return (
    <Link href={href} className="flex flex-col gap-2 px-6 py-5 group hover:bg-afs-bg-surface transition-colors">
      <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-silver">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="font-heading text-3xl text-afs-chrome-high group-hover:text-afs-danger-on-dark transition-colors">{value}</p>
        {trend && <Sparkline values={trend} />}
      </div>
      {typeof progressPct === 'number' && (
        <div className="h-1.5 w-full bg-afs-bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${progressPct >= 100 ? 'bg-afs-success' : 'bg-afs-crimson'}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}
      {sublabel && <p className={`font-body text-xs ${STATUS_TEXT_CLASS[sublabelStatus]}`}>{sublabel}</p>}
    </Link>
  );
}
