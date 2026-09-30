'use client';

/**
 * The one look for "this part of the app failed" (F-06).
 *
 * Every route-segment `error.tsx` in this codebase renders THIS, so a failure in
 * the Command Center reads the same as a failure in FlashDraft or the customer
 * portal, and the wording rule lives in one file instead of five. It is a client
 * component because a route error boundary must be one.
 *
 * Two surfaces, because the app has two: `tone="light"` for the Command Center
 * V2 working area and the public site's light sections, `tone="dark"` for the
 * gunmetal pages. Both pairs are measured, not assumed:
 *
 *   light: ink-900 on bg-card 18.9:1 · ink-700 on bg-card 10.3:1
 *   dark:  chrome-high on bg-raised 10.8:1 · chrome-mid on bg-raised 5.8:1
 *
 * The message never blames the user, never shows a stack trace, and always says
 * what did NOT happen — on a platform where the next button along sends work to
 * a physical bending machine, "nothing was sent" is the sentence that matters.
 */

export interface ErrorScreenProps {
  /** Plain-English heading. No jargon, no error class names. */
  title: string;
  /** What the user should do next, and what did not happen. */
  body: string;
  /** Next.js hands this to every error.tsx; it re-renders the segment. */
  reset?: () => void;
  /** The framework's own error id, useful to quote when reporting a problem. */
  digest?: string;
  tone?: 'light' | 'dark';
  /** Distinguishes boundaries in tests and in screenshots. */
  testId?: string;
}

const TONES = {
  light: {
    wrap: 'bg-afs-bg-card border-afs-border-light',
    title: 'text-afs-ink-900',
    body: 'text-afs-ink-700',
    ref: 'text-afs-ink-700',
  },
  dark: {
    wrap: 'bg-afs-bg-raised border-afs-btn-secondary',
    title: 'text-afs-chrome-high',
    body: 'text-afs-chrome-mid',
    ref: 'text-afs-chrome-mid',
  },
} as const;

export default function ErrorScreen({
  title,
  body,
  reset,
  digest,
  tone = 'light',
  testId = 'error-screen',
}: ErrorScreenProps) {
  const t = TONES[tone];
  return (
    <div className="flex items-start justify-center py-10">
      <div data-testid={testId} className={`w-full max-w-xl rounded-lg border p-7 ${t.wrap}`}>
        <h1 className={`font-heading text-2xl ${t.title}`}>{title}</h1>
        <p className={`font-body text-base leading-relaxed mt-3 ${t.body}`}>{body}</p>
        {digest ? (
          <p data-testid={`${testId}-digest`} className={`font-data text-sm mt-4 ${t.ref}`}>
            Reference code: {digest}
          </p>
        ) : null}
        {reset ? (
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 min-h-[48px] px-6 font-label text-base font-semibold rounded bg-afs-crimson text-afs-chrome-high hover:bg-afs-crimson-hover transition-colors"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
