'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/** Section boundary for the field app (F-06). */
export default function FieldError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="field-error"
      title="This screen could not be loaded"
      body="Nothing was uploaded and no quote request was sent. Try again — your photos are still on your phone."
      digest={error.digest}
      reset={reset}
    />
  );
}
