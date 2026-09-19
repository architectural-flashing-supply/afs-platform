'use client';

// Shared beforeinstallprompt capture (2026-09-19 revision pass, item 4).
// A module-level singleton rather than React state: the event can fire at
// any point after this module is first imported, and multiple
// "Install Field App" buttons (FieldAppStory + CustomerPathways) share the
// same captured event rather than each attaching a duplicate listener.
//
// Important scoping note: beforeinstallprompt reflects the manifest linked
// on the CURRENT page (Next.js metadata.manifest, resolved per route
// segment). This module works correctly wherever it's used, but the
// homepage links the root public/manifest.json ("AFS", start_url "/"), not
// field-contractor-manifest.json -- only /field/contractor itself links
// that. So the homepage buttons never try to trigger the prompt directly;
// they hard-navigate to /field/contractor?install=1, and
// components/field/InstallPromptHandler.tsx (mounted only on that route,
// where the correct manifest is actually linked) captures and triggers the
// real field-contractor install prompt on arrival.

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenerAttached = false;
const subscribers = new Set<(available: boolean) => void>();

function notify() {
  subscribers.forEach((cb) => cb(deferredPrompt !== null));
}

function attachListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/**
 * Call once on mount in any component that wants to react to availability.
 * Does NOT synchronously invoke cb with the current state -- a caller that
 * also needs the current value should check hasDeferredInstallPrompt()
 * itself first. (A synchronous initial call here would race: it'd fire
 * before this function has returned, so a caller capturing the return
 * value as `const unsubscribe = subscribeInstallPrompt(cb)` could see
 * `unsubscribe` still undefined inside that very first callback.)
 */
export function subscribeInstallPrompt(cb: (available: boolean) => void): () => void {
  attachListener();
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function hasDeferredInstallPrompt(): boolean {
  attachListener();
  return deferredPrompt !== null;
}

/** Spends the captured event -- each beforeinstallprompt firing is usable once. */
export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  attachListener();
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome;
}
