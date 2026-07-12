'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  label: string;
  href: string;
  badgeKey?: 'commandCenter';
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
];

interface AdminShellProps {
  adminName: string;
  pendingMachineJobs?: number;
  children: React.ReactNode;
}

export default function AdminShell({ adminName, pendingMachineJobs = 0, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href) ?? false;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-afs-bg-base">
      <aside className="fixed top-11 left-48 bottom-0 w-[240px] z-30 bg-afs-bg-raised border-r border-afs-border flex flex-col overflow-y-auto">
        <div className="px-4 pt-6 pb-4">
          <Link href="/admin" className="inline-block bg-afs-bg-dim rounded-sm px-3 py-2">
            <Image src="/afs-logo.png" alt="AFS" width={116} height={83} className="w-full h-auto object-contain" />
          </Link>
          <p className="font-label text-[10px] tracking-widest text-afs-chrome-dim uppercase mt-2 px-1">
            Admin Portal
          </p>
        </div>

        <nav className="flex-1 flex flex-col gap-5 px-3 pb-6">
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

        <div className="px-4 py-4 border-t border-afs-border">
          <p className="font-label text-sm text-afs-chrome-high truncate">{adminName}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="font-label text-xs text-afs-chrome-dim hover:text-afs-crimson transition-colors mt-1"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-[240px] pt-16 px-8 pb-16">{children}</main>
    </div>
  );
}
