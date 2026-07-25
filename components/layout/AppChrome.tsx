'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import NavBar from './NavBar';
import Footer from './Footer';

const ChatWidget = dynamic(() => import('@/components/ai/ChatWidget'), { ssr: false });

const NO_CHROME_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/invite', '/track'];
// Admin and account portals render their own sidebar (AdminShell/AccountShell)
// and must show no public nav at all — not the NavBar, not the Footer, not
// the marketing ChatWidget.
const PORTAL_PREFIXES = ['/admin', '/account'];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = NO_CHROME_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const isPortalRoute = PORTAL_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (hideChrome || isPortalRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <NavBar />
      <div className="ml-48 pt-11">
        {children}
        <Footer />
      </div>
      <ChatWidget />
    </>
  );
}
