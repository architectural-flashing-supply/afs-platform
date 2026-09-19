// Canonical site URL, single source of truth (2026-09-19 revision pass,
// item 11). Replaces every hardcoded 'https://afs-website-alpha.vercel.app'
// fallback that had drifted from the real production alias
// (https://afs-website-eight.vercel.app) -- see STATE_OF_THE_BUILD.md for
// the `vercel alias ls` investigation into what "alpha" actually is.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL -- explicit, set in Vercel production env (this
//      pass sets it to https://afs-website-eight.vercel.app).
//   2. VERCEL_URL -- Vercel's own per-deployment hostname, auto-populated
//      on every deployment (preview and production alike), no https://
//      prefix in the raw env var.
//   3. http://localhost:3000 -- local dev fallback.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
