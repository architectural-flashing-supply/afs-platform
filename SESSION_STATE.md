# Session State

_Last session: 2026-07-11_

## This session

Full day of design-system and page work on top of yesterday's quote wizard
build. In order:

1. **`afs-*` token rewrite** (`tailwind.config.js`, `app/globals.css`) — the
   original palette read as near-black/dark-on-dark; lifted the whole
   background scale, made text white/light-gray only, added
   `afs-btn-secondary`, `afs-border`/`afs-border-strong`, `chrome-silver`,
   `amber`/`amber-dim`/`amber-ghost`.
2. **Hardcoded-hex cleanup** across `app/page.tsx` (at the time),
   `app/upload/page.tsx`, `NavBar.tsx`, `Footer.tsx` — replaced stray hex
   literals with tokens.
3. **`/quote` contrast fixes** — profile buttons, selects, and the rush
   toggle had no background fill and sat invisibly on the card; gave every
   control its own layer. Went through a few follow-up rounds per explicit
   request: token-based → direct hex overrides on specific elements (page
   wrapper, main card, profile buttons, selects) → one more card-background
   tweak. `app/quote/page.tsx` now intentionally mixes `afs-*` tokens with a
   handful of direct hex utilities — see `STATE_OF_THE_BUILD.md` for the
   exact current values, since these changed multiple times today.
4. **Homepage rebuild** (`app/page.tsx`) — replaced the placeholder card with
   a full-viewport diagonal-split photo hero using
   `public/home_page_images/{1,2,3}.jpg`, glowing crimson/chrome headline
   text (new `.hero-glow-red` / `.hero-glow-chrome` classes in
   `globals.css`), and two CTA buttons.
5. **NavBar restructure** (`components/layout/NavBar.tsx`) — removed the
   header's "Submit a Drawing"/"Sign In" buttons, added a vertical nav menu
   (with active-route highlighting) to the left logo panel instead. Now a
   client component (`usePathname`).

`CLAUDE.md`, `BLUEPRINT.md`, `SPEC_QUOTE_BUILDER.md`, and `DESIGN_TOKENS.md`
were requested as reading material on day one but don't exist in the repo;
still worth confirming with Reid whether they exist outside the repo.

## Verified

- `pnpm tsc --noEmit` → 0 errors (checked after every change today).
- Visual verification throughout via Playwright driving the system-installed
  Edge browser in headless mode (no browser automation tooling was
  preinstalled — `playwright-core` was installed into the scratch temp dir
  only, not added to `package.json`).

## Next steps (not started)

- Wire `/quote` submit and the upload page's "Submit Quote Request" button to
  a real backend endpoint once one exists.
- Replace placeholder profile/material/gauge lists in `app/quote/page.tsx`
  with real catalog data.
- `/products`, `/architects`, `/account`, `/login` are linked from the
  NavBar's left panel and header but don't exist as routes yet.
- If the four missing spec docs turn up, diff this build against them.
