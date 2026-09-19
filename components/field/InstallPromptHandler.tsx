'use client';

import { useEffect } from 'react';
import { hasDeferredInstallPrompt, subscribeInstallPrompt, triggerInstallPrompt } from '@/lib/pwa/install-prompt';

// Invisible -- renders nothing. Mounted only on /field/contractor
// (app/field/contractor/page.tsx), the one route that actually links
// field-contractor-manifest.json (see that page's own metadata export), so
// this is the only place beforeinstallprompt can correctly reflect that
// manifest's identity rather than the homepage's root site manifest. See
// components/home/InstallFieldAppButton.tsx's own comment for the full
// reasoning behind why the homepage button hard-navigates here
// (?install=1) instead of trying to trigger the prompt itself.
export default function InstallPromptHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('install')) return;

    // beforeinstallprompt may already have fired by the time this effect
    // runs, or may still be pending -- check the already-captured case
    // synchronously first, then subscribe for the pending case.
    if (hasDeferredInstallPrompt()) {
      triggerInstallPrompt();
      return;
    }
    const unsubscribe = subscribeInstallPrompt((available) => {
      if (!available) return;
      unsubscribe();
      triggerInstallPrompt();
    });
    return unsubscribe;
  }, []);

  return null;
}
