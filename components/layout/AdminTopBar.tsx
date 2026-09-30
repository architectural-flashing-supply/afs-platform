'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface TopBarTab {
  label: string;
  href: string;
}

// "Production" here and "Production Queue" in AdminShell's sidebar are
// deliberately the same destination (/admin/orders, the real-time
// fabrication-stage table) under two labels — the spec this was built to
// asked for a persistent top-bar tab set alongside the sidebar, not two
// different production views. "Orders" is the separate CRM view
// (/admin/orders-crm — customer record, dispatch, invoicing), promoted out
// of the old Command Center CRM tab in this same pass.
const TOP_BAR_TABS: TopBarTab[] = [
  { label: 'Dashboard', href: '/admin/command-center' },
  { label: 'Quote Requests', href: '/admin/quote-requests' },
  { label: 'Production', href: '/admin/orders' },
  { label: 'Orders', href: '/admin/orders-crm' },
  { label: 'Customers', href: '/admin/customers' },
  // Real, already-built, admin-only page (app/admin/shop-view/page.tsx,
  // requireAdminUser-gated) that lost its nav link in the afs-cc-001
  // Command Center redesign along with several other real admin tools
  // (see BLUEPRINT.md's Phase 9 addendum) — it kept its route the whole
  // time, just wasn't linked from anywhere. Restored here rather than
  // rebuilt as a ?tab= case of /admin/command-center: it's already its
  // own top-level route (same pattern as Orders/Customers/Profile
  // Library), not one of command-center's own internal
  // ?tab=pending/sent/completed/bids cases.
  { label: 'Shop View', href: '/admin/shop-view' },
  // Phase 3b: direct jump-out to FlashDraft (for Steve) — not an /admin/*
  // route, so isActivePath below never marks it active; that's expected,
  // this is a one-way link to a separate tool, not another admin section.
  // ?admin=1 marks the session as opened from Command Center, revealing
  // the "Send to PathfinderEdge" button there (see app/studio/draft/
  // page.tsx's adminContext).
  { label: 'FlashDraft', href: '/studio/draft?admin=1' },
];

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/** Exact-segment match — `pathname.startsWith(href)` alone would also true-match /admin/orders-crm for href="/admin/orders" since it shares that string prefix. */
function isActivePath(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export default function AdminTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/admin/customers?q=${encodeURIComponent(q)}` : '/admin/customers');
  }

  return (
    <header className="fixed top-0 left-[240px] right-0 z-40 h-16 bg-afs-bg-raised border-b border-afs-border flex items-center gap-4 px-4 lg:px-6">
      <Link href="/admin/command-center" className="flex items-center gap-2 shrink-0">
        <Image src="/afs-logo.png" alt="AFS" width={28} height={20} className="h-6 w-auto object-contain" />
        <span className="hidden sm:inline font-label text-sm font-semibold text-afs-chrome-high whitespace-nowrap">Command Center</span>
      </Link>

      <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
        {TOP_BAR_TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`font-label text-sm px-3 py-2 rounded transition-colors whitespace-nowrap ${
                active ? 'text-afs-chrome-high bg-afs-bg-surface' : 'text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 ml-auto shrink-0">
        <div className="hidden lg:block">
        </div>

        <form onSubmit={handleSearchSubmit} className="hidden sm:block">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="w-40 lg:w-56 bg-afs-bg-overlay border border-afs-border rounded px-3 py-1.5 font-body text-xs text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
          />
        </form>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Settings"
            className="w-8 h-8 flex items-center justify-center rounded text-afs-chrome-mid hover:text-afs-chrome-high hover:bg-afs-bg-surface transition-colors"
          >
            <GearIcon className="w-5 h-5" />
          </button>

          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-afs-bg-raised border border-afs-border rounded shadow-raised p-3 z-50">
                <p className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim mb-2 px-2">Integrations</p>
                <div className="flex flex-col gap-1">
                  <Link
                    href="/admin/quickbooks"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded hover:bg-afs-bg-surface transition-colors"
                  >
                    <span className="font-body text-sm text-afs-chrome-high">QuickBooks Integration</span>
                    <span className="font-label text-[10px] text-afs-chrome-dim border border-afs-border rounded px-1.5 py-0.5 whitespace-nowrap">
                      Coming Soon
                    </span>
                  </Link>
                  <Link
                    href="/admin/pricing"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded hover:bg-afs-bg-surface transition-colors"
                  >
                    <span className="font-body text-sm text-afs-chrome-high">Dynamic Pricing Engine</span>
                    <span className="font-label text-[10px] text-afs-chrome-dim border border-afs-border rounded px-1.5 py-0.5 whitespace-nowrap">
                      Coming Soon
                    </span>
                  </Link>
                </div>
                <Link
                  href="/admin/settings"
                  onClick={() => setSettingsOpen(false)}
                  className="block mt-2 pt-2 border-t border-afs-border font-label text-xs text-afs-crimson hover:text-afs-crimson-hover transition-colors px-2"
                >
                  All Settings →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
