'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TOP_LEVEL_NAV, MORE_NAV, ADMIN_SEARCH_HREF } from '@/lib/data/admin-nav';

/**
 * THE Command Center navigation. ONE level, and this is the only level.
 *
 * Command Center V2 prompt v2-01 removed the second level outright. Before
 * this there were two-and-a-half nav surfaces: a 7-tab top bar, a gear
 * popover holding QuickBooks/Pricing/Settings (the second level), and an
 * AdminShell sidebar that duplicated the top bar's tabs under different
 * labels. A non-technical user had to learn which of three places a tool
 * lived in.
 *
 * Top level is exactly: Workbench, Shop View, Deliveries, Search, More.
 * More is a single flat menu, not a submenu tree — it holds destinations,
 * never further menus.
 *
 * Where the old tools went:
 *   Dashboard            -> Workbench (same route, /admin/command-center)
 *   Orders (orders-crm)  -> absorbed into Customers
 *   Pricing              -> absorbed into Settings
 *   QuickBooks           -> a "coming soon" card inside Settings
 *   Building Codes       -> MOVED OFF the Command Center, to the public
 *                           site's Resources menu (/resources/building-codes)
 *   Google Business pics  -> removed from the Command Center. The CODE IS
 *                           KEPT for the future driver mobile app — see
 *                           app/admin/gbp-photos, app/employee/photos,
 *                           components/employee/EmployeePhotoUploader.tsx,
 *                           components/field/DeliveryPhotoCapture.tsx and
 *                           the gbp_photo_queue table. Unlinked, not deleted.
 *   Geometry Test        -> developer-only: deliberately unlinked from every
 *                           nav surface, reachable only by typing the URL,
 *                           on top of the /admin admin-role gate.
 *   Quote Requests /
 *   Production Queue     -> direct-URL-only for now. The Workbench's New and
 *                           "In the shop" lanes replace them in v2-02; they
 *                           are listed under Settings' "Other tools" so they
 *                           are not lost in the meantime.
 *
 * CONTRAST: every pair here clears WCAG AA against the gunmetal header
 * (#363C4A). afs-chrome-mid is 5.8:1, white is 10.8:1, and the search field
 * sits on afs-bg-dim so even its PLACEHOLDER (afs-chrome-mid) is 8.9:1.
 * afs-chrome-dim is deliberately NOT used for text or borders here: it is
 * only 2.8:1 on this background and fails both the 4.5:1 text rule and the
 * 3:1 UI-component rule.
 */

/** Exact-segment match — plain startsWith would also true-match /admin/orders-crm for href="/admin/orders". */
function isActivePath(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export default function AdminTopBar({
  adminName,
  pendingCount = 0,
}: {
  adminName: string;
  pendingCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`${ADMIN_SEARCH_HREF}?q=${encodeURIComponent(q)}`);
  }

  const handleSignOut = async () => {
    // Hard redirect, not router.push, so no stale client auth state survives.
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const moreActive = MORE_NAV.some((i) => isActivePath(pathname, i.href));

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-afs-bg-raised border-b border-afs-border">
      <div className="h-16 flex items-center gap-2 px-4 lg:px-6">
        <Link href="/admin/command-center" className="flex items-center gap-2 shrink-0 mr-2">
          <Image src="/afs-logo.png" alt="AFS" width={28} height={20} className="h-6 w-auto object-contain" />
          <span className="hidden sm:inline font-label text-sm font-semibold text-afs-chrome-high whitespace-nowrap">
            Command Center
          </span>
        </Link>

        <nav className="flex items-center gap-1 min-w-0 overflow-x-auto" aria-label="Main">
          {TOP_LEVEL_NAV.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`font-label text-sm px-3 py-2.5 rounded transition-colors whitespace-nowrap flex items-center gap-2 ${
                  active
                    ? 'text-afs-chrome-high bg-afs-bg-surface font-semibold'
                    : 'text-afs-chrome-mid hover:text-afs-chrome-high hover:bg-afs-bg-surface'
                }`}
              >
                {item.label}
                {item.badge && pendingCount > 0 && (
                  <span className="bg-afs-crimson text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 ml-auto shrink-0">
          {/* Search sits on afs-bg-dim so the placeholder itself clears AA. */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:block" role="search">
            <label htmlFor="admin-search" className="sr-only">
              Search
            </label>
            <input
              id="admin-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, profile, or job"
              className="w-48 lg:w-64 h-10 bg-afs-bg-dim border border-afs-chrome-base rounded px-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-mid focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </form>

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={`h-10 px-4 font-label text-sm rounded border border-afs-chrome-base transition-colors ${
                moreActive
                  ? 'bg-afs-bg-surface text-afs-chrome-high font-semibold'
                  : 'text-afs-chrome-mid hover:text-afs-chrome-high hover:bg-afs-bg-surface'
              }`}
            >
              More
            </button>

            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 min-w-[220px] bg-afs-bg-raised border border-afs-chrome-base rounded shadow-raised py-1 z-50"
              >
                {MORE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="block px-4 py-3 font-body text-sm text-afs-chrome-high hover:bg-afs-bg-surface transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <span className="hidden lg:inline font-label text-sm font-semibold text-afs-chrome-high truncate max-w-[140px]">
            {adminName}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            className="h-10 px-3 font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high hover:bg-afs-bg-surface rounded transition-colors whitespace-nowrap"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
