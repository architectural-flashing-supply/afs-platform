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
}

export const TOP_LEVEL_NAV: AdminNavItem[] = [
  { label: 'Workbench', href: '/admin/command-center', badge: true },
  { label: 'Shop View', href: '/admin/shop-view' },
  { label: 'Deliveries', href: '/admin/deliveries' },
];

export const MORE_NAV: AdminNavItem[] = [
  // Absorbs the orders CRM (/admin/orders-crm), linked from its page.
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Credit Applications', href: '/admin/credit-applications' },
  { label: 'Bid Monitor', href: '/admin/bid-monitor' },
  // Absorbs Pricing, and carries the QuickBooks "coming soon" card.
  { label: 'Settings', href: '/admin/settings' },
];

/** Where the header's search box sends you. */
export const ADMIN_SEARCH_HREF = '/admin/search';

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
