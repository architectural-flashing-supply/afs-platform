'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  label: string;
  href: string;
  badgeKey?: 'commandCenter';
  openInNewTab?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Command Center', href: '/admin/command-center', badgeKey: 'commandCenter' },
      { label: 'Quote Requests', href: '/admin/quote-requests' },
      { label: 'Production Queue', href: '/admin/orders' },
      { label: 'Consultations', href: '/admin/consultations' },
      { label: '🚚 Deliveries', href: '/admin/command-center?tab=orders' },
      { label: '📸 GBP Photos', href: '/admin/command-center?tab=gbp' },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Customers', href: '/admin/customers' },
      { label: 'Credit Apps', href: '/admin/credit-applications' },
      { label: 'Pricing', href: '/admin/pricing' },
    ],
  },
  {
    title: 'Content',
    items: [{ label: 'CAD Library', href: '/admin/cad-library' }],
  },
  {
    title: 'Integrations',
    items: [{ label: 'QuickBooks', href: '/admin/quickbooks' }],
  },
  {
    title: 'Settings',
    items: [{ label: 'Settings', href: '/admin/settings' }],
  },
  {
    title: 'Employee',
    items: [{ label: '📱 Employee App', href: '/employee', openInNewTab: true }],
  },
];

interface AdminShellProps {
  adminName: string;
  pendingMachineJobs?: number;
  children: React.ReactNode;
}

export default function AdminShell({ adminName, pendingMachineJobs = 0, children }: AdminShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href) ?? false;

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
            Admin Portal
          </p>
        </div>

        {/* min-h-0 lets this scroll internally instead of pushing Sign Out
            below the fixed-height aside on shorter viewports. */}
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 px-3 pb-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="font-label text-[11px] uppercase tracking-widest text-afs-chrome-dim px-4 mb-1.5">
                {section.title}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const badgeCount = item.badgeKey === 'commandCenter' ? pendingMachineJobs : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
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
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 px-4 pt-4 border-t border-afs-border">
          <p className="font-label text-sm text-afs-chrome-high truncate">{adminName}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="shrink-0 w-full text-left px-4 py-3 text-afs-crimson font-semibold border-t border-afs-border hover:bg-afs-bg-surface transition-colors"
        >
          Sign Out
        </button>
      </aside>

      <main className="flex-1 ml-[240px] pt-16 px-8 pb-16">{children}</main>
    </div>
  );
}
