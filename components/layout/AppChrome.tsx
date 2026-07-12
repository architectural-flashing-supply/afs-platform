'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import NavBar from './NavBar';
import Footer from './Footer';

const ChatWidget = dynamic(() => import('@/components/ai/ChatWidget'), { ssr: false });

const NO_CHROME_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/invite'];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = NO_CHROME_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <NavBar />
      <div className="ml-48 pt-11">
        {children}
        <Footer />
      </div>
      {!isAdminRoute && <ChatWidget />}
    </>
  );
}
