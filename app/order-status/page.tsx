import type { Metadata } from 'next';
import OrderStatusLookup from '@/components/track/OrderStatusLookup';

/**
 * Public order-status lookup — the third surface of SPEC_PRODUCTION_TIMELINE.md
 * §1 ("public order tracker, read-only, minimal variant"). No session, no
 * token: order number plus the matching account email, verified by the existing
 * POST /api/track/verify.
 *
 * NOT under /track. Every /track path renders without the site nav or footer
 * (components/layout/AppChrome.tsx's NO_CHROME_PREFIXES, there so the
 * full-screen delivery map can fill the viewport), and a public lookup page
 * wants ordinary chrome. The live delivery map at /track/[orderId] is a
 * different, token-addressed thing and is untouched — see
 * components/track/OrderStatusLookup.tsx's own note.
 *
 * `components/layout/Footer.tsx`'s "Track an Order" link points here. It used to
 * point at /account/orders, which requires a session — a public footer link that
 * bounced an anonymous visitor to /login.
 */
export const metadata: Metadata = {
  title: 'Track an Order | Architectural Flashing Supply',
  description:
    'Check where your AFS order sits in fabrication. Enter your order number and the email it was placed with — no account needed.',
};

export default function OrderStatusPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <OrderStatusLookup />
    </main>
  );
}
