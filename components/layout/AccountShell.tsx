'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
  const router = useRouter();

  const isActive = (href: string) =>
    href === '/account' ? pathname === '/account' : pathname?.startsWith(href) ?? false;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-afs-bg-base">
      <aside className="fixed top-11 left-48 bottom-0 w-[220px] z-30 bg-afs-bg-raised border-r border-afs-border flex flex-col">
        <div className="px-4 pt-6 pb-2 shrink-0">
          <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-dim">My Account</p>
        </div>
        {/* min-h-0 lets this scroll internally instead of pushing Sign Out
            below the fixed-height aside on shorter viewports. */}
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-3 pb-6">
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

        <div className="shrink-0 px-4 py-4 border-t border-afs-border">
          <button
            type="button"
            onClick={handleSignOut}
            className="font-label text-sm text-afs-chrome-dim hover:text-afs-crimson transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-[220px] pt-16 px-8 pb-16">{children}</main>
    </div>
  );
}
