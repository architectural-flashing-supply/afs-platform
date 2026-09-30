'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/**
 * Section boundary for the whole admin area (F-06) — the fallback for every
 * admin page that does not have a nearer boundary of its own (Pricing, Settings,
 * Customers, Quote Requests, the pre-V2 ?tab views, …).
 *
 * DARK tone on purpose: those screens are still gunmetal, and the header this
 * renders under is gunmetal too. The four converted light screens have their own
 * nearer boundaries so they degrade in their own palette
 * (lib/data/admin-working-area.ts records which is which).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="dark"
      testId="admin-error"
      title="This Command Center screen could not be loaded"
      body="Nothing was changed and nothing was sent to the machine. Try again. If it keeps happening, the rest of the Command Center is still reachable from the menu above — tell Reid the reference code below."
      digest={error.digest}
      reset={reset}
    />
  );
}
