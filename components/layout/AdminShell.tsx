'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminTopBar from '@/components/layout/AdminTopBar';

interface NavItem {
  label: string;
  href: string;
  badgeKey?: 'commandCenter';
}

// Phase 2 (Command Center redesign, afs-cc-001) — simplified from three
// titled sections (Operations/Business/Settings, 13 links total) down to
// exactly the 6 destinations the redesign calls for. Consultations, Bid
// Monitor, Shop View, Employee App, Credit Apps, and Building Codes are
// gone from here specifically (spec's own DELETIONS list names each one) —
// their routes are untouched and still reachable by direct URL, matching
// this codebase's existing pattern for nav-less admin tools (see
// app/admin/geometry-test/page.tsx's own comment). Pricing and QuickBooks
// lost their standalone entries too (folded into the new top bar's Settings
// gear popover instead, per the spec's own "SETTINGS" section) — both
// pages are still real and still linked from there and from
// /admin/settings, not deleted.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/command-center', badgeKey: 'commandCenter' },
  { label: 'Quote Requests', href: '/admin/quote-requests' },
  { label: 'Production Queue', href: '/admin/orders' },
  { label: 'Orders', href: '/admin/orders-crm' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Settings', href: '/admin/settings' },
];

interface AdminShellProps {
  adminName: string;
  pendingMachineJobs?: number;
  children: React.ReactNode;
}

/** Exact-segment match — plain startsWith would also true-match /admin/orders-crm for href="/admin/orders" since it shares that string prefix. */
function isActivePath(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export default function AdminShell({ adminName, pendingMachineJobs = 0, children }: AdminShellProps) {
  const pathname = usePathname();

  // Hard redirect (not router.push) so any stale client-side auth state is
  // guaranteed to be gone, not just navigated away from.
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-screen bg-afs-bg-base">
      <aside className="fixed top-0 left-0 bottom-0 w-[240px] z-30 bg-afs-bg-raised border-r border-afs-border flex flex-col">
        <div className="px-4 pt-6 pb-4 shrink-0">
          <Link href="/admin" className="inline-block bg-afs-bg-dim rounded-sm px-3 py-2">
            <Image src="/afs-logo.png" alt="AFS" width={116} height={83} className="w-full h-auto object-contain" />
          </Link>
          <p className="font-label text-[10px] tracking-widest text-afs-chrome-dim uppercase mt-2 px-1">
            Command Center
          </p>
        </div>

        {/* min-h-0 lets this scroll internally instead of pushing Sign Out
            below the fixed-height aside on shorter viewports. */}
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-3 pb-6">
          <p className="font-label text-[11px] uppercase tracking-widest text-afs-chrome-dim px-4 mb-1.5">Navigation</p>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const badgeCount = item.badgeKey === 'commandCenter' ? pendingMachineJobs : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between font-label text-sm px-4 py-2.5 rounded-sm border-l-2 transition-colors ${
                  active
                    ? 'border-afs-crimson bg-afs-bg-surface text-white'
                    : 'border-transparent text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white'
                }`}
              >
                {item.label}
                {badgeCount > 0 && (
                  <span className="bg-afs-crimson text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 px-4 pt-4 border-t border-afs-border">
          <p className="font-label text-sm text-afs-chrome-high truncate">{adminName}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="shrink-0 w-full text-left px-4 py-3 text-afs-crimson font-semibold border-t border-afs-border hover:bg-afs-bg-surface transition-colors"
        >
          Log Out
        </button>
      </aside>

      <AdminTopBar />

      <main className="flex-1 ml-[240px] pt-16 px-8 pb-16">{children}</main>
    </div>
  );
}
