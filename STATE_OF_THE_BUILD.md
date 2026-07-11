# State of the Build

_Last updated: 2026-07-11_

## Design tokens (2026-07-11)

Rewrote the `afs-*` token system in `tailwind.config.js` and `app/globals.css`
to fix a near-black/low-contrast palette that read as dark-on-dark:

- **Backgrounds** lifted a step across the board — `bg-dim` #1C1F26 through
  `bg-overlay` #404656 (previously #14151A–#32363F).
- **Text** is now white/light-gray only — `chrome-high` #FFFFFF, `chrome-mid`
  #E2E6EE, `chrome-base` #B8BFD0, `chrome-dim` #7A8299 (the floor — nothing
  darker is used for text or the footer). Previously these ran as dark as
  #48526A.
- **Buttons**: `afs-crimson` #C0001A unchanged as the primary CTA color; added
  `afs-btn-secondary` #4A5166 for secondary buttons (white text).
- **Borders**: added dedicated `--afs-border` / `--afs-border-strong` CSS vars
  (rgba(180,190,210) at 0.20 / 0.35) — visible against the new lighter
  backgrounds. Not yet wired into components, which still border with
  `chrome-dim`; that still works since `chrome-dim` sits at the new text
  floor, but new component work should prefer `var(--afs-border)`.
- **Accents**: added `chrome-silver` #C8D0E0 (highlights, metal-edge
  gradient) and `amber` #F59E0B / `amber-dim` #92650A / `amber-ghost` for
  minimal accent use. `afs-copper` #B87333 kept, scoped to the architect
  portal only. `success`/`warning`/`info` status colors left as-is.
- `.metal-edge` gradient now peaks at white with chrome-silver shoulders
  (was chrome-mid/chrome-high under the old, darker chrome scale).
- `pnpm tsc --noEmit` passes with 0 errors as of this update.

## Hardcoded hex cleanup (2026-07-11, follow-up)

Replaced the two `border-[#48526A]` literals in `app/page.tsx` (old
chrome-dim value, flagged in the prior pass) with `border-afs-chrome-dim`.
Scanned `app/upload/page.tsx`, `components/layout/NavBar.tsx`, and
`components/layout/Footer.tsx` for other hardcoded hex values bypassing the
`afs-*` token system — none found; those three files already use tokens
exclusively. (`app/upload/page.tsx` still has one hardcoded
`rgba(192,0,26,0.08)` background, close to but not identical to
`--afs-crimson-ghost`'s 0.12 alpha — left as-is since this pass was scoped to
hex literals only.) `pnpm tsc --noEmit` passes with 0 errors as of this
update.

## Note on missing spec docs

This file, along with `SESSION_STATE.md`, did not exist in the repo prior to this
update — they're created here for the first time. `CLAUDE.md`, `BLUEPRINT.md`,
`SPEC_QUOTE_BUILDER.md`, and `DESIGN_TOKENS.md` were also referenced as prior
context but are not present in the repo. The quote wizard below was built from
the inline task spec plus conventions already established in
`app/upload/page.tsx`, `tailwind.config.js`, and `app/globals.css`. If those
docs exist elsewhere, reconcile this page against them.

## Pages

| Route      | Status      | Notes |
|------------|-------------|-------|
| `/`        | Done        | Full-viewport diagonal-split photo hero (see "Homepage hero rebuild" below), replacing the old placeholder card. |
| `/upload`  | Done        | Blueprint Takeoff AI: drag/drop upload → AI extraction → editable results table → "Submit Quote Request" (no-op) / "Build Quote Manually" link to `/quote`. |
| `/quote`   | Done        | 4-step manual quote request wizard (this session). |

## `/quote` — Quote Request Wizard

`app/quote/page.tsx`, client component, single-file, 4-step wizard with a
stepper header, per-step validation gating the "Next" button, and a
client-side-only submit (no backend endpoint exists yet for quote
submissions — submit just flips to a local confirmation view).

- **Step 1 — Profile & Material**: profile type (button grid), material
  (dropdown), gauge/thickness (dropdown, options depend on selected material).
  All hardcoded placeholders in `PROFILE_TYPES` / `MATERIALS` / `GAUGE_OPTIONS`
  pending real catalog data.
- **Step 2 — Dimensions & Quantity**: width, height, leg A, leg B (inches,
  all optional but must be positive if provided), length (ft, required),
  quantity (required).
- **Step 3 — Project Details**: project name, jobsite address, PO number
  (optional), rush toggle, notes (optional).
- **Step 4 — Review**: read-only key/value tables grouped by section, each
  with an "Edit" link back to its step. **No prices are shown anywhere.**
  Submit button posts nothing (no API route) — transitions to a local
  confirmation screen.

Styling mixes `afs-*` Tailwind tokens with a set of direct hex utilities
(`bg-[#2A2D35]`, `bg-[#363D4E]`, `bg-[#8090AA]`, etc.) — see "Direct hex
override" below, which superseded the token-only pass on the page wrapper,
main card, profile buttons, and the material/gauge selects specifically.

## Quote wizard contrast fixes (2026-07-11)

`/quote` had a layering problem: profile-type buttons, the material/gauge
selects, and the rush-order toggle had no fill, so they sat directly on the
raised card (`afs-bg-raised` #2E3340) with only a thin border — visually
indistinguishable from the card itself. The "selected" state (a 8%-alpha
crimson tint) was nearly invisible on screen.

Fixed by giving every interactive control on the page its own layer, literally
as specified rather than via new tokens:

- Page → `bg-afs-bg-base` (#242830), card → `bg-afs-bg-raised` (#2E3340),
  every input/select/button → `bg-[#4A5166]`, hover → `bg-[#5A6280]`.
- Applied to: profile-type buttons, the Material/Gauge `<select>`s (shared
  `inputClass`, also used by all text/number/textarea fields), the rush-order
  toggle, and the Back / "Upload a Drawing Instead" secondary buttons.
- Selection is now marked with a `border-afs-crimson` border instead of a
  near-invisible background tint.
- `<option>` elements get an explicit `bg-[#4A5166] text-white` class
  (`optionClass`) so the closed `<select>` and its native popup no longer show
  browser-default colors.
- **Gauge dropdown**: verified with a headless-browser check (Playwright
  driving system Edge, since no browser tooling was preinstalled) that
  `GAUGE_OPTIONS` was already populating correctly and the select was already
  enabling/disabling correctly on material selection — this was a pure
  contrast bug (enabled and disabled looked the same), not a logic bug. Added
  `disabled:opacity-50 disabled:pointer-events-none` to the shared
  `inputClass` so the enabled state now reads as visibly interactive.
- **Next/Submit buttons**: already matched the nav "Submit a Drawing" button
  (`bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label
  font-semibold`) and were not faded when active — no change needed there;
  `disabled:opacity-40` only applies while `canProceed` is false.
- Verified visually (Playwright + system Edge, headless) at each wizard step
  before/after; confirmed via screenshot that fills and selection borders now
  render correctly. `pnpm tsc --noEmit` passes with 0 errors as of this
  update.

## Token conversion (2026-07-11, follow-up)

The prior "contrast fixes" pass used arbitrary-value hex utilities
(`bg-[#4A5166]`, `border-[#5A6280]`) to solve the layering problem quickly.
This pass replaced every one of those with real `afs-*` tokens per an
explicit mapping, so the page no longer has any hardcoded color literal:

- Page wrapper → `bg-afs-bg-base`; step-indicator row and card/panel
  containers → `bg-afs-bg-raised` (the step-indicator row previously had no
  background at all — added `bg-afs-bg-raised rounded p-6`).
- Inputs, textareas, and both `<select>`s (shared `inputClass`) →
  `bg-afs-bg-overlay text-afs-chrome-high border border-afs-border`;
  `<option>` elements (`optionClass`) → `bg-afs-bg-overlay text-afs-chrome-high`.
- Profile-type buttons: unselected → `bg-afs-bg-surface text-afs-chrome-high
  border-afs-border hover:bg-afs-bg-overlay`; selected → `bg-afs-crimson
  text-white border-afs-crimson` (full fill, replacing the old near-invisible
  8%-alpha tint).
- Rush-order toggle mapped the same way as the profile buttons (it's the same
  selectable-chip pattern); its inner switch-track "off" state moved from
  `afs-bg-surface`/`chrome-dim` to `afs-bg-overlay`/`afs-border` so it doesn't
  blend into the now-filled container.
- Back button reclassified as an active nav button alongside Next/Submit:
  `bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label
  font-semibold` (previously a bordered secondary style). "Upload a Drawing
  Instead" is the one that now uses the secondary-button pattern:
  `bg-afs-bg-overlay text-afs-chrome-high border-afs-border
  hover:bg-afs-bg-surface`.
- All remaining `text-afs-chrome-base` label/caption text (step-2 helper
  copy, review-table field labels, Edit links, footnotes) collapsed to
  `text-afs-chrome-mid` — the page now uses a two-tier text system
  (`chrome-high` primary / `chrome-mid` secondary); `chrome-dim` is kept only
  for genuine dim/disabled/future-step state, not label copy.
- Also audited `app/upload/page.tsx`, `components/layout/NavBar.tsx`, and
  `components/layout/Footer.tsx` for the same class of issue. NavBar and
  Footer were already 100% token-based. `app/upload/page.tsx` had one
  survivor — the drag-over dropzone state's `bg-[rgba(192,0,26,0.08)]` —
  replaced with `bg-afs-bg-overlay` (paired with the existing
  `border-afs-crimson`) rather than a raw tint.
- Verified visually via Playwright against system Edge (headless) at each
  wizard step. `pnpm tsc --noEmit` passes with 0 errors as of this update.

## Direct hex override (2026-07-11, follow-up)

A follow-up request explicitly asked for direct hex values in five specific
spots on `/quote` (not tokens), scoped to `app/quote/page.tsx` only —
`tailwind.config.js` / `globals.css` untouched:

- Outer page wrapper (both the wizard `<main>` and the submitted-confirmation
  `<main>`) → `bg-[#2A2D35]` (was `bg-afs-bg-base`).
- The shared wizard card (holds Profile & Material and every other step,
  since all four steps render inside the same container) → `bg-[#363D4E]`
  (was `bg-afs-bg-raised`).
- Profile-type buttons: unselected → `bg-[#8090AA] text-white border
  border-[#9AA8C0] hover:bg-[#9AA8C0]`; selected → `bg-[#C0001A] text-white
  border-[#C0001A]` (was the token-based surface/overlay + crimson pair from
  the prior pass).
- Material/Gauge `<select>`s only → new `selectClass` = `bg-[#8090AA]
  text-white border border-[#9AA8C0]`. Deliberately split from the shared
  `inputClass` so plain text/number/textarea fields keep their
  `afs-bg-overlay`/`afs-border` token styling, since those weren't named in
  the request. `optionClass` (the `<option>` elements) was also left
  untouched for the same reason — not named in the request.
- Everything else on the page (step-indicator background, rush toggle,
  review tables, Back/Next/Submit buttons, text colors) is unchanged from the
  token-based pass above.
- Verified visually (Playwright + system Edge, headless). `pnpm tsc --noEmit`
  passes with 0 errors as of this update.

## Card background tweak (2026-07-11, follow-up)

The shared wizard card (contains the "Profile & Material" heading and all
step content — see "Direct hex override" above) had its background changed
again, from `bg-[#363D4E]` to `bg-[#4A5568]`. Nothing else on the page
touched. `pnpm tsc --noEmit` passes with 0 errors as of this update.

## Homepage hero rebuild (2026-07-11)

`app/page.tsx` rebuilt from scratch as a full-bleed photo hero using the
three images dropped at `public/home_page_images/{1,2,3}.jpg`:

- **Layout**: image 1 fills the left 40% of the viewport at full height;
  images 2 and 3 stack top/bottom across a full-bleed layer behind it (image
  2 top half, image 3 bottom half). The right layer spans the full width
  (z-0) specifically so there's no gap or background bleed-through wherever
  the left layer's diagonal clip recedes — the left image div (z-10, `w-[40%]`)
  sits on top with `clip-path: polygon(0 0, 100% 0, calc(100% - 10vh) 100%, 0
  100%)`, a ~6°-equivalent diagonal edge (`tan(6°) × 100vh ≈ 10.5vh`).
  All three use `next/image` with `fill` + `object-cover` + `priority`.
- **Overlay**: each image gets its own `bg-gradient-to-t from-black/60
  to-transparent` div for text legibility.
- **Headline**: two new global classes in `globals.css`, `.hero-glow-red`
  (`#C0001A`, layered crimson text-shadow/glow) and `.hero-glow-chrome`
  (`#D0D6E8`, a softer chrome glow) — applied to "Texas Crafted. Nationally
  Delivered." (`font-display`, `text-[5rem] md:text-[7rem]`) and "Precision
  Metal Flashing Fabrication" (`font-heading`, `text-3xl md:text-4xl
  font-semibold`) respectively. Both are centered, full-width overlay content
  above the images (z-20).
- **CTAs**: "Submit a Drawing" → `/upload` (crimson fill) and "Request a
  Quote" → `/quote` (outline), both direct hex per the request
  (`bg-[#C0001A]`/`hover:bg-[#E8001F]`, `border-[#9AA8C0]`/`hover:bg-white/10`).
- Verified visually via Playwright + system Edge (headless) — no console
  errors, diagonal seam and both overlays render correctly.

## NavBar restructure (2026-07-11)

`components/layout/NavBar.tsx` converted to a client component
(`usePathname`) to support active-link highlighting:

- **Header** (top, right of the left panel): the crimson "Submit a Drawing"
  button and "Sign In" button were removed entirely — it now holds only the
  four nav links (Products, Request a Quote, Upload Drawing, Architects), no
  CTA boxes.
- **Left panel**: added a vertical nav below the logo — Home, Products,
  Request a Quote, Upload Drawing, Architects, a divider, then My Account and
  Sign In (moved here from the header). Each link is
  `font-label text-sm text-afs-chrome-mid hover:text-white
  hover:bg-afs-bg-surface px-4 py-2.5 rounded transition-colors`; the link
  matching the current route (`pathname === href`, exact match) instead gets
  `text-white bg-afs-bg-surface border-l-2 border-afs-crimson`.
- Verified visually on `/` (Home active) and `/upload` (Upload Drawing
  active).

`pnpm tsc --noEmit` passes with 0 errors as of this update.

## Known gaps / next steps

- No backend endpoint for quote submissions — `/quote` and the upload results
  screen's "Submit Quote Request" button are both client-only no-ops.
- `PROFILE_TYPES`, `MATERIALS`, `GAUGE_OPTIONS` in `app/quote/page.tsx` are
  placeholders — replace with real catalog data when available.
- `/products`, `/architects`, `/account`, `/login` are linked from the left
  nav panel and header but don't exist yet as routes.
- `pnpm tsc --noEmit` passes with 0 errors as of this update.
