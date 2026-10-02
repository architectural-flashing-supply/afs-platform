import Link from 'next/link';

interface EscalationCardProps {
  reason?: string | null;
}

export default function EscalationCard({ reason }: EscalationCardProps) {
  return (
    <div className="bg-afs-bg-surface border-l-4 border-afs-crimson rounded p-4">
      <p className="font-label text-sm font-semibold text-afs-chrome-high mb-1">
        Connect with our team
      </p>
      {reason && (
        <p className="font-body text-xs text-afs-chrome-mid mb-3">{reason}</p>
      )}
      <div className="flex flex-col gap-2 mb-3">
        <a
          href="tel:+15123724900"
          className="font-label text-sm text-afs-crimson hover:text-afs-crimson-hover transition-colors"
        >
          (512) 372-4900
        </a>
        <a
          href="mailto:trica@architecturalflashingsupply.com"
          className="font-label text-sm text-afs-crimson hover:text-afs-crimson-hover transition-colors break-all"
        >
          trica@architecturalflashingsupply.com
        </a>
      </div>
      <Link
        href="/studio"
        className="inline-block bg-afs-crimson hover:bg-afs-crimson-hover text-white text-xs font-label font-semibold px-4 py-2 rounded transition-colors"
      >
        Or start a quote request →
      </Link>
    </div>
  );
}
