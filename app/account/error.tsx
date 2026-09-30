'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/** Section boundary for the customer portal (F-06). */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="account-error"
      title="Your account page could not be loaded"
      body="Your orders and quotes are safe and nothing was changed. Try again, or use the menu above to go to another part of your account."
      digest={error.digest}
      reset={reset}
    />
  );
}
