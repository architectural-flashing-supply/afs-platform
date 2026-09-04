'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const LOGO_WIDTH = 200;
const LOGO_HEIGHT = 80;

const TOP_NAV_LINKS = [
  { label: 'Products', href: '/products' },
  { label: 'HailView', href: '/hailview' },
  { label: 'Design Studio', href: '/studio' },
  { label: 'Track Delivery', href: '/track' },
  { label: 'Architects', href: '/architects' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
];

export default function NavBar() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setIsAuthenticated(!!session?.user));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

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
      <Link
        href="/"
        className="fixed top-0 left-0 z-40 shrink-0 flex items-center justify-center"
        style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
      >
        <Image
          src="/afs-logo.png"
          alt="AFS Architectural Flashing Supply"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          className="object-contain"
        />
      </Link>
      <header
        className="fixed top-0 right-0 z-40 h-14 bg-afs-bg-raised border-b border-afs-chrome-dim flex items-center px-8"
        style={{ left: LOGO_WIDTH }}
      >
      <div className="hidden md:flex items-center gap-8">
        {TOP_NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={topNavLinkClass(link.href)} style={topNavLinkStyle(link.href)}>
            {link.label}
          </Link>
        ))}
        {isAuthenticated ? (
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className={topNavLinkClass(accountLink.href)}
              style={topNavLinkStyle(accountLink.href)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              {accountLink.label}
            </button>
            {accountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 min-w-[160px] rounded-md border border-afs-chrome-dim bg-afs-bg-raised shadow-lg py-1"
              >
                <Link
                  href="/account"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-white hover:bg-afs-bg-overlay font-label"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  Account
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="block w-full text-left px-4 py-2 text-sm text-afs-crimson hover:bg-afs-bg-overlay font-label"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href={accountLink.href} className={topNavLinkClass(accountLink.href)} style={topNavLinkStyle(accountLink.href)}>
            {accountLink.label}
          </Link>
        )}
      </div>
      </header>
    </>
  );
}
