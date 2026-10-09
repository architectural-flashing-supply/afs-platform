'use client';

import { useRouter } from 'next/navigation';

export interface BackButtonProps {
  /** Where to go when there is no browser history to step back through. */
  fallbackHref?: string;
  label?: string;
  className?: string;
}

/**
 * A plain Back control for full-screen tool pages (HailView, Track Delivery)
 * that otherwise leave the visitor with no obvious way out. Steps back in
 * history; falls back to the home page when the page was opened directly.
 */
export default function BackButton({ fallbackHref = '/', label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded border border-afs-border bg-afs-bg-raised px-4 py-2 font-label text-sm font-semibold uppercase tracking-wide text-afs-chrome-high shadow-lg transition-colors hover:bg-afs-bg-overlay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3L5 8l5 5" />
      </svg>
      {label}
    </button>
  );
}
