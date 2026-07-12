'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/account' },
  { label: 'My Orders', href: '/account/orders' },
  { label: 'My Quotes', href: '/account/quotes' },
  { label: 'My Projects', href: '/account/projects' },
  { label: 'Documents', href: '/account/documents' },
  { label: 'Invoices', href: '/account/invoices' },
  { label: 'Templates', href: '/account/templates' },
  { label: 'Team', href: '/account/team' },
  { label: 'Credit Application', href: '/account/credit-application' },
  { label: 'Settings', href: '/account/settings' },
];

export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/account' ? pathname === '/account' : pathname?.startsWith(href) ?? false;

  return (
    <div className="flex min-h-screen bg-afs-bg-base">
      <aside className="fixed top-11 left-48 bottom-0 w-[220px] z-30 bg-afs-bg-raised border-r border-afs-border overflow-y-auto">
        <div className="px-4 pt-6 pb-2">
          <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim">My Account</p>
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-6">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-label text-sm px-4 py-2.5 rounded-sm border-l-2 transition-colors ${
                  active
                    ? 'border-afs-crimson bg-afs-bg-surface text-white'
                    : 'border-transparent text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 ml-[220px] pt-16 px-8 pb-16">{children}</main>
    </div>
  );
}
