'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/** Section boundary for HailView (F-06). */
export default function HailViewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="hailview-error"
      title="HailView could not be loaded"
      body="No address was saved and no report was emailed. Try again, or contact AFS directly for a roof assessment."
      digest={error.digest}
      reset={reset}
    />
  );
}
