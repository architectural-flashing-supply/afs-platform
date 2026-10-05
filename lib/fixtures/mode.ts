/**
 * FIXTURE MODE — three locks, all of which must be open.
 *
 * The whole-screen pixel gate needs the live app to render the SAME CONTENT as
 * prototype v7, so the diff measures fidelity rather than photographing a
 * database (see lib/fixtures/command-center-v7.ts for why). That means a
 * code path in the real application that substitutes sample data for real data,
 * which is exactly the sort of switch that gets left on.
 *
 * So it is not a switch. It is three independent conditions:
 *
 *   1. `CC_FIXTURE=1` in the environment. Present in .env.local and
 *      .env.example; NOT set in Vercel, for any environment.
 *   2. `NODE_ENV !== 'production'`. A production build refuses even with the
 *      env var set — so shipping .env.local by accident is not enough.
 *   3. `?fixture=v7` on the request URL. So a developer running `pnpm dev` with
 *      the var set still sees real data on every page they did not ask.
 *
 * Condition 2 is the one that matters and the one lib/fixtures/mode.test.ts
 * tests hardest: it is the only lock that cannot be opened by a mistake in
 * configuration, because `NODE_ENV` is set by `next build` itself.
 *
 * WHAT FIXTURE MODE DOES NOT DO. It does not touch authentication. Every
 * /admin route still runs `requireAdminUser`, and the gate signs in with the
 * same `storageState` every other admin spec uses. A data fixture that also
 * bypassed auth would be a hole, not a fixture.
 */

/** The exact query value. Not a boolean — a typo must not enable it. */
export const FIXTURE_PARAM = 'fixture';
export const FIXTURE_VALUE = 'v7';

/**
 * Next.js hands a page `searchParams` whose values may be a string, an array
 * (`?fixture=a&fixture=v7`) or undefined. An array containing the right value
 * counts: the gate appends one parameter and a middleware or a redirect could
 * legitimately duplicate it.
 */
export type SearchParamValue = string | string[] | undefined;

function paramMatches(value: SearchParamValue): boolean {
  if (typeof value === 'string') return value === FIXTURE_VALUE;
  if (Array.isArray(value)) return value.includes(FIXTURE_VALUE);
  return false;
}

/**
 * The three locks, evaluated against an explicit environment so the test can
 * exercise a production build without being one.
 */
export function isFixtureModeFor(
  searchParams: Record<string, SearchParamValue> | undefined,
  env: { CC_FIXTURE?: string; NODE_ENV?: string } = process.env,
): boolean {
  if (env.CC_FIXTURE !== '1') return false;
  if (env.NODE_ENV === 'production') return false;
  return paramMatches(searchParams?.[FIXTURE_PARAM]);
}

/**
 * THE TWO LOCKS A SERVER COMPONENT CAN CHECK WITHOUT THE URL.
 *
 * Next.js never gives a LAYOUT `searchParams`, and the Command Center header
 * lives in `app/admin/layout.tsx`. Its nav badge is data (v7 counts approvals
 * plus unread email), so in fixture mode it has to be v7's number or the
 * structure gate reports a difference on every single screen — the nav is on
 * all of them.
 *
 * So the layout checks the two locks it CAN see, both of which are server-side
 * and neither of which a visitor can set, and hands the answer to the client
 * header, which checks the third from `useSearchParams()`. All three still have
 * to be open. In a production build this returns false and the client branch is
 * unreachable, exactly as if the parameter did not exist.
 */
export function fixtureAllowedByEnvironment(
  env: { CC_FIXTURE?: string; NODE_ENV?: string } = process.env,
): boolean {
  return env.CC_FIXTURE === '1' && env.NODE_ENV !== 'production';
}

/** The form a page calls: `isFixtureMode(searchParams)`. */
export function isFixtureMode(searchParams: Record<string, SearchParamValue> | undefined): boolean {
  return isFixtureModeFor(searchParams, process.env);
}

/**
 * Carry `?fixture=v7` across an internal link so a navigation inside the gate
 * does not silently fall back to live data mid-run. Returns `href` untouched
 * when fixture mode is off, so no production URL ever grows a parameter.
 */
export function fixtureHref(href: string, on: boolean): string {
  if (!on) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}${FIXTURE_PARAM}=${FIXTURE_VALUE}`;
}
