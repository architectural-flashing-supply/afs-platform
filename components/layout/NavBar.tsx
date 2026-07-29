'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const TOP_NAV_LINKS = [
  { label: 'Products', href: '/products' },
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
    <header className="fixed top-0 left-0 right-0 z-40 h-11 bg-afs-bg-raised border-b border-afs-chrome-dim flex items-center px-8">
      <div className="hidden md:flex items-center gap-8">
        {TOP_NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={topNavLinkClass(link.href)} style={topNavLinkStyle(link.href)}>
            {link.label}
          </Link>
        ))}
        <Link href={accountLink.href} className={topNavLinkClass(accountLink.href)} style={topNavLinkStyle(accountLink.href)}>
          {accountLink.label}
        </Link>
      </div>
    </header>
  );
}
