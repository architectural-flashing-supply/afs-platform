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
];

/**
 * The full-bleed wrapper. AdminShell's <main> supplies `pt-16 px-6 lg:px-8
 * pb-16` for the gunmetal pages, so a light screen has to cancel that padding
 * with negative margins, paint, and then re-apply it — otherwise the light
 * panel would float inside a gunmetal frame instead of being the working area.
 *
 * Kept as one exported string so the unit test can assert the light background
 * token and the full-bleed cancellation are both present, and so the two pages
 * using it cannot drift apart.
 */
export const LIGHT_WORKING_AREA_CLASS =
  '-mt-16 -mb-16 -mx-6 lg:-mx-8 pt-16 pb-16 px-6 lg:px-8 min-h-screen bg-afs-bg-band text-afs-ink-900';
