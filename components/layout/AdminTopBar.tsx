'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TOP_LEVEL_NAV, MORE_NAV, ADMIN_SEARCH_HREF, NEW_QUOTE_HREF } from '@/lib/data/admin-nav';
import { TYPEAHEAD_MIN_CHARS } from '@/lib/data/header-typeahead';

/**
 * THE Command Center header — a port of prototype v7's `header()` (line 1195).
 *
 * This file is a PORT, not a design. Its markup and class names come from
 * docs/design/command-center-v7/AFS_Command_Center_Prototype_v7.html and its
 * appearance comes entirely from that prototype's own CSS, scoped to `.cc-v7`
 * (see scripts/design/scope-v7-css.mjs). Nothing here carries a Tailwind
 * colour, size or spacing utility, and nothing should: a utility added to one
 * of these elements overrides v7 and the style gate
 * (tests/visual/v7-style-gate.spec.ts) will fail on the difference.
 *
 * WHAT CHANGED AND WHY IT MATTERS. The previous version of this component had
 * v7's LABELS — "+ New quote", the seven-item nav, the type-ahead — on the old
 * gunmetal Tailwind styling (`bg-afs-bg-raised`, `text-afs-chrome-mid`). That
 * is the specific failure this rebuild exists to correct: the labels were right
 * and the look was the old app's. The behaviour below (debounced type-ahead
 * with request abandonment, outside-click and Escape handling, hard-redirect
 * sign-out) is carried over unchanged, because it was correct — only the
 * presentation is replaced.
 *
 * v7's own structure, which this mirrors element for element:
 *
 *   header.hdr > .hdr-in >
 *     a.brand          (logo + "Command <em>Center</em>")
 *     button.nqb       ("+ New quote", the one red)
 *     nav.nav          (seven pills; .on marks the current page; .cnt badge)
 *     .hdr-r >
 *       .hs            (search input + .hsd type-ahead panel)
 *       .more          (.mbtn + .mm menu)
 *       .who           (signed-in admin)
 *       a.lo           ("Log out")
 *
 * The one deliberate departure: v7 renders `.who` as the literal sample name
 * "Steve Harycki". This renders the real signed-in admin's name, because a
 * hardcoded person in a shipped header is sample data, and the rule is that no
 * mock data survives the port. The element, its class and its position are
 * unchanged, so it is the same component to the style gate.
 */

/** Exact-segment match — plain startsWith would also true-match /admin/orders-crm for href="/admin/orders". */
function isActivePath(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

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

/** v7 `cents()` (line 1067) — grouped dollars, two decimals, no currency code. */
function cents(value: number): string {
  return `$${(value / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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

  const showSuggest = suggestOpen && suggest !== null && search.trim().length >= TYPEAHEAD_MIN_CHARS;

  return (
    <header className="hdr">
      <div className="hdr-in">
        <Link href="/admin/command-center" className="brand">
          <Image src="/afs-logo.png" alt="Architectural Flashing Supply" width={120} height={34} />
          <span className="bt">
            <b>
              Command <em>Center</em>
            </b>
          </span>
        </Link>

        {/* v7 puts "+ New quote" immediately after the brand, in the one red. */}
        <Link href={NEW_QUOTE_HREF} data-testid="new-quote-button" className="nqb">
          + New quote
        </Link>

        <nav className="nav" aria-label="Main">
          {TOP_LEVEL_NAV.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'on' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
                {item.badge && pendingCount > 0 && <span className="cnt">{pendingCount}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="hdr-r">
          <div className="hs" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} role="search">
              <label htmlFor="hq" className="sr-only">
                Search every customer, quote and order
              </label>
              <input
                id="hq"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                autoComplete="off"
                role="combobox"
                aria-expanded={showSuggest}
                aria-controls="hsd"
                placeholder="Search: Hill Country drip edge"
                aria-label="Search every customer, quote and order"
              />
            </form>

            {/* v7 .hsd — companies first, then job rows, then "See all". */}
            {showSuggest && suggest && (
              <div className="hsd" id="hsd" data-testid="admin-typeahead" role="listbox">
                {suggest.companies.map((c) => (
                  <div className="hsc" key={c.name} data-testid="typeahead-company">
                    <b>{c.name}</b>
                    <span>{c.person}</span>
                    <Link href={NEW_QUOTE_HREF} className="btn red sm">
                      New quote
                    </Link>
                  </div>
                ))}

                {suggest.rows.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/command-center/job/${r.id}`}
                    className="hsr"
                    data-testid="typeahead-row"
                    role="option"
                    aria-selected={false}
                  >
                    <span className="tx">
                      <b>
                        {r.customer} · {r.item}
                      </b>
                      <span>
                        {[
                          r.spec,
                          `${r.quantity} pcs`,
                          r.requestNumber,
                          r.totalCents == null ? null : cents(r.totalCents),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </Link>
                ))}

                {suggest.totalRows > 0 && (
                  <Link
                    href={`${ADMIN_SEARCH_HREF}?q=${encodeURIComponent(search.trim())}`}
                    className="hsall"
                  >
                    See all {suggest.totalRows} result{suggest.totalRows === 1 ? '' : 's'}, newest
                    first
                  </Link>
                )}

                {suggest.emptyMessage && <div className="hsn">{suggest.emptyMessage}</div>}
              </div>
            )}
          </div>

          <div className="more" ref={moreRef}>
            <button
              type="button"
              className="mbtn"
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              data-active={moreActive ? 'true' : undefined}
            >
              More
            </button>

            {moreOpen && (
              <div className="mm" id="mm" role="menu">
                {MORE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <span className="who">{adminName}</span>

          <a
            href="/login"
            className="lo"
            onClick={(e) => {
              e.preventDefault();
              void handleSignOut();
            }}
          >
            Log out
          </a>
        </div>
      </div>
    </header>
  );
}
