// Canonical site URL, single source of truth (2026-09-19 revision pass,
// item 11). Replaces every hardcoded deployment hostname that had drifted
// out of date; CLAUDE.md rule #9 requires server-side code to call this
// rather than spell a URL out.
//
// THE COMMENT HERE USED TO NAME https://afs-website-eight.vercel.app AS THE
// REAL PRODUCTION ALIAS. THAT WAS BACKWARDS, and it was corrected in CLAUDE.md
// (lr-01, 2026-09-29) from live Vercel API output without this file being
// updated with it. The canonical environment is
// **https://afs-website-alpha.vercel.app**, the production alias of
// steveharyckis-projects/afs-website tracking `main`. The `-eight` project was
// DISCONNECTED from GitHub on 2026-09-29 and no longer builds this repo.
// Corrected here 2026-09-30 (v2-03) so the code and the governance agree.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL -- explicit, set in Vercel production env.
//   2. VERCEL_URL -- Vercel's own per-deployment hostname, auto-populated
//      on every deployment (preview and production alike), no https://
//      prefix in the raw env var.
//   3. http://localhost:3000 -- local dev fallback.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
