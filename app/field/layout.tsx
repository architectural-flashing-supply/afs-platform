import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'AFS Field',
};

export const viewport: Viewport = {
  themeColor: '#1C1F26',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Shared shell for /field/** — the contractor camera-to-quote flow
 * (afs-fl-002) and the shop-floor job completion flow (afs-fl-003).
 * Deliberately bare: no public NavBar/Footer (see PORTAL_PREFIXES in
 * components/layout/AppChrome.tsx), no AdminShell/AccountShell sidebar —
 * both /field flows are single-purpose, full-screen mobile views used on a
 * phone in the field or a tablet on the shop floor, not multi-page portals.
 */
export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-afs-bg-dim text-afs-chrome-high">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">{children}</div>
    </div>
  );
}
