/**
 * WHICH admin screens have the LIGHT working area, and the one class string
 * that makes one.
 *
 * The design rule is "gunmetal header, light working area". Prompt v2-01
 * deliberately left the whole admin body gunmetal and said so, because
 * flipping it wholesale would have made twenty existing admin pages
 * unreadable — their text uses the light-on-dark afs-chrome-* tokens. v2-02
 * rebuilds the Workbench and the Job screen, so those two convert now and the
 * rest convert when they are rebuilt.
 *
 * WHY THE PAGE OPTS IN, RATHER THAN THE SHELL DECIDING BY PATHNAME.
 * /admin/command-center serves two different things: with no `?tab` it is the
 * new light Workbench, and with `?tab=dashboard|pending|sent|completed|bids` it
 * is the pre-V2 dark views, kept reachable by direct URL. Those share one
 * pathname, so a pathname test in the shell would put white-on-white text on
 * the dark views. The page knows which it is rendering; the shell does not.
 *
 * This module keeps the decision as DATA so "the Workbench is light, the
 * dashboard tab is not yet" is a unit test instead of something only a browser
 * can tell you.
 */

/**
 * Every screen currently rendered inside a light working area, with the reason.
 * Add a row here in the same commit that converts a screen's tokens.
 */
export const LIGHT_WORKING_AREA_SCREENS: { screen: string; route: string }[] = [
  { screen: 'Workbench', route: '/admin/command-center' },
  { screen: 'Job screen', route: '/admin/command-center/job/[id]' },
  // v2-04 rebuilt both of these to the approved prototype, so they convert now.
  { screen: 'Shop View', route: '/admin/shop-view' },
  { screen: 'Deliveries', route: '/admin/deliveries' },
  // v2-05 replaced the interim results table with the approved thumbnail rail.
  { screen: 'Search', route: '/admin/search' },
  // v7 Phase 2: both office lists are light working areas under the dark header.
  { screen: 'Quotes', route: '/admin/quotes' },
  { screen: 'Orders', route: '/admin/orders' },
];

/**
 * The full-bleed wrapper. AdminShell's `<main>` has its own padding, so a light
 * screen has to cancel it with negative margins, paint, and then re-apply it —
 * otherwise the light panel would float inside a gunmetal frame instead of
 * being the working area.
 *
 * THE NUMBERS COME FROM v7's `.wrap`, NOT FROM TAILWIND'S SCALE. The shell used
 * to supply `pt-16 px-6 lg:px-8 pb-16` (64px / 24px / 32px), and this string
 * cancelled exactly those. The Command Center is now a port of prototype v7, so
 * `<main>` is v7's own `.wrap` — `padding: 20px 20px 60px` with a 1900px
 * measure (see docs/design/command-center-v7/v7.css). The cancellation has to
 * match THAT, which is why these are 20px and 60px and why the responsive
 * `lg:` step is gone: v7's padding does not change with the viewport.
 *
 * Getting this wrong is silent. Too little negative margin leaves a gunmetal
 * gutter down both sides of a light screen; too much pulls the content under
 * the sticky header. Both look like a styling accident rather than a mismatch
 * with the shell, which is why the numbers are pinned to v7's value in a
 * comment and asserted in lib/data/workbench.test.ts.
 *
 * Kept as ONE exported string, written as a single literal: the contrast gate
 * resolves class constants across modules, and CLAUDE.md rule #28 records that
 * a concatenated one reads as `unresolved` — which it treats as the gate going
 * blind.
 */
export const LIGHT_WORKING_AREA_CLASS =
  '-mt-5 -mb-[60px] -mx-5 pt-5 pb-[60px] px-5 min-h-screen bg-afs-bg-band text-afs-ink-900';
