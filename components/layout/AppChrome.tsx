'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import NavBar from './NavBar';
import Footer from './Footer';

const ChatWidget = dynamic(() => import('@/components/ai/ChatWidget'), { ssr: false });

const NO_CHROME_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/invite', '/track'];
// Admin and account portals render their own sidebar (AdminShell/AccountShell)
// and must show no public nav at all — not the NavBar, not the Footer, not
// the marketing ChatWidget. The Employee PWA (/employee) is the same case:
// it renders its own bottom nav (EmployeeBottomNav) and is a distinct
// installable app, not a page within the main site.
const PORTAL_PREFIXES = ['/admin', '/account', '/employee'];

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
      <div className="pt-14">
        {children}
        <Footer />
      </div>
      <ChatWidget />
    </>
  );
}
