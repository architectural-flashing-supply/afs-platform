'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/**
 * Section boundary for checkout (F-06). The one thing a customer needs to know
 * when this screen breaks is whether they were charged — so that is the first
 * sentence.
 */
export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="light"
      testId="checkout-error"
      title="Checkout could not be loaded"
      body="You have not been charged and no order was placed. Try again. If it keeps happening, call AFS rather than trying a second time — tell them the reference code below."
      digest={error.digest}
      reset={reset}
    />
  );
}
