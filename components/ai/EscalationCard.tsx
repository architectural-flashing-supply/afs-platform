interface EscalationCardProps {
  reason?: string | null;
}

export default function EscalationCard({ reason }: EscalationCardProps) {
  return (
    <div className="bg-afs-bg-surface border-l-4 border-afs-crimson rounded p-4">
      <p className="font-label text-sm font-semibold text-afs-ink-900 mb-1">
        We&apos;ve flagged your question for our team.
      </p>
      {reason && (
        <p className="font-body text-xs text-afs-ink-700 mb-3">{reason}</p>
      )}
      <p className="font-body text-xs text-afs-ink-700 mb-3">Contact us directly:</p>
      <div className="flex flex-col gap-2">
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
    </div>
  );
}
