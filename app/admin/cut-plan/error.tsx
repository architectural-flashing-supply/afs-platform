'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

/**
 * Section boundary for the Cut Plan screen (CLAUDE.md rule #30). It sits BELOW
 * app/admin/error.tsx, so a failure here leaves the gunmetal header — and
 * therefore the rest of the Command Center — reachable.
 *
 * `tone="dark"` because this screen is gunmetal: it is not one of the converted
 * light working areas (lib/data/admin-working-area.ts).
 *
 * The body says what did NOT happen. This screen only ever reads the profile
 * catalog and does arithmetic in the browser, so the reassurance is true by
 * construction rather than by promise: nothing was saved, quoted or sent
 * anywhere, because there is nothing here that could.
 */
export default function CutPlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      tone="dark"
      testId="admin-section-error"
      title="The cut plan could not be loaded"
      body="Nothing was saved, quoted or sent to the machine — this screen only reads the profile catalog and works out cut lists. Try again, and tell Reid the reference code below if it keeps happening."
      digest={error.digest}
      reset={reset}
    />
  );
}
