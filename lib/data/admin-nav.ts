/**
 * THE Command Center navigation, as data. ONE level, and this is the whole of
 * it (Command Center V2 prompt v2-01, step 5).
 *
 * It lives here, apart from the component that renders it, for one reason:
 * "the nav has exactly these items and no second level" is an assertion worth
 * testing, and a pure module can be tested without rendering React or mocking
 * next/navigation. See lib/data/admin-nav.test.ts.
 *
 * MORE_NAV holds destinations only. If a future change ever wants to nest a
 * menu inside it, that is the second navigation level coming back — which is
 * exactly what this prompt removed. Don't.
 */

export interface AdminNavItem {
  label: string;
  href: string;
  /** Shows the pending-work count badge. Only the Workbench has one. */
  badge?: boolean;
  /**
   * Visible only to an admin. Recorded as data because the v7 design calls
   * Pricing out as Steve-only.
   *
   * NOTE, and it matters: this codebase has exactly ONE admin role.
   * `lib/admin/auth.ts`'s `requireAdminUser` redirects anyone whose
   * `profiles.role !== 'admin'` away from the whole `/admin` tree, so every
   * user who can see this nav at all is already that role. The flag therefore
   * records intent and gives the renderer something to gate on; it does not
   * create a second tier, and adding one would be a schema change nobody has
   * asked for.
   */
  adminOnly?: boolean;
}

/**
 * v7 header nav, left to right (prototype `header()`, line 1199):
 * Workbench, Quotes, Orders, Shop View, Deliveries, Customers, Pricing.
 *
 * Customers is TOP LEVEL in v7, not under More. Quotes and Orders are separate
 * destinations — v7 never merges them.
 */
export const TOP_LEVEL_NAV: AdminNavItem[] = [
  { label: 'Workbench', href: '/admin/command-center', badge: true },
  { label: 'Quotes', href: '/admin/quotes' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Shop View', href: '/admin/shop-view' },
  { label: 'Deliveries', href: '/admin/deliveries' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Pricing', href: '/admin/pricing', adminOnly: true },
];

/**
 * Destinations only — never a nested menu. Credit Applications and Bid Monitor
 * live here because v7's nav has no equivalent for either and the seven items
 * above are the approved set.
 */
export const MORE_NAV: AdminNavItem[] = [
  { label: 'Credit Applications', href: '/admin/credit-applications' },
  { label: 'Bid Monitor', href: '/admin/bid-monitor' },
  { label: 'Search', href: '/admin/search' },
  { label: 'Settings', href: '/admin/settings' },
];

/** Where the header's search box sends you. */
export const ADMIN_SEARCH_HREF = '/admin/search';

/**
 * The red "+ New quote" button in the header.
 *
 * v7 points it at its own `newquote` page, which does not exist here yet (it is
 * the next phase). It points at the Quotes list instead — a real route that
 * exists today, reached from every admin page — rather than a dead link or a
 * stub page nobody built.
 */
export const NEW_QUOTE_HREF = '/admin/quotes';

/**
 * Routes that exist, work, and are deliberately NOT in any navigation
 * surface. Kept as data so the reason is recorded next to the decision
 * instead of only in a commit message.
 */
export const UNLINKED_ADMIN_ROUTES: { href: string; why: string }[] = [
  {
    href: '/admin/geometry-test',
    why: 'Developer-only geometry validation tool. Hidden from nav on purpose, admin-gated twice.',
  },
  {
    href: '/admin/gbp-photos',
    why: 'Google Business photos: removed from the Command Center. Code kept, unlinked, for the future driver mobile app.',
  },
];
