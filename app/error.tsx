'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/**
 * The top route boundary (F-06). Catches anything thrown while rendering a page
 * that has no nearer boundary, while the root layout — header, nav, footer —
 * keeps rendering. app/global-error.tsx is the level below this one, for when the
 * root layout itself is what failed.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="root-error"
      title="This page could not be loaded"
      body="Nothing you submitted was lost and no request was sent. Try again, or use the menu above to go somewhere else."
      digest={error.digest}
      reset={reset}
    />
  );
}
