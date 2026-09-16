'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AfsLogo from './AfsLogo';

// Exported so any full-width fixed/absolute element anchored near the top of
// the viewport (e.g. app/hailview/page.tsx's map background) can clear the
// header row's real height. h-24 (96px) gives the 76px logo mark (with its
// AFS + tagline stack) room to breathe without the header feeling cramped.
export const LOGO_HEIGHT = 96;

const TOP_NAV_LINKS = [
  { label: 'Products', href: '/products' },
  { label: 'Design Studio', href: '/studio' },
  { label: 'Track Delivery', href: '/track' },
  { label: 'Services', href: '/about/services' },
  { label: 'Architects', href: '/architects' },
];

const RESOURCES_LINKS = [
  { label: 'Resources', href: '/resources' },
  { label: 'HailView', href: '/hailview' },
];

const START_QUOTE_CLASS =
  'bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-sm font-semibold rounded px-4 py-2 transition-colors shadow-crimson shrink-0';

export default function NavBar() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [resourcesMenuOpen, setResourcesMenuOpen] = useState(false);
  const resourcesMenuRef = useRef<HTMLDivElement>(null);
  const resourcesTriggerRef = useRef<HTMLButtonElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    if (!resourcesMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (resourcesMenuRef.current && !resourcesMenuRef.current.contains(event.target as Node)) {
        setResourcesMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setResourcesMenuOpen(false);
        resourcesTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [resourcesMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setResourcesMenuOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

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

  const resourcesActive = RESOURCES_LINKS.some((link) => isActive(link.href));

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-40 h-24 bg-afs-bg-raised border-b border-afs-chrome-dim flex items-center justify-between gap-4 px-4 md:px-8"
      >
      <Link href="/" className="flex items-center shrink-0">
        <AfsLogo />
      </Link>

      <div className="hidden md:flex items-center gap-8">
        {TOP_NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={topNavLinkClass(link.href)} style={topNavLinkStyle(link.href)}>
            {link.label}
          </Link>
        ))}
        <div className="relative" ref={resourcesMenuRef}>
          <button
            ref={resourcesTriggerRef}
            type="button"
            onClick={() => setResourcesMenuOpen((open) => !open)}
            className={`${topNavLinkClass('/resources')} inline-flex items-center gap-1`}
            style={resourcesActive ? { backgroundColor: '#C0001A', color: 'white', borderRadius: '4px', padding: '2px 8px' } : undefined}
            aria-haspopup="menu"
            aria-expanded={resourcesMenuOpen}
          >
            Resources
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {resourcesMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 min-w-[160px] rounded-md border border-afs-chrome-dim bg-afs-bg-raised shadow-lg py-1"
            >
              {RESOURCES_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-white hover:bg-afs-bg-overlay font-label"
                  onClick={() => setResourcesMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
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

      <div className="flex items-center gap-3 ml-auto md:ml-0">
        <Link href="/design-studio" className={START_QUOTE_CLASS}>
          Start a Quote
        </Link>
        <button
          type="button"
          className="md:hidden text-white p-2 -mr-2"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-6 h-6">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>
      </div>
      </header>

      {mobileMenuOpen && (
        <div
          role="menu"
          className="md:hidden fixed left-0 right-0 z-30 bg-afs-bg-raised border-b border-afs-chrome-dim overflow-y-auto max-h-[calc(100vh-80px)]"
          style={{ top: LOGO_HEIGHT }}
        >
          {TOP_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              className="block px-6 py-3 font-label text-sm text-white border-b border-afs-chrome-dim/40 hover:bg-afs-bg-overlay"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {RESOURCES_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              className="block px-6 py-3 font-label text-sm text-white border-b border-afs-chrome-dim/40 hover:bg-afs-bg-overlay"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={accountLink.href}
            role="menuitem"
            className="block px-6 py-3 font-label text-sm text-white border-b border-afs-chrome-dim/40 hover:bg-afs-bg-overlay"
            onClick={() => setMobileMenuOpen(false)}
          >
            {accountLink.label}
          </Link>
          {isAuthenticated && (
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="block w-full text-left px-6 py-3 font-label text-sm text-afs-crimson border-b border-afs-chrome-dim/40 hover:bg-afs-bg-overlay"
            >
              Sign Out
            </button>
          )}
          <div className="px-6 py-4">
            <Link
              href="/design-studio"
              className={`${START_QUOTE_CLASS} block text-center`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Start a Quote
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
