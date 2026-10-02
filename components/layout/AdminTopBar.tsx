'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TOP_LEVEL_NAV, MORE_NAV, ADMIN_SEARCH_HREF, NEW_QUOTE_HREF } from '@/lib/data/admin-nav';
import { TYPEAHEAD_MIN_CHARS } from '@/lib/data/header-typeahead';

/** What /api/admin/command-center/typeahead returns. */
interface Suggest {
  companies: { name: string; person: string }[];
  rows: {
    id: string;
    customer: string;
    item: string;
    spec: string;
    quantity: number;
    totalCents: number | null;
    requestNumber: string;
  }[];
  totalRows: number;
  emptyMessage: string | null;
}

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
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
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

  // TYPE-AHEAD (v7 hqShow, line 1680). Opens at two characters; companies
  // first, then job rows. Debounced so a fast typist makes one request, not one
  // per keystroke, and the in-flight request is abandoned when a newer one
  // starts so an older, slower response can never overwrite a newer one.
  useEffect(() => {
    const q = search.trim();
    if (q.length < TYPEAHEAD_MIN_CHARS) {
      setSuggest(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/admin/command-center/typeahead?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json) setSuggest(json as Suggest);
        })
        .catch(() => {
          /* aborted or offline — leave the last result on screen */
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  // Close the dropdown on an outside click, same as the More menu.
  useEffect(() => {
    if (!suggestOpen) return;
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [suggestOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-afs-bg-raised border-b border-afs-border">
      <div className="h-16 flex flex-nowrap items-center gap-2 px-4 lg:px-6">
        <Link href="/admin/command-center" className="flex items-center gap-2 shrink-0 mr-2">
          <Image src="/afs-logo.png" alt="AFS" width={28} height={20} className="h-6 w-auto object-contain" />
          {/* v7 hides the brand text below 1250px so the nav never wraps. */}
          <span className="hidden min-[1250px]:inline font-label text-sm font-semibold text-afs-chrome-high whitespace-nowrap">
            Command Center
          </span>
        </Link>

        {/* v7 puts "+ New quote" immediately after the brand, in the one red. */}
        <Link
          href={NEW_QUOTE_HREF}
          data-testid="new-quote-button"
          className="shrink-0 inline-flex items-center h-10 px-4 rounded bg-afs-crimson text-white font-label text-sm font-semibold whitespace-nowrap transition-colors hover:bg-afs-crimson-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afs-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-afs-bg-raised"
        >
          + New quote
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
          <div className="relative hidden sm:block" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} role="search">
              <label htmlFor="admin-search" className="sr-only">
                Search
              </label>
              <input
                id="admin-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestOpen && suggest !== null}
                aria-controls="admin-typeahead"
                placeholder="Customer, profile, or job"
                className="w-48 lg:w-64 h-10 bg-afs-bg-dim border border-afs-chrome-base rounded px-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-mid focus:outline-none focus:border-afs-crimson transition-colors"
              />
            </form>

            {/* v7 .hsd — companies first, then job rows, then "See all". */}
            {suggestOpen && suggest && search.trim().length >= TYPEAHEAD_MIN_CHARS && (
              <div
                id="admin-typeahead"
                data-testid="admin-typeahead"
                role="listbox"
                className="absolute right-0 top-full mt-2 w-[min(640px,92vw)] max-h-[72vh] overflow-auto bg-afs-bg-raised border border-afs-chrome-base rounded shadow-raised p-1.5 z-50"
              >
                {suggest.companies.map((c) => (
                  <div
                    key={c.name}
                    data-testid="typeahead-company"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-afs-bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-label text-sm text-afs-chrome-high">{c.name}</b>
                      {c.person && (
                        <span className="block truncate font-body text-xs text-afs-chrome-silver">
                          {c.person}
                        </span>
                      )}
                    </span>
                    <Link
                      href={NEW_QUOTE_HREF}
                      className="shrink-0 h-8 px-3 inline-flex items-center rounded bg-afs-crimson text-white font-label text-xs font-semibold"
                    >
                      New quote
                    </Link>
                  </div>
                ))}

                {suggest.rows.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/command-center/job/${r.id}`}
                    data-testid="typeahead-row"
                    role="option"
                    aria-selected={false}
                    className="block px-3 py-2 rounded hover:bg-afs-bg-surface"
                  >
                    <b className="block truncate font-label text-sm text-afs-chrome-high">
                      {r.customer} · {r.item}
                    </b>
                    <span className="block truncate font-body text-xs text-afs-chrome-silver">
                      {[r.spec, `${r.quantity} pcs`, r.requestNumber].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                ))}

                {suggest.totalRows > 0 && (
                  <Link
                    href={`${ADMIN_SEARCH_HREF}?q=${encodeURIComponent(search.trim())}`}
                    className="block px-3 py-2 mt-1 rounded text-center font-label text-xs text-afs-chrome-high bg-afs-bg-surface hover:bg-afs-bg-overlay"
                  >
                    See all {suggest.totalRows} result{suggest.totalRows === 1 ? '' : 's'}, newest first
                  </Link>
                )}

                {suggest.emptyMessage && (
                  <p className="px-3 py-3 font-body text-sm text-afs-chrome-silver">
                    {suggest.emptyMessage}
                  </p>
                )}
              </div>
            )}
          </div>

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
