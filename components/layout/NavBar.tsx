'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const PANEL_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Request a Quote', href: '/quote' },
  { label: 'Configure', href: '/configure' },
  { label: 'Upload Drawing', href: '/upload' },
  { label: 'Design Studio', href: '/studio' },
  { label: 'Architects', href: '/architects' },
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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard redirect so any stale client-side auth state is guaranteed gone.
    window.location.href = '/login';
  };

  const panelLinkClass = (href: string) => {
    const active = pathname === href;
    return `font-label text-sm text-white px-4 py-2.5 rounded transition-colors ${
      active
        ? 'bg-afs-bg-surface border-l-2 border-afs-crimson'
        : 'hover:bg-afs-bg-surface'
    }`;
  };

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
            <Link key={link.href} href={link.href} className={panelLinkClass(link.href)}>
              {link.label}
            </Link>
          ))}

          <div className="my-2 border-t border-afs-chrome-dim mx-1" />

          <Link href={accountLink.href} className={panelLinkClass(accountLink.href)}>
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
          <Link href="/products" className="font-label text-sm text-white transition-colors">
            Products
          </Link>
          <Link href="/quote" className="font-label text-sm text-white transition-colors">
            Request a Quote
          </Link>
          <Link href="/configure" className="font-label text-sm text-white transition-colors">
            Configure
          </Link>
          <Link href="/upload" className="font-label text-sm text-white transition-colors">
            Upload Drawing
          </Link>
          <Link href="/studio" className="font-label text-sm text-white transition-colors">
            Design Studio
          </Link>
          <Link href="/architects" className="font-label text-sm text-white transition-colors">
            Architects
          </Link>
        </div>
      </header>
    </>
  );
}
