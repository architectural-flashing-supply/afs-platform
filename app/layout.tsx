import type { Metadata, Viewport } from 'next';
import {
  Bebas_Neue,
  Barlow_Condensed,
  Barlow,
  Barlow_Semi_Condensed,
  Inter,
  JetBrains_Mono,
} from 'next/font/google';
import AppChrome from '@/components/layout/AppChrome';
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
// Command Center v7 sets its body text in Barlow and asks for 700 as well as
// 400/500/600 (`.stretch`, `.mrow .m1`, `th`, `.pill`, `.facts dd` are all
// bold). See docs/design/command-center-v7/FONTS.md.
const barlow = Barlow({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
});
// v7's `--display` family. Barlow SEMI Condensed is a different family from
// Barlow Condensed (already loaded above for the marketing site) — it is the
// measure every v7 heading and the brand wordmark are set in, which is why
// v7's own fallback is "Arial Narrow" rather than Arial.
const barlowSemiCondensed = Barlow_Semi_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow-semi-condensed',
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
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#C0001A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${barlowCondensed.variable} ${barlow.variable} ${barlowSemiCondensed.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-afs-bg-base text-afs-chrome-mid font-body">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}