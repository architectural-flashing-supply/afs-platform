import type { Metadata } from 'next';
import { Bebas_Neue, Barlow_Condensed, Barlow, Inter, JetBrains_Mono } from 'next/font/google';
import NavBar from '@/components/layout/NavBar';
import Footer from '@/components/layout/Footer';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});
const barlowCondensed = Barlow_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});
const barlow = Barlow({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AFS — Architectural Flashing Supply',
  description: 'Custom fabricated sheet metal flashing. Upload your blueprint and receive a formal quote.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${barlowCondensed.variable} ${barlow.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-afs-bg-base text-afs-chrome-mid font-body">
        <NavBar />
        {/* Offset content for fixed left panel (w-60) and fixed top nav (h-16) */}
        <div className="ml-60 pt-16">
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}