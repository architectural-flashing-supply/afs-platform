'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/**
 * Section boundary for FlashDraft (F-06).
 *
 * The wording matters more here than anywhere else on the public site: the
 * drawing canvas autosaves to localStorage, so a crash on this route has NOT
 * lost the operator's work, and telling them so is the difference between
 * reloading and redrawing from scratch.
 */
export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="studio-error"
      title="FlashDraft could not be loaded"
      body="Your drawing is still saved on this computer and nothing was submitted. Reload the page and it should come back. If it does not, tell Reid the reference code below."
      digest={error.digest}
      reset={reset}
    />
  );
}
