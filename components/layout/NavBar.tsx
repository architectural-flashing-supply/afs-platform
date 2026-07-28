'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const PANEL_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Design Studio', href: '/studio' },
  { label: 'Track Delivery', href: '/track' },
  { label: 'Architects', href: '/architects' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
];

// Same links as the sidebar, minus Home — matches the top header's
// long-standing manual list exactly, just no longer duplicated by hand.
const TOP_NAV_LINKS = PANEL_LINKS.filter((link) => link.href !== '/');

export default function NavBar() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setIsAuthenticated(!!session?.user));
    return () => subscription.unsubscribe();
  }, []);

  const accountLink = isAuthenticated
    ? { label: 'My Account', href: '/account' }
    : { label: 'Sign In', href: '/login' };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard redirect so any stale client-side auth state is guaranteed gone.
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Inline styles here (rather than Tailwind classes) guarantee the active
  // background color renders regardless of class-order/specificity cascade.
  const panelLinkClass = (href: string) => {
    const active = isActive(href);
    return `font-label text-sm px-4 py-2.5 rounded transition-colors ${
      active ? '' : 'text-white hover:bg-afs-bg-surface'
    }`;
  };

  const panelLinkStyle = (href: string): React.CSSProperties | undefined =>
    isActive(href) ? { backgroundColor: '#C0001A', color: 'white' } : undefined;

  const topNavLinkClass = (href: string) => {
    const active = isActive(href);
    return `font-label text-sm transition-colors ${active ? '' : 'text-white'}`;
  };

  const topNavLinkStyle = (href: string): React.CSSProperties | undefined =>
    isActive(href)
      ? { backgroundColor: '#C0001A', color: 'white', borderRadius: '4px', padding: '2px 8px' }
      : undefined;

  return (
    <>
      <div className="fixed top-0 left-0 bottom-0 w-48 z-50 bg-afs-bg-dim border-r border-afs-chrome-dim flex flex-col">
        <div className="flex items-center justify-center px-2 pt-2 pb-3">
          <Link href="/">
            <Image
              src="/afs-logo.png"
              alt="AFS Architectural Flashing Supply"
              width={232}
              height={165}
              priority
              className="w-full h-auto object-contain"
            />
          </Link>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {PANEL_LINKS.map(link => (
            <Link key={link.href} href={link.href} className={panelLinkClass(link.href)} style={panelLinkStyle(link.href)}>
              {link.label}
            </Link>
          ))}

          <div className="my-2 border-t border-afs-chrome-dim mx-1" />

          <Link href={accountLink.href} className={panelLinkClass(accountLink.href)} style={panelLinkStyle(accountLink.href)}>
            {accountLink.label}
          </Link>

          {isAuthenticated && (
            <button
              type="button"
              onClick={handleSignOut}
              className="font-label text-sm text-afs-crimson font-semibold px-4 py-2.5 rounded text-left hover:bg-afs-bg-surface transition-colors"
            >
              Sign Out
            </button>
          )}
        </nav>

        <div className="flex-1" />

        <div className="px-4 py-4 border-t border-afs-chrome-dim">
          <p className="font-label text-xs text-afs-chrome-dim tracking-widest uppercase text-center">
            Est. Texas
          </p>
        </div>
      </div>

      <header className="fixed top-0 left-48 right-0 z-40 h-11 bg-afs-bg-raised border-b border-afs-chrome-dim flex items-center px-8">
        <div className="hidden md:flex items-center gap-8">
          {TOP_NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={topNavLinkClass(link.href)} style={topNavLinkStyle(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>
      </header>
    </>
  );
}
