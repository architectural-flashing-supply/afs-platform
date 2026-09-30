import { LIGHT_WORKING_AREA_CLASS } from '@/lib/data/admin-working-area';

/**
 * The light working area under the gunmetal header (Command Center V2).
 *
 * A server component with no state — it exists so the two V2 screens share one
 * wrapper instead of copy-pasting a negative-margin class string, and so the
 * class string itself is asserted in one place. See
 * lib/data/admin-working-area.ts for why the page opts in rather than the shell
 * deciding.
 */
export default function LightWorkingArea({ children }: { children: React.ReactNode }) {
  return <div className={LIGHT_WORKING_AREA_CLASS}>{children}</div>;
}
