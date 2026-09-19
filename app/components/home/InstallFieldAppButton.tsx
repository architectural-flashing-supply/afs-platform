'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { isDesktopForInstall, isIOS, isStandalone } from '@/lib/pwa/platform';

// Shared "Install Field App" CTA (2026-09-19 revision pass, item 4) --
// every "Open the Field App" button on the homepage (FieldAppStory,
// CustomerPathways) now renders this one component instead of two
// separately-labeled breakpoint variants, so the platform-detection logic
// lives in exactly one place.
//
// Behavior by platform:
//   - Already installed (standalone display-mode): straight to
//     /field/contractor, nothing else to offer.
//   - Desktop/laptop (no touch, or wide viewport): QR modal, never the
//     camera flow -- a desktop has no camera worth using here.
//   - iOS Safari: no beforeinstallprompt event exists on iOS at all: a
//     small sheet with the manual "Add to Home Screen" steps.
//   - Android/Chrome mobile: hard-navigates to
//     /field/contractor?install=1 rather than trying to trigger the
//     native prompt from here -- beforeinstallprompt reflects whichever
//     manifest is linked on the CURRENT page, and the homepage links the
//     root site manifest, not field-contractor-manifest.json. Only
//     /field/contractor itself links that (see
//     components/field/InstallPromptHandler.tsx, mounted there), so the
//     real field-contractor install prompt can only correctly fire once
//     the user has actually landed on that page.
export default function InstallFieldAppButton({ className }: { className?: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qrOpen || qrDataUrl) return;
    const targetUrl = `${window.location.origin}/field/contractor`;
    QRCode.toDataURL(targetUrl, { width: 320, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrOpen, qrDataUrl]);

  const handleClick = () => {
    if (isStandalone()) {
      window.location.href = '/field/contractor';
      return;
    }
    if (isDesktopForInstall()) {
      setQrOpen(true);
      return;
    }
    if (isIOS()) {
      setSheetOpen(true);
      return;
    }
    // Android/Chrome mobile. A hard navigation (not next/link/router) is
    // deliberate -- it guarantees a fresh load of /field/contractor with
    // its own manifest correctly linked from first paint, giving the
    // browser a clean chance to evaluate installability for that specific
    // manifest rather than carrying over whatever beforeinstallprompt
    // state (if any) belonged to the homepage's own manifest.
    window.location.href = '/field/contractor?install=1';
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        Install Field App
      </button>

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install the AFS Field App on iOS"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-afs-border bg-afs-bg-raised p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg font-semibold text-afs-chrome-high">Install the Field App</h3>
            <ol className="mt-4 flex flex-col gap-3 font-body text-sm text-afs-chrome-mid">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-afs-crimson font-label text-xs font-bold text-white">
                  1
                </span>
                Tap the <span className="font-semibold text-afs-chrome-high">Share</span> button in Safari&apos;s
                toolbar.
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-afs-crimson font-label text-xs font-bold text-white">
                  2
                </span>
                Scroll down and tap{' '}
                <span className="font-semibold text-afs-chrome-high">Add to Home Screen</span>.
              </li>
            </ol>
            <a
              href="/field/contractor"
              className="mt-6 block rounded bg-afs-crimson px-6 py-3 text-center font-label text-sm font-semibold text-white transition-colors hover:bg-afs-crimson-hover"
            >
              Continue to Field App
            </a>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-3 block w-full text-center font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {qrOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Scan to install the AFS Field App"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-afs-border bg-afs-bg-raised p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-center font-heading text-lg font-semibold text-afs-chrome-high">
              Scan with your phone to install the AFS Field App
            </h3>
            <div className="mt-6 flex h-[176px] w-[176px] items-center justify-center rounded bg-white p-2">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code linking to the AFS Field App" className="h-full w-full" />
              ) : (
                <span className="font-body text-xs text-afs-ink-700">Generating…</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="mt-6 font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
