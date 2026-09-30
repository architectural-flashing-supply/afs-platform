'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';
import LightWorkingArea from '@/components/admin/LightWorkingArea';

/**
 * Section boundary for Shop View (F-06). It sits BELOW app/admin/error.tsx, so a
 * failure here leaves the gunmetal header — and therefore the rest of the
 * Command Center — reachable, instead of replacing the whole admin section.
 *
 * Light tone because this screen is one of the converted light working areas
 * (lib/data/admin-working-area.ts).
 */
export default function ShopViewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <LightWorkingArea>
      <ErrorScreen
        tone="light"
        testId="admin-section-error"
        title="Shop View could not be loaded"
        body="No job was started, finished or scheduled. Try again. If it keeps happening, the Workbench still shows the same queue."
        digest={error.digest}
        reset={reset}
      />
    </LightWorkingArea>
  );
}
