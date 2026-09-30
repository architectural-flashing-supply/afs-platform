'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/** Section boundary for the employee/driver PWA (F-06). */
export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="employee-error"
      title="This screen could not be loaded"
      body="No photo, delivery or location update was sent. Try again — if you are out on a route and it keeps failing, carry on and report it when you are back."
      digest={error.digest}
      reset={reset}
    />
  );
}
