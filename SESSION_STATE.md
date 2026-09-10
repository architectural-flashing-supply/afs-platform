# SESSION_STATE.md
## AFS — Session Log
**This is the handoff document between sessions.**

---

## WORKING STYLE NOTE — VERIFICATION STANDARD

Governance docs in this project must reflect **verified, tested-and-confirmed
status only**. A Claude Code session's own "verified live" claim — a
Playwright screenshot, a passing build, a byte-for-byte screenshot diff — is
**not sufficient on its own** to mark a fix complete in these documents,
especially for anything visual or interactive. Multiple times in this
project's history, a fix was reported complete by the session that made it
and later found to not actually be visible or working correctly once the
user checked it themselves (FlashDraft's hem glyph rendering is the current
live example — several rewrite passes each self-reported as "verified,"
none yet confirmed correct by the user against real reference evidence).

**Going forward:** report a session's own testing as exactly that — evidence
to bring to the user — and hold the item as unresolved/unconfirmed in these
docs until the user has independently checked the actual behavior. Do not
let self-reported verification read as equivalent to user confirmation.

---

## CUSTOMERPATHWAYS — THREE-ROLE PATHWAY CARDS (hp-009): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`. Commit
`52b2b58`.

Read CLAUDE.md, DESIGN_TOKENS.md, SITEMAP.md, SPEC_ARCHITECT_PORTAL.md, and
SPEC_ONLINE_CREDIT_APPLICATION.md first, then resolved all three routes
against the real `app/` tree rather than SITEMAP.md alone — SITEMAP.md's
route tree has no `/field/**` entry at all (a staleness hp-005 and hp-006
already flagged and worked around), so `/field/contractor` was re-confirmed
with a direct `Glob` this pass. Final route mapping: Contractors ->
`/field/contractor` (`ContractorCameraQuoteForm`, anonymous camera-to-
quote), Architects -> `/architects` (portal landing), Purchasing ->
`/account/credit-application` (`CreditApplicationForm`, auth required).

Built `app/components/home/CustomerPathways.tsx` — a server component
(static content, no interactivity needed), three cards in a `grid-cols-1
md:grid-cols-3` layout per the prompt's stacked-on-mobile/3-column
requirement. Each card: an inline-SVG role icon (same pattern as
`DesignToDelivery.tsx`, no `lucide-react` in this repo — checked
directly), a one-sentence value line, three bullets naming capabilities
that exist today, and a crimson `metal-edge-red` CTA button.

Deliberately did **not** apply copper to the Architects card:
SPEC_ARCHITECT_PORTAL.md §3 restricts the copper accent to `/architects/**`
routes only, and this component lives on the homepage. All three cards
use the same crimson accent as the rest of the homepage.

Bullets grounded in real features, not generic copy: Contractors —
photo-to-quote AI, guest/no-account submission, PWA install. Architects —
AI spec writer, CAD/BIM library, finish palette (the three of
`SPEC_ARCHITECT_PORTAL.md`'s four landing cards that are public/browsable
without an account; Custom Profiles needs one, left out). Purchasing —
net-30/60 credit application, `/account/team`'s real member roles, and
PO numbers (a real field collected on quote/configure/checkout, per a
direct grep — phrased as "every quote and order carries your purchase
order number," not as a dedicated PO-management feature that doesn't
exist).

**Left open, not silently fixed:** `CustomerPathways` is not yet imported
into `app/page.tsx` — deferred to `hp-019` same as hp-002 through hp-008.
No Playwright checkpoint run this pass (not requested); Reid has not
looked at this component yet.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard.

---

## DESIGNTODELIVERY — FIVE-STEP CAPTURE-TO-DELIVERY SEQUENCE (hp-008): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`. Commit
`c90c8aa`.

Read CLAUDE.md, DESIGN_TOKENS.md, and SPEC_PRODUCTION_TIMELINE.md first,
then checked `package.json` before writing any code — neither
`lucide-react` nor `framer-motion` is a dependency, so icons are five
hand-authored inline SVGs and the progress rail uses CSS transitions only,
no new package.

Built `app/components/home/DesignToDelivery.tsx` — five steps (Capture →
Convert → Verify → Fabricate → Track), each with an icon, title, and
two-line description. Copy is grounded in the real platform flow rather
than generic labels: Convert's "dimensions are always confirmed by you,
never guessed from a photo" deliberately mirrors the correction
`FieldAppStory.tsx` (hp-005) already made against SPEC_PHOTO_TO_QUOTE_AI.md
(the AI never extracts dimensions from a photo); Verify/Fabricate reflect
estimator review and the Thalmann DS2801 shop floor; Track reflects
production-stage updates and delivery per SPEC_PRODUCTION_TIMELINE.md.

Progress rail: one `IntersectionObserver` (threshold 0.5) watches each
step's `data-step-index` and unobserves once triggered, raising a
`visibleCount` state that drives `fillPercent = (visibleCount / 5) * 100`.
Desktop shows a `hidden md:block` horizontal rail, mobile a `md:hidden`
vertical rail, both reading the same `fillPercent` for `width`/`height`
respectively, transitioned via Tailwind's `transition-[width]`/
`transition-[height] duration-700`.

`prefers-reduced-motion`: a `matchMedia` listener sets `visibleCount` to
the full step count immediately instead of waiting on the observer, so the
rail renders fully filled with no scroll-driven animation. Actual
transition suppression already comes from `globals.css`'s existing global
reduced-motion block (`transition-duration: 0.01ms !important`) — nothing
extra was needed per-component for that half of it.

Not imported into `app/page.tsx` — deferred to `hp-019`, same as
hp-002/hp-003/hp-004/hp-005/hp-006. No Playwright checkpoint run this pass
(not requested by the prompt); Reid has not looked at this component yet.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard.

---

## DESIGNSTUDIOHUB — FIVE-METHOD SELECTOR + /design-studio ROUTE (hp-006): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`. Commit
`4fa1228`.

Read CLAUDE.md, DESIGN_TOKENS.md, SITEMAP.md, and COMPONENT_MAP.md first,
then resolved the five method routes against the real `app/` tree rather
than trusting COMPONENT_MAP.md verbatim — it found one stale claim:
COMPONENT_MAP.md says `app/studio/page.tsx`'s Photo to Quote tab links to
`/upload?tab=photos`; the real file (checked directly) links to plain
`/upload`, which has no photo mode at all (grepped `app/upload/page.tsx`
for `photo`/`mode=`/`PhotoUploadZone` — zero matches). The real photo-to-
quote flow is `/field/contractor` (`ContractorCameraQuoteForm`, anonymous
camera-to-quote, already linked from hp-005's `FieldAppStory.tsx` for the
same reason) — that's what `DesignStudioHub` links to. Final route
mapping: Scan Plans → `/upload`, Photo to Quote → `/field/contractor`,
FlashDraft → `/studio/draft`, Configurator → `/configure`, Quick Quote →
`/quote`.

Built `app/components/home/DesignStudioHub.tsx` — `id="design-studio"`
(the anchor `CredibilityStrip.tsx` already links to), ARIA tabs pattern:
`role="tablist"`/`role="tab"` cards with `aria-selected` and roving
`tabIndex` (selected card = 0, rest = -1), one `role="tabpanel"` below
showing description/"Best for"/a `Start` button (real `Link` to the
resolved route). Arrow Left/Right/Up/Down move both selection and DOM
focus; Home/End jump to first/last. Card row: `overflow-x-auto snap-x
snap-mandatory` below `sm:`, 5-column grid at `sm:` and up — always above
the detail panel. Default selection: FlashDraft (index 2), per the
prompt.

Created `app/design-studio/page.tsx` — did not exist before this pass.
Server component, `title: 'Design Studio | AFS Architectural Flashing
Supply'`, renders `DesignStudioHub` full-width in a `<main>`. No manual
NavBar/Footer — `/design-studio` isn't in `AppChrome.tsx`'s
`NO_CHROME_PREFIXES`/`PORTAL_PREFIXES`, so it gets the standard site
chrome automatically. This resolves the 404 hp-003 flagged: `HeroSection
.tsx`'s "Start a Quote" CTA already pointed at `/design-studio` before
this route existed.

**Left open, not silently fixed:** `components/layout/NavBar.tsx`'s
"Design Studio" nav link still points to the older `/studio` 4-tab
landing page, not `/design-studio` — reconciling the two wasn't in this
prompt's scope. `DesignStudioHub` is not yet imported into `app/
page.tsx` — deferred to `hp-019` same as hp-002 through hp-005. No
Playwright checkpoint run this pass (not requested); Reid has not looked
at this component yet.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard.

---

## FIELDAPPSTORY — PHOTO-TO-QUOTE FIELD APP STORY SECTION (hp-005): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`. Commit
`fe5a917`.

Built `app/components/home/FieldAppStory.tsx` — a two-column section: a
CSS-only phone device frame (bezel/notch built from styled `div`s, no
third-party device-frame image) on the left, playing a muted, looping 0-7s
cut of `public/videos/hero-metal-fabrication.mp4`/`.webm` (same source
HeroSection uses, trimmed client-side via a `timeupdate` handler that
resets `currentTime` to 0 at 7s — no separate trimmed asset), poster
`/images/hero-poster.jpg` as fallback, and paused under
`prefers-reduced-motion` (same pattern as HeroSection). Right column:
heading "Photo to Quote from the jobsite" and a three-step numbered flow.

**Step 2 copy corrected against SPEC_PHOTO_TO_QUOTE_AI.md, not shipped as
prompted.** The prompt's literal copy — "AI extracts the profile and
dimensions" — contradicts the spec directly: §1 and §4's system prompt are
explicit that dimensions are never extracted from photos
(`dimensionVisible`/`visibleWidth` default false/null; "Never estimate
dimensions from photos") and must always be entered from site
measurements. Shipped as "AI identifies the profile and material" instead,
which is what the spec's AI step actually does.

CTA "Open the Field App" and secondary text link "Install as an app" both
route to `/field/contractor` — confirmed as a real, existing route
(`app/field/contractor/page.tsx`, no auth/role gate, its own
`/field-contractor-manifest.json` PWA manifest already wired via that
page's route-scoped `metadata.manifest`) before linking, not assumed from
the prompt.

Background accent: `flashing-1.jpg` from
`public/legacy-site-photos/homepage-categories/`, at 8% opacity behind an
`afs-bg-base/90` scrim — the manifest there confirms it as a real jobsite
installation-detail photo ("angled receiver/counterflashing bracket
fastened over a metal roof panel against a stucco wall — real installation
detail, not a staged product shot"), not stock.

Not imported into `app/page.tsx` — deferred to `hp-019`, same as
hp-002/hp-003/hp-004. No Playwright checkpoint run this pass (not
requested by the prompt); Reid has not looked at this component yet.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard.

---

## CREDIBILITYSTRIP — FIVE-ITEM CAPABILITY NAV (hp-004): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`. Commit
`024c554`.

Built `app/components/home/CredibilityStrip.tsx` — a `<nav aria-
label="Key capabilities">` with five condensed-uppercase (`font-heading`)
links on an `afs-bg-surface` background: "5 Ways to Start", "9
Materials", "Custom Profiles", "SMACNA Standards Compliant", "Nationwide
Delivery". Desktop is a single centered row with `&middot;` separators
between items; mobile is a `grid-cols-2` 2-up stack, with the fifth item
(`SMACNA Standards Compliant`) `col-span-2` since 5 doesn't split evenly
across 2 columns.

Link targets: "5 Ways to Start" → `#design-studio`, "Custom Profiles" →
`#profile-passport`, "Nationwide Delivery" → `#nationwide`, per the
prompt's explicit instruction (none of these ids exist on any page yet —
same open state as HeroSection's `#profile-explorer` from hp-003, to
resolve when `hp-019` assembles the real homepage sections). "9
Materials" → `/architects/finish-palette`, the real public materials/
finish page (queries the live `materials`/`finishes` tables) — so the
prompt's `#profile-explorer` fallback wasn't needed. "SMACNA Standards
Compliant" → `/architects/guides`, the real resource-center page (its
component is named `ArchitecturalResourceCenterPage`, on-page eyebrow
"Architectural Resource Center", fully public per SITEMAP.md) — chosen
over `/resources` ("Industry Resources"), a separate page that also
mentions SMACNA but isn't the resource-center page.

Not imported into `app/page.tsx` — deferred to `hp-019`, same as hp-002/
hp-003. No Playwright checkpoint run this pass (not requested by the
prompt); Reid has not looked at this component yet.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard.

---

## HEROSECTION — FULL-BLEED VIDEO HERO WITH PROFILEROTATION (hp-003): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`.

Built `app/components/hero/HeroSection.tsx`, combining hp-001's video
asset and hp-002's `ProfileRotation` component. Full-bleed
`hero-metal-fabrication.webm`/`.mp4` background video (`autoPlay muted
loop playsInline preload="metadata"`, `poster="/images/hero-
poster.jpg"`), `afs-bg-dim` gradient overlay reusing the same stops as
`app/page.tsx`'s current hero, `min-h-[100svh]` layout — text left /
`ProfileRotation` right on desktop, stacked with a shorter
`ProfileRotation` on mobile. Exact H1 copy: "SHOW US THE DETAIL. WE'LL
FORM IT." Primary CTA "Start a Quote" → `/design-studio`; secondary
"Explore Profiles" → `#profile-explorer`. `ProfileRotation` consumed via
`next/dynamic(..., { ssr: false })`, same pattern as `HailViewMap`.

LCP/reduced-motion handling: `<video>`'s `<source>` children are only
rendered after mount, once a `matchMedia('prefers-reduced-motion:
reduce')` check (with a live `change` listener) has run — so the
`poster` always paints first, and reduced-motion users never get a
video source at all.

Verified per the prompt's checkpoint: mounted on a temporary
`app/hp-003-preview/page.tsx`, ran `pnpm dev`, drove it with a
throwaway Playwright script (no `chromium-cli` in this environment) at
375px/768px/1440px. Results: no layout shift (H1 bounding box identical
across a 500ms delay at every width), video confirmed muted and
playing (`currentTime` advancing) at every width, zero console errors,
`flexDirection` on the layout wrapper confirmed `column` at 375px and
`row` at 768px/1440px (mobile-stacked vs. desktop side-by-side, as
asked), and both CTA `href`s confirmed correct via the DOM. Screenshots
at all three widths were visually reviewed. The temp route and check
script were deleted after verification; only `HeroSection.tsx` is
committed.

**Flag for Reid, not fixed in this pass:** the prompt's own instructions
name `/design-studio` as the primary CTA target, but that route doesn't
exist yet — the live `NavBar`'s "Design Studio" label currently points
to `/studio`, and there's no `app/design-studio/` directory. That CTA
will 404 until `/design-studio` exists (new route, or an alias/redirect
from `/studio`) — needs a decision before `hp-019` wires this component
into the real homepage.

**Not wired into `app/page.tsx`.** Per the prompt's own instructions,
assembly into the real homepage happens in `hp-019`.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard —
Reid has not looked at this hero himself yet.

---

## PROFILEROTATION — THREE.JS HERO ANIMATION COMPONENT (hp-002): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`. Commit
`2528909`.

Built `app/components/hero/ProfileRotation.tsx` — a client component
rendering a folded Z-flashing profile (ExtrudeGeometry from a 2D bend
centerline, same offset-polyline ribbon technique as
`components/studio/ProfileViewer3D.tsx`, duplicated locally since this is
decorative geometry, not FlashDraft's CAD pipeline), brushed-metal
`MeshStandardMaterial`, a `RoomEnvironment`/`PMREMGenerator` environment
map, one shadow-casting light plus a `ShadowMaterial` ground plane
(transparent canvas except for the soft shadow). 8-second seamless loop:
continuous Y rotation (full 360 in the first 4s, held 4–6s, another full
turn 6–8s back to exactly 0), an `easeInOutCubic` X-scale "unfold" 3.5–6s,
and `afs-crimson` bend-line bars that fade/slide in 4.0–5.5s.
`prefers-reduced-motion` renders one static folded frame and never starts
the render loop (live `matchMedia` change listener, not just a
mount-time check). Follows `ProfileViewer3D`'s scene-setup/dispose
pattern: devicePixelRatio capped at 2, `ResizeObserver` resize, full
geometry/material/renderer disposal on unmount. Default export, meant to
be consumed via `next/dynamic(..., { ssr: false })` — same pattern
already used for `ChatWidget` in `components/layout/AppChrome.tsx`.

Verified per the prompt's checkpoint: mounted on a temporary
`app/dev/hero-preview/page.tsx`, ran `pnpm dev`, drove it with a
throwaway Playwright script (no `chromium-cli` in this environment) —
canvas rendered, rotation/unfold/re-fold all progressed correctly across
sampled frames 500ms apart, ~7.5s-apart screenshots matched (consistent
with a true 8s loop), zero `pageerror`s. One real console warning was
caught and fixed during this pass: `renderer.shadowMap.type =
THREE.PCFSoftShadowMap` is deprecated in this project's three@0.185 and
silently falls back with a warning — removed in favor of the default
`PCFShadowMap` (which is what `ProfileViewer3D` already uses, unchanged)
plus `light.shadow.radius` for the soft edge instead. Separately
confirmed the reduced-motion path with
`page.emulateMedia({ reducedMotion: 'reduce' })` — static, no animation,
zero page errors. The temp route and check scripts were deleted after
verification; only `ProfileRotation.tsx` is committed.

**Not wired into any real page.** `HeroVisual.tsx` (the current homepage
hero visual, per `COMPONENT_MAP.md`) is untouched and still the pure-CSS
mockup it always was. Integrating `ProfileRotation` into the actual
homepage — and reconciling it with hp-001's video assets, also unwired —
is separate follow-up work, not done here.

Marked IMPLEMENTED, UNCONFIRMED per this file's verification standard —
Reid has not looked at this animation himself yet.

---

## HOMEPAGE HERO + SHOP-FLOOR VIDEO ASSETS FROM REAL FABRICATION FOOTAGE (hp-001): IMPLEMENTED, UNCONFIRMED (2026-09-10)

`pnpm tsc --noEmit`: 0 errors. Branch: `feat/homepage-redesign`.

Produced `public/videos/hero-metal-fabrication.mp4`+`.webm` (18.2s,
1920x1080, 30fps, silent, 3.7MB/7.6MB) and `shop-floor-loop.mp4`+`.webm`
(25.0s, same specs, 8.8MB/12.7MB), plus `public/images/hero-poster.jpg`
and `shop-floor-poster.jpg` (1920x1080). Asset production only — nothing
wired into a page yet.

This prompt's own text described the source as "5 sources...
`public/videos/metal-fab-1.mp4` through `metal-fab-5.mp4`." That was
wrong on both count and location: the real footage is 8 clips
(`metal-fab-1.mp4`–`8.mp4`, real phone footage of the Thalmann machine,
mixed 30/120fps) sitting in `C:\Users\manag\Downloads\Recent Downloads\`,
not `public/videos/`. An earlier, uncommitted pass had already produced
the mp4/poster/README outputs above correctly from the real 8-clip set —
this session verified that work was genuine rather than trusting it
blind: `ffprobe`'d all 8 real source clips against the specific claims in
`scripts/video-review/README.md` (durations, resolutions, the one 120fps
clip) — all matched — and pulled + visually inspected 4 frames directly
from the encoded outputs, confirming real Thalmann-machine shop-floor
content, not placeholder video. Added the two missing `.webm` encodes,
added `.gitignore` rules for `public/videos/metal-fab-*.mp4` and
`scripts/video-review/*.jpg` (raw phone footage/review frames, never
committed), and this log entry.

**Worth telling Reid directly:** the queue prompt's source-footage
description (5 clips, wrong path) doesn't match reality (8 clips, in
Downloads) — if future `hp-*` prompts keep referencing footage paths,
whoever is authoring them should double check against what's actually on
disk before the prompt ships, the same way this session had to.

Marked IMPLEMENTED, UNCONFIRMED — not yet on any real page, not yet seen
by Reid.

---

## HAILVIEW DEFAULT ZOOM RE-CORRECTED, 8 → 9 (afs-hv-009): IMPLEMENTED, UNCONFIRMED — afs-hv-008's ZOOM 8 WAS STILL TOO WIDE ON REAL DESKTOP VIEWPORTS (2026-09-04)

`pnpm tsc --noEmit`: 0 errors.

Root cause: afs-hv-008 (below) picked `DEFAULT_ZOOM 8` and claimed live
screenshots confirmed it framed Central Texas "without going wider than
that region." Re-running that same check this session (Playwright,
1440x900 and 1366x768) showed that claim was incomplete — Houston,
Galveston, Sugar Land, The Woodlands, Tyler, and Longview were also
visible in frame at zoom 8, well outside Central Texas. The previous
session correctly spotted the right cities but didn't check for wrong
ones also being present. Contributing factor: the overlay panel
(afs-hv-007) docks left over the map's upper portion, so the visible,
unobstructed area at a given zoom is skewed right of the true geographic
center — a wide zoom's right-side bleed is easy to undercount if you're
only checking "are Austin/Waco/Killeen/San Antonio there," not also
"is anything else there that shouldn't be."

Changed `DEFAULT_ZOOM` `8` → `9` in `HailViewMap.tsx`. Re-verified live at
both viewports: Burnet now actually labeled (wasn't at zoom 8), plus Waco,
Killeen/Fort Hood, Georgetown, Round Rock, Austin, and San Antonio's Hill
Country approach (Fredericksburg, Boerne, Comfort, Kerrville) — no East
Texas/Gulf Coast bleed at either size. Also re-checked (not just carried
forward) afs-hv-008's `FitToMarkers` zoom-11 post-submit view against the
same real 209 Sure Cast Drive, Burnet, TX 78611 lookup — still correct,
no change made there.

Screenshots written to an untracked scratch path, deleted after the run
— not committed.

**Marked IMPLEMENTED, UNCONFIRMED per this file's VERIFICATION STANDARD**
— same caveat as afs-hv-008 below, and worth weighting more heavily this
time: afs-hv-008 was also marked IMPLEMENTED, UNCONFIRMED and needed a
correction on its very next check. This should not be treated as settled
until Reid has looked at it directly.

**Commit:** `fix: HailView default zoom re-corrected 8 to 9 after live
verification showed East Texas/Gulf Coast cities in frame at zoom 8
(afs-hv-009)`.

---

## HAILVIEW DEFAULT MAP VIEW + POST-SUBMIT ZOOM CORRECTED (afs-hv-008): IMPLEMENTED, UNCONFIRMED — DEFAULT VIEW NOW REAL CENTRAL TEXAS SERVICE AREA, POST-SUBMIT ZOOM LOOSENED (2026-09-04)

`pnpm tsc --noEmit`: 0 errors.

Root cause: `HailViewMap.tsx`'s `DEFAULT_CENTER [31.5, -97.0]` / `ZOOM 5`
(afs-hv-007) was a rounded value reused from `DeliveryTrackingMap.tsx`'s
nationwide-delivery-tracking framing — never actually calibrated for
HailView's own purpose. HailView's real service area, confirmed by Reid,
is physical roofing-bid prospecting dispatched out of the Burnet, TX shop
— Central Texas only, not the nationwide flashing-shipping footprint
`afs-company.ts`'s `company-service-area` entry describes; dispatching a
crew to a Dallas roof from Burnet isn't realistic.

Changed `DEFAULT_CENTER` to the real Burnet shop coordinate
(`30.737075730063307, -98.23321342395246`, matching `afs-company.ts`'s
shop-coordinates entry exactly) and `DEFAULT_ZOOM` to `8` — confirmed by
live screenshot to frame Austin, Waco, Killeen, and San Antonio's
northern edge around Burnet, not the whole US, not a single city. Loosened
`FitToMarkers`'s single-point `setView` zoom from `13` to `11` — confirmed
by live screenshot to leave visible room around the post-submit pin for
future nearby-area hail-triangulation markers (not built yet) while
keeping the pin easy to locate.

Verified live via Playwright against a real dev server: default view
screenshot shows Austin/Round Rock/Georgetown/Killeen/Fort Hood/Waco/
San Antonio's northern edge all on-screen together; post-submit lookup
for **209 Sure Cast Drive, Burnet, TX 78611** (the real AFS shop address)
shows the pin with several surrounding streets, the local creek, and
nearby named landmarks in frame — not a tight single-block crop.
Screenshots written to an untracked scratch directory, deleted after the
run — not committed.

**Marked IMPLEMENTED, UNCONFIRMED per this file's VERIFICATION STANDARD**
— this is this session's own Playwright evidence, not Reid's independent
confirmation of how the two zoom levels read to a human eye.

**Commit:** `fix: HailView default map view corrected to real Central
Texas service area, post-submit zoom loosened for future triangulation
markers (afs-hv-008)`.

---

## ROLE-BASED LOGIN REDIRECT + CREDIT APPLICATION DISCOVERABILITY (afs-fl-038): IMPLEMENTED, UNCONFIRMED (2026-09-04)

Task brief claimed no role-based login redirect existed anywhere. Investigation
found that was already false for the *password* login path — `app/(auth)/
login/page.tsx` and `middleware.ts` already redirect admins to `/admin`
correctly, and this was confirmed live this session (see below), not just
by reading the code. The real, still-live gap was the **magic-link** path:
`app/auth/callback/route.ts` always redirected to `/account` regardless of
role. Fixed it to look up `profiles.role` and force `/admin` for admins,
mirroring the password-login pattern exactly.

Added a "Applying for net terms? Apply for a credit account" CTA linking
to `/account/credit-application` on both `app/(auth)/login/page.tsx` and
`app/(auth)/register/page.tsx` (existing footer-link style). The page
itself already requires login (and the `credit_applications` table's RLS
requires a real `auth.uid()`, so a truly anonymous submission was never
possible) — `middleware.ts`'s existing account-route gate already carries
a logged-out click through `/login?redirect=...` back to the form, so no
new redirect-preservation code was needed.

`pnpm tsc --noEmit`: 0 errors. Two real throwaway accounts (admin +
contractor role) were created directly via Supabase's admin API — the
public `/api/auth/register` route was tried first but hit Supabase's email
rate limit mid-session — and logged in through the real `/login` page in a
live Playwright browser: **admin → `/admin`, customer → `/account`**,
confirmed correct. Credit-application CTA confirmed visible and clickable
from a logged-out state on both `/register` and `/login`. Both test
accounts deleted afterward and confirmed removed from `auth.users` and
`profiles`.

**Still open:** the magic-link fix itself could not be click-tested with a
real received email (no test inbox in this environment; Supabase's
admin-generated link uses the implicit flow, not the PKCE `?code=` flow the
real client uses, so it doesn't exercise the new code path the same way).
Logic mirrors the already-verified password-login pattern and compiles
clean, but per this file's verification standard that's evidence, not
confirmation — left **IMPLEMENTED, UNCONFIRMED** for that one path.
Next session or Reid: click-test an actual magic-link sign-in as an admin
and confirm it lands on `/admin`.

---

## LOGO/HEADER FULL-WIDTH BACKGROUND CLEARANCE (afs-fl-037): IMPLEMENTED, UNCONFIRMED — HAILVIEW MAP BACKGROUND NOW CLEARS THE LOGO'S REAL 80PX HEIGHT (2026-09-04)

Root cause behind afs-fl-033's still-standing complaint: the logo
(`LOGO_HEIGHT=80`) is taller than the header bar (`h-14`=56px) it sits next
to, and both are `fixed` at `top:0`, so the logo's bottom 24px hangs below
the header. afs-fl-033 already fixed the header bar's own left offset
correctly — this is a separate defect, only visible where a genuinely
full-width fixed/absolute element spans underneath the logo's `x:0`–`200`
footprint.

Audited the whole codebase (grep for `top-14`/`pt-14`/`top-16`/`pt-16`/
`fixed`+`inset-0`/`inset-x-0`). Found exactly one real instance: HailView's
persistent map background, `app/hailview/page.tsx` (`fixed inset-x-0 top-14
bottom-0`), the one named in the task brief as confirmed. Fixed it to use
`style={{ top: LOGO_HEIGHT }}`, importing `LOGO_HEIGHT` newly-exported from
`components/layout/NavBar.tsx`, instead of a second hardcoded `80`.

Everything else the grep found was checked and left alone on purpose:
`AccountShell`/`AdminShell` are on portal routes that never render the
public logo at all; `AppChrome`'s own `pt-14` wrapper (used by almost every
public page), the products page, both architects pages, and the FlashDraft
studio page all use normal-flow padding/height, not `fixed`/`absolute`, so
they scroll clear of the logo instead of staying pinned under it —
`ResourcesBrowser`'s `sticky top-14` category headers are the same
reasoning (noted as a borderline case, not touched). One more `fixed
inset-0` full-viewport page was found —
`app/studio/profile-viewer/[profileId]/page.tsx`, a deliberate full-screen
share-link viewer at the same z-40 as the logo — but it paints *over* the
nav by DOM order, the opposite problem from this bug, and wasn't touched.

`pnpm tsc --noEmit`: 0 errors. Verified live with a real Playwright
screenshot against the dev server at `/hailview` — logo no longer overlaps
the map/panel. Per this file's verification standard above, that's evidence
for Reid, not a substitute for his own check — left as **IMPLEMENTED,
UNCONFIRMED** until he confirms it himself.

---

## LEGACY SITE PHOTOGRAPHY LIBRARY (afs-fl-036): DONE (2026-09-04)

Built `public/legacy-site-photos/` — a real, organized library of AFS's own
legitimate photography pulled from the live legacy WordPress site, for
reuse across the new platform, explicitly excluding both iStock photos
flagged in afs-fl-035 plus every other licensed stock photo found along
the way. Full detail in the matching `STATE_OF_THE_BUILD.md` entry; summary
here.

Crawled every remaining real page (`/about/`, `/products/`, `/materials/`,
`/equipment/`, `/suppliers/`, `/contact/`, all 7 `/product/*/` category
pages), then went further and pulled the legacy site's WordPress REST API
media library directly (`/wp-json/wp/v2/media`) — 91 items total, a
complete inventory independent of which pages happened to reference which
image. Every item was opened and classified by eye, not by filename.

**Important correction to this prompt's own starting premise:** the brief
described 13 homepage category images as "confirmed real, no stock-photo
naming pattern." Actually opening them showed only 3 are genuine —
`metal-roof-4.jpg` and `metal-roof3.jpg` are pixel-identical re-crops of
two stock photos also found in the media library (`tile-roofing-worker-...
-utc.jpg`, `green-tiles-roof-background-...-utc.jpg`), just re-uploaded
under an innocuous name with the stock-service `-utc` timestamp suffix
stripped off. The other 8 (`metal-walls.jpg`, `metal-walls-2.jpg`,
`customfab.jpg`, `customfab1.jpg`, `siding1.jpg`, `siding2.jpg`,
`door-and-window1.jpg`, `door-and-window2.jpg`) are studio-lit macro
product shots — one is literally an unrelated airport payphone bank —
stylistically identical to the confirmed stock photos and unlike every
genuine AFS photo in this library. All 10 were excluded despite matching
the prior "confirmed real" list; **filename pattern alone is not a
reliable signal on this site.**

New real photos found that weren't on the prior known list: 4 candid
job-site photos on the homepage (`2012-06-20-09.35.33.jpg`, `DSC00028.jpeg`,
`DSC01403.jpeg`, `DSC01549.jpeg`, three still under their default camera
filenames), surfaced via the WP media API and visually confirmed genuine.
No other new pages or images turned up beyond these 4.

**Result: 46 genuine photos downloaded** — 39 in `our-work-gallery/`
(the full `/our-work/` portfolio), 3 in `homepage-categories/`
(`flashing-1.jpg`, `flashing-2.jpg`, the Thalmann folder-machine equipment
photo `tz-long-folder.jpg`), 4 in `additional-project-photos/` (the newly
found homepage photos). `MANIFEST.md` documents every file's source URL,
source page, and a real look-at-it description, plus the full excluded-image
accounting (2 iStock source photos / 4 files, 3 more `-utc` stock photos,
the 10 stock homepage images above, 14 supplier logos, 2 manufacturer
equipment catalog photos, 4 AFS brand assets, 8 non-photo design/UI assets,
13 dead duplicate media records, 2 duplicate cache crops). **Neither iStock
URL was fetched at any point.** `pnpm tsc --noEmit`: 0 errors.

Not done this pass: wiring these 46 files into any page — this was a
library-building pass only. Also worth knowing: `public/home_page_images/
gallery/afs-1.jpg`–`afs-39.jpg` (from afs-fl-034) is a separate,
already-in-use copy of the same 39 our-work-gallery photos; this pass left
it untouched.

---

## ISTOCK LEGACY PHOTO AUDIT (afs-fl-035): CLEAN — NO REFERENCES FOUND (2026-09-04)

Root-cause search requested by Reid for two specific iStock-licensed photo
IDs (`1434931160`, `1354157446`) from the old WordPress site, never
confirmed cleared for this site. Four searches run in order, each against
real live state, not assumed:

1. Repo-wide grep (all file types) for `istock` case-insensitive and both
   IDs — **no matches found in the repo.**
2. `public/` recursive directory listing, every filename checked — **no
   matches found.**
3. Supabase Storage, both real buckets (`blueprints`, `documents`) on the
   actual live project (`lxfiziwsqezjjybeguqq`, from `.env.local`), walked
   recursively via the Storage REST API with the service-role key — **no
   matches found** among the 40 real objects present. The Supabase MCP
   connector in this session again only exposed unrelated projects
   (`tarritrix`, `tarritrix-audit`, `hail-intel-resurrected`); this check
   used direct REST calls against the real project instead, so the
   MCP-scope gap didn't block it this time.
4. Media-tracking tables (`order_attachments`, `gbp_photo_queue`,
   `takeoff_uploads`, `cad_library_files`, `vault_documents`) queried
   directly via PostgREST for the same terms across every filename/
   storage_key/caption/description column — **no matches found.**

**Full detail in the matching `STATE_OF_THE_BUILD.md` entry.** Nothing was
deleted — no real match existed to delete. No code changed, `pnpm tsc
--noEmit` re-confirmed at 0 errors. This doc and `STATE_OF_THE_BUILD.md`
were committed by explicit filename, not `git add -A` — the working tree
has unrelated untracked paths including one (`EMAIL PROSPECT LISTS/`) that
looks sensitive and was left alone.

---

## HOMEPAGE "DRAWING TO STEEL" HERO ACCENT, REAL PHOTO CATEGORY GRID, PROJECT GALLERY (afs-fl-034): IMPLEMENTED, UNCONFIRMED BY REID (2026-09-04)

Corrected re-scope of a task a prior prompt (afs-fl-032) halted on: that
prompt had wrongly assumed SPEC_HOMEPAGE.md's hero copy was already live
and referenced `AFS_WEBSITE_CONTENT_AUDIT.md`, a photo-category document
that turned out to exist only in a separate Claude.ai project-knowledge
store, not this repo — it correctly stopped rather than guess. This pass's
instructions were explicit that the live headline/copy and hero photo must
not change at all, and that any photo-category mapping had to come from
actually viewing the photos, not from the inaccessible prior document.
Both constraints were followed: `app/page.tsx`'s hero JSX (headline,
sub-copy, hero photo, rooftop-triangle image) is untouched other than one
new sibling element added after the triangle image.

Independently re-verified the photo URLs rather than trusting the prior
session's claim: ran real HTTP requests against all 40
`Architectural-Flashing-Supply-{N}.jpg` URLs — confirmed 1-39 = 200, 40 =
404, matching the prior claim but not assumed from it. Downloaded and
personally viewed all 39 images (none skipped), then grouped them by what
is actually depicted — there was no existing mapping anywhere in this repo
to start from. Photo #29 (a wood glulam trellis, no visible flashing/metal
work) didn't fit any category and was left out rather than forced in.
Copied all 39 into `public/home_page_images/gallery/` as local static
assets instead of hotlinking the WordPress host.

Built three new pieces: `components/home/HeroDrawingOverlay.tsx` (a thin
red/chrome SVG line-drawing accent over the hero photo's top-right corner,
in FlashDraft's own CANVAS_COLORS visual language, with a one-time CSS
draw-in animation and a static `prefers-reduced-motion` fallback matching
the `hailview-address-marker-ring` precedent), `PhotoCategoryGrid.tsx` (4
categories: roofing, wall/window flashing, gutters & roof accessories,
custom fabrication), and `ProjectGallery.tsx` (a curated, genuinely varied
8-photo spread). Category/gallery data and every photo's alt text live in
the new `lib/home/portfolio-photos.ts`. No customer-facing pricing added
anywhere (CRITICAL RULE #1) — both sections are browse-only.

`pnpm tsc --noEmit`: 0 errors. `pnpm build`: succeeded. Both run directly
this pass, not assumed.

Per this file's own verification standard, did not stop at the build/tsc
pass: started a fresh `pnpm dev`, confirmed via `curl` that the served HTML
still contains the unchanged headline text and the unchanged hero photo
path, then drove the real running app with `npx playwright screenshot` and
visually confirmed from the actual screenshots — headline and hero photo
pixel-identical to before, the new sketch accent rendering cleanly in the
hero's corner, "Fabrication Categories" rendering with 4 correctly
thumbnailed tiles, and "Project Gallery" rendering all 8 curated photos
with no broken-image icons. Screenshots and the throwaway Playwright script
were scratch verification artifacts (`.repro-afs-fl-034/`), deleted before
committing — nothing test-only was committed.

Committed as `feat: Drawing to Steel hero addition, real photo category
grid and project gallery -- current homepage copy unchanged (afs-fl-034)`
(`app/globals.css`, `app/page.tsx`, `components/home/`, `lib/home/`,
`public/home_page_images/gallery/` only — this repo currently has several
unrelated untracked paths at its root, including what appears to be a
prospect-email-list folder; `git add -A` was deliberately not used so
those wouldn't get swept into this commit).

**IMPLEMENTED, UNCONFIRMED, not DONE** — this pass's own screenshots are
evidence to bring to Reid, not a substitute for him loading the homepage
himself and confirming the hero is genuinely unchanged and both new
sections look right.

---

## NAVBAR HEADER/LOGO OVERLAP, ACCOUNT MENU SIGN OUT, HAILVIEW NAV LINK (afs-fl-033): RE-VERIFIED THIS PASS, NO CODE CHANGES NEEDED, STILL UNCONFIRMED BY REID (2026-09-04)

Same task re-issued this pass. Read the real `components/layout/NavBar.tsx`
directly first, per this pass's own instructions, instead of trusting the
task description's stale "currently" state or the previous session's
governance-doc entry (below). Found all three fixes already committed in
`f5178a8` — `git status --short` showed no diff on `NavBar.tsx`,
`STATE_OF_THE_BUILD.md`, or this file at the start of this pass. No code
was changed. `pnpm tsc --noEmit`: 0 errors, run directly.

Since this file's own verification standard treats a prior session's
"verified live" claim as evidence, not confirmation, this pass did not
reuse the prior run's result — it performed a fresh, independent live
verification: new `pnpm dev`, a new real throwaway Supabase Auth test user
via the admin REST API (`email_confirm: true`, deleted after), driven with
a scratch Playwright script (deleted after the run, nothing committed)
against the real running app.

Results, matching the prior session's: `LOGO_BOX {x:0,width:200,height:80}`
/ `HEADER_BOX {x:200,width:1240,height:56}` with zero overlap logged out and
logged in (screenshots confirm the header's background genuinely starts at
the logo's right edge); HailView link visible and clickable from the nav on
both `/` and `/products`, landing on `/hailview`; zero standalone top-level
Sign Out elements; "My Account" opens a dropdown containing "Account" and
"Sign Out" (screenshot confirms); clicking "Sign Out" redirected to
`/login` and a subsequent `/account` visit redirected to
`/login?redirect=%2Faccount`, confirming the session was actually
terminated, not just the UI changed.

No root-cause issues found. **Still IMPLEMENTED, UNCONFIRMED, not DONE**
— this is the second independent session to reach this same result via
Playwright; neither substitutes for Reid loading the site himself and
confirming the header/logo layout, the account-menu sign-out, and the
HailView nav link.

No new commit — the working tree had nothing to commit.

---

## HAILVIEW PERSISTENT FULL-BLEED MAP BACKGROUND (afs-hv-007): IMPLEMENTED, UNCONFIRMED — VERIFIED LIVE AGAINST A REAL AMARILLO, TX ADDRESS, NOT YET REID-CONFIRMED (2026-09-04)

`pnpm tsc --noEmit`: 0 errors. `pnpm run build`: succeeded, `○ /hailview`
5.4 kB.

Read `app/hailview/page.tsx` and `components/hailview/HailViewMap.tsx`
directly first, per this pass's own instructions — confirmed the map
(afs-hv-006) previously rendered only inside the results view, not before a
lookup. Restructured `app/hailview/page.tsx` so `HailViewMap` mounts once as
a persistent, full-bleed background (visible immediately on page load,
default-centered on the same Southwest-US service-area framing already used
by `DeliveryTrackingMap.tsx`), with the address/material form (and, after
submit, the results) as a single floating `420px` overlay panel docked
top-left, using `afs-bg-raised`/`afs-border` per the task. Positioned below
the fixed `NavBar` via `top-14`, matching the `pt-14` convention every other
non-portal page already uses, rather than the chrome-less pattern `/track`
uses. `components/hailview/HailViewMap.tsx`'s `address`/`lat`/`lon`/
`hailEvents` props are now optional — with none supplied it shows the
default view with no markers; the marker icons, pulse animation, popups,
and `FitToMarkers` bounds-fit logic are byte-for-byte unchanged from
afs-hv-006.

**Real bug found and root-caused this pass:** the overlay panel initially
rendered invisible — present in the DOM with correct geometry/background
(confirmed via `getComputedStyle`) but painted behind the map tiles. Cause:
Leaflet's `.leaflet-container` sets `position: relative` with no
`z-index`, so it never forms its own stacking context — its internal panes
(z-index up to 1000 for zoom controls) leaked past the map wrapper and
painted over the panel's `z-10`. Fixed with `isolate` (`isolation:
isolate`) on the map's wrapper `div` — the standard Leaflet/React
integration fix, not a z-index escalation.

Verified live via Playwright against **3701 W Interstate 40, Amarillo, TX**
(same real address, with real storm history, used in afs-hv-006's own
verification): map full-bleed and tile-loaded before any address entered
(`{x:0,y:56,w:1400,h:844}` at 1400×900 viewport, below the 56px nav); form
compact at `{x:16,y:254,w:420,h:275}`, not full-width; on submit, map
re-fit to Amarillo street level with exactly 1 address marker + 1 real
storm-event marker (matching this address's known real event count), score
31/100 rendered in the panel; pulse animation
(`getComputedStyle(ring).animationName === 'hailview-address-pulse'`) and
reduced-motion fallback (`animationName === 'none'`, `opacity: 0.35`) both
confirmed unchanged from afs-hv-006. Screenshots taken this pass were in a
gitignored scratch directory, deleted after the run — not committed.

**Marked IMPLEMENTED, UNCONFIRMED per this file's VERIFICATION STANDARD** —
this is this session's own Playwright evidence, not Reid's independent
confirmation of how the layout actually reads.

**Commit:** `feat: HailView persistent full-bleed map background with
overlay form panel (afs-hv-007)`.

---

## NAVBAR HEADER/LOGO OVERLAP, ACCOUNT MENU SIGN OUT, HAILVIEW NAV LINK (afs-fl-033): IMPLEMENTED, UNCONFIRMED — VERIFIED LIVE AGAINST A REAL TEST ACCOUNT, NOT YET REID-CONFIRMED (2026-09-04)

`pnpm tsc --noEmit`: 0 errors.

Three fixes to `components/layout/NavBar.tsx`, requested together this
pass. Read the real current file first per this pass's own instructions
(not assumed from the task description) and found all three already
present as **uncommitted working-tree changes** — not authored this pass.
This pass's actual work was: confirm the existing diff genuinely solved
each described problem, verify all three live against a running dev
server and a real test account, then commit.

**FIX 1 — header/logo overlap.** The task description's "currently"
state (logo `fixed` `z-50` over a full-width `fixed` header at `z-40`
using `paddingLeft: 210` to manually clear it) matches the last
*committed* version (see `git log -p -- components/layout/NavBar.tsx`,
commits `nav: double AFS logo size...` and `fix: compact top nav to
56px...`), not the working tree. The uncommitted diff already redesigned
it: the header is now `left: LOGO_WIDTH` (200px, a named constant, not a
magic number) instead of `left: 0` + `right: 0` + `paddingLeft: 210`;
both logo and header dropped to the same `z-40` (irrelevant now, since
they no longer occupy overlapping screen space at all). Confirmed live
via Playwright bounding boxes, both logged out and logged in:
`LOGO_BOX {x:0,width:200}`, `HEADER_BOX {x:200}` — the header's own
background genuinely starts at the logo's right edge, not hidden beneath
it.

**FIX 2 — Sign Out moved into account menu.** Already a `role="menu"`
dropdown under a "My Account" toggle button (`accountMenuOpen` state,
click-outside-to-close via a `mousedown` listener), containing an
"Account" link and a "Sign Out" `menuitem` button. `handleSignOut`'s body
(`supabase.auth.signOut()` then `window.location.href = '/login'`) is
byte-for-byte unchanged from the prior standalone-button version — only
its UI placement moved, confirmed by diff.

**FIX 3 — HailView added to nav.** `TOP_NAV_LINKS` gained `{ label:
'HailView', href: '/hailview' }`, placed second (right after Products) —
chosen because HailView, like Products, is a customer-facing lookup tool
used before any account/quote relationship exists, so it belongs with the
top-level discovery links rather than nearer Contact/FAQ.

**Live verification, run directly this pass, not assumed:**
- Started a fresh `pnpm dev`, confirmed reachable.
- Created a real, throwaway Supabase Auth test user via the admin REST
  API (`SUPABASE_SERVICE_ROLE_KEY`, `email_confirm: true`) — no
  `E2E_TEST_EMAIL`/`PASSWORD` exist in this repo per `tests/e2e/README.md`,
  and none were fabricated into a committed file. A scratch, uncommitted
  Playwright spec (deleted after the run) then, against the real dev
  server: loaded `/`, asserted the no-overlap bounding-box relationship
  logged out, clicked "HailView" in the nav and landed on `/hailview`,
  logged in with the real test account, re-asserted no-overlap while
  authenticated, opened the "My Account" menu, asserted no standalone
  top-level "Sign Out" link/button exists anywhere on the page, clicked
  the menu's "Sign Out" item, confirmed redirect to `/login`, then
  confirmed the session was actually gone (`/account` also redirected to
  `/login` rather than rendering). Screenshots captured at each stage
  (gitignored, not committed).
- The throwaway test user was deleted via the same admin API immediately
  after the run. The scratch spec file and screenshots were deleted; no
  test artifacts were committed.

**Commit:** `fix: NavBar header/logo overlap, Sign Out moved to account
menu, HailView added to navigation (afs-fl-033)`.

**Marked IMPLEMENTED, UNCONFIRMED, not DONE**, per this file's
verification standard above — this pass's own Playwright runs and
screenshots are evidence to bring to Reid, not a substitute for him
independently loading the site and confirming the header/logo layout,
the account-menu sign-out, and the HailView nav link himself.

---

## HAILVIEW MAP (afs-hv-006): IMPLEMENTED, UNCONFIRMED — LEAFLET/OSM MAP, PULSATING ADDRESS MARKER, REAL STORM EVENT MARKERS (2026-09-04)

`pnpm tsc --noEmit`: 0 errors. `pnpm run build`: exit 0, `/hailview` builds
clean.

Extends the already-complete 5-phase HailView build (Phases 1–5, all DONE)
with a map view that was outside SPEC_HAILVIEW.md Section 9's original
scope — requested directly this session, not derived from the spec.

Read the real, already-committed code first (`app/hailview/page.tsx`,
`app/api/hailview/storm-history/route.ts`, `lib/hailview/types.ts`,
`lib/hailview/geocode.ts`, `lib/hailview/storm-history.ts`) before writing
any map code, per this pass's own instructions — confirmed
`HailViewLookupResponse.lat`/`.lon` (real Nominatim geocode) and each
`StormEvent.lat`/`.lon` (real IEM LSR `geometry.coordinates`) were already
present on data the page already receives. No new fetch, no assumed field
names.

New `components/hailview/HailViewMap.tsx`: `leaflet`+`react-leaflet` v4
(v4, not v5 — this repo is on React 18, v5 needs React 19), real OSM tiles,
no Mapbox/Google key. Both marker types use `L.divIcon` (no default Leaflet
pin image asset, so the usual webpack-breaks-the-marker-icon problem never
comes up). Address marker: expanding/fading afs-crimson ring (CSS keyframe
`hailview-address-pulse` in `app/globals.css`) behind a solid afs-crimson
dot. Storm markers: flat, unanimated, sized/colored by real `sizeIn`
(afs-amber/afs-copper/afs-crimson-hover buckets) — deliberately distinct
from the address marker by motion and size, not just color. Bounds-fit via
`map.fitBounds()` for 2+ points or `map.setView(point, 13)` for a single
point, mirroring the same split `components/track/DeliveryTrackingMap.tsx`
already uses for exactly this problem — no hardcoded zoom. Reduced-motion:
a dedicated `@media (prefers-reduced-motion: reduce)` block sets
`animation: none` on the ring with a fixed opacity — a deliberate static
ring, not reliance on this file's pre-existing global
`animation-duration: 0.01ms !important` catch-all, which would just freeze
the ring on an arbitrary in-between animation frame instead of a clean
static state. `app/hailview/page.tsx` loads the map via
`next/dynamic(..., { ssr: false })` — Leaflet touches `window` at import
time and breaks under Next's SSR pass without that.

**Verification standard note applies below exactly as it does above:**
this session's own Playwright runs and screenshots are evidence brought to
Reid, not a substitute for him independently confirming the pulse, marker
placement, and reduced-motion fallback himself. Marked **IMPLEMENTED,
UNCONFIRMED**, not DONE.

What was actually run, live, this pass:
- Found port 3000 already held by an orphaned `node` process from a prior
  session (started 2026-09-03, serving stale pre-afs-hv-006 code — that's
  why the first `curl /hailview` came back a `/login` redirect that the
  current `middleware.ts` doesn't actually contain). Killed it, started a
  fresh `pnpm start` against the real current build before testing anything.
- `tests/e2e/hailview.spec.ts` gained 3 tests under "HailView — interactive
  map (afs-hv-006)". Two passed live against the real dev server: the
  address-marker test asserts a real `getComputedStyle(ring).animationName
  === 'hailview-address-pulse'` on the actual DOM element (not a
  screenshot-only check) and that total Leaflet marker count equals
  `1 + hailEvents.length` pulled from the real API response; the
  reduced-motion test asserts `animationName === 'none'` with `opacity > 0`
  under `page.emulateMedia({ reducedMotion: 'reduce' })`. The third test
  (click a storm marker, assert its popup) self-skipped for a real reason,
  not a bug: this spec's committed `TEST_ADDRESS` (1500 Marilla St, Dallas,
  TX) has zero real hail events in its 1mi/5yr IEM LSR window, confirmed via
  the live API response captured mid-test — nothing to click there.
- Because the committed address has no hail events, storm-marker plotting
  itself was verified separately with a throwaway (deleted after the run,
  not committed) spec against **3701 W Interstate 40, Amarillo, TX**, which
  does have one: a real 2023-12-23, 0.88in hail report 0.56mi away, at its
  own real lat/lon (35.18, -101.94). The marker rendered there; clicking it
  opened a popup reading `2023-12-23 — 0.88″ hail`, matching the Storm
  History Timeline list rendered from the same data below it on the page.
- Screenshots taken (gitignored under `/test-results/`, not committed —
  reproducible via the commands in the matching STATE_OF_THE_BUILD.md
  entry): `hailview-map-pulse.png`, `hailview-map-reduced-motion.png`,
  `hailview-map-real-storm-events.png`.

**Commit:** `feat: HailView interactive map with pulsating address marker
and real storm event locations (afs-hv-006)`.

**Next session should NOT re-mark this DONE from this entry alone** — it
needs Reid's own look at the rendered map (ideally at
`http://localhost:3000/hailview` with a real address that has storm
history, e.g. the Amarillo address above) before this becomes DONE in
either governance doc.

---

## HAILVIEW PHASE 4 (afs-hv-004): DONE — REAL AGENT NARRATIVE WIRED INTO THE UI, SCORE/TIER IMMUTABILITY VERIFIED (2026-09-04)

`pnpm tsc --noEmit`: 0 errors.

Root cause, found by reading the actual code rather than trusting the old
halted afs-hv-004 entry below (preserved further down, now stale): the
agentic explanation layer (`lib/hailview/explanation.ts`, a real
`anthropic.messages.create({ model: 'claude-sonnet-4-6' })` call via the
shared `lib/anthropic/client.ts`, the same convention `SPEC_AI_CHATBOT.md`'s
FlashChat integration uses) already existed and was already being called by
`app/api/hailview/storm-history/route.ts`, which already returned a real
`narrative` field. Phase 3 built the page but *deliberately chose not to
read that field*, rendering a local deterministic
`buildPlaceholderExplanation()` template instead with a visible "Phase 4
pending" badge — exactly as Phase 3's own header comment said it would,
reserving the real wiring for this prompt. So this pass was narrower than
"build the agent layer": it was (1) wire the page to `result.narrative`, (2)
give it a real fallback instead of silently rendering blank text if the
agent call fails, and (3) close two real gaps against Section 6's input
contract found by reading `ExplanationInput` directly — it had no
`roofAgeYears` or material sub-detail fields (shingle type / gauge / mil),
despite the spec listing roof age and material sub-details as required
agent inputs.

What changed: `lib/hailview/explanation.ts` gained `roofAgeYears`/
`shingleType`/`metalGauge`/`membraneMilThickness` on `ExplanationInput`,
surfaced in the prompt; `app/api/hailview/storm-history/route.ts` passes them
through; `app/hailview/page.tsx` now renders `result.narrative ||
buildFallbackExplanation(result)` (the old placeholder function, renamed and
repurposed as the graceful-degrade path — the route's own try/catch already
sets `narrative = ''` on any agent failure, so this is where "never show
nothing" actually lands), with the badge now conditional on the fallback
actually being in use. `tests/e2e/hailview.spec.ts` updated — it previously
hard-asserted the placeholder label was always visible, which is no longer
true now that the real narrative is the default path.

Type-system enforcement (Section 6's non-negotiable rule) verified by
reading the integration code back: `generateHailViewExplanation` returns a
bare `Promise<string>` — no numeric field anywhere on it. In the route,
`score`/`tier` are assigned from `computeReplacementScore()` before the
agent is even called; `narrative` is a separate field never read back into
either.

Live-verified against a real dev server (port 3001 — 3000 was already in
use) with the real Anthropic key configured locally: two real
`POST /api/hailview/storm-history` calls (asphalt shingle/architectural/16yr
→ score 25/Low; metal standing seam/24ga/20yr → score 15/Low) each returned
a real multi-paragraph narrative correctly citing that exact score, tier,
age, and material sub-detail. First live pass caught the model defaulting to
Markdown (`##` headers, `**bold**`) that rendered as literal characters in
the page's plain-text `<p>` tag — fixed by adding an explicit
no-Markdown instruction to the system prompt, re-verified clean on the
second call. `pnpm exec playwright test tests/e2e/hailview.spec.ts` against
that same dev server: 4/4 material-type tests pass. Screenshot
(`test-results/hailview-asphalt-shingle.png`, gitignored) visually confirms
clean prose, no placeholder badge, no blank panel. Per this file's own
working-style note above: this is the session's own testing, evidence to
bring to Reid, not a substitute for his own confirmation of the live page.

Still open, unchanged by this pass: Open-Meteo commercial licensing
(Section 4.3) — `OPEN_METEO_API_KEY` not configured here, so both live test
calls above correctly reported wind data as unavailable rather than
fabricating it. Phase 5 (email capture UI, afs-hv-005) still not built.

Committed as `afs-hv-004`: `feat: HailView Phase 4 -- agentic explanation
synthesis, score/tier immutability enforced in the type system (afs-hv-004)`.

**Original halted entry preserved for history further below — its finding
(Phase 2/3 didn't exist yet) is now stale; both were rebuilt for real before
this pass started.**

---

## HAILVIEW PHASE 3 (afs-hv-003): DONE — REAL UI WIRED TO PHASE 1+2, PLACEHOLDER EXPLANATION (2026-09-04)

Built `app/hailview/page.tsx` against the real, already-committed Phase 1
(`lib/hailview/geocode.ts`/`storm-history.ts`/`wind.ts`) and Phase 2
(`lib/hailview/replacement-score.ts`, the real afs-hv-002 Section 5 engine)
code — exact exported signatures confirmed by reading those files directly,
not assumed. Read `SPEC_HAILVIEW.md` Sections 3 and 7 first, per the
prompt's own Step 0. `pnpm tsc --noEmit`: 0 errors. `pnpm run build`:
succeeded, `○ /hailview` listed in the route summary.

Continues the same test-pipeline discrepancy every HailView entry since
afs-hv-002 has documented: `app/api/hailview/test-pipeline/route.ts` still
doesn't exist, so the page calls the real Phase 1 endpoint,
`app/api/hailview/storm-history/route.ts`, directly — building a
differently-named wrapper route to match the spec's original naming would
be a workaround, not a fix. Flow: address input, a 4-option material-type
selector (Asphalt Shingle / Metal / TPO-PVC / Wood Shake), conditional
sub-inputs (metal gets its own Panel Type selector plus a scoped gauge
dropdown, since the API's `MaterialCategory` has no generic `'metal'`
value; TPO/PVC gets a mil dropdown; all four get a roof-age input), then a
results view (score, tier, a real storm-history timeline from the response's
actual `hailEvents`). Design tokens only (`afs-crimson`/`afs-chrome-*`/
`afs-bg-*`/`.metal-edge`) — no e4roofing assets.

The explanation section is a deliberate, UI-visible-labeled placeholder:
`buildPlaceholderExplanation()` builds a plain deterministic template
string from the real `score`/`tier`/`factors` — the page intentionally does
**not** read the API response's `narrative` field (the Phase 4 agent
explanation was wired ahead of schedule back in afs-hv-001), reserving that
for afs-hv-004. A `TEMPORARY PLACEHOLDER — PHASE 4 PENDING` badge renders
next to it live, not just in a code comment.

Live-verified with a real dev server and a new Playwright spec
(`tests/e2e/hailview.spec.ts`, committed) against a real address (Dallas
City Hall) for all four material types: each produced a real, in-range
score with the address, materials, and 0-hail/8-non-hail storm counts
genuinely coming from the live Nominatim/IEM APIs — not fabricated. Two
screenshots captured confirm asphalt shingle (25/Low) and metal R-panel
(10/Low) score differently for the identical address/age, matching the
determinism afs-hv-002's unit tests already proved. Per this file's own
working-style note above: this is a session's self-reported Playwright/
screenshot verification, not the user's own confirmation of the live page —
still worth bringing to Reid before calling the visual result itself
"confirmed." Full detail in `STATE_OF_THE_BUILD.md`'s matching entry.
Committed as `afs-hv-003` (page + spec, two commits).

**Original halted entry preserved for history further below — root cause is
now resolved (`SPEC_HAILVIEW.md` exists, and Phase 2's real scoring engine
now exists to build against).**

---

## HAILVIEW PHASE 2 (afs-hv-002): DONE — REAL SECTION 5 FORMULAS IMPLEMENTED (2026-09-04)

Re-run of afs-hv-002 now that `SPEC_HAILVIEW.md` exists in the repo (added
during afs-hv-004, see that entry below). Step 0 re-confirmed the same
finding the halted passes below already documented: `app/api/hailview/
test-pipeline/route.ts` still does not exist — it was never built in Phase
1. The real Phase 1 endpoint is `app/api/hailview/storm-history/route.ts`,
and its callees (`geocode.ts`, `storm-history.ts`, `wind.ts`) were read
directly to confirm real data shapes before writing any scoring code. Two
data-shape discrepancies vs. the spec's predictions were found and are
documented in `STATE_OF_THE_BUILD.md`'s matching entry: a missing
`countrycodes=us` Nominatim param, and Open-Meteo using different field
names/a different (already-resolved, paid) endpoint than the spec guessed.
Neither affects `replacement-score.ts`'s inputs, so neither was changed.

`lib/hailview/replacement-score.ts` was rewritten in full against Section 5,
replacing afs-hv-001's self-admitted guessed placeholder: real asphalt
shingle formula (3-tab/architectural subtype, +8 bonus, banded age
multiplier with lifespan-ratio bonus, escalating frequency weight), a
genuinely distinct metal formula (flat 1.5" onset, separately-derived
additive age term, no multiplier), a genuinely distinct TPO/PVC formula
(effective-onset shift from thickness + age), and a genuinely distinct wood
shake formula (real Haag Engineering graduated tier table). `pnpm tsc
--noEmit` passes (0 errors), `pnpm run build` succeeds, and 22 new unit
tests (`lib/hailview/replacement-score.test.ts`, via newly-added `vitest` —
no unit test runner existed in the repo before this pass) prove the four
materials score distinctly and tier correctly against identical storm
history, not just that the functions run without throwing. Full detail,
including the two interpretive numeric choices the spec's prose didn't
fully pin down (documented rather than silently guessed), is in
`STATE_OF_THE_BUILD.md`'s matching entry. Committed as `afs-hv-002`.

**Original halted entry below, preserved for history:**

---

## HAILVIEW PHASE 2 (afs-hv-002) — ORIGINAL ENTRY, SUPERSEDED ABOVE: HALTED AT STEP 0, NO CODE WRITTEN (2026-09-03)

afs-hv-002 requires reading `app/api/hailview/test-pipeline/route.ts` (Phase
1's real committed output) and `SPEC_HAILVIEW.md` Section 5 before writing
any scoring code. Neither exists. `git show --stat ecc3f3a` (the afs-hv-001
commit) shows Phase 1 committed `storm-history/route.ts`,
`email-report/route.ts`, `replacement-score.ts`, and `explanation.ts`
instead of the scoped `test-pipeline/route.ts`, and never created
`SPEC_HAILVIEW.md` — despite its own prompt saying to halt and ask Reid if
that file was missing. `replacement-score.ts`'s own header comment admits
its constants are a guessed placeholder, not Reid's real e4roofing formula.
Full findings in `STATE_OF_THE_BUILD.md`'s matching HailView entry. Halted
and reported to Reid rather than guessing at formula constants and writing
code against a spec section that doesn't exist. Needs either the real
`SPEC_HAILVIEW.md`/formula constants, or explicit direction on how to treat
the existing placeholder scoring code, before afs-hv-002 can proceed.

---

## HAILVIEW PHASE 3 (afs-hv-003) — ORIGINAL ENTRY, SUPERSEDED ABOVE: HALTED, SAME ROOT CAUSE AS afs-hv-002, NO CODE WRITTEN (2026-09-03)

afs-hv-003 requires reading `SPEC_HAILVIEW.md` Sections 3 and 7, and reading
committed "Phase 1 and Phase 2" code, before writing the results-view UI.
Re-checked directly this pass: `SPEC_HAILVIEW.md` still does not exist
anywhere in the repo (working tree or history), and afs-hv-002 never ran —
it halted at its own Step 0 with no code written, so there is no Phase-2
scoring code, only Phase 1's out-of-scope `lib/hailview/replacement-score.ts`,
whose own header comment still admits its constants are a guessed
reconstruction, not Reid's real e4roofing formula. Full findings in
`STATE_OF_THE_BUILD.md`'s matching entry. Did not write `app/hailview/page.tsx`
or fabricate spec content — doing so would mean shipping a results screen
that labels a self-admitted guessed score as "the real score" to whoever
tests it, compounding the exact deviation afs-hv-002 already flagged. Same
unblock as afs-hv-002: either the real `SPEC_HAILVIEW.md`/formula constants,
or explicit product-decision direction to proceed with the existing
placeholder engine as provisional-but-final (and how the UI should represent
that provisionality to whoever uses it).

---

## HAILVIEW PHASE 4 (afs-hv-004) — ORIGINAL ENTRY, SUPERSEDED ABOVE: HALTED, SPEC NOW LOCATED AND ADDED, BUT PHASE 2/3 STILL DON'T MATCH IT (2026-09-03)

Also flagging: this prompt's text matches `afs-hv-004` in
`FORGE/projects/afs-website/queue.yaml` verbatim but ran directly in Claude
Code, not via `forge.ps1` — contrary to `CLAUDE.md`'s FORGE launch policy.

`SPEC_HAILVIEW.md` still didn't exist in the repo, but this pass found it
outside the repo at
`C:\Users\manag\Downloads\Recent Downloads\SPEC_HAILVIEW.md` and copied it
into the repo root, so it's now available for real. Read Section 6 in
full: agent never decides/computes/alters the score or tier, enforced in
the type system, not just convention. `lib/hailview/explanation.ts`
(already committed, out-of-scope Phase-1 work) genuinely satisfies this —
it calls `claude-sonnet-4-6` through the same `lib/anthropic/client.ts`
pattern the chatbot and material-recommendation routes use, and its return
type is a bare `string` with no numeric field anywhere a score could be
wired back through; verified by reading `app/api/hailview/storm-history/route.ts` lines 129-144, where `response.score` comes only from
`computeReplacementScore()` and is never touched by `narrative`.

But Phase 4 still can't honestly proceed: checked `replacement-score.ts`
against the real Section 5 now available, and it diverges materially —
missing the 3-tab shingle subtype/+8 bonus, missing age modifiers for
metal/TPO-PVC/wood-shake entirely (spec requires all three), and a
different largest-event/cumulative/frequency formula shape than Section
5.1 describes. Section 4.3's Open-Meteo commercial-licensing question is
also still unverified. And `app/hailview/page.tsx` (Phase 3) still doesn't
exist, so there's no placeholder to replace and nowhere to wire the real
explanation in. Full detail in `STATE_OF_THE_BUILD.md`'s matching entry.
No Phase 4 code written this pass. Needs `afs-hv-002` and `afs-hv-003`
re-run for real against the now-present spec before afs-hv-004 can
meaningfully run.

---

## HAILVIEW PHASE 5 (afs-hv-005): DONE — EMAIL-MY-RESULTS FORM ADDED TO THE REAL RESULTS PAGE, ALL 5 HAILVIEW PHASES COMPLETE (2026-09-04)

The prior halted entry below (2026-09-03) was correct at the time: the
results page didn't exist. It does now — `afs-hv-003`/`afs-hv-004` built and
wired it for real since (see this file's matching entries and
`STATE_OF_THE_BUILD.md`). This pass re-confirmed that directly (`git log`,
direct file read) before adding anything, then added a small "Email Me This
Result" form to `app/hailview/page.tsx` that posts the already-rendered
lookup result (address/material/score/tier/narrative — the user's own data,
nothing else) to the pre-existing `app/api/hailview/email-report/route.ts`.
That route was committed out-of-scope back in Phase 1 (`ecc3f3a`) and, on
inspection, already correctly implements Section 8's contract — no route
changes were needed, only the UI to actually call it.

**Verification requirement answered directly:** Resend is confirmed **not
configured** in this environment — `grep -i RESEND .env.local` returns no
match, and `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are unset in the process
environment (checked directly this pass). Real observed behavior: `curl
POST /api/hailview/email-report` with a real result body returned
`{"sent":false,"reason":"not_configured","message":"Email delivery isn't
live yet — you can screenshot or print this page to save your
results."}` — the real graceful-degradation path, not a fabricated "sent"
claim. A live Playwright test (`tests/e2e/hailview.spec.ts`, new
`email-my-result form degrades gracefully...` case) drove a real browser
through the real address→score pipeline and confirmed that same message
renders in the UI. `pnpm tsc --noEmit` (0 errors) and `pnpm run build`
(succeeded) both pass.

Committed as `afs-hv-005`: `feat: HailView Phase 5 -- consent-based
email-my-results capture, graceful Resend degradation (afs-hv-005)`.

**This completes all 5 HailView phases** per `SPEC_HAILVIEW.md` Section 9.
Still open: the Open-Meteo licensing question (unchanged, see afs-hv-004
entry) and a real Resend send, which cannot be exercised until a real
`RESEND_API_KEY`/`RESEND_FROM_EMAIL` is configured in this environment —
the code path for it already exists and needs no changes when that happens.

---

## HAILVIEW PHASE 5 (afs-hv-005) — ORIGINAL HALTED ENTRY, SUPERSEDED ABOVE: HALTED, SAME ROOT CAUSE, NO CODE WRITTEN (2026-09-03)

afs-hv-005 asks for a consent-based email-capture form "on the HailView
results page." Re-verified this pass: `app/hailview/page.tsx` still does
not exist — Phase 3 never got built, so there is no results page for a
form to attach to, and `lib/hailview/replacement-score.ts` still doesn't
match the real Section 5 formulas. A form has no independent existence
apart from the results page it's specified to live on, so building one
disconnected (or against a fabricated stand-in page) would fabricate scope
the same way afs-hv-001 did, which this project's last three HailView
passes each halted to avoid. Full findings in `STATE_OF_THE_BUILD.md`'s
matching entry.

**Verification requirement answered directly:** Resend is confirmed **not
configured** in this environment — `.env.local` has no `RESEND_API_KEY` or
`RESEND_FROM_EMAIL` entry (checked via direct grep this pass), matching
the known Phase 4 credential blocker in `CLAUDE.md`. No real email was
sent and none could be — there is no page to trigger a send from. The
backend already handles this correctly with no changes needed:
`app/api/hailview/email-report/route.ts` (committed out-of-scope in
`ecc3f3a`) already calls `lib/resend/send.ts`'s `sendEmail()`, which
returns a soft `{ success: false, error: 'Resend is not configured.' }`
given the current env, and the route turns that into `{ sent: false,
reason: 'not_configured', message: "Email delivery isn't live yet — you
can screenshot or print this page to save your results." }` rather than
throwing — the graceful-degradation behavior Section 8 asks for already
exists and was exercised by direct route-code read, just with no page yet
to reach it from.

No code written, no commit made. Needs `afs-hv-002` and `afs-hv-003`
re-run for real, then `afs-hv-004`, before `afs-hv-005` can attach a form
to an actual results page.

---

## ADMIN NAV RESTRUCTURING: afs-fl-031 -- SHOP VIEW PROMOTED, QUICKBOOKS/EMPLOYEE FOLDED, GBP RELOCATED, INVOICES FOLDED INTO ORDERS (2026-09-03)

Root-cause-only follow-up to afs-fl-030's audit (treated as settled facts,
not re-verified). Two files restructured: `components/layout/AdminShell.tsx`
and `app/admin/command-center/page.tsx`, plus one new file,
`app/admin/gbp-photos/page.tsx`, and one component change,
`components/admin/OrdersCrmTab.tsx`. `pnpm tsc --noEmit` — 0 errors, `pnpm
build` — succeeds. Full detail in STATE_OF_THE_BUILD.md's afs-fl-031 entry;
summary:

1. **Left nav** — emoji stripped from all remaining labels; Deliveries/GBP
   Photos/Bids removed (were pure Command Center `?tab=` deep-links);
   Shop View promoted to a top-level Operations item; Employee App folded
   into Operations; QuickBooks folded into Settings. Final: **13 items / 3
   sections** (Operations 7, Business 4, Settings 2). Profile Library
   deliberately NOT added, per Reid's standing instruction.
2. **Judgment call, flagged for Reid:** Settings section now holds
   "General" (was "Settings," renamed only to avoid "Settings > Settings"
   reading redundantly — still points at `/admin/settings`) and
   "QuickBooks."
3. **GBP review relocated, not deleted.** Moved off Command Center's tab
   bar entirely to a new standalone route, `/admin/gbp-photos`, reusing
   `GbpPhotosTab.tsx` and the existing approve/reject API routes unchanged.
   **Judgment call, flagged for Reid:** reachable via Command Center
   dashboard's existing "GBP Photo Queue" stat card (href repointed from
   `?tab=gbp`), not a new tab or nav item. Verified end-to-end against the
   real Supabase project with two seeded test photos (deleted after): both
   Approve and Reject hit the real API routes, persisted to the database,
   and rendered the correct status on a fresh reload.
4. **Invoices folded into Orders, not deleted.** `OrdersCrmTab.tsx` gained
   a real Orders/Invoices toggle that mounts the actual, unchanged
   `InvoicesCrmTab` component with real data — not a stub. Verified live:
   the real Total Outstanding/Overdue/Paid summary and invoice table
   render inside the Orders tab.
5. **Shop View/Profile Library visibility bug fixed** — both links now
   render in the same position across every `?tab=...` view, not just the
   bare dashboard. Verified live across 5 different views.
6. **Pre-existing bug found, NOT fixed (out of this task's scope):**
   `/admin/consultations` 404s — no page exists at that route. Confirmed
   via `git log` this predates this session, not a regression.

Verified live with a real admin session (Playwright driving a genuine
Supabase magic-link login for the existing `role='admin'` account) against
the real dev server — every remaining/moved nav link resolves, both tab
bars render consistently, and the GBP approve/reject flow was exercised
against real database rows, not mocked. Marked **IMPLEMENTED, UNCONFIRMED**
in STATE_OF_THE_BUILD.md per this project's verification standard — this
session's own Playwright evidence is not a substitute for Reid
independently checking the actual behavior.

---

## SUBMIT CONFIRMATION 3D MODAL: afs-fl-029 -- CANVAS MAXIMIZED, HEADER COLOR, BACKGROUND LIGHTENED AGAIN (2026-09-01)

Root-cause-only follow-up to afs-fl-028, four related reports in
`SubmitConfirmation3DModal.tsx`. Diagnosed each live with a temporary
Playwright script (deleted after use, not committed), comparing pre-fix and
post-fix code directly via `git stash` rather than trusting a single
before/after impression. `pnpm tsc --noEmit` — 0 errors. Full detail in
STATE_OF_THE_BUILD.md's afs-fl-029 entry; summary:

1. **Canvas maximized** — replaced the `max-w-2xl` modal (hardcoded
   600x500 canvas + bottom button row) with a near-fullscreen modal: canvas
   as a `flex-1` region, controls moved to a `w-80` side rail (stacks below
   the canvas on mobile). Measured: canvas area went from 600x500px (35% of
   a 1366x768 viewport) to 1012x734px (96%).
2. **Cropped/uncentered profile — confirmed a SYMPTOM of #1, not a new
   fit-math bug.** Fixed #1 first, then re-checked live per the task's
   instruction before touching camera code. Direct DOM measurement found
   the real cause: the old canvas container's inline `height: 500` could
   flex-shrink (down to 356px measured at a 1366x600 viewport), but
   `ProfileViewer3D`'s own wrapper carries a separate `minHeight: 500`
   (needed as a fallback for its other, non-modal call sites) that kept
   forcing the actual `<canvas>` to render at a full 500px regardless —
   `overflow-hidden` on the shrunk parent then clipped the bottom 144px.
   `computeFitCamera` (afs-fl-026) was centering correctly against the full
   500px canvas it was told about; the crop was pure CSS clipping, not a
   fit-math edge case. Re-verified live on the task's own profile (4 9/16"
   / 2 1/2" legs, 124° bend) at viewport heights from 768px down to an
   extreme 480px — fully visible, centered, not cropped. No new camera-fit
   code was written.
3. **Header color** — the value was already correct (`#C0001A`, byte-
   identical to the Submit button, before AND after). The dimness was the
   known small-text-antialiasing legibility issue `app/globals.css`
   already documents and has a standing fix for (`.eyebrow-label`, used at
   9 other call sites: adds font-weight 600 + a crimson text-shadow glow,
   doesn't touch the base color). Swapped the header onto that existing
   class instead of inventing a new shade. Confirmed visually: bold vivid
   red now, versus a faint smear before.
4. **Background lightened again** — dome `#565656`→`#787878`, clear color
   `#6A6A6A`→`#8A8A8A` (second pass on afs-fl-026's own first pass).
   Verified against Matte Black (Kynar 500, `#1E2028`) — stayed clearly
   dark at every angle, no need to back off. Also checked Stainless Steel;
   its near-black/near-white swing by camera angle is a pre-existing
   metalness/no-envMap rendering characteristic, confirmed unrelated to
   this background change and out of this task's scope.

Marked **IMPLEMENTED, UNCONFIRMED** in STATE_OF_THE_BUILD.md per this
project's verification standard — this session's own Playwright evidence
is not a substitute for the user independently checking the actual
behavior.

---

## SUBMIT CONFIRMATION 3D MODAL: afs-fl-028 -- CLIPPED HEADER, BACK NAV, BROWSER BACK BUTTON (2026-09-01)

Root-cause-only task, three related reports in
`SubmitConfirmation3DModal.tsx` (opens from "Submit for Quote" on
`/studio/draft`). Diagnosed each live with a temporary Playwright script
(deleted after use, not committed) against both the dev server and the
production build, not assumed from code reading. `pnpm tsc --noEmit` — 0
errors. `pnpm run build` — succeeds. Full detail in
STATE_OF_THE_BUILD.md's afs-fl-028 entry; summary:

1. **Clipped header** — real bug, but not the z-index/afs-fl-026/027
   interaction the task asked me to check first: it was the modal's own
   box (~684px of fixed content, including a hardcoded 500px 3D canvas)
   having no `max-height`/scroll handling, so any viewport under ~730px
   tall clipped both the header and the buttons off-screen with no way to
   scroll to them. Confirmed the chat trigger and FlashDraft toolbar don't
   actually intersect this. Fixed with `max-h-[90vh] overflow-y-auto` on
   the modal box.
2. **"Go back and edit"** — confirmed live it already existed and worked;
   it was just unreachable on short viewports because of bug #1. Fixing #1
   restored it. Did not add a second back control — checked first per the
   task's instruction, and no real gap remained.
3. **Browser back button** — was exiting to whatever page preceded
   `/studio/draft` because the modal was conditionally mounted and never
   pushed history state. Reused ColorPickerModal.tsx's/VariantPicker.tsx's
   already-proven always-mounted, `isOpen`-gated history push/popstate
   pattern (no new logic), including the specific shape that avoids the
   React Strict Mode double-invoke race VariantPicker's own doc comment
   describes. Verified live with `page.goBack()`: returns to
   `/studio/draft` itself with the modal closed and the same drawn profile
   still on the FlashDraft 2D canvas underneath (not a fresh page, not the
   `/studio` hub).

Marked **IMPLEMENTED, UNCONFIRMED** in STATE_OF_THE_BUILD.md per this
project's verification standard — this session's own Playwright evidence
(dev + prod builds) is not a substitute for the user independently checking
the actual behavior.

---

## CHAT WIDGET RESIZE: afs-fl-027 -- 192px -> 115px, FLASHDRAFT MOBILE OVERLAP IMPROVED, NOT RESOLVED (2026-09-01)

Root-cause-only task, one change: `components/ai/ChatWidget.tsx`'s
collapsed trigger `width`/`height` reduced from 192px (afs-fl-026's 3x) to
115px (1.8x the original 64px — Reid's exact target, a 40% cut off the
192px size). `pnpm tsc --noEmit` — 0 errors.

Verified live with a temporary Playwright script (deleted, not committed),
same method as afs-fl-026's own passes — real bounding-box measurements on
homepage and FlashDraft, desktop (1440x900) and mobile (375x812):

- Trigger measures 115x115 everywhere, confirming the resize applied
  correctly site-wide (both pages, both viewports).
- Homepage and FlashDraft desktop: clean, no overlap, both before and after.
- **FlashDraft mobile 375px — the overlap afs-fl-026's second and third
  passes both flagged and left open: improved but not resolved.** Save
  Draft now fully clears the trigger (was covered at 192px). Clear has a
  ~1px sliver overlap (negligible). **Load is still substantially
  overlapped — its full height and nearly its full width sit under the
  trigger.** Screenshot confirms the hard-hat icon visually covers the Load
  button.

Root cause is unchanged from afs-fl-026's finding: the trigger is
fixed-position and independent of the sidebar footer's on-screen position,
so shrinking it only reduces its footprint — it doesn't address why the two
collide. Reporting this plainly rather than as resolved, matching how the
prior two sessions handled the same finding. Real fix still needs one of
the two options afs-fl-026 already identified: a FlashDraft-specific
accommodation for the shared trigger, or a deliberate mobile redesign of
the sidebar footer. Not attempted here per this task's explicit "no
workarounds" scope.

---

## FLASHDRAFT UI POLISH: afs-fl-026 -- THIRD PASS, MOBILE CANVAS BUG FIXED, CHAT OVERLAP STILL OPEN (2026-08-28)

Same task prompt as the two entries below, run a third time. Checked git
log first: all six items were already committed (`2e553b5`) and
independently re-verified live by a second session (`683ed58`) before this
one started, so nothing about those six was redone — re-verifying identical,
unchanged code a third time would have been waste, not rigor. This session's
actual work was narrower: investigate and root-cause the one item the
second pass left flagged (chat trigger overlapping the mobile sidebar
footer), per this task's own "root cause only, no workarounds" framing.

**Found a real, separate, previously-undocumented bug while investigating**
— live Playwright measurement (temporary script, deleted, not committed)
showed FlashDraft's canvas rendering at just 76px tall on a 375px-wide
viewport, because the sidebar (stacked full-width above it on mobile) took
its whole natural ~525px height inside a fixed, non-scrolling
`h-[calc(100vh-56px)] overflow-hidden` shell, leaving almost nothing for the
canvas — unusable for drawing, independent of the chat widget entirely.
Fixed in `app/studio/draft/page.tsx`: below `lg` only, `main` changed from a
hard height + `overflow-hidden` to `min-h-[calc(100vh-56px)]` +
`overflow-visible` (page scrolls normally now, like every other page on the
site), and the canvas panel got `min-h-[400px] lg:min-h-0`. Desktop (`lg+`)
classes are byte-for-byte unchanged and re-confirmed live (sidebar
`scrollHeight === clientHeight`, toolbar still right-aligned, 3D button
still permanently red with the ring indicator). `pnpm tsc --noEmit` — 0
errors.

**Did not fix the chat-trigger overlap itself — tried one approach, it made
things worse, reverted it, documented why instead of shipping a partial
fix silently.** The sidebar's footer row (Save Draft/Clear/Load, Submit)
still overlaps the trigger's fixed footprint at the default scroll
position, unchanged from the second pass's finding — the canvas-height fix
above doesn't touch the sidebar's own size or position. Tried reordering
canvas above sidebar on mobile via CSS `order`: this DID clear the footer
row, but pushed the Material/Gauge selects (rendered first once reordered)
into the identical collision instead — worse, since those are needed
immediately, not just at save/clear time. Reverted that reorder. Also
considered reordering fields within the sidebar so the footer isn't last,
but that would contradict the exact field order specified in this task
(Material, Gauge, Length, Quantity, Notes, paint-face toggle, Submit —
Submit last) — rejected without trying. Conclusion: the sidebar's own
content (~525px, full width) is taller than the trigger's 192px band, so
some part of it collides with the trigger's fixed screen position wherever
it's placed in the document — no in-page rearrangement clears it without
relocating the same problem onto different (often more critical) controls.
Left unresolved, flagged for Reid same as the second pass, now with
concrete before/after evidence that a layout-only fix isn't sufficient —
see STATE_OF_THE_BUILD.md for the full writeup and the two real remaining
options (a page-specific ChatWidget accommodation, or an intentional mobile
sidebar redesign).

No other code touched this session — the other five items and their
verification stand exactly as the second pass (below) documented them.

---

## FLASHDRAFT UI POLISH: afs-fl-026 -- IMPLEMENTED, UNCONFIRMED (2026-08-28)

Six scoped UI/UX changes: 3D auto-fit camera, lighter 3D background, chat
widget 3x size (site-wide, per Reid's explicit confirmation — not
FlashDraft-scoped), toolbar moved right, compact sidebar (Rush Order
removed), and a permanently-red 3D toggle button with a ring-based active
indicator. `pnpm tsc --noEmit` — 0 errors.

**Root-cause bug found and fixed mid-session (not just symptom-patched):**
the auto-fit camera's first implementation used a `useRef` boolean to apply
the fit only once per mount. Live Playwright testing showed the profile
rendering just as zoomed-in as the original bug — tracked it down to React
18 StrictMode's dev-only mount->cleanup->remount cycle: the ref survives
across that phantom remount (same component instance), but the actual
`THREE.PerspectiveCamera` object is recreated fresh each time (it's `const
camera = new THREE.PerspectiveCamera(...)` inside the effect body). The
flag was getting set to `true` on the *first, phantom* camera and never
reset for the *second, real* one, so the real camera silently kept its
hardcoded starting position. Fixed by resetting the ref to `false` every
time a fresh camera is constructed (inside the same effect that creates
it), not just relying on mount-once semantics.

**Downstream check Reid explicitly asked for, and what it found:** removing
the Rush Order toggle removes the *only* place `isRush` could be set to
`true` on a FlashDraft-submitted quote request. Checked what reads that
column before removing the control — it's not just
`CommandCenterJobCard.tsx`'s RUSH badge: `lib/data/
pending-quote-requests.ts`, `lib/data/admin.ts`, and `lib/data/
machine-jobs.ts` all `.order('is_rush', {ascending:false})`, meaning
FlashDraft-submitted requests can no longer sort to the top of any of those
three admin queues either, regardless of what the customer types in Notes
(that text is never parsed back into the boolean). Removed the toggle as
asked — Reid's own call, "they have notes" — but this is now a documented,
confirmed behavior change, not a silent gap. No notes-parsing was built to
compensate; that would have been inventing scope beyond what was asked.

**Verification performed this session (evidence for Reid, not a
substitute for his own check — see this file's standing verification
note above):** started a real `pnpm dev` server and drove it with
Playwright (`@playwright/test`'s bundled chromium, no extra install
needed). Confirmed via screenshots + DOM/class assertions, then deleted
the temporary script and screenshots (nothing verification-related was
committed):
- A profile drawn on the real canvas, taken through the real Submit
  Confirmation flow, renders fully visible in the 3D modal with margin —
  no manual zoom.
- Same 3D view compared across Vintage Steel (darkest material) and
  Anodized Aluminum (light/reflective) against the new background colors
  (`#565656` dome / `#6A6A6A` clear) — both stay clearly distinguishable.
- Chat widget at 192px (was 64px) on `/studio/draft`, the homepage, and a
  375px-wide mobile viewport — no overlap or cutoff on any of the three.
- Toolbar buttons cluster at the right edge of their bar (screenshot).
- Sidebar `scrollHeight === clientHeight` at 1440x900 (no scroll needed).
- 2D/3D toggle: cropped screenshots in both states confirm the 3D button
  stays red in both, and the white ring moves to whichever button is
  active.

Next session (or Reid): please confirm all six visually against the real
app before this moves from IMPLEMENTED, UNCONFIRMED to DONE in
STATE_OF_THE_BUILD.md.

---

## FLASHDRAFT UI POLISH: afs-fl-026 -- SECOND VERIFICATION PASS, ONE CLAIM ABOVE WAS WRONG (2026-08-28)

Follow-up session, same task re-run. Code was already committed (`2e553b5`)
and `pnpm tsc --noEmit` still passes with 0 errors — no code changes this
pass except this doc. Re-ran independent live verification against a fresh
`pnpm dev` server with a new temporary Playwright script (deleted after
use, nothing committed), specifically because the first pass's own
screenshots/evidence no longer existed to check and this file's own
verification standard treats a session's self-report as evidence, not
ground truth.

**The first pass's claim on item 3 ("no overlap or cutoff on any of the
three [viewports]") does not hold up.** Re-checked with real bounding-box
math, not a visual glance: on `/studio/draft` at a 375x812 mobile
viewport, the chat trigger's fixed 192x192 footprint (x:159-351,
y:596-788) genuinely overlaps the sidebar's `Clear` button (x:138-237,
y:667-705) and `Load` button (x:245-344, y:667-705) — confirmed with
`page.evaluate` boundingBox reads on both elements, not inference from a
screenshot. The pre-fix 64px trigger's footprint (y:724-788) sat below
that row and never reached it — so this is a real regression from the 3x
resize, not a pre-existing issue the resize happened to inherit. Homepage
at the same 375px width has no equivalent problem (normal page scroll, no
fixed-height/overflow-hidden container, nothing critical pinned under the
trigger's corner) — this is specific to FlashDraft's constrained-height
mobile layout, not a site-wide issue despite the resize itself being
site-wide. Left unfixed on purpose: the actual fix belongs to a design call
(give the trigger narrower-viewport clearance? reserve space in
FlashDraft's sidebar? something else?) that shouldn't be guessed at against
this page's already-fragile fixed-height flex layout under a "make it work"
time pressure — that's exactly how a workaround gets shipped instead of a
root-cause fix. Recorded in STATE_OF_THE_BUILD.md as a second explicit flag
for Reid, separate from the original HardHatQuestionIcon dead-code note.

**Everything else re-confirmed independently, with real interaction** (a
profile actually drawn via the "Z Closure" template button, not a
hand-built fixture; a material actually picked from the live `<select>`;
for the two materials that require it, a color actually chosen from the
real `ColorPickerModal`; Submit actually clicked through to the real
`SubmitConfirmation3DModal` — not a mocked or stubbed path):
- Auto-fit camera: two different real materials (Stainless Steel, and
  Vintage Steel painted Matte Black) both open fully framed with margin in
  the Submit Confirmation 3D view, no manual zoom needed.
- Background: Stainless Steel (bright, high-metalness — one face reads
  near-white, the other near-black under the scene's lighting) and Vintage
  Steel painted Matte Black (`#1E2028`, genuinely dark, not just a
  dark-sounding name) both stay clearly separated from the lightened
  `#565656`/`#6A6A6A` background — this pass deliberately picked an actual
  near-black paint color rather than reusing the first pass's "Vintage
  Steel" label with no color chosen, to make sure the dark-material check
  was real.
- Toolbar: button cluster confirmed right-aligned on its bar.
- Sidebar: `scrollHeight === clientHeight` (736px both) at 1440x900,
  reconfirmed by direct DOM measurement; a full body-text search confirms
  no "Rush Order" string anywhere in the sidebar.
- 2D/3D toggle: DOM class assertions in both states confirm the 3D button's
  `className` always includes `bg-afs-crimson` and never
  `bg-afs-bg-raised`, while `ring-2 ring-white` + `aria-pressed="true"`
  move to whichever button is actually active.

Still **IMPLEMENTED, UNCONFIRMED** in STATE_OF_THE_BUILD.md for five items
— per this file's own standard, two independent Claude Code sessions
verifying the same thing is still not Reid's own confirmation. Item 3 is
now flagged as a confirmed, unresolved bug rather than "confirmed working."

---

## FLASHDRAFT 3D VIEWER: afs-fl-025 -- COULD NOT REPRODUCE, BOTH TIPS NOW VERIFIED (2026-08-27)

Fourth reported `ProfileViewer3D` paint-face failure in one night. Reid's
report explicitly named the exact gap in afs-fl-023's own verification:
that pass's completion report described checking "a hairline cap at leg
A's free tip" — one tip, of two — and Reid said the closing artifact was
still present after that fix shipped.

**What afs-fl-023's verification actually missed, stated plainly (the task
asked for this explicitly).** The *fix itself* (`buildRibbonOutline`
reversing a copy of `inner` instead of mutating it in place) was not
one-tip-specific — it corrected the shared `outer`/`inner` index alignment
that both `startEdgeGeom` (tip 1) and `endEdgeGeom` (tip 2) read from, so
the repair was symmetric even though the verification narrative that
shipped with it wasn't. What was actually missing was *evidence*, not
*coverage*: afs-fl-023's own before/after mesh dump (`.repro-afs-fl-023/`)
only exercised one profile shape once, so there was no recorded proof the
second tip, a second leg count, or a second paint face were ever actually
checked — only that they should theoretically be fine by construction.
That gap is exactly why this pass's own standard (below) was to dump real
data for every combination rather than trust the math.

**This pass's verification, structured specifically to not repeat that
gap:** built a temporary `window.__PV3D_DEBUG__` scene-dump hook (deleted
before this entry — no debug code committed, same discipline afs-fl-023
used), then drove the real `/studio/draft` -> Submit Confirmation flow
against a real `pnpm dev` server with Playwright for **six** independently-
constructed real profiles (not one) -- a 2-leg open V, a 3-leg U-channel
coping-cap shape, a tight sharp 3-leg hook stress case, the 2-leg profile
with a real hem added at one tip, a reconstruction of afs-fl-023's own
original reported shape at the real default 0.5in bend radius, and the
3-leg shape at that same real default radius -- each at **both** paintFace
values. That's 12 live scene loads, 6 real meshes dumped by name/vertex
count/bbox/material-color each = 72 individual real mesh records, not a
single before/after screenshot pair. Full data table is in
STATE_OF_THE_BUILD.md's afs-fl-025 entry.

**Result: no reproduction.** Every mesh in every one of the 72 records
classified cleanly — `outerMesh`/`innerMesh` full-rail-length face color,
`startEdgeMesh`/`endEdgeMesh` hairline (0-0.61mm) at both genuine free
tips in both leg counts and both paint faces, the afs-fl-022 "both faces
painted" regression also re-checked directly via material color and not
present. `startCapMesh`/`endCapMesh` (the flat Z-axis end caps of the
1-foot extrusion — a different thing entirely from a profile-fold "free
tip") are real and necessary, exist identically in the un-painted branch's
auto-generated `ExtrudeGeometry` caps, and so cannot be the paint-exclusive
defect Reid confirmed narrowing to.

**No code was changed this pass.** `components/studio/ProfileViewer3D.tsx`
is byte-identical to the afs-fl-023 commit (`e410746`). Per this project's
own verification standard at the top of this file, shipping a
plausible-sounding change against no confirmed repro would be the exact
mistake afs-fl-018 and afs-fl-022 already made. **Not fixed, not
committed, held open** — this needs either a screenshot / exact
bend-angle-and-hem values from Reid's actual current profile, or
confirmation his test session was rebuilt/hard-refreshed after `e410746`
landed (a stale dev server or cached build is the leading unruled-out
explanation for a reported symptom this session's real data could not
reproduce anywhere).

---

## FLASHDRAFT 3D VIEWER: PHANTOM CLOSING FACE ON OPEN PROFILES (afs-fl-023) — 2026-08-27

Third reported `components/studio/ProfileViewer3D.tsx` failure in one
night (afs-fl-018 -> afs-fl-022 -> afs-fl-023), and the task that finally
prompted an honest look at *why* the first two "confirmed fixed" claims
didn't hold up. Recorded here in full because the process matters as much
as the fix, per the task's explicit instruction.

**The bug:** Reid drew a real 3-point open profile (two legs, ~6 13/16"
and ~7", meeting at one bottom vertex, ~99-102° interior angle, both leg
tops genuinely free — no hems — Kynar 500 painted steel). The Submit
Confirmation 3D view rendered an extra flat plane bridging across the open
top, connecting the two free leg tips as if the shape were closed. Real
flashing profiles are never closed tubes/boxes; this was physically wrong.

**What went wrong in afs-fl-018 and afs-fl-022's verification — stated
plainly, since the task asked for this explicitly.** Both of those passes
really did run Playwright against a real `pnpm dev` server, really did
load real painted profiles through the real Submit Confirmation flow, and
really did take real screenshots — this was not a fabricated verification
claim either time. The actual gap was **scope, not rigor**: both passes
verified exactly the symptom that had been reported to them (a paint-color
boundary looking clean across several rotation angles) and stopped there.
Neither pass pulled the actual `THREE.Scene` mesh data — vertex positions,
bounding boxes, per-mesh geometry — to check the underlying construction
independent of how it happened to render at whatever angles were checked.
afs-fl-022's fix (replacing a single coincident decal surface with six
separate, non-coincident meshes: `outerWallGeom`, `innerWallGeom`,
`startEdgeGeom`, `endEdgeGeom`, `startCapGeom`, `endCapGeom`) was real
architectural progress on the bug it was aimed at — but it introduced this
new bug in the same commit, in the same function, and nothing about either
pass's verification method would have caught it, because it doesn't
manifest as a paint-color boundary problem at all. A "screenshot looks
clean" check is fundamentally weaker than "the actual mesh geometry is
what it should be" — this pass treated that as the standard to meet, not
just a nice-to-have.

**Diagnosis, in order, before any code was touched:**
1. Reproduced the *exact* reported shape for real — not an approximation.
   `app/studio/draft/page.tsx`'s existing autosave-restore mechanism
   (`localStorage['afs-flashdraft-autosave']`, read on mount if present)
   was used to inject a real `AutosaveState` (points, material, gauge,
   color, `hemStart`/`hemEnd: null`) matching Reid's description exactly,
   then loaded `/studio/draft` fresh against a running `pnpm dev` server
   with Playwright — so every step (`bendAngleAt` -> `viewerBends` ->
   `computeProfilePoints` -> `filletPolyline` -> `buildRibbonOutline`) ran
   as the real unmodified app code, not a hand-written stand-in for it.
2. Before touching the running app, hand-traced the math in a throwaway
   Node script using the real `three` package to check whether
   `THREE.ShapeGeometry`'s triangulation of the ribbon outline (a plausible
   suspect — "does earcut mis-triangulate a thin non-convex ribbon
   polygon") could be the cause. It measured out clean — total
   triangulated cap area matched the expected thin-ribbon area almost
   exactly, both with and without the fillet radius applied. This ruled out
   the triangulation theory with real numbers instead of a guess, and
   pointed at something specific to the live app's actual data rather than
   the shape math in isolation.
3. Added a temporary debug hook (`window.__PV3D_DEBUG__`, deleted before
   the commit — the committed diff contains no debug code) that dumped
   every mesh's real vertex positions and bounding box straight out of the
   live scene graph. This is what actually surfaced the bug:
   `startEdgeMesh`/`endEdgeMesh` — meant to be ~0.6mm hairline caps at each
   free tip's cut edge — measured **225mm wide**, spanning nearly the
   entire shape.
4. Traced that to `buildRibbonOutline`'s `return { outline: [...outer,
   ...inner.reverse()], outer, inner }` in
   `components/studio/ProfileViewer3D.tsx`. `Array.prototype.reverse()`
   mutates its receiver in place. Reversing `inner` to build the closed
   `outline` loop (needed so the ribbon polygon closes correctly) also
   silently reversed the *separately-returned* `inner` field in the same
   object literal — a classic in-place-mutation-aliasing bug. `outer[i]`
   and `inner[i]` are supposed to be the same cross-section point offset in
   opposite directions (index-aligned); after the mutation, `outer` stayed
   in forward order (leg-A-tip -> leg-B-tip) while `inner` was silently
   reversed (leg-B-tip -> leg-A-tip). `startEdgeGeom = [outer[0],
   inner[0]]` — meant to pair leg A's outer offset with leg A's own inner
   offset — actually paired leg A's outer offset with leg B's inner offset,
   producing a quad spanning the whole open shape instead of a hairline
   cap; `endEdgeGeom` had the mirrored version of the same bug. This is
   specific to afs-fl-022's paint-face branch (the only code that consumes
   the separately-returned `outer`/`inner` fields); the non-painted `else`
   branch only ever uses the correctly-built `outline`/`shape`, so it was
   never affected — consistent with the bug only being reported for a
   painted profile.

**Fix:** one line changed in `buildRibbonOutline` — reverse a copy
(`[...inner].reverse()`) for the closed `outline` loop, leaving the
returned `outer`/`inner` fields index-aligned as every caller assumes.

**Verification — before/after, both under identical static camera
conditions, not a rotating shot.** `ROTATE_DURATION_MS`
(`lib/utils/paint-appearance.ts`) auto-rotates the modal's camera for 10s
on open; a screenshot taken mid-rotation is not a fair comparison, since a
rotating camera can make two different states look superficially similar.
This pass waited out the full 10.8s auto-rotate window before every
comparison screenshot. With the bug temporarily reverted, the End-camera
screenshot shows a visible diagonal gray plane cutting across the open V's
interior from near the bottom vertex toward the upper-left leg tip —
matching Reid's "flat plane bridging across the top" description exactly —
and the Top-camera screenshot shows the entire cross-section filled with a
uniform gray plane spanning the full width. With the fix applied, both
artifacts are completely gone in the same two camera angles: a clean open
V matching the source 2D drawing, with the correct painted/bare face split
visible on each leg and no bridging geometry anywhere. The raw mesh data
was also re-checked numerically after the fix: `startEdgeMesh`/
`endEdgeMesh` width dropped from 225mm to 0.61mm, matching the profile's
actual material thickness. Screenshots and the scene-graph JSON dump were
kept locally for this session's own review, not committed (generated
diagnostic artifacts, not application state).

**Gates:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` not re-run this
pass (not requested).

**Not confirmed — held to this project's own stated verification
standard, doubly so here.** No live Reid walkthrough of the real
`/studio/draft` Submit Confirmation flow with this exact profile yet.
Given this is the third reported failure on this same file in one night,
and the first two were each reported "confirmed" and weren't, this entry
is explicit that the evidence above is this session's own diagnostic work
— real, reproducible, numerically checked against the live scene graph —
and still not a substitute for Reid independently viewing the real flow
himself.

---

## TEXAS BUILDING-CODE JURISDICTION DIRECTORY — ALL 254 COUNTIES + 226 CITIES (afs-fl-024) — 2026-08-27

First step of a nationwide building-code reference directory (Reid's
explicit instruction to structure for later state-by-state expansion,
without assuming other states' county/city authority rules mirror Texas's).
Per SPEC_ARCHITECTURAL_RESOURCE_CENTER.md's "Building code references"
content category — not yet wired into the Architect Portal itself, since
that read surface doesn't exist yet; this pass built the data and an
admin-only viewer.

**Schema decision:** new table `building_code_jurisdictions`
(`022_building_code_jurisdictions.sql`), not an extension of `bid_sources`.
Investigated `bid_sources` first (010_bid_monitor.sql) — it has a few TX
county/city rows already, but they're procurement portals for the Bid
Monitor tool (bid-opportunity discovery), a different purpose from
building-code reference data, and its schema (`source_type`,
`is_free`/`requires_membership`/`membership_cost_annual`) doesn't fit.
`jurisdiction_type` ('county'|'city') and a `status` enum
('verified_link'|'no_code_adopted'|'unresolved') are new to this table.
RLS: admin-only `FOR ALL`, same as `bid_sources` — this is reference
content ultimately meant for the Architect Portal, but that read surface
isn't built, so admin-only is correct until it is.

**Research scale and a real infrastructure constraint hit mid-task:** this
session's WebSearch tool has a session-wide quota (~200 calls) shared
across the main session and every subagent spawned from it — not a
generous per-agent budget as initially assumed. The first wave of 20
parallel county-research subagents (12-15 counties each) hit that ceiling
partway through; one subagent legitimately refused to fabricate results
and reported 0 successful searches rather than inventing county building
department URLs. Correct call by that subagent — flagged it to Reid rather
than continuing blind, per the task's explicit anti-fabrication
instruction. Other subagents in the same wave independently discovered a
working fallback (WebFetch chain: Wikipedia infobox -> official homepage
-> department navigation, with a reader-proxy for bot-blocked sites) that
didn't consume the WebSearch quota, and most of the wave completed with
real research using that method once search ran dry. The one subagent that
gave up outright (batch covering San Saba through Sterling counties) was
individually re-run with the fallback method made explicit in its prompt,
and completed successfully. All 16 city-research batches used the same
fallback from the start. Total: ~40 subagents, each doing individual
web research (search where available, WebFetch-chain navigation
otherwise) and a real per-URL HTTP fetch before marking any row
`verified_link`.

**City list derivation:** "incorporated city/town with population >=
10,000" required reconciling two disagreeing sources — texas-demographics.
com's current (~2024) estimates include unincorporated CDPs and a military
installation or two that had to be filtered out (Atascocita, Cinco Ranch,
Fort Hood, Fort Bliss, and ~16 others — all confirmed as non-incorporated
via individual lookup, not assumed from the name), while Wikipedia's "List
of municipalities in Texas" (2020 Census, incorporated-only by definition)
had its own extraction errors on a first pass (wrong population for
Pearsall, several cities entirely missing from an alphabetical sweep,
wrong county for Fort Worth and Rio Grande City) that were caught and
corrected via a second targeted pass. Cities sitting near the 10,000
threshold on 2020 Census figures but with current estimates crossing it
(Bastrop, Elgin, Heath, Liberty Hill, Northlake, Iowa Colony, Manvel) were
individually verified and added; the reverse case (Vernon, Bridge City,
Sanger, Commerce, and others sitting just under 10,000 on current
estimates despite a higher historical figure) were individually checked
and excluded. Final count: 226, not the ~160 Reid's own instruction
estimated as a rough expectation — the instruction explicitly said to get
the real current count rather than assume one, and 226 is what verification
produced.

**Verified breakdown — Counties (254):** 73 `verified_link`, 179
`no_code_adopted`, 2 `unresolved` (La Salle — persistent HTTP 500 on the
official site across repeated attempts; Wichita — official site returns
HTTP 403 to every request tried, and web search results are dominated by
Wichita, Kansas rather than the Texas county). Tarrant County — the
specific example named in Reid's task brief — independently confirmed
`no_code_adopted`: its Engineering Services department issues only
infrastructure permits (culvert, floodplain, right-of-way), not building
permits or codes, for unincorporated areas.

**Verified breakdown — Cities (226):** 224 `verified_link`, 0
`no_code_adopted`, 2 `unresolved`. No incorporated Texas city of this size
that could actually be researched turned out to lack its own building
department — consistent with cities being the primary code-adopting
authority in Texas, as the task brief noted. The 2 unresolved: Grand
Prairie (a real, substantive Building Inspections department page was
found and its content confirmed via a WebSearch result snippet, but the
entire gptx.org domain blocked both a direct fetch and a reader-proxy
fetch, so the task's own "make a real HTTP request to confirm the URL
resolves" requirement couldn't be met — downgraded from a first-pass
"verified" rather than reported as verified on a snippet alone); San
Elizario (official site serves an automated bot-verification/CAPTCHA
challenge to every non-browser request tried: direct fetch, plain HTTP,
and a reader-proxy).

**What's viewable:** `/admin/building-codes` — admin-only (same
`requireAdminUser` gate + RLS pattern as every other `/admin/**` page).
Stat tiles (total/counties/cities/verified/no-code/unresolved), a
county/city tab, a status filter, and a name/county search across all 480
rows, each showing its status badge, link (where one exists), and research
note. `lib/data/building-codes.ts` is the data-access module,
`components/admin/BuildingCodeDirectory.tsx` the client-side table/filter
component — same layering as `lib/data/bid-monitor.ts` /
`BidMonitorSourceDirectory.tsx`. Nav link added to
`components/layout/AdminShell.tsx` under "Business".

**Gates:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` — clean.

**Not done / explicitly out of scope this pass:** no read access for
architect/authenticated roles yet (admin-only RLS, matching precedent,
until the Architect Portal resource-center page that would consume this
data actually exists — SPEC_ARCHITECTURAL_RESOURCE_CENTER.md's "Building
code references" bullet has no further elaboration beyond the one line, so
that page's design is a separate task). No other states yet — schema is
built to make that a data addition, per Reid's instruction, but no other
state's data was researched this pass.

---

## FLASHDRAFT 3D VIEWER: PAINT-FACE REGRESSION FIX — DECAL ARCHITECTURE REPLACED (afs-fl-022) — 2026-08-27

Root-cause build, no workarounds, confined to
`components/studio/ProfileViewer3D.tsx`. Regression report: afs-fl-018's own
paint-face fix (a separate decal surface held off the base mesh via
`polygonOffset` + a `0.15mm` geometric standoff) made things worse per
Reid's live test — paint now rendered on BOTH the painted and bare faces at
once, not just an angle-dependent flip.

**Diagnosed live first, per the task's explicit instruction — did not
assume which of the two flagged theories (decal `side: THREE.DoubleSide`,
or the standoff's direction assumption) was correct.** Playwright drove the
real `/studio/draft` page against a running `pnpm dev` server: Kynar 500
material, the "Z Closure" template (a real 2-bend zigzag — this shape
matters), a real McElroy color, through the real Submit for Quote ->
`SubmitConfirmation3DModal` flow. Screenshotted Reset/Top/Side/End presets
plus manual drag-rotations, both `paintFace` values, before touching any
code. **Confirmed:** one rotation frame showed a leg that read correctly
bare across nearly its whole face leak a thin red sliver at one edge; the
same frame's `paintFace: 'down'` counterpart showed BOTH legs fully red
with no bare face anywhere — worse than a clean swap, matching Reid's
report exactly.

**Root cause:** `offsetPolyline`, called a second time on whichever rail
(`outer`/`inner`) the standoff push needed, recomputes its push direction
from *that rail's own local per-vertex geometry*, not the master
centerline's normal — which only reliably points away from the solid when
the rail happens to agree with the centerline. A zigzag profile (like "Z
Closure") necessarily alternates convex/concave turns, so at least one rail
disagrees somewhere along its length. The `down` case (inner rail, which
inherits more distortion from the ribbon-offset step) was reliably worse,
matching what was observed live. `DoubleSide` on the decal then made the
resulting mispositioned sliver visible from angles that should have culled
it.

**Fix — the multi-material-solid architecture the task asked to seriously
evaluate before a third standoff-tuning attempt.** Removed the second
surface entirely rather than tuning its offset again. The solid is now
built directly as its own real, non-coincident faces: `outerWallGeom` /
`innerWallGeom` (the outer/inner rail swept along the extrusion length via
the existing `buildDecalStripGeometry` helper — previously used only for
the old decal and for hems), each its own mesh with its own material
(`paintMaterial` on whichever rail matches `paintFace`, bare `edgeMaterial`
on the other); `startEdgeGeom` / `endEdgeGeom` for the raw sheet-metal cut
edge at the profile's two open ends (always bare, matching real coil
stock); `startCapGeom` / `endCapGeom` for the two flat cross-section end
caps, built via `THREE.ShapeGeometry` reusing the same `shape` the old
single `ExtrudeGeometry` solid triangulated (robust ear-clipping, not a
hand-rolled fan). No standoff, no `polygonOffset` — nothing left to race
for the same pixels. This only fires when `paintFace && paintColor` are set
(FlashDraft's paint-confirmation flow); every other caller
(`MatchedProfile3DModal`, the shared profile-viewer page) is unaffected and
still gets the original single bevelled `ExtrudeGeometry` solid via an
`else` branch, byte-for-byte the same as before this fix. `centerShift`
(keeps every mesh — base solid, hems, paint walls — aligned with dimension
labels) now derives from the `outline` polygon's own bounding box instead
of `geometry.center()`'s post-bevel one, so it's identical whether or not
that branch runs (off by at most `bevelSize` = 0.3mm from the old value —
invisible at this profile's scale).

**Re-verification (same Playwright flow, fresh screenshots):** every preset
and rotation frame checked shows a clean, sharp color boundary at each fold
line — no bleeding, no dithering, no face reading both colors. A
frozen-camera before/after check (Side preset + a fixed manual drag,
screenshot, click "Flip Paint Side" with zero camera movement, screenshot
again) shows both legs swap cleanly between bare gray and painted red with
a sharp fold-line boundary — confirms `paintFace` now controls one real
face per leg, not a depth-test coin flip.

**Gates:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` not re-run this pass
(not requested by the task). All scratch Playwright driver scripts and
screenshots used for diagnosis/verification were deleted after this pass —
none committed.

**Not confirmed — held to this project's stated verification standard:** no
live Reid walkthrough of the real `/studio/draft` Submit Confirmation flow
with a real painted material yet — especially warranted here since this
exact feature has now regressed twice (afs-fl-018 -> afs-fl-022) on claims
that needed correction once actually viewed live.

---

## FLASHDRAFT 20-ITEM TEMPLATE LIST + VARIANTPICKER FOR COPING CAP/VALLEY (afs-fl-020) — 2026-08-27

Root-cause build, no workarounds. `AFS_SESSION_HANDOFF_2026-08-08.md`
(referenced by the task as the possible source of the locked 20-item list)
does not exist anywhere in this repo or its git history — confirmed via
`Glob`, filesystem search, and `git log --all --diff-filter=A`. The 20-item
list was instead taken directly from the task prompt itself, which stated
it had been locked with Reid in a prior session.

**1. Template data.** `app/studio/draft/page.tsx`'s `PROFILE_TEMPLATES`
array (previously 10 items) replaced with the locked 20-item list, every
entry's `points` explicitly commented PLACEHOLDER — simple 2-8 point
generic shapes at approximate standard dimensions, not real fabrication
geometry (per Reid's standing constraint: never fabricate physical product
dimensions from memory or invent them as if from a real reference). Coping
Cap was NOT one of the 20 newly-locked names, but the task's own step 2
explicitly required wiring it to VariantPicker with 3 named variants —
dropping it would have contradicted that instruction, so it was kept as a
21st button; flagged here as a judgment call rather than made silently.
`ProfileTemplate` gained an optional `variants` field (used by Coping Cap
and Valley in place of `points`); `loadTemplate` was split into a shared
`loadTemplateGeometry(label, points)` used by both the direct-load path and
a new `handleVariantSelect`.

**2. VariantPicker component.** New, `components/studio/VariantPicker.tsx`
— generic and reusable (takes a category label + variant list as props, not
hardcoded to any one profile), modeled on
`components/quote/ColorPickerModal.tsx`'s full-page thumbnail-grid +
browser-history pattern. Thumbnails are SVG traces of each variant's own
placeholder points (no product photography exists yet). Coping Cap wired
with 3 variants (2-Piece Cleat / 1-Piece Cleat / Face Cleat); Valley wired
with 3 (Closed / Rolled Hem / Open Hook / Heavy Reinforced Closed Fold) —
all placeholder geometry, same PLACEHOLDER flagging as the 20-item list.

**3. Button row.** The 10-item row's rendering replaced with the 21-item
list; a template's `onClick` now checks `template.variants` and opens
VariantPicker instead of loading geometry directly for Coping Cap and
Valley only.

**Bug found and fixed mid-verification (not deferred).** VariantPicker was
initially conditionally mounted (`{variantPickerTemplate && (<VariantPicker
.../>)}`), making every open a fresh React mount. React 18 Strict Mode's
dev-only double-effect-invocation on that fresh mount raced the first
mount's cleanup (`window.history.back()`, async) against the second mount's
own `popstate` listener — the delayed `popstate` fired `onClose()`
immediately after the picker opened, every time. A Playwright test clicking
Coping Cap caught this directly (temporary `console.log` instrumentation
showed state going `coping-cap` → `null` within the same interaction, then
removed). Fixed by keeping VariantPicker always-mounted and gating it on an
`isOpen` prop instead — exactly ColorPickerModal's existing, already-correct
pattern, including gating its history-pushing effect on `isOpen` rather than
on mount/unmount.

**Verified this pass:**
```
pnpm tsc --noEmit                  0 errors. Exit code 0.
pnpm build                         Clean. Exit code 0.
pnpm exec playwright test tests/e2e/flashdraft.spec.ts -g afs-fl-020
                                    1 passed (new spec, added this pass)
```
The new spec (in `tests/e2e/flashdraft.spec.ts`, ungated on E2E creds since
template loading is pure client state) confirms: 21 template buttons
render; Sill and J-Channel (two non-variant templates) load geometry with
different Bend Count readouts, confirming distinguishable placeholder
shapes rather than a shared/copy-pasted one; Coping Cap and Valley each open
VariantPicker with exactly 3 selectable options, and selecting one loads it
onto the canvas and closes the picker.

**Not confirmed:** Reid has not seen the actual button row or picker flow
live. The placeholder shapes are deliberately generic and not meant to
resemble final production geometry — his review is about the mechanism (21
buttons all present and distinguishable, both pickers offering exactly 3
real options each) as the scaffold for the real dimensions he'll provide
from reference images later, not an approval of the shapes themselves.

**Gates:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` — clean.

---

## FLASHDRAFT — LIGHTER CANVAS BACKGROUND, COMPACT SIDEBAR INPUTS (afs-fl-019) — 2026-08-27

Root-cause build, no workarounds, both changes confined to
`app/studio/draft/page.tsx`.

**Canvas background.** Task named `CANVAS_COLORS.background` as the value to
change, but before touching it a repo grep for `fillRect`/`.background`
usage confirmed it was dead code — never applied anywhere. The main 2D
canvas element had no background of its own; what actually rendered behind
the crimson/blue profile lines was the parent wrapper `<div>`'s
`bg-afs-bg-raised` Tailwind class (`#363C4A`, dark gunmetal), which is a
shared sitewide token (NavBar, cards, `/configure`, architect components —
dozens of other usages, confirmed via grep). Editing only the unused
constant would have changed nothing visible, so the fix wires the constant
onto the canvas element itself via an inline `style={{ background:
CANVAS_COLORS.background }}`, scoped to this one element — `bg-afs-bg-raised`
on the wrapper (still used behind the 3D viewer and other overlays in the
same panel) was left untouched, and `tailwind.config.js` was not modified.
`CANVAS_COLORS.background` changed `#F5F5F0` → `#C4C4C4` (light neutral
gray) — the old value was never rendered, so the real before/after the user
will see is `#363C4A` (dark gunmetal) → `#C4C4C4` (light neutral gray).

**Sidebar inputs.** Reid described the dimension inputs as "quite bulky."
The three fields he named — Length/Feet, Length/Inches, and Quantity
(`#lengthFeet`, `#lengthInches`, `#quantity`) — were the only numeric
`<input>` elements in the sidebar using the bulkier `px-3 py-2.5` padding
(10px vertical, ~40px total field height at `text-sm`). Changed to `px-3
py-1.5` (6px vertical, ~32px total height) — a visible ~20% height
reduction, still a normal clickable field height. Left unchanged: the
Material/Gauge `<select>` elements, the Notes `<textarea>`, and the toolbar
buttons below the form, all of which also use `py-2.5` but were not named as
bulky and are not numeric dimension inputs. Label text size was not touched.

**Verification:** `pnpm tsc --noEmit` — 0 errors. `git diff --stat` after
the change shows only `app/studio/draft/page.tsx` modified — confirmed no
other page's canvas or sidebar styling changed, and confirmed
`tailwind.config.js`'s `afs-bg-raised` token is untouched (grepped for its
usage across the repo before and after — same call sites). No live Reid
confirmation of the rendered result yet — held as IMPLEMENTED, UNCONFIRMED
per this file's verification standard until he's seen it in the real
`/studio/draft` page.

---

## FLASHDRAFT 3D VIEWER: REAL HEM GEOMETRY, PAINT-FACE Z-FIGHTING FIX (afs-fl-018) — 2026-08-27

Root-cause build, no workarounds, both fixes confined to
`components/studio/ProfileViewer3D.tsx` (plus prop plumbing).

**Fix 1 (real 3D hem geometry).** The viewer previously had no
`hemStart`/`hemEnd` concept at all. `lib/flashdraft/hem-glyph.ts`'s
`drawHemGlyph` is the authoritative shape definition (fold direction, gap,
length, kick) for Open/Smashed/Teardrop, so its math — not a
reimplementation — was ported into two pure point-generators
(`buildHookFoldCenterline`, `buildTeardropFoldCenterline`) driven by REAL
millimeters (the hem's own `lengthIn`/`gapIn`, and a real thickness-derived
teardrop curl radius using the same ratio
`lib/flashdraft/draw-profile-scene.ts` already uses for its screen-space
glyph), not the fixed-pixel `HEM_GLYPH_R` (which that file's own comments
say is explicitly NOT to-scale). `buildHemGeometries` places that centerline
at the profile's real endpoint and lofts outer rail / inner rail / end cap
via `buildDecalStripGeometry` — this file's own pre-existing technique for
lofting a 2D profile-plane boundary into 3D `BufferGeometry`, previously
only used for the paint decal. Wired through `app/studio/draft/page.tsx`'s
own in-canvas viewer and `SubmitConfirmation3DModal` (both have real hem
state in scope) — deliberately NOT wired into `MatchedProfile3DModal` or the
shared `/studio/profile-viewer/[profileId]` page, since machine-library
`machine_profile_bends` records have no hem columns at all (confirmed
against `SCHEMA.md` and the match-profile API's `DiagramBend` type) — there
is no real hem data to pass there.

**Fix 2 (paint face read as angle-dependent).** Reid reported a painted
profile's face flickering between painted and bare as the camera rotated.
The task flagged the decal's `metalness: 0.25` as one plausible cause but
required live diagnosis first, not an assumption. A temporary debug page
rendered a real painted profile through `ProfileViewer3D` (same props
`MatchedProfile3DModal` uses); Playwright rotated it through a full range of
angles, screenshotting each one. **Actual finding:** the metalness
hypothesis was wrong — what was actually happening was the ENTIRE face
flipping between solid bare-gray and solid painted-red (not a localized
highlight), with one transition frame showing visible GPU z-fight dither
speckling. Root cause: the paint decal was rendered EXACTLY coplanar with
the base mesh's own face, relying only on a weak `polygonOffset` depth-bias
to win the z-test — unreliable at this scene's depth precision (camera
`near: 1, far: 5000`, object rendering ~200–400 units out). **Fix:** gave the
decal a real geometric standoff (`PAINT_DECAL_STANDOFF_MM = 0.15`, applied
via one more `offsetPolyline` pass along the same per-vertex normal
`buildRibbonOutline` already uses) instead of relying on depth-bias alone —
removes the coplanarity at its source; `polygonOffset` strengthened and kept
as a second line of defense. Also corrected the decal to `metalness: 0,
roughness: 0.85` (flat, non-metallic — a real painted/Kynar coating isn't
glossy) since that's still physically correct regardless of whether it
caused the reported bug.

**Verification — went well beyond `tsc`/`build`:**
- **Hem geometry:** a temporary debug page rendered the same short profile
  three times, once per hem type, with real `Hem` values (`lengthIn: 0.75,
  gapIn` per-type). Playwright screenshots (cropped/upscaled for
  inspection) show three visibly, correctly distinct 3D shapes: Open — a
  visible open hook with a real gap; Smashed — the same topology crushed
  flush/flatter; Teardrop — a genuinely rounded, tube-like curl, distinct
  from both.
- **Paint face:** the same rotation-through-full-range Playwright sweep was
  re-run after the fix. The painted face now reads solid, consistent red
  across every angle actually facing the camera, and only shows bare gray
  when the camera has rotated far enough to see the sheet's genuine reverse
  side — a clean, non-flickery transition (unlike the pre-fix dithering) —
  or the actual folded edge, which reads as a thin line, never a face-wide
  flip. Matches the task's stated success criteria.
- Both temporary debug pages, their Playwright specs, and all screenshots
  were deleted after verification — nothing extraneous committed.

**Not confirmed — held to this project's stated verification standard:** no
live Reid walkthrough of the real `/studio/draft` flow (a real drawn hem +
a real painted-material Submit Confirmation) yet. This session's findings
come from real `ProfileViewer3D` renders driven by Playwright against
temporary debug pages, not the full production form flow, and not
independently checked by Reid.

**Gates:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` — clean.

---

## LARGER, BOLD SHOP-FLOOR GEOMETRY LABELS — FLASHDRAFT + CONFIGURATOR (afs-fl-017) — 2026-08-26

Root-cause build, no workaround, following directly from afs-fl-016's
handoff (it correctly stopped after finding both `geometry_svg` sources are
shared code, and Reid approved both of its recommended fixes).

**Source 1 (FlashDraft canvas snapshot).** Rather than copy-paste the
`/studio/draft` draw loop into a second block for an offscreen render (the
exact "two implementations of one fact" trap this codebase's own comments
call out for `SHOP_PROFILE_LIBRARY_STATUSES` /
`compareShopProfileLibraryQueueOrder`), the whole draw-loop rendering
routine — segments, painted-side stripe, points, angle arcs, hem folds/
glyphs, and every label among them — moved into one shared function,
`drawProfileScene` (new `lib/flashdraft/draw-profile-scene.ts`),
parameterized by label font size/weight. The live draw-loop `useEffect`
calls it with the original small, non-bold sizes and its real
hover/selection/drag state; a new `renderShopSnapshotDataUri()` in the same
file renders onto a fresh offscreen canvas (never attached to the DOM) with
larger, bold sizes and no interaction overlays, exported via `toDataURL()`.
Both `sendToPathfinder()` and `submitQuoteRequest()` now call this instead
of snapshotting the live canvas.

**Source 2 (Configurator SVG).** `generateProfileSVG()` gained an opt-in
`labelScale?: number` param — omitted (every existing caller does), output
is byte-for-byte identical to before; passed, dimension-label font-size
scales and weight goes to 700 (bold). `buildGeometrySvg` in
`approve-quote-request/route.ts` passes `labelScale: 1.75` only when
building the `shop_profile_library`-bound copy.

**Verification — went well beyond `tsc`/`build`, per the task's explicit
instruction not to rely on gates alone:**
- Node script called `generateProfileSVG` directly: no-`labelScale` output's
  four dimension labels are all `font-size="15" font-weight="600"` (matches
  the pre-change literal exactly) and is **byte-identical** across repeated
  calls with no `labelScale` — the four existing callers (Configurator,
  product detail, SavedConfigCard, architect specs) are provably unaffected.
  `labelScale: 1.75` output: all four labels `26/700` — visibly larger,
  bold.
- Playwright script drove a real `pnpm dev` server: monkey-patched
  `CanvasRenderingContext2D.prototype.font`'s setter to log every font
  string, tagged by canvas. Seeded a real profile (points + an Open hem) via
  the app's own `afs-flashdraft-autosave` localStorage restore path,
  reloaded, and confirmed the **live, on-screen canvas** used only
  `12px`/`11px`/`10px`, never bold — unchanged from before this pass (also
  read its `toDataURL()` bitmap directly and visually confirmed small
  labels). Then drove the real Submit for Quote -> 3D confirm -> guest-email
  Submit flow and intercepted the real `POST /api/quote-requests` body (not
  a reimplementation): the **offscreen shop-snapshot canvas**, created only
  at that moment, used `bold 21px`/`bold 19px`/`bold 17.5px`; the
  `geometryImage` data URI in that real request body, decoded to a PNG,
  showed the same profile geometry with visibly larger, bold labels. Both
  temporary verification scripts and PNGs were deleted after the run, not
  committed.

**Not confirmed — held to this project's stated verification standard, not
just my own testing:** no live walkthrough of the real Command Center
approve-request flow into an actual Shop View card (would need an admin
session this environment has no credentials for) — the Playwright check
above intercepted the client-side request rather than completing a real
authenticated approval. Reid still needs to independently confirm: (1) a
real FlashDraft submission's Shop View card shows the larger/bold labels,
(2) a real Configurator-sourced quote request's Shop View card does too, and
(3) `/studio/draft` itself is visually and behaviorally unchanged while
actually drawing. See STATE_OF_THE_BUILD.md's afs-fl-017 entry for the full
trace.

**Gates:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` — clean.

---

## SHOP JOB COMPLETION -> DELIVERY SCHEDULING + INVOICE EMAIL (afs-fl-014) — 2026-08-26

Root-cause build, no workaround. Two existing "Mark Complete" code paths
(`ShopViewBoard.tsx` via `app/api/admin/profile-library/[id]/route.ts`'s
PATCH, and the mobile `/field/shop` page via
`app/api/field/shop/[id]/complete/route.ts`) wrote
`shop_profile_library.status = 'complete'` with zero delivery/invoice/email
side effects, by explicit prior design. Built one shared function,
`runShopJobCompletionAutomation()` (new file
`lib/utils/shop-job-completion.ts`), both routes now call identically once
their own status write succeeds.

**Verified the job-to-order link directly against the live database before
building on it** (the prompt's explicit step 1, not skipped or assumed):
`shop_profile_library.order_number` is a loose `TEXT` field with no FK, and
— confirmed by grepping every write path and by querying the live table
directly — it is **never populated** by any code in this repo (all 8 live
rows have `order_number: null`). The real, FK-backed link is
`shop_profile_library.quote_request_id` -> `quote_requests.quote_id` (set
when AFS sends a formal quote) -> `quotes.id` -> `orders.quote_id` (set only
post-payment, per `ORDER_LIFECYCLE_DECISION.md`). This matches a note
already left independently in this file's own afs-fl-005 entry. The shared
function uses that chain as its primary lookup and `order_number` equality
only as a defensive fallback. Live-database reality: `orders` and `quotes`
both have **0 rows** right now — no quote has ever been sent, so this
automation currently has nothing to act on for any existing job, which is
correct given the data, not a bug. A job with neither link (e.g. a direct
FlashDraft admin test send) logs via `console.error` and is skipped —
marking the shop job complete always succeeds regardless.

**Delivery date (step 3):** traced the real mechanism Track Delivery
actually reads — `orders.delivery_scheduled_at` / `.delivery_window`
(`app/api/track/verify/route.ts`), already written today by the Command
Center CRM's `[Set Delivery Date]` control
(`app/api/admin/orders/[id]/crm/route.ts`) and by
`app/api/pickup/schedule/route.ts`. `SPEC_DELIVERY_SCHEDULER.md`'s own
`POST /api/delivery/schedule` API does not exist in the codebase (its
scheduling inputs are explicitly BLOCKED, checklist #84/85/80–82) — used the
real, already-shipped column instead of inventing a new one.

**Invoice email + tracking link (step 4):** `sendInvoiceEmail()`
(`lib/utils/invoice-email.ts`) gained an optional `trackingUrl` second
parameter, rendered via the same `ctaButton()` the dispatch route's email
already uses. Additive only — the dispatch route's and
`/api/invoices/[id]/send`'s existing calls pass nothing and are byte-for-
byte unchanged.

**Confirmed untouched, per the prompt's hard constraint:** `app/api/checkout/`,
`app/api/webhooks/stripe/route.ts`, `orders.status`, and dispatch SMS —
checked the diff directly before committing.

**End-to-end verification, real function against the real live database:**
wrote a throwaway `tsx` script (not committed — deleted immediately after)
that created a real `quote_requests` -> `quotes` -> `orders` fixture chain
in the live project (reusing the existing `hem-e2e-admin@afs-internal.test`
profile as `user_id`, this codebase's established e2e-fixture convention)
and a linked `shop_profile_library` row, then imported and called the
actual `runShopJobCompletionAutomation()` export — not a reimplementation.
It correctly resolved the order via the `quote_request_id` chain, set
`orders.delivery_scheduled_at`, wrote the expected `admin_audit_log` row,
and called `sendInvoiceEmail()`, which failed gracefully with `"Resend is
not configured"` (pre-existing CLAUDE.md data blocker — no `RESEND_API_KEY`
in this environment, not a defect introduced here) and logged that to
`notifications` exactly like every other Resend call site. Separately
verified the "no matching order" path logs and returns without throwing.
All fixtures were deleted after the run and re-verified gone. `pnpm tsc
--noEmit` and `pnpm build` both clean.

**Not confirmed:** no browser click-through of either "Mark Complete"
surface against a real order — the live database has no real order to
complete against yet (see above), so that isn't possible in this
environment regardless of code correctness. Held IMPLEMENTED, UNCONFIRMED.

**Also corrected while in these files:** `app/api/field/shop/[id]/complete/
route.ts`'s header comment claimed migration 020 (`completion_events`) was
"FILE ONLY, not yet applied live" — stale; it's confirmed applied live (see
afs-fl-003/afs-fl-005 entries below and the live query in this pass).
Updated that comment and `020_completion_events.sql`'s own header to match.

---

## COMMAND CENTER APPROVAL: GEOMETRY SUMMARY RESTORED TO SHOP-FLOOR ACCOUNT NOTES (afs-fl-015) — 2026-08-26

Root-cause fix, no workaround, for a side effect afs-fl-012 (below) flagged
but deliberately left unfixed, now confirmed by Reid as needing a real fix.
afs-fl-012 correctly narrowed `quote_requests.notes` to customer-typed text
only, moving the auto-generated bend/leg/radius/hem readout onto each line
item's own `geometrySummary` field. But
`app/api/admin/command-center/approve-quote-request/route.ts` still copied
`qr.notes` verbatim into `machine_jobs.notes` (read by the external
`afs-machine-bridge` project) and `shop_profile_library.account_notes`
(rendered by `ShopViewBoard.tsx`'s "Account Notes"). With the geometry
readout no longer in `qr.notes`, both stopped showing it for any
newly-approved FlashDraft request.

**Changes:**
1. `approve-quote-request/route.ts`'s `QuoteRequestLineItem` gained the
   matching `geometrySummary?: string | null` field (already present in
   `quote_requests.line_items` since afs-fl-012, just not typed/read here).
2. New `composeShopFloorNotes(customerNotes, geometrySummary)` joins the
   two with a `\n\n` separator — same convention as
   `app/api/contact/route.ts`'s `descriptionLines` and
   `app/api/consultation/request/route.ts`'s `noteLines`. Used for both the
   `machine_jobs.notes` insert and the `shop_profile_library.account_notes`
   insert, called once per line item (this route already writes one row of
   each per line item, so each row naturally gets only its own item's
   geometry rather than every item's geometry mixed together — that's the
   "one per item, clearly delimited" handling for multi-item requests).
3. `field_photo_quote` items never carry `geometrySummary` (not FlashDraft
   profiles) — `composeShopFloorNotes` falls through to customer notes only
   for them, unchanged from before this fix.
4. `ShopViewBoard.tsx`'s "Account Notes" `<p>` gained `whitespace-pre-line`
   — without it the `\n\n` collapses to a single space in rendered HTML and
   the two parts wouldn't actually appear separated. Matches
   `PendingQuoteRequestCard.tsx`'s "Customer Notes" block, which already
   uses this class for the same reason.

**Verified this pass:** `pnpm tsc --noEmit` — 0 errors.

**Not yet confirmed — needs Reid's live check:** a fresh FlashDraft
submission, once approved and sent to the machine, showing BOTH the
customer's typed note AND the bend/geometry summary in Shop View's Account
Notes, clearly separated — and that a field-photo-quote submission's
Account Notes is unaffected (customer text only, as before). As of
afs-fl-012's pass, no live `quote_requests` row with
`source_tool = 'afs-flashdraft'` existed in the database yet — not
re-checked this pass.

---

## FLASHDRAFT: REAL CUSTOMER-SELECTED PAINT COLOR, EARLY 2D PAINT-FACE DECISION, PLACEHOLDER ANODIZED COLOR CHART (afs-fl-013) — 2026-08-26

**⚠ Ships a short-lived PLACEHOLDER anodized aluminum color chart — see
item 1. Reid expects to replace it within days with PAC-CLAD's real vector
chart. Do not treat as production-final color data.**

Root-cause fix, no workaround, for two real gaps in FlashDraft's
paint-face confirmation flow: (1) `approxPaintColor()` derived a color from
the material NAME via regex, never from the customer's actual selected
color; (2) `isPaintedMaterial()`'s regex never matched anodized aluminum,
so it never triggered the paint-face flow at all despite anodizing being a
one-face coating exactly like Kynar.

**Changes:**
1. `lib/data/metal-colors.ts` — populated the previously-empty
   `pacclad_anodized` array with 9 `{ name, hex }` entries (Brite Clear,
   Clear Satin, Brite Brushed Clear, Brite Gold, Gold Satin, Brite Brushed
   Gold, Dark Bronze, LA Extra Bronze, Black). **PLACEHOLDER data**,
   pixel-averaged from a PAC-CLAD reference PDF on 2026-08-26 — the array's
   own comment flags it for replacement within days. Confirmed by tracing
   `colorPaletteForMaterial()` that this alone flips `FinishColorField.tsx`
   from its free-text fallback to a real `ColorField`/`ColorPickerModal`
   picker — no changes were needed in that component, matching what its own
   FUTURE-SWAP HOOK comment predicted.
2. `lib/utils/paint-appearance.ts` — `isPaintedMaterial()` now delegates to
   `materialRequiresColorValue()` (`lib/data/material-color-requirement.ts`)
   instead of its own `/kynar|painted|vintage/i` regex — the same
   painted_steel/aluminum category check `app/studio/draft/page.tsx`
   already uses, so anodized aluminum (any finish) now correctly triggers
   the paint-face flow, and there's one source of truth instead of two.
3. `lib/utils/paint-appearance.ts` — new `resolveSelectedPaintColor(material,
   color)` replaces `approxPaintColor(material)` (deleted, no remaining
   callers). Looks up the customer's real selected name via
   `findMetalColorByName()` — the same colorMatch-by-name lookup
   `ShopViewBoard.tsx` uses for `row.color` — falling back to catalog.ts's
   "Custom Color Match" placeholder hex for a free-text/unmatched name.
   **Deviated from the prompt's literal instruction to look up painted_steel
   colors in catalog.ts's `FINISHES` array** — traced `app/studio/draft/page.tsx`
   and confirmed it never imports `FINISHES`; its painted_steel color field
   is `<ColorField palette="mcelroy">`, so real selections are McElroy names
   that don't exist in `FINISHES` at all. Looking them up there would always
   miss and silently fall back to the placeholder, reproducing the exact bug
   being fixed — so `findMetalColorByName` (mcelroy → pacclad →
   pacclad_anodized) was used instead, which is also the literal reuse
   target the prompt named. `SubmitConfirmation3DModal.tsx` and
   `MatchedProfile3DModal.tsx` both gained a `color: string` prop from
   `app/studio/draft/page.tsx` to feed this.
4. `app/studio/draft/page.tsx` — new page-level `paintFace` state (was only
   local state inside `SubmitConfirmation3DModal`, resetting every open). A
   new 2D sidebar toggle + real resolved-hex swatch chip appears as soon as
   `isPaintedMaterial(material) && color.trim() !== ''`, not only at final
   3D submit confirmation. `SubmitConfirmation3DModal` gained a required
   `initialPaintFace` prop seeding its internal toggle instead of a
   hardcoded `'up'`; `handle3DConfirmed` writes the confirmed face back to
   the page-level state so both directions stay in sync.
5. `app/studio/draft/page.tsx` — the canvas draw effect now strokes a
   colored stripe alongside the profile line (averaged-normal miter offset,
   sign flipped by `paintFace`, mirroring `ProfileViewer3D.tsx`'s
   `offsetPolyline` outer/inner convention) using the real resolved hex as
   a raw `ctx.strokeStyle` — the same documented canvas-color-exception
   (CLAUDE.md rule #4) this file already relies on for `CANVAS_COLORS`.

**Verified this pass:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` —
succeeded.

**Not yet confirmed — needs Reid's live check:** (a) `FinishColorField.tsx`
actually rendering a real color picker for Anodized Aluminum in the running
app (traced correct by code inspection only); (b) a fresh FlashDraft draw
with a real Kynar/McElroy color and a separate one with a real (placeholder)
anodized color, confirming the true selected swatch appears in the 2D
sidebar, the 2D canvas stripe, and the 3D confirmation modal — not a generic
guess; (c) the 2D sidebar's up/down choice correctly seeding the 3D modal's
starting state instead of resetting to 'up'; (d) that the canvas stripe
actually reads as useful once seen against a real drawn profile.

---

## FLASHDRAFT: CUSTOMER NOTES SEPARATED FROM AUTO-GENERATED BEND/GEOMETRY SUMMARY (afs-fl-012) — 2026-08-26

Root-cause fix, no workaround. `submitQuoteRequest` in
`app/studio/draft/page.tsx` was sending `notes: [buildBendSummary(),
notes.trim() || null].filter(Boolean).join('\n\n')` — the auto-generated
leg/angle/radius/hem readout always went first, and with blank customer
notes, `quote_requests.notes` held *only* that readout. On Command Center's
Pending Approval card this looked like customer notes never populate.
`buildBendSummary()`'s calculation logic was not touched — only where its
output is transmitted and displayed.

**Changes:**
1. `app/studio/draft/page.tsx` — `notes: notes.trim() || null` now (matches
   `app/api/field/quote-request/route.ts`'s existing pattern). Line item
   gained `geometrySummary: buildBendSummary()`.
2. `app/api/quote-requests/route.ts` — `QuoteRequestItemInput` gained
   documented optional `geometrySummary?: string | null`. No storage-layer
   change was actually required: `items = rawItems.filter(isValidItem)`
   never reconstructs the item object, so extra fields already passed
   through to `line_items` untouched — this is a type-safety addition
   matching the file's existing convention, not new plumbing.
3. `lib/data/pending-quote-requests.ts` — `PendingQuoteRequestLineItem`
   gained `geometrySummary`. `describeLineItem` now returns a new
   `LineItemDescription { label, geometrySummary }` shape instead of a bare
   string; `PendingQuoteRequestRow.lineItemDescriptions` is now
   `LineItemDescription[]`. `PendingQuoteRequestCard.tsx` renders `label` as
   before plus a dimmed, visually distinct `<p>` block for `geometrySummary`
   when present — not concatenated into the label line.
   `app/admin/command-center/page.tsx`'s `QueueItem` mapping updated to
   `r.lineItemDescriptions[0]?.label`.
4. **Traced other consumers of `quote_requests.notes` before touching
   anything — found two, deliberately left unchanged, flagged instead of
   guessed:**
   - `approve-quote-request/route.ts` copies `qr.notes` into
     `machine_jobs.notes`, which `app/api/machine-bridge/pending-jobs/route.ts`
     exposes to the separate `afs-machine-bridge` project.
   - The same route also copies `qr.notes` into
     `shop_profile_library.account_notes`, rendered on the shop floor by
     `ShopViewBoard.tsx` under "Account Notes."
   - Both will stop receiving the bend/geometry readout in newly-approved
     requests' notes text (the real structured bend data still reaches
     `machine_jobs.custom_bends`/`blank_width_mm` independently — this is
     just the human-readable text). **If Reid relies on seeing the geometry
     readout there, that's a real follow-up** (e.g. read `geometrySummary`
     off the item instead of `qr.notes`) — not assumed either way here.
5. **`sendToPathfinder()` (temporary admin test button) — checked, already
   correct, no change made.** It already sends `notes: notes.trim() ||
   null` and never calls `buildBendSummary()`; geometry goes to
   PathfinderEdge as separate structured fields (`points`/`hemStart`/
   `hemEnd`), not folded into notes text.

**Verified this pass:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` —
succeeded.

**Not yet confirmed — needs Reid's live check once deployed:** queried this
project's live Supabase instance directly (not the org's other, unrelated
Supabase projects visible through the connected MCP) — **zero
`quote_requests` rows exist with `source_tool = 'afs-flashdraft'`** (35 total
rows: 26 `unknown`, 9 `field_photo_quote`). A fresh FlashDraft submission
with real typed notes is required: confirm Customer Notes on the Pending
Approval card shows only the typed text, and the bend/leg/radius/hem summary
renders separately under "Requested Profiles," not commingled or lost.

---

## COMMAND CENTER PENDING APPROVAL — THUMBNAIL, CAPTURE-TIME ORIENTATION FIX, CANCEL (afs-fl-011) — 2026-08-25

Three root-cause fixes to the Pending Approval workflow, no workarounds.

**1. Inline photo thumbnail.** `getPendingQuoteRequests`
(`lib/data/pending-quote-requests.ts`) now selects `upload_id`, batches a
`takeoff_uploads` join by upload_id, and mints a 900-second signed URL via
the service-role admin client — same pattern already used by the
quote-request detail view (afs-fl-008). `QuoteRequestAttachmentCard.tsx`'s
`IMAGE_EXTENSIONS` constant is now exported and reused rather than
redefined. `PendingQuoteRequestCard.tsx` renders a real clickable
thumbnail (image types) with click-through to full resolution via the
existing `ImageLightbox`, or a download link (non-image types) — same
fallback `QuoteRequestAttachmentCard` already uses. Traced the call site:
`app/admin/command-center/page.tsx` calls `getPendingQuoteRequests(supabase)`
and passes the rows straight to `PendingQuoteRequestCard` via
`CommandCenterDashboard`'s pending tab — data flows through with no
intermediate transform to break.

**2. Photo orientation at capture time.**
`ContractorCameraQuoteForm.tsx` previously uploaded the raw camera `File`
unmodified. New `correctPhotoOrientation` decodes with
`createImageBitmap(file, { imageOrientation: 'from-image' })`, draws to a
canvas at the corrected natural width/height, and re-encodes via
`canvas.toBlob` — baking the correction into pixels rather than trusting
downstream EXIF handling. The corrected file drives both the pre-submit
preview and the actual upload. Falls back to the original file on any
failure so the golden path can't be blocked.
**Does not fix already-uploaded sideways photos** — `AFS-QR-2026-00029`
and `AFS-QR-2026-00030` stay stored sideways; this only affects captures
made after deploy.

**3. Soft-delete (cancel).** New
`app/api/admin/command-center/cancel-quote-request/route.ts`, same
admin-auth shape as `approve-quote-request`/`reject`: sets
`quote_requests.status = 'cancelled'` via the admin client. `'cancelled'`
was already valid under the existing CHECK constraint
(`001_initial_schema.sql:438`) — no migration. `PendingQuoteRequestCard.tsx`
gained a trash-can button (top-right, near the RUSH/source badges) with an
inline confirm step (no modal, matching this component's existing style),
then `router.refresh()` on success. `getPendingQuoteRequests`'s existing
`.eq('status', 'submitted')` filter means a cancelled row just disappears
from Pending Approval on refresh — no query change needed.

**Verified this pass:** `pnpm tsc --noEmit` — 0 errors. `pnpm build` —
succeeded, new route confirmed in the route table.

**Not yet confirmed — needs Reid's live check once deployed:**
- A real thumbnail rendering and opening at full resolution on an actual
  Pending Approval card. **Request `AFS-QR-2026-00027` and
  `AFS-QR-2026-00029` are the known existing requests with real photos** —
  test against those.
- Clicking Cancel on a real pending card and confirming it disappears from
  Pending Approval after `router.refresh()`.
- `AFS-QR-2026-00029`/`00030` (known sideways-photo cases) are useful for
  confirming fix #2 correctly leaves already-stored photos untouched.

---

## ROOT + FIELD PWA INSTALL ICONS/MANIFESTS (afs-fl-010) — 2026-08-25

Root site (`/`) had zero install capability before this pass — no
`app/manifest.ts`, no `public/manifest.json`, no favicon/apple-touch-icon
anywhere in the repo (the only existing manifest was
`public/employee-manifest.json`, `/employee`, afs-sv-era, untouched here).
`/field/contractor` and `/field/shop` had no manifest either — new
capability on all three routes, not a fix to something broken.

Confirmed `public/afs-logo-512.png` (the site-wide mark) has true alpha
transparency by hand-decoding the PNG (1024x1024, 8-bit RGBA, colorType
6) — no image library in this project, so this followed the existing
`scripts/generate-employee-icons.js` hand-rolled-PNG precedent. New
`scripts/generate-pwa-icons.js` extends that pattern with a PNG decoder
and a minimal multi-image `.ico` encoder, crops to the mark's bounding
box, and composites onto each target size with 4x4 supersampling,
alpha-blending against a solid RGB baked into every output pixel — not
left to OS/browser default fill, which is what caused inconsistent
Android/iOS results previously.

Three independently scoped sets: **root** (RED `#C0001A`, wired in
`app/layout.tsx` via `metadata.manifest`/`metadata.icons` + a new
`viewport.themeColor` export), **AFS Field** (BLACK `#000000`, scope
`/field/contractor`, wired via a `metadata` export added directly to
`app/field/contractor/page.tsx` — afs-fl-007's anonymous no-auth access
untouched, only a sibling export was added above the existing component),
**AFS Shop** (WHITE `#FFFFFF`, scope `/field/shop`, same pattern in
`app/field/shop/page.tsx` — `requireFieldRole(['admin'])` still gates the
route, unchanged). `app/field/layout.tsx` exports no `manifest` of its
own, confirmed by reading it, so neither field page can leak into the
other or inherit a shared one.

**Verified this pass:** `pnpm tsc --noEmit` 0 errors. Read every
generated 512px icon back as an image and visually confirmed red/black/
white are actually baked into the pixels, not guessed at, and clearly
distinguishable from each other; spot-checked 192px and 180px sizes too.
Did not run `pnpm build` this pass.

**Not confirmed — hold as unresolved per this file's verification
standard:** no real-device install has been checked. Adding this to a
home screen on Android and iOS and confirming (a) correct name/icon per
route, (b) red/black/white actually render instead of a default fill —
the specific failure this work targets, and (c) `/field/contractor`'s
installed shortcut still opens with no login prompt, all remain open
until Reid checks them on real devices.

---

## QUOTE-REQUEST ATTACHMENT VIEWER, COMMAND CENTER (afs-fl-008) — 2026-08-25

**Genuine pre-existing gap, discovered during field-app testing — not a
regression from this week's work.** The Command Center quote-request
detail view has never surfaced `quote_requests.upload_id`, for either
flow that can set it: the original Blueprint Takeoff upload and the
newer field_photo_quote flow (afs-fl-002/007). It only surfaced now
because field_photo_quote submissions are upload-only with no line
items to fall back on, but the same gap has existed for Blueprint
Takeoff since it shipped.

Added `upload_id` to the detail page's `quote_requests` select
(`app/admin/quote-requests/[id]/page.tsx`); when set, joins
`takeoff_uploads` and mints a signed URL via the service-role admin
client — same pattern as `getOrderAttachments` (`lib/data/orders.ts:618`)
and `getGbpPhotos` (`lib/data/command-center-crm.ts:258`), 900-second
TTL, full original resolution, no thumbnail generated. Bucket is derived
from `storage_key`'s first path segment rather than stored separately,
matching both upload routes' existing key conventions. New
`components/admin/QuoteRequestAttachmentCard.tsx` renders a clickable
thumbnail for image attachments (falls back to a download link for
Blueprint Takeoff's non-image extensions — `.pdf`/`.dwg`/`.dxf`). New
`components/ui/ImageLightbox.tsx` is a full-viewport zoomable/pannable
viewer — checked the codebase first and found no existing full-screen
image viewer to reuse; `components/ui/Modal.tsx` is a small fixed-size
dialog and deliberately wasn't repurposed, since the whole point is
inspecting fine detail (hand-drawn dimensions, a damaged seam) that a
small modal would defeat.

**Verified this pass:** `pnpm tsc --noEmit` 0 errors. Tested the signed-
URL logic directly against the live Supabase project: exactly one
`quote_requests` row has a non-null `upload_id` (`AFS-QR-2026-00027`,
field_photo_quote) — no Blueprint Takeoff row has one yet, so that path
has code coverage but no live data to exercise it against (flagged, not
silently assumed fine). Derived its bucket, minted a signed URL the same
way the new code does, fetched it directly: `200`, `image/jpeg`,
1,254,905 bytes — full original resolution. Then a real Playwright
session (cookie-based login as the live admin account) opened that
request's detail page: thumbnail rendered, click opened the lightbox
full-viewport with zero console errors, the sketch's hand-written labels
were legible at 100%, and zooming to 205% made individual pen strokes
inspectable — the ~8.8x bounding-box jump between those two scales (not
2.05x) confirms the image actually renders at native intrinsic
resolution once zoomed rather than a clamped/downscaled copy. Close
button removed the overlay cleanly.

---

## /field/contractor ROLE-GATE REMOVAL — ANONYMOUS GUEST ACCESS (afs-fl-007) — 2026-08-24

Fixed a spec mismatch, not a regression: afs-fl-001 gated `/field/contractor`
behind `role IN ('contractor','admin')` — a pre-assigned AFS account.
`SPEC_PHOTO_TO_QUOTE_AI.md` specifies this flow for anonymous field
contractors/superintendents with **no AFS account**, the same guest-access
pattern already live on `/upload`. Removed the gate from
`middleware.ts` (dropped `isFieldContractorRoute`, only `/field/shop` is
still checked), `app/field/contractor/page.tsx` (no longer calls
`requireFieldRole`), `app/api/field/photo-upload/route.ts`, and
`app/api/field/quote-request/route.ts` (both now `userId = user?.id ?? null`
matching `app/api/upload/route.ts`'s / `app/api/quote-requests/route.ts`'s
existing guest pattern exactly — `guestEmail` + `EMAIL_PATTERN` required only
when signed out, `user_id`/`guest_email` written accordingly).
`ContractorCameraQuoteForm.tsx` got the same `isAuthenticated` +
`showEmailCapture` two-step submit `app/upload/page.tsx` already uses.
`/field/shop`'s admin-only gate and `lib/field/auth.ts`'s `requireFieldRole`
itself are unchanged (still used, unmodified, by `/field/shop`) — only their
comments were updated to stop describing `/field/contractor` as gated.

Did NOT touch `/field/page.tsx` — it does not exist in this codebase (no
`app/field/page.tsx` file), so there was no root-redirect logic to preserve
or accidentally change.

**Verified this pass:** `pnpm tsc --noEmit` 0 errors, `pnpm build` clean
(`/field/contractor` now builds static). Against a real running `pnpm dev`
instance with zero cookies sent (curl, simulating incognito): `GET
/field/contractor` → `200` with the camera-capture UI in the initial HTML,
no redirect anywhere. `POST /api/field/quote-request` with no auth/no email
→ `400`; with no auth + a valid `guestEmail` → `200`, and the resulting
`quote_requests` row was read back directly from the live Supabase project
(`user_id: null`, `guest_email` set, `source_tool: 'field_photo_quote'`,
`status: 'submitted'`) confirming it matches exactly what
`lib/data/pending-quote-requests.ts`'s Command Center query selects, then
deleted (test data). Full photo-attach path (upload -> Storage ->
`quote_requests.upload_id`) could NOT be end-to-end verified: the live
project's Storage has only a `blueprints` bucket, and `documents` (which
`/api/field/photo-upload` targets) does not exist there —
`StorageApiError: The related resource does not exist`, a pre-existing gap
independent of this fix (would 500 for a legitimate authenticated
contractor too, since that upload code path is unchanged). Flagged to Reid
in STATE_OF_THE_BUILD.md rather than fixed here — creating a bucket in the
live project is out of scope for a role-gate bug fix.

---

## MONDAY INTEGRATION HANDOFF DOC (afs-fl-005) — 2026-08-24

Wrote `AFS_FIELD_INTEGRATION_TODO.md` at the project root — a handoff doc
for Reid covering the five real integration gaps left after afs-fl-000
through afs-fl-004 (contractor/shop field flows). Every item was sourced by
re-reading the actual code, not reconstructed from memory: (1) Resend
API key + sender domain needed before `app/api/field/shop/[id]/complete/
route.ts`'s `POST` handler can flip `completion_events.email_sent` from its
default `false`; (2) delivery-scheduling logic for `completion_events.
delivery_scheduled` is flagged as a genuinely open question for Reid — what
input should drive it and where that logic should live is not decided or
guessed at; (3) confirmed an approved quote's dollar amount **is** queryable
from this system, via `completion_events.shop_profile_library_id` →
`shop_profile_library.quote_request_id` → `quote_requests.quote_id` →
`quotes.total` — NOT via `shop_profile_library.order_number`, which is
never populated on this insert path; (4) Twilio SMS noted as optional with
no existing stub — nothing to point to yet; (5) Google Business Profile
clarified as already fully wired end-to-end for afs-fl-004's delivery-photo
button (reuses the exact same `gbp_photo_queue` pipeline the Employee PWA
uses) — the only remaining GBP work is provisioning real OAuth
credentials/building the `/admin/settings/integrations` flow, per
`lib/integrations/google-business.ts`'s own DEVIATION FLAGGED (d-007)
comment, shared with (not duplicated from) the Employee PWA's existing GBP
posting. Also lists migrations 020 and 021 as still pending manual
Dashboard application, in apply order, and notes neither needs elevated
review — neither alters `profiles` or any table this codebase's security
model depends on. No application code was touched in this prompt.

**UPDATE 2026-08-24: migrations 020 and 021 are now CONFIRMED APPLIED
LIVE** — independently verified via a direct `information_schema` query,
two `true` results, covering `completion_events` (020) and
`gbp_photo_queue.shop_profile_library_id` (021). See the updated afs-fl-004
and afs-fl-003 entries below for the full detail. No session has had a
working Supabase MCP connection to this project's actual instance to run
that check itself.

---

## DELIVERY PHOTO CAPTURE AT /field/shop (afs-fl-004) — 2026-08-24

Added a "Delivery Photo" button to `components/field/
ShopJobCompletionList.tsx`'s job cards, deliberately separate and
independent from afs-fl-003's "Mark Complete" button — separate React
state (`DeliveryPhotoCapture` owns its own upload/queue state internally),
so a job can get a delivery photo without being marked complete, and vice
versa.

**Read directly before writing anything, per the prompt's own instruction
— not assumed from the prompt's description:** `lib/integrations/google-
business.ts`, `app/api/gbp/queue/route.ts`, `app/api/gbp/post/[id]/
route.ts`, `components/employee/EmployeePhotoUploader.tsx`, `app/employee/
photos/page.tsx`, and `gbp_photo_queue`'s table definition + RLS notes in
`SCHEMA.md` (source: `007_delivery_tracking.sql`). Confirmed this is a
real, fully wired, already-in-production queue-review-post pipeline, not
scaffolding: camera upload -> `gbp-photos` Storage bucket -> `POST
/api/gbp/queue` inserts a `gbp_photo_queue` row (`status: 'pending_
review'`) -> the existing `/employee/photos` review step flips it to
`approved`/`rejected` -> `POST /api/gbp/post/[id]` calls `postPhotoToGbp()`,
a real Google My Business API v4 `POST` to `mybusiness.googleapis.com`,
gated on `isGbpConfigured()` (checks `GOOGLE_BUSINESS_CLIENT_ID`/`SECRET`/
`LOCATION_ID`) and the separately-checked, manually-provisioned
`GOOGLE_BUSINESS_ACCESS_TOKEN` env var. Per CLAUDE.md's DATA BLOCKERS
section, GBP API access has not been granted — none of these env vars are
set, so `isGbpConfigured()` returns `false` today and no live post can
happen regardless of what this prompt builds.

**Did NOT create a new `delivery_photos` table** — would have duplicated
`gbp_photo_queue`. Instead extended it with exactly one new nullable
column so a field-captured photo can be tied back to the job it belongs to.

**New migration — `021_gbp_photo_queue_shop_job_link.sql`. CONFIRMED
APPLIED LIVE 2026-08-24**, independently verified via a direct
`information_schema` query (`true`, alongside migration 020's own `true` —
see the afs-fl-005 UPDATE note above). Originally FILE ONLY: confirmed
`020_completion_events.sql` (afs-fl-003) is the highest-numbered
migration file on disk before numbering this one `021` — not assumed from
the prompt's "likely 020... verify, don't assume" framing. Adds:
```sql
ALTER TABLE gbp_photo_queue
  ADD COLUMN shop_profile_library_id UUID REFERENCES shop_profile_library(id);
```
plus a supporting `idx_gbp_photo_queue_shop_profile_library_id` index.
Purely additive/backward-compatible — every existing Employee PWA row
leaves this column `NULL`, unaffected. No RLS policy change: `gbp_photo_
queue`'s existing operator/admin INSERT-own-row (`queued_by = auth.uid()`)
and SELECT/UPDATE-all-rows policies (007_delivery_tracking.sql) already
cover this new insert path, since `/field/shop` shop staff use the
existing `'admin'` role — same precedent afs-fl-001 already established
for `shop_profile_library` itself, no new role introduced. **CONFIRMED
APPLIED LIVE 2026-08-24** — see the UPDATE note above.

**New component — `components/field/DeliveryPhotoCapture.tsx`:** hidden
file input, `accept="image/*"` + `capture="environment"` — same camera-
capture pattern afs-fl-002's `ContractorCameraQuoteForm.tsx` already uses.
On file select: uploads directly to the existing `'gbp-photos'` Storage
bucket using the operator's own session — this is `EmployeePhotoUploader.
tsx`'s `handleQueue()` upload mechanism mirrored exactly (`supabase.
storage.from('gbp-photos').upload(storageKey, file, { contentType:
file.type || 'image/jpeg' })`, same `${user.id}/${crypto.randomUUID()}.
${ext}` storage-key shape), not a new upload path. Then calls the EXISTING
`POST /api/gbp/queue` route (not a parallel admin-client insert — this was
a clean fit) with `{ storageKey, shopProfileLibraryId: job.id }`. No
separate review UI is built — the row lands in the SAME queue Steve/admin
already reviews at `/employee/photos`.

**`app/api/gbp/queue/route.ts` extended, not duplicated:** added one
optional `shopProfileLibraryId` field to the existing request body,
written through to the new `gbp_photo_queue.shop_profile_library_id`
column on insert (`null` if omitted/blank). `queued_by` and `status:
'pending_review'` are unchanged — same `auth.userId` and existing column
default as before. `EmployeePhotoUploader.tsx`'s own call site never sends
this field, so its behavior and resulting rows are unaffected.

**`postPhotoToGbp()` / the live Google API is never called from this new
button or any new code in this prompt.** Posting stays gated behind
exactly the same review-then-post flow that already exists in production
— this prompt adds a second way to QUEUE a photo into that pipeline, not a
second way to POST one.

**Confirmation text — exact literal from the prompt, not paraphrased:**
"Photo saved and added to the Google Business Profile review queue. Will
post once reviewed and API access is approved." — shown per job, replacing
the Delivery Photo button, once `POST /api/gbp/queue` resolves
successfully.

`pnpm tsc --noEmit`: 0 errors.

Committed: "feat: delivery photo capture on /field/shop reuses existing
gbp_photo_queue pipeline via new nullable shop_profile_library_id column
(afs-fl-004)".

**Status: IMPLEMENTED, UNCONFIRMED.** Migration 021 is now CONFIRMED
APPLIED LIVE (see above), so this feature's data path is queryable live.
Still pending Reid's own browser verification of a real photo capture at
`/field/shop` (as an admin/shop-staff account) landing as a new row in the
SAME `/employee/photos` review queue used by Employee PWA photos today,
with `shop_profile_library_id` populated to the correct job.

---

## SHOP-FLOOR JOB COMPLETION FLOW (afs-fl-003) — 2026-08-24

Replaced the disabled placeholder at `app/field/shop/page.tsx` (afs-fl-000)
with the real flow: a read-only job queue, each job with one large "Mark
Complete" button, no other controls.

**Read query — reused the existing style, not a new shape:** added
`getFieldShopQueue()` to `lib/data/shop-profile-library.ts`, sitting next to
`getShopProfileLibrary()`/`getShopProfileLibraryFull()` and following their
exact pattern (comma-joined `.select()` string, typed raw-row intermediate,
explicit `?? ` fallbacks in the map). Filters `deleted_at IS NULL` (same as
every other reader of this table) and `status != 'complete'` (a completed
job has no action left to take — same filter `ShopViewBoard.tsx`'s own
`activeRows` already applies), then sorts client-side with the existing
`compareShopProfileLibraryQueueOrder`, the same ordering Shop View and
Profile Library both already use.

**Status literal — grepped `components/admin/ShopViewBoard.tsx` directly
before writing anything, not assumed:** the literal is `'complete'`, not
`'completed'` (confirmed at lines 91, 122, 267, 305 — `SHOP_PROFILE_LIBRARY_
STATUSES` in `lib/data/shop-profile-library.ts` is the actual source of
truth: `['queued', 'in_progress', 'complete']`). The new completion route
writes this exact literal.

**New route — `app/api/field/shop/[id]/complete/route.ts` (POST):**
gated inline (`profiles.select('role') === 'admin'`, same pattern every
other `/api/field/**` and `/api/admin/**` route already uses — `middleware.
ts` doesn't cover `/api/field/**`). Rejects an already-`'complete'` row with
`409` (double-tap guard — this is a real button on a mobile screen). Then
two writes, in this order, not a single Postgres transaction (the Supabase
JS client doesn't expose multi-statement transactions across two `.from()`
calls, so a literal transaction wasn't a clean fit — matches this route's
own prompt-specified fallback):
1. `shop_profile_library` `UPDATE status = 'complete', completed_at = now()`
   — same combined status+completed_at write `app/api/admin/profile-
   library/[id]/route.ts`'s PATCH handler already does for this exact
   transition (afs-cv-004).
2. `completion_events` `INSERT` (new table, migration 020 below) —
   `shop_profile_library_id`, `order_number` (copied from the row), and the
   same `completed_at` timestamp as write 1. `status`/`delivery_scheduled`/
   `invoice_generated`/`email_sent` are left to their column defaults
   (`'pending_integration'`/`false`/`false`/`false`).

**Write-ordering failure mode, handled explicitly per the prompt's own
instruction:** if write 2 fails after write 1 already succeeded, the route
does **not** roll back write 1 (the shop-floor job really is done) and does
**not** silently swallow the failure — it returns a `500` with `error:
'Job was marked complete, but the completion record failed to save. Tell an
admin — this must be fixed manually.'` plus the `completedAt` timestamp, and
`console.error`s the raw Supabase error for follow-up. The client
(`components/field/ShopJobCompletionList.tsx`) surfaces that exact message
inline on the job card rather than showing the success text.

**No external API calls anywhere in this prompt.** No Resend, no Twilio, no
PathfinderEdge. The UI's post-completion text is the literal string the
prompt specified, verbatim, not paraphrased: "Job marked complete. Delivery
scheduling, invoice, and customer email will be sent automatically once
integration is finalized." — shown per-job, replacing that job's button,
once its own `POST` resolves `ok: true`.

**No new RLS policy needed on `shop_profile_library`** — confirmed per
afs-fl-001's own entry below: `admin_all_shop_profile_library` already
covers read + update, since shop staff use the existing `'admin'` role.

**New migration — `020_completion_events.sql`. CONFIRMED APPLIED LIVE
2026-08-24**, independently verified via a direct `information_schema`
query (`true`, alongside migration 021's own `true` — see the afs-fl-005
UPDATE note above). Originally FILE ONLY: confirmed 019 is
still the highest file on disk and is CONFIRMED APPLIED LIVE (see the
afs-jf-004 entry below) before numbering this one 020, not assumed. Creates
`completion_events` (`id`, `shop_profile_library_id` FK ->
`shop_profile_library(id)`, `order_number`, `completed_at`, `status`
DEFAULT `'pending_integration'`, `delivery_scheduled`/`invoice_generated`/
`email_sent` all `BOOLEAN NOT NULL DEFAULT false`, `created_at`), RLS
enabled, one policy — `"admin_all_completion_events"`, `FOR ALL USING
(EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role =
'admin'))` — matching the exact `<scope>_<verb>_<table>` naming and
single-`FOR ALL`-policy shape `shop_profile_library`'s own
`admin_all_shop_profile_library` already uses (migration 016). **CONFIRMED
APPLIED LIVE 2026-08-24** — see the UPDATE note above.

`pnpm tsc --noEmit`: 0 errors. `pnpm run build`: clean, `/field/shop` listed
as a dynamic route, no collisions.

Committed: "feat: shop staff job completion flow at /field/shop, real
completion_events record, no fake success states (afs-fl-003)".

**Status: IMPLEMENTED, UNCONFIRMED.** Migration 020 is now CONFIRMED
APPLIED LIVE (see above), so this feature's data path is queryable live.
Still pending Reid's own browser verification of a real Mark Complete tap
on `/field/shop` as an admin account, plus a direct query confirming the
`completion_events` row actually persisted (`shop_profile_library_id`,
`order_number`, `completed_at` all populated; `status =
'pending_integration'`; all three booleans `false`).

---

## CONTRACTOR CAMERA-TO-QUOTE FLOW (afs-fl-002) — 2026-08-24

Replaced the disabled placeholder at `app/field/contractor/page.tsx`
(afs-fl-000) with the real flow: `components/field/
ContractorCameraQuoteForm.tsx` (client component) renders a camera-capture
`<input type="file" accept="image/*" capture="environment">` behind one big
button, then optional Business Name / Job Name / Client Name / PO Number /
Notes fields plus a Send button — two taps end to end (camera, then Send),
no intermediate required screen. The photo starts uploading in the
background the moment it's captured; if Send is tapped before that upload
finishes, `handleSubmit` just awaits the same promise rather than requiring
a third tap.

**Read SCHEMA.md's TABLE 15 directly before mapping fields** (migrations
018/019, both CONFIRMED APPLIED LIVE): Business Name -> `client_business_
name`, Job Name -> `job_name`, Client Name -> `client_name`, PO Number ->
`po_number`, Notes -> `notes`. `requested_by` (migration 018, retired dead
by migration 019 per that migration's own note) is never written by the
new insert route — confirmed by reading the route before considering this
done. `line_items` (NOT NULL) is inserted as an explicit `[]` — a photo-
only submission has no line items until an estimator adds them.

**Two new API routes**, both gated inline (contractor + admin only, same
`profiles.select('role')` check pattern `approve-quote-request/route.ts`
already uses for admin-only routes — middleware.ts's matcher doesn't cover
`/api/field/**`, so this inline check is the sole guard, consistent with
how every other `/api/admin/*` route already works):
- `app/api/field/photo-upload/route.ts` — signs a Storage upload URL
  (mechanics copied from `app/api/upload/route.ts`) and inserts a
  `takeoff_uploads` row with `status: 'pending'`.
- `app/api/field/quote-request/route.ts` — verifies the `uploadId` belongs
  to the calling user, flips its `takeoff_uploads.status` to `'uploaded'`,
  then inserts the `quote_requests` row with `source_tool:
  'field_photo_quote'` and `upload_id` set to that upload's id. Deliberately
  a new dedicated route rather than reusing `app/api/quote-requests/
  route.ts`, which hard-rejects zero-item submissions
  (`rawItems.length === 0` check) — a photo-only request always has zero
  items, and this route's job is exactly that case. No changes made to the
  shared route or its other callers.

**Photo storage decision (diverges from a literal "reuse takeoff_uploads +
blueprints" reading, documented per the prompt's own instruction to do so
if there's a real reason):** still uses the `takeoff_uploads` table and
still populates `quote_requests.upload_id` (confirmed by grep: no other
insert path in this codebase populates that column today — FlashDraft/
Configurator/Quote Builder/Takeoff all copy items straight into
`line_items` instead), so the existing FK relationship, RLS policies, and
signed-upload-URL security model are all reused as-is. The one change: the
file is signed into the **`documents`** Storage bucket (private, 100MB max,
already live for the Project Document Vault — see `app/api/documents/
upload/route.ts` — per SPEC_SUPABASE_INTEGRATION.md §2), not `blueprints`.
Reason: `blueprints` + `takeoff_uploads` is purpose-built for the AI
blueprint-extraction pipeline (`app/api/takeoff/route.ts`) — this flow
never calls that route (no AI extraction, by design: "no FlashDraft, no
drawing tool, no configurator"), so a field photo would leave
`result_items`/`confirmed_items`/`overall_confidence`/`processing_notes`/
`page_count` permanently null and its storage path would misleadingly read
`blueprints/...` for a file that was never a blueprint. `takeoff_uploads.
status` stays at `'pending'` until the quote-request route confirms the
upload and flips it to `'uploaded'` — it never advances further for these
rows (no `/api/takeoff` call), which is expected, not a stuck-processing
bug.

**Command Center reachability — verified by reading the code, not
assumed, no changes needed:**
- `lib/data/command-center-dashboard.ts` (`getRecentQuoteRequests`) and
  `lib/data/pending-quote-requests.ts` (`getPendingQuoteRequests`) both
  read `source_tool` as `r.source_tool ?? 'unknown'` with no CHECK
  constraint and no switch/case — confirmed no exhaustiveness break from
  adding a union member (grepped for `case 'afs-` and any switch on
  sourceTool: none exist). `sourceToolLabel()` (`lib/data/quote-request-
  source-tool.ts`) now recognizes `'field_photo_quote'` (added to both the
  `SourceTool` union and the `SOURCE_TOOL_LABEL` record — the latter is
  required, not optional, since it's typed `Record<SourceTool, string>`)
  and renders it as "Field Photo" rather than falling back to "Unknown".
- `app/api/admin/command-center/approve-quote-request/route.ts` (lines
  404-406) returns a clean `400 { error: 'Quote request has no line
  items.' }` when `qr.line_items` is empty — a `field_photo_quote` row
  displays in the Pending Approval queue without erroring; an admin simply
  can't approve it until line items are added (expected, out of scope
  here).
- Neither dashboard/queue query joins `takeoff_uploads`, so the attached
  photo itself isn't yet visible in the Command Center UI — only the row
  and its text fields are. Not asked for in this prompt.

`pnpm tsc --noEmit`: 0 errors.

Committed: "feat: contractor camera-to-quote flow at /field/contractor,
two-tap submit into quote_requests (afs-fl-002)".

**Status: IMPLEMENTED, UNCONFIRMED.** No browser/Playwright verification
run this session — mobile camera capture (`capture="environment"`) can't
be meaningfully exercised without a real phone. Pending Reid's own
end-to-end check: open `/field/contractor` on a phone as a contractor
account, tap the camera button, confirm the OS camera opens directly (not
a file picker), take a photo, optionally fill a field, tap Send, and
confirm a `quote_requests` row lands with the photo actually reachable via
`takeoff_uploads.storage_key` in the `documents` bucket.

---

## /field ROUTE ACCESS CONTROL (afs-fl-001) — 2026-08-24

Read `profiles.role`'s real CHECK constraint directly (migrations
`001_initial_schema.sql` and `007_delivery_tracking.sql`), not from any
prior session's summary, before touching anything. Confirmed: five allowed
values — `admin`, `contractor`, `architect`, `customer`, `operator`. Grepped
migrations 008–019 for any further alteration — none found. No migration
runs in this prompt; no new role is introduced.

`/field/contractor` and `/field/shop` now have a real server-side guard,
not a client-side redirect or a hidden nav link:
- `middleware.ts` — extended the existing `isAdminRoute` pattern with
  `isFieldContractorRoute`/`isFieldShopRoute`, reusing the same
  service-role `getUserRole()` helper already in the file. Unauthorized
  visitors (wrong role or signed out) are redirected to a new
  `/field/no-access` page, never to the field routes themselves.
- `lib/field/auth.ts` — new `requireFieldRole(supabase, allowedRoles)`,
  called from both page components (now async server components), matching
  `lib/admin/auth.ts`'s `requireAdminUser()` precedent of checking again at
  the page level in case middleware is ever bypassed.
- `/field/contractor`: `contractor` + `admin`. `/field/shop`: `admin` only.
  Decision recorded: admin is allowed at `/field/contractor` too, for
  oversight/testing — not a new privilege since admin already has standing
  access everywhere else.

**Verification actually run, not assumed:** started `pnpm dev` and issued
direct unauthenticated `curl` requests — `GET /field/shop` and
`GET /field/contractor` both returned `307` to `/field/no-access`;
`/field/no-access` itself returns `200`, no loop. This is the closest
exercisable stand-in for "a non-admin, non-contractor account" available in
this environment (no seeded architect/customer/operator test login exists
here) — it exercises the middleware layer for real; the page-level
`requireFieldRole()` layer was checked by code review only, not by an
authenticated wrong-role session.

RLS confirmed by reading the actual `CREATE POLICY` statements in the
migrations, not a prior summary:
- `quote_requests` already has `users_insert_requests` — any authenticated
  user can insert a request for themselves (`auth.uid() = user_id OR
  user_id IS NULL`). This is what afs-fl-002 needs later in this queue;
  coverage exists, no gap.
- `shop_profile_library` has exactly one policy —
  `admin_all_shop_profile_library`, admin-only `FOR ALL` — unchanged since
  migration 016, confirmed against 017–019 too. **No new RLS policy was
  written here.** Because `/field/shop` reuses the existing `admin` role
  instead of inventing one, this one policy already covers everything
  afs-fl-003 (reading + updating `shop_profile_library` rows) will need.
  This intentionally replaces an earlier, discarded design that would have
  added a new `shop_operator` role and a `profiles.role` constraint
  migration against a table this repo's own production code depends on —
  rejected specifically to avoid that risk; reusing `admin` sidesteps it
  entirely.

`pnpm tsc --noEmit` — 0 errors, run directly this session.

---

## /field MOBILE ROUTES SCAFFOLDED (afs-fl-000) — 2026-08-24

New build phase, opened by this prompt: mobile-first `/field/**` routes
inside this same repo (confirmed via `git status`/`git log` at session
start — same clean working tree, same `main` branch, no separate repo or
deploy involved) for two flows to be built in later, separately-numbered
prompts:
- `afs-fl-002` — contractor camera-to-quote (`/field/contractor`)
- `afs-fl-003` — shop-floor job completion (`/field/shop`)

This prompt (afs-fl-000) is scaffold only — both pages are disabled-button
placeholders, no data wiring, no auth gate. Confirmed `app/field` did not
already exist before creating anything (`test -d app/field`), reused
`lib/supabase/{client,server,admin}.ts` (no new client files — none of the
placeholder pages call Supabase yet, but the layout was built to sit
alongside the existing pattern, not a parallel one), and the existing
`afs-*` Tailwind tokens from `tailwind.config.js` (no new tokens, no
second Tailwind config).

One deliberate addition beyond the three files named in the prompt:
`components/layout/AppChrome.tsx`'s `PORTAL_PREFIXES` now includes
`/field`. Read the file before editing — without this, the public
NavBar/Footer/ChatWidget would render on top of `app/field/layout.tsx`'s
own bare shell, the exact double-nav bug ARCHITECTURE.md documents as
afs-036. `/employee` already established this same pattern for its own
PWA shell, so `/field` follows it rather than inventing a new mechanism.

Gates run directly this session: `pnpm tsc --noEmit` (0 errors), `pnpm
run build` (clean — `/field/contractor` and `/field/shop` both listed as
new static routes, no collision with any existing route). Not yet done:
Playwright coverage (no interactive behavior to test yet — both pages are
static placeholders) and any user-facing browser check, since there is
nothing behaviorally meaningful to confirm until afs-fl-002/003 land.

---

## PATHFINDEREDGE TITLE GENERATOR REWRITE (afs-jf-006) — 2026-08-23

Read both real title-generation call sites in full before changing
anything, per the task's instruction: `app/studio/draft/page.tsx`'s
`sendToPathfinder` (client-side `generatedProfileName` template +
`userSetProfileName` check) and `approve-quote-request/route.ts`'s
`describeItem`/`resolveItemProfileName` (server-side, shared by every
submission surface). Confirmed directly, not assumed:
- Both existing "use the real user-set name first" checks are unchanged —
  `sendToPathfinder`'s `trimmedProfileName !== 'Untitled Profile'`
  comparison and `resolveItemProfileName`'s `item.profileName?.trim() ||
  describeItem(...)` fallback. Only what each generates when that check
  fails was rewritten.
- `describeItem` is genuinely shared, not FlashDraft-specific — re-read
  `itemBuilds`'s `.map` in `approve-quote-request/route.ts`: every line
  item from every submission surface (FlashDraft, Configurator, Quote
  Builder, Blueprint Takeoff AI upload) is pushed to PathfinderEdge through
  this same `resolveItemProfileName`/`buildMachineProfileForItem` call
  chain, and the request-level `identity` object (built once, before the
  `.map`) is in scope at that call site.
- `nameEn: input.profileName` in `flashdraft-to-pathfinder.ts` and the
  equivalent `nameEn:` assignments in `buildMachineProfileForItem` both
  confirmed as the real data flow into `pushProfileToPathfinder`'s outgoing
  PathfinderEdge `profileName` — both generators genuinely feed
  machine-facing text, not cosmetic UI.

**Materials data source, confirmed directly per the task's instruction:**
the `material` string both generators receive at runtime is
`lib/data/catalog.ts`'s `ALL_MATERIALS` (re-read directly — nine entries:
Galvanized Steel, Galvanized Galvalume, Copper, Lead Coated Copper,
Anodized Aluminum, Stainless Steel, Zinc, Kynar 500 (Painted Steel),
Vintage Steel), NOT the live `materials` Supabase table. Re-confirmed
`lib/data/material-color-requirement.ts`'s header comment still states none
of the three material-selection surfaces query that live table directly,
and that its spellings differ from `ALL_MATERIALS` (e.g. "Galvalume Steel"
in the DB seed vs. "Galvanized Galvalume" in `ALL_MATERIALS`) — so the new
`MATERIAL_SHORTHAND` map (added to `lib/data/catalog.ts`, next to
`ALL_MATERIALS`) is keyed on the `ALL_MATERIALS` spellings:

```
'Galvanized Steel'          -> 'Galvanized'
'Galvanized Galvalume'      -> 'Galvalume'
'Copper'                    -> 'Copper'
'Lead Coated Copper'        -> 'Lead Coated'
'Anodized Aluminum'         -> 'Anodized'
'Stainless Steel'           -> 'Stainless'
'Zinc'                      -> 'Zinc'
'Kynar 500 (Painted Steel)' -> 'Kynar'
'Vintage Steel'             -> 'Vintage'
```

`'Kynar 500 (Painted Steel)' -> 'Kynar'` and `'Anodized Aluminum' ->
'Anodized'` are exactly as specified in the task. The other seven follow
the same rule (drop the generic base-metal qualifier already implied by
the more specific descriptor): `'Lead Coated Copper' -> 'Lead Coated'`
drops "Copper" the same way "Steel"/"Aluminum" are dropped elsewhere;
`'Stainless Steel' -> 'Stainless'` and `'Vintage Steel' -> 'Vintage'` drop
the redundant "Steel"; `'Galvanized Galvalume' -> 'Galvalume'` drops the
redundant "Galvanized" (Galvalume is itself a galvanized coating);
`'Copper'` and `'Zinc'` have no redundant qualifier to drop, so they stay
as-is. **This map is machine-bound text (PathfinderEdge → the physical
Thalmann DS2801) and is flagged IMPLEMENTED/UNCONFIRMED pending Reid's
review**, per the task's explicit instruction not to trust it for
fabrication-facing text without that review.

**Fallback composition, identical priority logic on both paths, "FlashDraft"
prefix dropped entirely (already true of `describeItem`, only relevant to
the client-side template):** `[shortMaterial + gauge] - [first present of:
Job Name, Business Name, Client Name] - [PO Number, as "PO <number>"]`,
blanks dropped, no dangling ` - ` separators — same drop-blank-segments
convention `composeDescription` in `pathfinder-edge.ts` already uses (read
that function first, reused its convention, did not invent a new one;
`composeDescription` itself was explicitly not touched, per the task's
scope).

- **Client-side** (`buildFallbackProfileName`, new top-level helper in
  `page.tsx`): `jobName` was already in local state after afs-jf-005, so no
  new plumbing was needed there. When none of Job Name / Business Name /
  Client Name / PO Number is present, falls back to short-material + gauge
  + `new Date().toLocaleString('en-US')`, matching the pre-existing
  generator's always-a-timestamp behavior for that one case, per the
  task's explicit instruction.
- **Server-side** (`describeItem`, now `describeItem(item, identity)` in
  `approve-quote-request/route.ts`): `identity.jobName` required extending
  `JobIdentityFields` with a `jobName` field, sourced from a new `job_name`
  column added to this route's `quote_requests` select and to the `qr`
  type — same column migration `019_job_name_and_delivery_date.sql`
  (afs-jf-004) already added to `quote_requests`. **That migration was FILE
  ONLY at the time this prompt ran; it is now CONFIRMED APPLIED LIVE** (see
  the afs-jf-004 entry below) — this route's `quote_requests` select is
  safe against the live schema, a second call site that depended on that
  standing pre-deploy requirement, now resolved. No timestamp
  fallback exists server-side, and none was added: `item.profileType` is a
  required, non-nullable field on `QuoteRequestLineItem`, so the
  composition can never actually come back empty even with no material
  shorthand match and no identity field present — judged an acceptable
  last resort per the task's explicit "use your own judgment" instruction,
  documented here rather than left silent.

`lib/data/catalog.ts`, `app/studio/draft/page.tsx`, and
`approve-quote-request/route.ts` were all edited via targeted `Edit` calls
(not full-file rewrites) — each file was read in full or in relevant
section first, per the task's own re-verification instructions.

`pnpm tsc --noEmit`: 0 errors, run directly this session. No `pnpm run
build` and no browser/Playwright access this session — per this project's
verification standard, **IMPLEMENTED, UNCONFIRMED** until Reid (1) reviews
the shorthand map above and (2) confirms a real fallback-title send on
both paths, tried once with job-identity fields present and once with
none present. Committed as `feat: PathfinderEdge title generator rewrite --
materials shorthand, Job Name-first fallback priority (afs-jf-006)`.

---

## FLASHDRAFT INFO OVERLAY RELOCATION (afs-jf-005) — 2026-08-23

Read `app/studio/draft/page.tsx` in full before changing anything, per the
task's instruction — confirmed 3,929 lines at the start of this prompt
(3,988 after). Grepped every `requestedBy`/`clientBusinessName`/
`clientName`/`poNumber` reference first (the canvas overlay's "PART 2 —
PROFILE INFO PANEL" at the old line ~3477, the sidebar's 2-column
job-identity grid at the old line ~3258, the `useState` declarations at
~856–859, the autosave restore effect at ~924–927, the autosave write
effect + its dependency array at ~963–990, `sendToPathfinder`'s POST body
at ~2708–2711, and `submitQuoteRequest`'s body + its `useCallback`
dependency array at ~2831–2874) before touching any of them, per the
task's explicit instruction not to guess the shape.

**What moved (unchanged wiring, only UI location changed):** Business
Name, Client Name, PO Number — out of the sidebar's job-identity grid,
into the canvas overlay, now behind a collapsed-by-default "+ Job Info"
toggle alongside two new fields.

**What was added:** `jobName`/`setJobName` state (sent as `jobName` on
both outgoing paths) and `requestedDeliveryDate`/`setRequestedDeliveryDate`
state, backed by a native `<input type="date">` (re-confirmed this
session: no date-picker library in `package.json`, matching the task's
own note that this was "confirmed" but should be "re-verified before
assuming"). Both are wired into the same `AUTOSAVE_KEY` localStorage
restore/write effects the moved fields already used.

**Naming asymmetry implemented exactly as afs-jf-004 specified — verified,
not assumed:** `requestedDeliveryDate` is the key `sendToPathfinder` sends
(→ `shop_profile_library.requested_delivery_date`, a genuinely new
column); `requestedDelivery` (no "Date" suffix) is the key
`submitQuoteRequest` sends (→ `quote_requests.requested_delivery`, the
pre-existing column migration 019 deliberately reused instead of adding a
duplicate). These two outgoing body keys are intentionally different
strings — double-checked this wasn't accidentally typo'd into matching.

**What was removed — real cleanup, not hide-but-keep-wired:** FlashDraft's
own `requestedBy`/`setRequestedBy` state, its sidebar input, its two
autosave restore/write entries, and its key in both outgoing request
bodies, all deleted. Confirmed by grep after the edit: the only two
remaining occurrences of the string `requestedBy` in the file are doc
comments explaining the retirement (lines 83, 859) — no dangling state
reference, no orphaned input.

**Explicitly left untouched, per the task's scope:**
- `app/api/studio/send-to-pathfinder/route.ts`'s and `lib/data/
  shop-profile-library.ts`'s own `requestedBy` parameter/field — both stay,
  typed optional, because the three other submission surfaces
  (Configurator, Quote Builder, Blueprint Takeoff AI upload) documented as
  still writing to `quote_requests.requested_by` in afs-jf-004's entry
  below are not part of this prompt.
- `app/configure/page.tsx`, `app/quote/page.tsx`, `app/upload/page.tsx` —
  their own separate Requested By inputs (afs-jf-003) were not touched.
- `lib/data/shop-profile-library.ts`'s read-side (`ShopProfileLibraryRow`,
  `ShopProfileLibraryFullRow`, `getShopProfileLibrary`,
  `getShopProfileLibraryFull`) — only the `ShopProfileLibraryInsert`
  interface and the insert call itself got the new `jobName`/
  `requestedDeliveryDate` fields, matching the task's literal instruction
  ("that file's `ShopProfileLibraryInsert` interface and insert call").
- `lib/integrations/flashdraft-to-pathfinder.ts` / `pushProfileToPathfinder`
  — `jobName`/`requestedDeliveryDate` were NOT threaded into the
  PathfinderEdge push itself, only into the separate
  `insertShopProfileLibraryRecord` shop-record write-through, per the
  task's narrower explicit scope.

**⚠️ Real risk surfaced this session, RESOLVED 2026-08-23 — see the UPDATE
note in the afs-jf-004 entry below:** `app/api/quote-requests/route.ts` now
unconditionally sends `job_name` in every `quote_requests` insert — and this
route is shared by **every** submission surface (FlashDraft, Configurator,
Quote Builder, Blueprint Takeoff), not just FlashDraft. Migration
`019_job_name_and_delivery_date.sql` (afs-jf-004, entry directly below) was
FILE ONLY at the time this prompt ran; it is now **CONFIRMED APPLIED LIVE**,
independently verified via `information_schema`. Confirmed directly: this
insert is a hard failure path (`if (insertError) return NextResponse.json(...,
{ status: 500 })`, not soft-caught) — this "column job_name does not exist"
500 risk no longer applies now that 019 is live. `requested_delivery` itself
is safe (pre-existing, confirmed live). The `shop_profile_library` write in
`insertShopProfileLibraryRecord` is lower-risk — it's wrapped in try/catch
and only logs, per its own "never throws" doc comment — and also now safe
with 019 live.

Cosmetic: the profile-name field's idle placeholder now renders `italic
opacity-60` when `profileName === 'Untitled Profile'`. Read
`sendToPathfinder`'s `userSetProfileName` and `submitQuoteRequest`'s
`userSetProfileNameForSubmit` logic directly first and confirmed both
already compare against that exact literal string — neither the
comparison nor the stored/sent default value was touched, only the
placeholder's visual treatment.

`pnpm tsc --noEmit`: 0 errors. `pnpm run build`: succeeds. Per this file's
own verification standard, this is **IMPLEMENTED, UNCONFIRMED** — no
browser/Playwright access this session, so Reid needs to independently
confirm in `/studio/draft`: the overlay's collapsed/expanded states, the
date picker, a real send on both paths (admin "Send to PathfinderEdge" and
"Submit for Quote"), and that the Requested By field is actually gone.
Committed as `feat: FlashDraft info overlay relocation -- Job Name +
Requested Delivery Date added, Requested By removed (afs-jf-005)`.

---

## JOB_NAME + REQUESTED_DELIVERY_DATE COLUMNS, DEAD REQUESTED_BY RETIRED (afs-jf-004), THEN CONFIRMED APPLIED LIVE — 2026-08-23

**UPDATE 2026-08-23:** Migration 019 was applied and independently verified
via a direct `information_schema` query — three `true` results, covering
`quote_requests.job_name`, `shop_profile_library.job_name`, and
`shop_profile_library.requested_delivery_date`. This closes the FILE-ONLY
status this entry originally recorded (see below for the original write-up,
left intact for history) with the same standard of evidence migrations
013/015/016/017/018 already carry, and resolves the production-blocking
sequencing risk flagged in the afs-jf-005 and afs-jf-006 entries above —
`app/api/quote-requests/route.ts`'s insert, `insertShopProfileLibraryRecord`,
and `approve-quote-request/route.ts`'s `quote_requests` select can now safely
reference these columns. No session has had a working Supabase MCP
connection to this project's actual instance to run that check itself.

Read every file in `supabase/migrations/` (001 through 018) in full and
this file's own live-apply status notes before choosing a migration
number, per the task's instruction. Confirmed
`018_job_identity_and_finish.sql` is still the highest-numbered file on
disk (001–018, no gaps) and is **CONFIRMED APPLIED LIVE** (see the
afs-jf-000 entry below, "RESOLVED 2026-08-22") — so this migration is
correctly numbered 019. No discrepancy to note.

**Pre-check on `quote_requests.requested_delivery`, done directly per the
task's explicit instruction, not assumed:** confirmed `requested_delivery
DATE` already exists (`001_initial_schema.sql`, line 441). Grepped the
whole repo for `requested_delivery`/`requestedDelivery`: the only file
referencing it at all is
`app/api/admin/command-center/approve-quote-request/route.ts`, which
selects `qr.requested_delivery` and assigns `dueDate: qr.requested_delivery`
feeding `machine_jobs.due_date` on every approval. None of FlashDraft,
Configurator, Quote Builder, or the Blueprint Takeoff AI upload write to
it — confirmed by the same grep turning up no other reference anywhere.
Every approved job's `due_date` is silently seeded NULL today; this
migration does not fix that, it only adds the column reuse decision below
so a future prompt can.

New `supabase/migrations/019_job_name_and_delivery_date.sql` — all
columns nullable, no defaults, `ADD COLUMN IF NOT EXISTS`, matching the
established pattern from migrations 016/017/018 (verified directly, not
assumed):
1. `quote_requests`: `job_name TEXT` only.
2. `shop_profile_library`: `job_name TEXT`, `requested_delivery_date DATE`.

**Decision already made with Reid, executed here: do NOT add a new
`requested_delivery_date` column to `quote_requests`.** Its existing
`requested_delivery` column is reused for that purpose instead —
`quote_requests` gets no new date column from this migration.
`shop_profile_library` has no equivalent pre-existing column (only
`due_date` from migration 016, a distinct concept — the shop's own
committed date Steve sets/confirms in Command Center, not what the
customer asked for at intake), so `requested_delivery_date` is genuinely
new there. This produces an intentional naming asymmetry between the two
tables for the same real-world concept, documented explicitly in
SCHEMA.md (both the TABLE 15 and SHOP PROFILE LIBRARY TABLE sections) so
it doesn't read as an oversight to a future session.

**Three `requested_by` columns — disambiguated per the task's explicit
warning not to confuse them:**
1. `quote_requests.requested_by TEXT` (migration 018) — DEAD. Retired by
   this migration (documented as dead, left in place untouched).
2. `shop_profile_library.requested_by TEXT` (migration 018) — ALSO DEAD,
   also retired here.
3. `machine_jobs.requested_by UUID REFERENCES profiles(id)` (an earlier,
   unrelated migration) — ACTIVELY USED, set to `qr.user_id` at
   `approve-quote-request/route.ts` around line 483. **Not touched,
   renamed, or documented as dead** — verified this is a completely
   separate column on a separate table before writing anything, per the
   task's explicit instruction.

**Both TEXT `requested_by` columns retired, not removed — always null
going forward, per the decision that both were a naming mistake (meant to
capture a delivery date, not a person's name).** No UI or logic should be
built against either, noted here explicitly so no future session tries to
wire either one up.

**Known, deliberately out-of-scope consequence, recorded here per the
task's explicit instruction:**
(a) The Configurator (`app/configure/page.tsx`), Quote Builder
(`app/quote/page.tsx`), and Blueprint Takeoff AI upload (`app/upload/
page.tsx`) surfaces (afs-jf-003) still each have their own "Requested By"
input writing to `quote_requests.requested_by` — this migration does not
remove any of those three inputs. FlashDraft (`app/studio/draft/
page.tsx`) also still has its own "Requested By" input (confirmed by grep
— `requestedBy` state, autosave restore, and the labeled form field are
all still present); a separate future prompt, afs-jf-005, is expected to
remove FlashDraft's own instance. So the column will not actually be
"always null" in practice until future prompts remove all four remaining
inputs.
(b) `lib/integrations/pathfinder-edge.ts`'s `composeDescription` still
includes a `Req: <name>` segment sourced from `requestedBy` (confirmed at
line ~373). Since that value keeps arriving non-null from all four
submission surfaces until they are cleaned up, the segment will simply
keep being populated or dropped exactly as before — this migration does
not touch that composition function.

`SCHEMA.md` updated: header counts (19 migration files, table count
unchanged at 54 since no new table is added), the `MIGRATION FILE
LOCATION` list, new documentation on TABLE 15 (`quote_requests.job_name`,
the `requested_delivery` reuse decision and why, the dead `requested_by`
retirement, the three-`requested_by`-column disambiguation) and the SHOP
PROFILE LIBRARY TABLE section (`job_name`, `requested_delivery_date`, the
naming-asymmetry writeup, the `due_date` vs. `requested_delivery_date`
distinction, the same dead-column retirement note) — matching this
project's existing documentation depth/style for migrations 016/017/018's
own additions. Also corrected the stale "FILE ONLY as of this writing —
018 has not been applied to the live Supabase project" language left over
in both of those same sections from migration 018's original entries (018
is CONFIRMED APPLIED LIVE per the afs-jf-000 entry below, this document's
own record) — that language now reflects 018's real current status
instead of being left stale.

**This was originally a FILE-ONLY prompt, per its own instructions.
Migration 019 is now CONFIRMED APPLIED LIVE — see the UPDATE note at the
top of this entry.** It followed the same "pending manual apply"
convention already used for migrations 015/016/017/018: written and
committed, then applied and independently verified via
`information_schema`, the same standard of evidence 013/015/016/017/018
already carry. No session has had a working Supabase MCP connection to
this project's actual instance to apply or verify it directly.

`pnpm tsc --noEmit`: 0 errors, run directly this session. This prompt
adds no UI, no API route, and no data-fetching code — there is no browser
surface to verify for this prompt itself; per this file's verification
standard, browser verification is owed by whatever downstream prompt
actually consumes these columns (afs-jf-005, afs-jf-006), independent of
this migration's now-confirmed live-apply status. Committed
as `feat: add job_name + requested_delivery_date columns, retire dead
requested_by, file only (afs-jf-004)`.

---

## OPEN/PARKED — PATHFINDEREDGE BEND-ANGLE INVESTIGATION (afs-sv-000)

**Status: OPEN/PARKED as of 2026-08-20. Not resolved, not abandoned —
a future session should pick this up from here, not assume it is done
and not restart from scratch.**

1. **Confirmed:** the supplement-swap bug, via a single-bend V test —
   PathfinderEdge profile 32912069, drawn interior angle 45°, rendered
   as approximately 135° on the machine side (PathfinderEdge) under
   the (now superseded) turn-angle formula.
2. **Staircase test profile 32911526: UNEVALUATED.** Has not yet been
   checked against this bend-angle behavior. Its only prior verdict
   (self-intersecting/impossible shape) rests entirely on Reid's own
   chat messages, not independent visual confirmation — no session has
   had browser access to PathfinderEdge's own web UI.
3. **Signed-interior-angle fix status (quoted, not restated from
   memory — see CURRENT STATUS below for the full write-up):** "FOURTH
   revision applied (2026-08-20): bend angle now emits SIGNED INTERIOR
   angle, not turn-angle. IMPLEMENTED, PENDING Reid's visual
   verification matrix below — not yet confirmed."
4. **Verification matrix still pending** — none of the following have
   been run: (1) V-profile sharp angle, (2) W-profile 45°/-60°/45°/-60°
   sequence, (3) near-90° regression check, (4) a -180°/hem-tail case.
5. **"Angle vs Radius" feature-type question: still open, undecided.**
   Whether a bare `radius: 0` (`Angle`-type feature) behaves differently
   from the `Radius`-type feature every real test so far has used
   remains untested.
6. **Production deploy SHA: UNVERIFIED.** Do not claim this fix is live
   in production without a real `deploy_verify`-equivalent check
   (production's deployed commit SHA, read from the Vercel API,
   compared against `git rev-parse HEAD`).

---

## JOB-IDENTITY FIELDS END TO END (afs-jf-003) — 2026-08-21

Read all four submission surfaces (`app/studio/draft/page.tsx`,
`app/configure/page.tsx`, `app/quote/page.tsx`, `app/upload/page.tsx`),
`app/admin/quote-requests/[id]/page.tsx`, both PathfinderEdge send paths,
`lib/integrations/pathfinder-edge.ts`, `app/admin/shop-view/page.tsx`, and
`app/admin/profile-library/page.tsx` in full before changing anything, per
the task's instruction. All prior claims about these files (afs-cv-002
through afs-sv-009) re-verified accurate.

**New finding:** `app/quote/page.tsx` already collected a PO Number and
already sent it to `/api/quote-requests` as `poNumber` in the body — but
that route never read `body.poNumber`, so it was silently dropped on every
submission. Real pre-existing bug, fixed as part of this prompt (not
"already working").

**Added four optional fields (Business Name, Client Name, PO Number,
Requested By) to all four submission surfaces**, none block submit. Wired
into `app/api/quote-requests/route.ts`, which now writes
`client_business_name`/`client_name`/`po_number`/`requested_by` on
`quote_requests` (mirroring the existing `color`/`finish` handling).
`app/studio/draft/page.tsx` was edited via precise `Edit` calls, not
`Write` — same oversized-file exception afs-cv-003 already used, flagged
explicitly rather than silently deviating.

**Command Center `app/admin/quote-requests/[id]/page.tsx` was entirely
read-only before this prompt** — confirmed by reading it in full. New
`components/admin/JobIdentityEditorForm.tsx` (client component, following
`CustomerAccountSettingsForm.tsx`'s existing dirty-tracking/PATCH-on-save
convention, not a new pattern) plus new `PATCH
/api/admin/quote-requests/[id]` route (following the CRM route's
single-PATCH-per-resource pattern) let Steve view and edit all four
fields before approval.

**Both PathfinderEdge send paths now copy all five fields (four identity +
`finish`) into `shop_profile_library`** on write — `finish` was NOT
previously copied there by afs-cv-003/afs-jf-002, confirmed by reading
`lib/data/shop-profile-library.ts` before touching it; this prompt is the
first to wire it through. `lib/integrations/pathfinder-edge.ts`'s
`pushProfileToPathfinder` now composes the outgoing `description` as
`"Business | Client | PO <po> | Req: <name> | <finish>"` (blank segments
dropped, never an empty ` | `) prepended to the existing `AFS profile
<profileNumber>` reference text.

**Length-limit check: no live over-length test run.** Diagnostics only
capture outgoing request bodies (no evidence either way); PathfinderEdge's
public docs state no length limit for `description`; a live test was
deliberately skipped because it would write a real profile into the
production catalog (20115) the physical Thalmann DS2801 polls
automatically — not safe to trigger unattended. No truncation applied;
the priority order to use if a real limit is ever found is documented in
a code comment at the composition site.

**Profile-name fallback — verified independently per send path, not
assumed symmetric:** FlashDraft's direct send
(`send-to-pathfinder/route.ts`) previously always used a generated name,
ignoring the canvas's own editable `profileName` state entirely — now uses
that real name when the user set one (renamed away from "Untitled
Profile"), generated fallback otherwise. Command Center approval
(`approve-quote-request/route.ts`) had NO "user-set name" concept
reaching it at all before this prompt (no line item ever carried one) —
fixed by having FlashDraft's own quote-request submission include its
`profileName` only when real, with the route's new
`resolveItemProfileName()` falling back to the exact prior
`describeItem()` format otherwise.

Shop View's focus card and the Profile Library table now display all five
fields; Profile Library gained dedicated Business Name and PO Number
filter inputs, in addition to its existing search/source/status filters.
Both keep excluding soft-deleted rows via the same existing
`getShopProfileLibrary`/`getShopProfileLibraryFull` queries, extended not
replaced.

**PRODUCTION-BLOCKING SEQUENCING RISK, still open from afs-jf-002, now
worse:** migration 018 is still recorded NOT applied live. Attempted to
re-check this session via the connected Supabase MCP account — it points
at an unrelated project (`tarritrix`, no `quote_requests` or
`shop_profile_library` table at all), so it could not be used to verify
the real AFS project. `app/api/quote-requests/route.ts`'s insert now
always includes four more columns beyond `finish` — apply and confirm
migration 018 live before or immediately upon deploying this commit, or
every quote-request submission through all four surfaces will fail.

**RESOLVED 2026-08-22:** migration 018 is now CONFIRMED APPLIED LIVE —
see the updated afs-jf-000 entry below, which records Reid's five-`true`
`information_schema` verification covering all five job-identity/finish
columns on `quote_requests`. This sequencing risk no longer applies.

`pnpm tsc --noEmit`: 0 errors. `pnpm run build`: succeeds. Both run
directly this session. Marked **IMPLEMENTED, UNCONFIRMED** per this file's
verification standard — no browser/Playwright access this session; pending
Reid's confirmation across all four submission surfaces, Command Center
editing, a real PathfinderEdge send from both paths, and both display
surfaces. Committed as `feat: job-identity fields end to end — submission
surfaces, Command Center edit, PathfinderEdge description, Shop
View/Profile Library display (afs-jf-003)`.

---

## ALUMINUM FINISH CHOICE (ANODIZED/PAINTED) — SUPERSEDES AFS-CV-002 (afs-jf-002) — 2026-08-21

Read `lib/data/material-color-requirement.ts`, `components/quote/
ColorField.tsx`, and `components/quote/ColorPickerModal.tsx` in full before
changing anything, per the task's instruction.

**This prompt explicitly supersedes afs-cv-002's ruling** that every
`aluminum`-category material (currently only "Anodized Aluminum") always
requires the PAC-CLAD palette. That blanket rule was wrong: an aluminum
item can be genuinely anodized with no painted coating at all, in which
case PAC-CLAD (a painted-color chart) doesn't apply. Replaced with a
required Finish choice — "Anodized" or "Painted" — on every surface that
previously applied the blanket rule. `painted_steel` (Kynar 500 Painted
Steel, Vintage Steel → McElroy) is untouched; it never had a finish
concept and doesn't get one here.

**"Painted"** → the existing PAC-CLAD picker, unchanged (`ColorField`,
`palette="pacclad"`, the same 51-entry `pacclad` array). **"Anodized"** →
a required free-text "Specify Anodized Color" input, because
`lib/data/metal-colors.ts` has no `pacclad_anodized` chart yet — the
physical PAC-CLAD anodized chart is expected within days.

**Future-swap hook (the task's explicit requirement):** added an empty
`pacclad_anodized: MetalColor[] = []` export to `metal-colors.ts`.
`colorPaletteForMaterial()` in `material-color-requirement.ts` branches on
`pacclad_anodized.length > 0` — not on a hard-coded "Anodized means free
text" rule — with a FUTURE-SWAP HOOK comment on that exact line explaining
the intent for whoever adds the real array. `ColorField.tsx` and
`ColorPickerModal.tsx` already include `'pacclad_anodized'` in their
palette/label maps, and `findMetalColorByName()` already checks it too —
all three ahead of the data existing. **Populating `pacclad_anodized` with
real `{ name, hex }` entries is the only change a future prompt needs to
make** — no page and no other function needs to change; the real
`ColorField`/`ColorPickerModal` picker starts rendering automatically on
all four wired surfaces.

**New component, `components/quote/FinishColorField.tsx`:** the single
place that renders the Finish toggle + conditional color control (picker
vs. free text), used by all four wired surfaces in place of a bare
`ColorField` whenever `requiresFinishChoice(material)` is true. This is
what makes the future-swap hook above actually require zero surface
changes — the branch lives in this one component (and
`colorPaletteForMaterial`), not duplicated at each call site.

**Replaced the old, silently-wrong validity check.** `!colorPalette ||
color.trim() !== ''` (afs-cv-002) would have incorrectly passed for an
unfinished Anodized item, since `colorPaletteForMaterial` legitimately
returns `null` for 'Anodized' (free-text mode) even though a color value
IS still required. New `isColorRequirementSatisfied(material, finish,
color)` in `material-color-requirement.ts` is the single source of truth
now, used by all four surfaces; `colorRequirementErrorMessage()` replaces
the old inline `colorPalette === 'mcelroy' ? 'McElroy' : 'PAC-CLAD'`
ternary (which no longer made sense once `colorPalette` could be `null`
for a legitimately-required Anodized color).

**Four wired surfaces (re-confirmed by grep, same four afs-cv-002/afs-jf-001
found — no fifth exists):**
1. `app/quote/page.tsx` — `QuoteFormData.finish: AluminumFinish | ''`,
   reset alongside gauge/color on material change, shown in the step-4
   review table.
2. `app/configure/page.tsx` — `ConfiguratorForm.finish`, same pattern.
3. `app/studio/draft/page.tsx` — new `finish` state; added to
   `AutosaveState` and both the localStorage restore/write effects (new
   `isAluminumFinishShape()` type guard validates a restored value against
   `'Anodized' | 'Painted' | ''`, rejecting stale/corrupt entries from
   before this field existed). The separate admin-only `sendToPathfinder()`
   flow (→ `shop_profile_library`, a different table/pipeline per that
   route's own file-header comment) was deliberately NOT touched — out of
   this task's stated scope (`quote_requests.finish` only).
4. `app/upload/page.tsx` — per-item `TakeoffItem.colorFinish:
   AluminumFinish | null`, composed into one `"ProfileType: Finish"`-joined
   string via new `buildRequestFinish()`, mirroring the existing
   `buildRequestColor()` pattern (this table can hold several items with
   different aluminum materials/finishes in one submission, unlike the
   other three single-item surfaces).

**Naming collision found and deliberately avoided:** `TakeoffItem` already
had an unrelated `finish: string | null` field — a free-text finish note
the takeoff AI extracts off the drawing (`app/api/takeoff/route.ts`'s JSON
schema), never displayed, edited, or submitted anywhere in the UI, and
never constrained to "Anodized"/"Painted". Reusing it for this prompt's
controlled two-value choice would have silently conflated two different
things. Named the new field `colorFinish` instead; left the pre-existing
`finish` field completely untouched.

**No pre-existing finish concept found for the McElroy/painted-steel
path** — checked `EstimatorLineItem`, the takeoff AI's own extraction
schema, and every McElroy call site before writing anything, per the
task's explicit instruction not to invent one. `quote_requests.finish` is
left `null`/unset for painted-steel submissions.

**Payload/schema:** `app/api/quote-requests/route.ts` now reads
`body.finish` (mirroring the existing `body.color` handling exactly) and
writes it into `quote_requests.finish`.

**PRODUCTION-BLOCKING SEQUENCING RISK — flagging explicitly:** the
`quote_requests` insert in `app/api/quote-requests/route.ts` now always
includes a `finish` key (null for non-aluminum items). Migration
`018_job_identity_and_finish.sql` (afs-jf-000), which adds
`quote_requests.finish`, is still recorded FILE-ONLY / not applied to the
live Supabase project (re-checked this session, not assumed). **Deploying
this commit before that migration is applied live would break every
quote-request submission through all four surfaces**, not just aluminum
ones — Postgrest rejects an insert referencing a nonexistent column. This
needs to be sequenced: apply + confirm migration 018 live (same
`information_schema` standard as 017) before or immediately upon
deploying this commit.

**RESOLVED 2026-08-22:** migration 018 is now CONFIRMED APPLIED LIVE —
see the updated afs-jf-000 entry below, which records Reid's five-`true`
`information_schema` verification. `quote_requests.finish` exists on the
live project; this sequencing risk no longer applies.

**Command Center:** `app/admin/quote-requests/page.tsx` (list) and
`.../[id]/page.tsx` (detail) now render a `finish` `Badge` (chrome
variant) immediately next to the existing `ColorSwatchChip`, in the list
row, the detail page's Project Details panel, and the per-item table.
`lib/data/admin.ts`'s `getQuoteRequestsQueue()` now selects/returns
`finish`. (The smaller dashboard-widget `getQuoteRequestQueue()` — no
trailing "s" — was left untouched; it doesn't show `color` today either,
so `finish` wasn't added there, consistent with the task's named surfaces.)

`pnpm tsc --noEmit`: 0 errors, run directly this session. Per this file's
verification standard, marked **IMPLEMENTED, UNCONFIRMED** — pending the
migration-sequencing fix above, plus Reid's own confirmation that the
Finish choice, both its color paths, and the Command Center display all
work correctly on every one of the four wired surfaces; no browser/
Playwright access this session. Committed as `feat: aluminum Finish
choice (Anodized/Painted), supersedes PAC-CLAD-on-all-aluminum ruling
(afs-jf-002)`.

---

## COLOR PICKER MODAL — BACK BUTTON FIX (afs-jf-001) — 2026-08-21

Read `components/quote/ColorPickerModal.tsx` and `components/quote/
ColorField.tsx` in full, plus every real wiring surface, per the task's
instruction to re-verify completeness rather than trust the afs-cv-002
list as given. Re-grepped the whole repo for `ColorPickerModal`/
`ColorField`: the only real wiring surfaces are still the same four —
`app/studio/draft/page.tsx` (FlashDraft), `app/configure/page.tsx`
(Configurator), `app/quote/page.tsx` (Quote Builder), `app/upload/
page.tsx` (Blueprint Takeoff AI) — each importing `ColorField` only,
never `ColorPickerModal` directly. No fifth surface exists.

**Confirmed the bug live, not just from reading the code**, using ad hoc
Playwright scripts against a real `pnpm dev` server (scripts written to
the repo root for this session only, then deleted — not committed):
opening the color picker on `/quote` (after selecting Kynar 500 Painted
Steel, which requires a McElroy color) and calling `page.goBack()`
navigated the tab away from `/quote` entirely instead of closing the
modal. Repeated the same test starting from `/studio` → `/studio/draft`
(the exact FlashDraft navigation path in the bug report) — Back left
FlashDraft and landed on `/studio`, matching the reported "lands on the
Design Studio home page" symptom exactly.

**Root cause, confirmed:** `ColorPickerModal.tsx` was a plain
conditional-render `fixed inset-0` overlay gated only on its `isOpen`
prop. It never called `history.pushState`, so opening it left nothing on
the browser's history stack for a Back press to intercept — the press
just fell through to whatever page actually preceded the current one.

**Fix — `components/quote/ColorPickerModal.tsx`, full file replacement,
no other file touched:**
- New `useEffect` keyed on `isOpen`: on open, `window.history.
  pushState({ afsColorPickerModal: true }, '')` and register a `popstate`
  listener that calls `onClose()`.
- Effect cleanup (runs when the modal closes by any other path — its own
  Close button, or `onSelect` picking a color): if the pushed entry is
  still "ours" (tracked via a ref, not re-derived from `isOpen`, since the
  ref must survive past the point `isOpen` itself flips to `false`), calls
  `window.history.back()` to pop it, *after* removing the `popstate`
  listener — so that programmatic `back()` doesn't re-trigger `onClose` a
  second time. Without this cleanup, a Close-button dismissal would leave
  a stray forward-navigable history entry that would silently absorb the
  user's next real Back press instead of actually navigating away.
- `afs-*` tokens untouched — this was purely a history-wiring change, no
  styling touched. `// eslint-disable-next-line react-hooks/exhaustive-deps`
  used on the effect's dependency array (only `[isOpen]`, deliberately
  excluding the inline `onClose`/`onSelect` closures ColorField passes in
  fresh every render) — this exact pattern is already established
  elsewhere in this codebase (`app/studio/draft/page.tsx`,
  `components/admin/BidBuilder.tsx`, and others).

**Verified live this session (Playwright against `pnpm dev`):**
1. `/quote`, picker open, Back press → modal closes, URL stays `/quote`,
   `#material`'s in-progress value (`Kynar 500 (Painted Steel)`)
   preserved — the exact "no in-progress field values are lost"
   requirement from the task.
2. `/quote`, picker reopened, closed via its own Close button, *then* a
   real Back press → correctly navigates to the actual prior page (not
   swallowed by a leftover history entry) — confirms the cleanup-on-Close
   path.
3. `/studio` → `/studio/draft`, picker open, Back press → stays on
   `/studio/draft`, no longer falls through to `/studio`.

Only `/quote` and `/studio/draft` were driven end-to-end in a real
browser this session; `/configure` and `/upload` wire the identical
shared `ColorField`/`ColorPickerModal` pair with no surface-specific
override, so the same fix applies, but were not separately clicked
through. Reid's own confirmation pass should still cover all four
surfaces per the task's instruction, not just these two.

**Related issue, noted but explicitly NOT fixed here (out of this task's
scope):** `components/ui/Modal.tsx` — the shared modal behind most of
`/admin` and `/account` (`ProfileLibraryTable`, `CommandCenterJobCard`,
`BidsCrmTab`, `CreditApplicationReviewModal`, `OrdersCrmTab`,
`CustomerDetailDrawer`, `StatusAdvancer`, `TemplateCreateModal`,
`ProjectEditModal`, `ProjectCreateModal`, `InviteTeamMemberModal`,
`DocumentUploadForm`, and others) — has the identical
overlay-with-no-history-entry pattern (no `pushState`, no `popstate`
listener, just an `Escape`-key handler). A Back press while any of those
is open would plausibly exhibit the same navigate-away bug. None of those
surfaces wire `ColorPickerModal`/`ColorField`, so this was left untouched
per the task's explicit instruction to note, not fix, an unimplicated
instance of the same pattern.

`pnpm tsc --noEmit`: 0 errors, run directly this session. Per this file's
verification standard, marked **IMPLEMENTED, UNCONFIRMED** — pending
Reid's own Back-button test on every one of the four wired surfaces, not
just the two driven directly this session. Committed as `fix:
ColorPickerModal Back button closes the picker instead of navigating away
(afs-jf-001)`.

---

## JOB-IDENTITY + FINISH COLUMNS MIGRATION WRITTEN (afs-jf-000), THEN CONFIRMED APPLIED LIVE — 2026-08-21

**UPDATE 2026-08-22:** Reid ran migration 018 in the Supabase Dashboard SQL
Editor and confirmed it completed with no errors, then independently
verified via a direct `information_schema` query in the Dashboard — five
`true` results, covering `quote_requests.client_business_name`,
`quote_requests.client_name`, `quote_requests.po_number`,
`quote_requests.requested_by`, and `quote_requests.finish`. This closes
the FILE-ONLY status this entry originally recorded (see below for the
original write-up, left intact for history) with the same standard of
evidence migrations 013/015/016/017 already carry, and resolves the
production-blocking sequencing risk flagged in the afs-jf-002 and
afs-jf-003 entries above — `app/api/quote-requests/route.ts`'s insert can
now safely reference all five columns. No session has had a working
Supabase MCP connection to this project's actual instance to run that
check itself — this verification was run by Reid directly in the
Dashboard.

Read every file in `supabase/migrations/` (001 through 017) in full and
this file's own live-apply status notes before choosing a migration
number, per the task's instruction. Confirmed
`017_color_and_queue_position.sql` is still the highest-numbered file on
disk (001–017, no gaps) and is **CONFIRMED APPLIED LIVE** (see the
afs-cv-000 entry below) — so this migration is correctly numbered 018.
No discrepancy to note.

**Pre-existing-column check, done directly rather than trusted from the
task's own note, per its explicit instruction:** grepped
`001_initial_schema.sql` for `po_number` and confirmed `quote_requests.
po_number TEXT` already exists there (line 442) — it predates this
migration and is NOT a new addition. It is included in this migration's
`quote_requests` `ALTER TABLE` only via `ADD COLUMN IF NOT EXISTS` for
idempotent-migration-style safety, matching this project's existing
pattern — both the migration file's header comment and `SCHEMA.md` state
this pre-existing status explicitly, so it can't be mistaken for new.
Also checked `shop_profile_library` (via migrations 016 and 017, the
only two prior migrations touching that table) — none of the five
columns below existed there before this migration; all five are
genuinely new on that table.

New `supabase/migrations/018_job_identity_and_finish.sql` — all columns
nullable, no defaults, `ADD COLUMN IF NOT EXISTS`:
1. `quote_requests`: `client_business_name TEXT`, `client_name TEXT`,
   `po_number TEXT` (pre-existing, included only for idempotent safety —
   see above), `requested_by TEXT`, `finish TEXT`.
2. `shop_profile_library`: `client_business_name TEXT`, `client_name
   TEXT`, `po_number TEXT`, `requested_by TEXT`, `finish TEXT` — all five
   new.

**No indexes, constraints, or defaults beyond the columns listed above.**
Checked the real pattern already established on `shop_profile_library`
by migrations 016/017 before deciding, per the task's instruction not to
invent a new convention: only 5 of its ~20 columns are indexed
(`customer_name`, `profile_name`, `status`, `due_date`, `created_at`);
plain nullable text columns like `material`, `gauge`, `order_number`,
`hem_instructions`, `color` carry no index. All ten new columns (five
per table) were left unindexed, matching that existing pattern.

`SCHEMA.md` updated: header counts (18 migration files, table count
unchanged at 54 since no new table is added), the `MIGRATION FILE
LOCATION` list, a new note on TABLE 15 (`quote_requests`) documenting
the four new columns plus the `po_number` pre-existing finding, and a
new note in the SHOP PROFILE LIBRARY TABLE section documenting all five
new columns there — matching this project's existing documentation
depth/style for migrations 016/017's own additions in both places.

**This was originally a FILE-ONLY prompt, per its own instructions.
Migration 018 is now CONFIRMED APPLIED LIVE — see the UPDATE note at the
top of this entry.** It followed the same "pending manual apply"
convention already used for migrations 015/016/017: written and committed,
then applied by Reid via the Dashboard and independently verified via
`information_schema`, the same standard of evidence 013/015/016/017
already carry. No session has had a working Supabase MCP connection to
this project's actual instance to apply or verify it directly — this
verification was run by Reid directly in the Dashboard.

`pnpm tsc --noEmit`: 0 errors, run directly this session. This prompt
adds no UI, no API route, and no data-fetching code — there is no
browser surface to verify for this prompt itself. Per this file's own
verification standard (see top of file), this is marked **IMPLEMENTED,
UNCONFIRMED** — pending Reid's manual application of the migration in
the Supabase Dashboard, and, per this file's own standard, a file-only
migration has no browser surface to verify at all, so that "unconfirmed"
status is expected to persist until a downstream prompt actually
consumes these columns in the UI. Committed as `feat: add job-identity
fields and finish columns migration, file only (afs-jf-000)`.

---

## PROFILE LIBRARY QUEUE REORDERING ADDED (afs-cv-005) — 2026-08-21

Read `app/admin/profile-library/page.tsx` (afs-sv-009) and afs-cv-004's Shop
View queue-strip implementation in full first, per the task's own
instruction — Shop View's queue order and this feature's writes both have to
be driven by the exact same `queue_position` values, so the ordering model
had to match on both ends.

**Reordering approach chosen: explicit up/down buttons per row, not
drag-to-reorder.** `package.json` has no drag-and-drop library anywhere in
it; adding one solely for this single table would have been disproportionate
effort for the need. A code comment states this choice and the reasoning
directly at the implementation site (`components/admin/
ProfileLibraryTable.tsx`).

What changed:

- **New "Queue" column** (leftmost) in `components/admin/
  ProfileLibraryTable.tsx` — shows each row's rank in the canonical queue
  order plus ▲/▼ buttons. Rank and up/down behavior are computed from the
  full row set, not whatever the table's own search/filter/sort currently
  shows, since shop priority is a global order.
- Reuses the same `compareShopProfileLibraryQueueOrder` comparator afs-cv-004
  already built for Shop View's queue strip — its signature was generalized
  from `ShopProfileLibraryFullRow`-only to a small structural
  `QueueOrderFields` interface (`queuePosition`/`dueDate`/`createdAt`) so
  both `ShopProfileLibraryRow` (this table) and `ShopProfileLibraryFullRow`
  (Shop View) satisfy it without a cast. One comparator, two surfaces, no
  chance of the two disagreeing on order.
- Clicking ▲/▼ swaps a row with its canonical-order neighbor, then PATCHes a
  new route, `app/api/admin/profile-library/reorder/route.ts`, with the FULL
  ordered id list for every currently active (non-deleted) row — not just
  the two that moved. The route writes `queue_position = index + 1` for
  every id in that list, after validating the list is exactly a permutation
  of the current active row set. Optimistic UI update, with rollback and an
  inline error banner on failure.
- Why the full list, not just the swapped pair: `compareShopProfileLibraryQueueOrder`
  always sorts a null `queue_position` after any explicit one. Updating only
  two rows while the rest stay null would jump those two ahead of every
  untouched row instead of just moving them one slot — writing the whole set
  keeps `queue_position` a gapless 1..N sequence.
- **New sends append to the end of the queue on insert.** Both real
  PathfinderEdge-send call sites (`app/api/studio/send-to-pathfinder/
  route.ts`, `app/api/admin/command-center/approve-quote-request/route.ts`)
  already go through one shared function,
  `insertShopProfileLibraryRecord` (`lib/data/shop-profile-library.ts`), so
  only that one function needed to change. It now calls a new
  `appendToQueueEnd` helper before every insert: reads every current
  non-deleted row, sorts them into canonical queue order, and — if the
  table has never been normalized to a real sequential `queue_position`
  before (true for every row today, since nothing has written this column
  before this prompt) — writes one now, then returns `count + 1` for the
  new row.
- That normalization step is not optional polish — it's what makes the
  literal instructed formula ("current max `queue_position` among
  non-deleted rows, plus 1") actually safe. Before any row has an explicit
  position, plain `MAX + 1` is `1` — but the comparator sorts ANY explicit
  position before ANY null one regardless of magnitude, so a new row with
  position `1` would rank ahead of every pre-existing (still-null) row.
  That's exactly the "jump the queue" bug the task explicitly said to
  avoid. Normalizing the whole active set to a real sequence once (a no-op
  on every call after the first) is the only way "append to the end" is
  actually true going forward.
- Soft-deleted rows excluded throughout via the existing
  `.is('deleted_at', null)` filter — no second filter implementation.
- afs-* tokens only; no new literal-hex/CANVAS_COLORS-style exception
  needed.

**Verification status: IMPLEMENTED, UNCONFIRMED.** `pnpm tsc --noEmit` — 0
errors, verified this session. `pnpm run build` — completed successfully,
verified this session. This session had no browser/Playwright access, so the
actual up/down interaction, persistence across reload, and the "append to
end" behavior on a real PathfinderEdge send have NOT been live-verified —
only code-reviewed and compiled. Migration 017
(`shop_profile_library.queue_position`, afs-cv-000) is now **CONFIRMED
APPLIED LIVE** (see the afs-cv-000 entry below) — that dependency is
closed. Reid still needs to confirm in a real browser at
`/admin/profile-library` that: reordering with ▲/▼ visibly moves a row,
the new order survives a page reload, and a fresh PathfinderEdge send
lands at the bottom of the queue, not the top.

Committed as `feat: add operator-controlled queue reordering to Profile
Library, writing shop_profile_library.queue_position (afs-cv-005)`.

---

## SHOP VIEW REWORKED TO ONE-JOB FOCUS MODE (afs-cv-004) — 2026-08-21

Read `app/admin/shop-view/page.tsx` and the real `shop_profile_library`
schema (migrations 016/017, including afs-cv-000's `queue_position`/
`completed_at` and afs-cv-003's `color`) in full first, per the task's own
instruction, before changing anything.

Replaced afs-sv-010's side-by-side multi-card grid with a one-job-at-a-time
focus layout:

- **Focus panel:** `geometry_svg` rendered as large as the viewport allows
  (`h-[calc(100vh-280px)]` on large screens), with all job fields arranged
  in a column beside it — order number, customer/company, contact info,
  account notes, material/gauge, quantity/length, a prominent color-coded
  due-date banner, hem instructions, painted-edge badge, special
  instructions, source badge, PathfinderEdge profile id, and the status
  control. A color swatch + name renders when `shop_profile_library.color`
  is set (reusing `ColorSwatchChip.tsx`'s literal-hex exception, not a new
  one) and is cleanly absent when it isn't.
- **Numbered queue strip** in the header: one chip per active job, ordered
  by a new shared `compareShopProfileLibraryQueueOrder`
  (`lib/data/shop-profile-library.ts`) — `queue_position` ascending (nulls
  last) → `due_date` ascending (nulls last) → `created_at` ascending as the
  final tiebreaker. The focused job's chip renders larger/filled; focus
  defaults to position 1 and auto-reassigns via a `useEffect` whenever the
  focused job drops out of the active set. Overdue chips render in the
  `afs-crimson` treatment. Clicking a chip calls `setFocusedId` — no route
  change, no reload.
- **Completion:** `app/api/admin/profile-library/[id]/route.ts`'s PATCH
  handler now writes `status: 'complete'` and `completed_at: now()` in the
  same `UPDATE` when the advance reaches `complete`. That drops the row out
  of `activeRows` (removing it from both the focus panel and the queue
  strip) and the `useEffect` above auto-advances focus to the next queued
  job in the same sort order. **Explicit comment added at that write site**
  stating this fires no delivery/invoice/email side effects —
  `completed_at` is purely an event record for a future automation chain.
- **"Show Completed Today" toggle** reveals a separate read-only list of
  jobs completed on the current local calendar day, without pulling them
  back into the active queue or queue strip.
- Same 30-second polling (`GET /api/admin/shop-profile-library`, unchanged)
  — no Realtime dependency introduced, per the task's explicit instruction.
  Soft-deleted rows (`deleted_at IS NOT NULL`) still excluded via the same
  single `getShopProfileLibraryFull` query afs-sv-009/010 established.

**Full file replacements** (not patches): `app/admin/shop-view/page.tsx`,
`components/admin/ShopViewBoard.tsx`. Also edited (not full-file, additive
changes only): `lib/data/shop-profile-library.ts` (added `color`/
`queuePosition`/`completedAt` fields + the new comparator) and
`app/api/admin/profile-library/[id]/route.ts` (the PATCH handler's
completion write).

`pnpm tsc --noEmit`: 0 errors, run directly this session. `pnpm run build`:
succeeded, run directly this session. No browser/Playwright access this
session — per this file's verification standard, **IMPLEMENTED,
UNCONFIRMED** until Reid opens `/admin/shop-view` and confirms the focus
layout, chip switching, and completion flow. Migration 017 (afs-cv-000) is
now **CONFIRMED APPLIED LIVE** (see the afs-cv-000 entry below) — `color`,
`queue_position`, and `completed_at` are real live columns; that
dependency is closed, the browser confirmation above is still needed.

Committed as `feat: rework Shop View to one-job-at-a-time focus mode with
numbered queue strip (afs-cv-004)`.

---

## SHOP VIEW ADDED (afs-sv-010) — 2026-08-20

**Superseded by afs-cv-004 above** — the multi-card grid layout described in
this entry was replaced by a one-job focus-mode layout. Kept for history;
the API routes, data layer, and polling mechanism described below are still
what afs-cv-004 builds on.

Read `app/admin/profile-library/page.tsx`, `lib/data/shop-profile-library.ts`,
and migration `016_source_tool_and_shop_profile_library.sql` first, per the
task's own instruction to reuse Profile Library's (afs-sv-009) data-fetching
pattern rather than invent a second one.

New: `app/admin/shop-view/page.tsx` + `components/admin/ShopViewBoard.tsx` —
a large-format, high-contrast, filterable/sortable card display for the
laptop that will sit beside the physical PathfinderEdge/Thalmann screen.
Each card shows `geometry_svg` large, plus order number, customer/company/
contact info, account notes, material/gauge, quantity/length, a prominent
color-coded due date, hem instructions, an always-visible painted-edge
YES/NO badge, a highlighted special-instructions box, the source badge, and
the PathfinderEdge profile id. One-click status advance
(queued → in_progress → complete) via a new `PATCH` on the existing
`app/api/admin/profile-library/[id]/route.ts`. Polls a new
`GET /api/admin/shop-profile-library` every 30s (polling, not Realtime, per
the task). "Shop View" added next to "Profile Library" in the Command
Center header nav, reusing its exact nav-link classname.

Added `getShopProfileLibraryFull` (wider column set than afs-sv-009's
`getShopProfileLibrary`) and the shared status-lifecycle helpers
(`isShopProfileLibraryStatus`, `nextShopProfileLibraryStatus`,
`shopProfileLibraryStatusLabel`) to `lib/data/shop-profile-library.ts`.

**Found, not fixed (out of scope for this task):** `hem_instructions`,
`painted_edge`, `special_instructions`, and `order_number` are real columns
on `shop_profile_library` that Shop View correctly reads and renders, but
neither real insert path (`approve-quote-request/route.ts`,
`send-to-pathfinder/route.ts`) nor `insertShopProfileLibraryRecord` itself
currently writes them — confirmed by reading all three. Every row today
will show blank/No for these fields regardless of the job's actual content.
A future session should wire this through (both call sites already have
`hemStart`/`hemEnd` in scope; painted-edge/special-instructions/order-number
would need new inputs threaded from wherever they're captured upstream).

**Gates run this session:** `pnpm tsc --noEmit` → 0 errors. `pnpm run build`
→ succeeded. **Not run this session:** Playwright / any browser check — no
browser tooling was available. **Shop View has NOT been opened in a real
browser by anyone this session — it is code-reviewed only, not
live-verified.** The user still needs to open `/admin/shop-view` themselves
(ideally on the actual shop-floor laptop) to confirm legibility at a glance
and that the status-advance button actually persists, before this can move
from IMPLEMENTED to DONE in STATE_OF_THE_BUILD.md. Migration 016
(`shop_profile_library`) is now CONFIRMED APPLIED LIVE to the live Supabase
project — Reid ran it in the Dashboard SQL Editor on 2026-08-20, then
independently verified `shop_profile_library` and `quote_requests.source_tool`
both exist via a direct `information_schema` query in the Dashboard,
closing the dependency carried over unresolved from afs-sv-007/008/009. No
session has had a working Supabase MCP connection to this project's actual
instance (the only connection available pointed at projects named
"tarritrix"/"tarritrix-audit", not this project) — the `information_schema`
verification was run by Reid directly in the Dashboard, not by a session.

---

## COLOR + QUEUE_POSITION + COMPLETED_AT COLUMNS MIGRATION WRITTEN, THEN CONFIRMED APPLIED LIVE (afs-cv-000) — 2026-08-21

**UPDATE 2026-08-21:** Reid ran migration 017 in the Supabase Dashboard SQL
Editor and confirmed it completed with no errors, then independently
verified all four new columns exist via a direct `information_schema`
query in the Dashboard — four `true` results, covering
`quote_requests.color`, `shop_profile_library.color`,
`shop_profile_library.queue_position`, and
`shop_profile_library.completed_at`. This closes the FILE-ONLY status this
entry originally recorded (see below for the original write-up, left
intact for history) with the same standard of evidence migrations
013/015/016 already carry. No session has had a working Supabase MCP
connection to this project's actual instance to run that check itself —
this verification was run by Reid directly in the Dashboard.

Read every file in `supabase/migrations/` (001 through 016) in full and
this file's own live-apply status notes before choosing a migration
number, per the task's instruction. Confirmed
`016_source_tool_and_shop_profile_library.sql` is still in fact the
highest-numbered file on disk (001–016, no gaps) — so this migration is
correctly numbered 017. No discrepancy to note.

New `supabase/migrations/017_color_and_queue_position.sql`:
1. `quote_requests.color TEXT` — nullable, additive
   (`ADD COLUMN IF NOT EXISTS`), no default.
2. `shop_profile_library.color TEXT` — nullable, additive.
3. `shop_profile_library.queue_position INTEGER` — nullable, additive.
4. `shop_profile_library.completed_at TIMESTAMPTZ` — nullable, additive.

**No indexes, constraints, or defaults added beyond the four bare
columns above.** Checked migration 016's actual `shop_profile_library`
table before deciding, per the task's instruction not to invent a
convention: only 5 of its ~20 columns are indexed (`customer_name`,
`profile_name`, `status`, `due_date`, `created_at`); plain nullable text
columns like `material`, `gauge`, `order_number`, `hem_instructions`
carry no index. There is no "every nullable column gets a matching
index" pattern to extend here, so `color`/`queue_position` were left
unindexed like the unindexed majority.

`SCHEMA.md` updated: header counts (17 migration files, table count
unchanged at 54 since no new table is added), the `MIGRATION FILE
LOCATION` list, a new note on TABLE 15 (`quote_requests`) documenting
`color`, and a new note in the SHOP PROFILE LIBRARY TABLE section
documenting `color`/`queue_position`/`completed_at` — matching this
project's existing documentation depth/style for migration 016's own
additions in both places.

**This was originally written as a FILE-ONLY prompt, per its own
instructions — migration 017 had NOT yet been applied to the live
Supabase project at the time this paragraph was first recorded. It is now
CONFIRMED APPLIED LIVE per the UPDATE note at the top of this entry**,
following the same "pending manual apply" convention already used for
migrations 015 and 016, closed the same way: Reid ran this migration in
the Supabase Dashboard SQL Editor and independently confirmed via a direct
`information_schema` query, the same standard of evidence 013/015/016
already carry.

`pnpm tsc --noEmit`: 0 errors, run directly this session. This prompt
adds no UI, no API route, and no data-fetching code — there is no
browser surface to verify for this prompt itself. Per this file's own
verification standard (see top of file), the migration dependency is now
closed for downstream prompts (afs-cv-002 through afs-cv-005), each of
which still needs its own browser/Playwright confirmation independent of
this. Committed as `feat: add color, queue_position, completed_at columns
migration, file only (afs-cv-000)`.

---

## COLOR SWATCH IN COMMAND CENTER + shop_profile_library.color WRITE-THROUGH (afs-cv-003) — 2026-08-21

Read `app/admin/quote-requests/page.tsx`, `app/admin/quote-requests/[id]/
page.tsx`, `app/api/admin/command-center/approve-quote-request/route.ts`,
and `app/api/studio/send-to-pathfinder/route.ts` in full first, per the
task's own instruction, then re-verified those are still the only two real
`shop_profile_library`-writing PathfinderEdge send paths by grepping every
`pushProfileToPathfinder` caller.

**Found a third real send path not in the task's list:**
`app/api/admin/command-center/approve/route.ts` (wired to
`CommandCenterJobCard.tsx`'s approve button) also pushes to PathfinderEdge
for real, but has no `insertShopProfileLibraryRecord` call at all — a
pre-existing afs-sv-009 gap, out of this task's scope, noted rather than
silently expanded into. `app/api/admin/pathfinder/push-profile/route.ts`
is confirmed stubbed/not-live per `SITEMAP.md` and has no UI caller.

**Display:** list view (`lib/data/admin.ts`'s `getQuoteRequestsQueue` now
selects `color`) and detail view both render a new `ColorSwatchChip`
(`components/quote/ColorSwatchChip.tsx`) wherever material is shown — the
"Profiles" column in the list table (its only per-row spec column), and
the "Material / Gauge" column in the detail table's line-item rows. New
`findMetalColorByName()` in `lib/data/metal-colors.ts` resolves the stored
name back to a hex; since neither `color` column records which chart
(McElroy/PAC-CLAD) a name came from and a few names exist in both with
different hex values, it checks McElroy first — a known limitation of the
existing schema, not fixed here. No second CANVAS_COLORS-style exception
introduced — reused the one already documented in `ColorPickerModal.tsx`
(afs-cv-002).

**Write-through:** `approve-quote-request/route.ts` now selects
`quote_requests.color` and passes it to every `insertShopProfileLibraryRecord`
call. `send-to-pathfinder/route.ts` has no source quote_request (confirmed
in its own header comment), so `color` is threaded exactly like
`material`/`gauge` already are — a new body field populated from
FlashDraft's own `ColorField`-backed `color` state
(`app/studio/draft/page.tsx`).

`pnpm tsc --noEmit`: 0 errors, run directly this session. No browser/
Playwright access — per this file's verification standard, **IMPLEMENTED,
UNCONFIRMED**. Migration 017 (afs-cv-000) is now **CONFIRMED APPLIED
LIVE** (see the afs-cv-000 entry below) — `color` is a real column in both
tables; that dependency is closed, browser/live-send confirmation is still
needed.

**Full file replacement note:** every changed file was rewritten in full
via `Write` except `app/studio/draft/page.tsx` (3,748 lines), where a
single precise `Edit` was used instead to avoid transcription risk on a
full manual rewrite of a file that size — flagged explicitly rather than
silently deviating from the task's instruction.

Committed as `feat: show selected color in Command Center quote views,
populate shop_profile_library.color on both send paths (afs-cv-003)`.

---

## FULL-PAGE COLOR PICKER WIRED INTO 4 SUBMISSION SURFACES (afs-cv-002) — 2026-08-21

Read `lib/data/metal-colors.ts` (afs-cv-001) and the real seeded `materials`
rows in `supabase/migrations/002_seed_afs_data.sql` first, per the task's
own instruction, before grepping the codebase for real material-selection
surfaces rather than assuming which ones exist.

**Grep result — exactly 4 real surfaces, confirmed against the closed
`SourceTool` union in `lib/data/quote-request-source-tool.ts`:**
`app/studio/draft/page.tsx` (FlashDraft), `app/configure/page.tsx`
(Configurator — this **is** SPEC_FLASHING_CONFIGURATOR.md's real
implementation, no separate route exists), `app/quote/page.tsx` (Quote
Builder), and `app/upload/page.tsx` (Blueprint Takeoff AI results table —
not in the task's "known real candidates" list, found by the grep itself).
Checked and ruled out as non-selection surfaces: the architect resource
pages (`finish-palette`, `custom-profiles`, `cad-library` — all read-only
browse/reference) and the admin quote-request detail page (read-only
estimator review, not a selection surface — though it did get a new
`color` display line so the new column isn't invisible to admins).

**New:** `lib/data/material-color-requirement.ts` (maps each of the 9 UI
material label strings to its real `materials.category`; `painted_steel` →
McElroy required, `aluminum` → PAC-CLAD required, everything else → no
color field), `components/quote/ColorPickerModal.tsx` (full-page modal,
swatch grid + search, afs-* token chrome with a documented CANVAS_COLORS-
style exception for the swatch hex backgrounds only), and
`components/quote/ColorField.tsx` (the shared required-field trigger used
by all 4 surfaces).

**Modified:** `app/api/quote-requests/route.ts` (reads `body.color`, writes
`quote_requests.color`), and all 4 surfaces above. `app/upload/page.tsx`
needed different handling from the other 3 — it's the only surface where
one submission can carry several line items with different color-requiring
materials at once, so its per-row `ColorField` results feed
`buildRequestColor()`, which composes one semicolon-joined
`"ProfileType: ColorName"` entry per item needing a color rather than a
single value, since `quote_requests.color` is one column for the whole
request.

`pnpm tsc --noEmit`: 0 errors, run directly this session. No browser/
Playwright access this session — per this file's verification standard,
**IMPLEMENTED, UNCONFIRMED**. Migration 017 (afs-cv-000) is now
**CONFIRMED APPLIED LIVE** (see the afs-cv-000 entry below) — that
dependency is closed; a real submission through each surface still needs
to be checked in the database to confirm `quote_requests.color` actually
persists. Committed as `feat: full-page color picker required for painted
materials, wired into FlashDraft/quote builder (afs-cv-002)`.

---

## METAL COLOR CHART DATA EXTRACTED (afs-cv-001) — 2026-08-21

Verified both source PDFs still exist at their exact given paths
(`public/Metal Color Charts/McElroy Shades of Distinction Roof and Wall
Panels.pdf`, `public/Metal Color Charts/PAC CLAD Color Guide-2025.pdf`)
before doing anything else, per the task's own instruction.

Rendered each PDF page to a raster image with PyMuPDF (zoom 3×) and read
every color name directly off the rendered swatch grids:
- **McElroy — 18 colors.** The PDF has no extractable text layer at all
  (both pages are embedded scans); names were read visually off page 1's
  3×6 swatch grid and cross-checked against page 2's "Product Availability"
  matrix, whose column headers list the same names as plain text (this
  matrix has no swatches, so it was cross-reference only, not a color
  source).
- **PAC-CLAD — 51 colors** (7 Premium, 5 Timber Series Wood Grain, 39
  Standard). This PDF has a real text layer; page 2's full swatch grid was
  used as the source. Page 1 is a cover-page teaser repeating an 18-color
  subset already present on page 2 — confirmed no new names there before
  discarding it as a source.

Full extracted name lists were printed to the session transcript in
reading order for Reid to spot-check directly against the two physical
charts — **that spot-check has not happened yet.**

Hex values were sampled programmatically, not guessed: each swatch's cell
boundaries were located (connected-component detection on PAC-CLAD's
clean white background; fixed-grid-pitch math on McElroy's noisier scanned
background, calibrated by sampling known swatch centers), then the median
RGB of a center-inset region was converted to hex. Textured/metallic/wood-
grain swatches that don't reduce to one flat color (Galvalume Plus,
Cor-Ten AZP Raw, Anodic Clear, Silversmith, Silver, Weathered Zinc,
Weathered Steel, all five Timber Series colors) use that same median-
sampled value as a stated approximation rather than being left blank, per
the task's instruction.

New file `lib/data/metal-colors.ts` exports `MetalColor { name, hex }` and
two arrays, `mcelroy` and `pacclad`. A comment at the top of the file
states explicitly that the NAME is the source of truth for fabrication and
ordering and hex values are display-only approximations, not fabrication
specifications — matching the task's explicit instruction.

`pnpm tsc --noEmit`: 0 errors, run directly this session. No UI/API route
was built to consume this data (out of scope for this prompt), so there is
no browser surface to verify. Per this file's own verification standard,
this is **IMPLEMENTED, UNCONFIRMED** — specifically pending Reid's own
spot-check of every extracted name against the two physical charts before
any of this data is trusted for fabrication or ordering. Committed as
`feat: extract McElroy and PAC-CLAD color chart data into
lib/data/metal-colors.ts (afs-cv-001)`.

---

## FLASHDRAFT SNAP TOGGLES REMOVED (afs-sv-001) — 2026-08-20

Read `app/studio/draft/page.tsx` in full before touching anything (3,356
lines), per the task's own instruction not to guess at wiring from the UI
alone. Removed the "Snap to 15° angle" and "Snap to 1/8" dimension" sidebar
checkboxes and every piece of logic behind them:

- `snapAngle` / `snapDimension` state, `applySnapping()`, `snapToGrid()`,
  and the `SNAP_ANGLE_DEGREES` / `SNAP_DIMENSION_INCHES` constants — all
  deleted.
- Three call sites that used them during drawing/editing (first-click
  anchor, vertex-drag reshape, click-drag-draw preview) now use the raw
  cursor position directly instead of a snapped one.
- The drag preview's angle label (`snapAngle && ...`) now always renders,
  since the toggle it was gated on no longer exists.

Left untouched, confirmed by re-reading before editing: hem logic, bend
logic, `clampDragAngle`'s 0°/180° guard rail, and the unrelated visual
background grid (`GRID_INCHES`, a different constant from the removed
`SNAP_DIMENSION_INCHES`).

Only `app/studio/draft/page.tsx` changed (full-file edits). `pnpm tsc
--noEmit` run directly this session: 0 errors. Per this file's own
verification standard (see top of file), this is **IMPLEMENTED,
UNCONFIRMED** — the user has not yet independently confirmed FlashDraft's
drawing/editing behavior in the browser with the toggles gone. Committed as
`fix: remove Snap to 15deg / Snap to 1/8in toggles from FlashDraft
(afs-sv-001)`.

---

## FLASHDRAFT WHEEL ZOOM FIXED (afs-sv-002) — 2026-08-20

Read the wheel-event handling code in `app/studio/draft/page.tsx` in full
before changing anything, per the task's instruction, and confirmed the bug
directly from the code rather than guessing from the reported symptom.

**Root cause:** zoom was wired via React's `onWheel={handleWheel}` JSX
prop. React always attaches `onWheel` as a **passive** native listener, so
`handleWheel`'s `e.preventDefault()` call was silently ignored — the
browser's native page scroll and the canvas zoom both fired on the same
wheel event, simultaneously and unpredictably, exactly as reported.
Separately, the old zoom math never adjusted `pan`, so zoom always scaled
around the canvas's fixed center rather than the cursor, causing the point
under the cursor to drift on every scroll.

**Fix:**
- Deleted the `handleWheel` React handler and the `onWheel` JSX prop.
- Added a `useEffect` that attaches a real native `wheel` listener via
  `canvas.addEventListener('wheel', handler, { passive: false })` — the
  only way to make `preventDefault()` actually stop page scroll.
- The handler now computes cursor position via `getBoundingClientRect()`
  and updates `pan` together with `zoom` so the world point under the
  cursor stays fixed on screen — single, deterministic, cursor-centered
  zoom.
- The effect depends on `[viewMode]`, matching the existing draw-loop
  effect's own reasoning: the `<canvas>` element unmounts/remounts when
  the user toggles the 2D/3D view toggle, so the listener must reattach to
  the new DOM node each time. Every effect run's cleanup calls
  `removeEventListener` before the next listener is attached (or on
  unmount), so listeners cannot accumulate across re-renders.

Only `app/studio/draft/page.tsx` changed (full-file edits, wheel-handling
code only — no color/styling touched). `pnpm tsc --noEmit` run directly
this session: 0 errors. Per this file's own verification standard, this is
**IMPLEMENTED, UNCONFIRMED** — the user has not yet independently confirmed
by scrolling the mouse wheel over the actual FlashDraft canvas that page
scroll no longer fires and zoom is now cursor-centered. Committed as `fix:
FlashDraft wheel handler - single cursor-centered zoom, no page scroll, no
duplicate listeners (afs-sv-002)`.

---

## FLASHDRAFT FIRST-LEG DRAG ASYMMETRY FIXED (afs-sv-003) — 2026-08-20

Read the leg hit-testing and drag-interaction code in
`app/studio/draft/page.tsx` in full before changing anything, per the
task's instruction, and confirmed the bug directly from the code rather
than guessing from the reported symptom.

**Root cause:** two compounding gaps, both keyed to point 0 (the first
leg's start, its "top"):

1. `hitTestVertex()` looped `i = 1` to `points.length - 2`, deliberately
   excluding BOTH true endpoints (point 0 and the last point) from direct
   vertex hit-testing.
2. That exclusion was invisible for the LAST point because leg-body
   dragging (`legBodyDragCandidateRef`) always drags the FAR vertex
   (`legIndex + 1`) of whichever leg's body is grabbed — for the last
   leg, that far vertex IS the last point, so grabbing its body still
   moved it correctly. For the FIRST leg, the same convention drags point
   1 (`legIndex + 1` where `legIndex = 0`) — never point 0. With point 0
   excluded from direct vertex hit-testing AND never the far vertex of
   any leg-body drag, no gesture could ever move it: grabbing near point
   0 fell through to leg-0 body-drag, stretching the leg by dragging
   point 1 away while point 0 stayed fixed. That reads exactly like the
   reported symptom — "grabbing near its top grows/resizes it instead of
   moving it."

**Fix:**
- `hitTestVertex()` now starts at `i = 0`, making point 0 a fully
  hit-testable, directly draggable vertex like every interior bend point.
  The last point stays excluded — that's a separate, deliberate design
  choice (owned by the "continue drawing from here" gesture), not part of
  this bug.
- `clampDragAngle()` and the `draggingVertexIndex` branch of
  `handlePointerMove` both special-case `idx === 0`, since point 0 has no
  leg before it to anchor the shared drag math against (which normally
  fixes `original[idx - 1]` and translates every point after `idx`).
  Mirrored instead: anchor on `original[idx + 1]`, move point 0 alone,
  translate nothing — the same behavior class as dragging the true last
  point (which also moves alone), not a divergent one. This is the one
  remaining special case for leg index 0, and it's structurally required
  (documented in both functions): point 0 genuinely has only one leg, on
  its far side, unlike every interior point which has one on each side.
- `selectedBendPoint` (Angle/Bend Radius panel) and the hover "radius too
  tight" tooltip both now explicitly skip point 0 — it has no bend angle
  or radius (no leg before it) and was never eligible for either before
  this fix; this just keeps the newly-hittable point 0 from opening a
  panel built for a point with legs on both sides.

Explicitly not touched: hem logic, bend-angle/length application
(`applyBendAngle`, `rotateChainAroundVertex`), and the leg-body-reshape
mechanism itself (`legBodyDragCandidateRef`, unchanged).

Only `app/studio/draft/page.tsx` changed (full-file edits, hit-testing and
drag-translation code only). `pnpm tsc --noEmit` and `pnpm run build` both
run directly this session: 0 errors, build passes. Per this file's own
verification standard, this is **IMPLEMENTED, UNCONFIRMED** — the user has
not yet independently confirmed by dragging the first leg's endpoint in
the actual FlashDraft canvas. Committed as `fix: FlashDraft first-leg drag
asymmetry - support same interactions as other legs (afs-sv-003)`.

---

## FLASHDRAFT WHOLE-PROFILE MOVE AFFORDANCE ADDED (afs-sv-004) — 2026-08-20

Read the full drag/interaction code in `app/studio/draft/page.tsx` (pointer
handlers, hit-testing, panning) before adding anything, per the task's
instruction, so the new gesture could be made to not conflict with any
existing leg-edit drag or with empty-canvas drag-to-draw.

**The ask:** a move affordance that translates ALL points of the profile
together — a true whole-profile move, distinct from editing one leg —
without repurposing the empty-canvas drag gesture (which continues to
extend the profile with a new segment, exactly as before).

**Interaction chosen (a UX decision made without direct user confirmation
— documented per the task's instruction):** hold Alt (Option on Mac) and
drag anywhere on the canvas while a profile exists. This reuses the file's
own existing modifier-key-for-a-distinct-drag-meaning convention —
`spacePressed` already means "this drag pans, not edits" — applied to a
second unambiguous meaning, rather than introducing a separate mode-toggle
button. The check in `handlePointerDown` runs before any vertex/segment
hit-testing, so it always wins: grabbing an endpoint or a leg body behaves
exactly as before whenever Alt is not held, and a plain drag on empty
canvas is untouched regardless of Alt state (the new branch requires
`points.length > 0` and returns before reaching the drag-to-draw fallback
either way). Cursor feedback (`grab` while Alt is held and hovering,
`grabbing` while actively moving) and an update to the toolbar's existing
shortcut-hint line are the only UI surface for discoverability — there is
no dedicated button.

**Implementation:** `isMovingProfile` state plus a `moveProfileOriginRef`
snapshot (mirroring the existing `panOrigin` pattern) captured at
pointer-down. On move, every point in that ORIGINAL snapshot — never the
live `points` state, so the delta can't drift or compound — is shifted by
one identical world-space `(dx, dy)`. On release, the pre-move snapshot is
pushed to the undo stack (skipped if the drag never crossed
`VERTEX_DRAG_THRESHOLD_PX`, matching the no-op guard the vertex-drag/
leg-reshape gestures already use elsewhere in this file).

**Numeric-identity verification (explicit task requirement):** a rigid
translation leaves every pairwise point relationship unchanged by
construction — `bendAngleAt`, leg length (`dist`), and the derived
`blankWidthInLive` are all computed purely from pairwise point positions,
so no leg length, bend angle, or blank width can change from this gesture.
This is a structural property of the math, not something that needed a
separate check. Hems are stored as direction/length data relative to their
endpoint, not as their own points, so they translate automatically.
Added a new Playwright test (`tests/e2e/flashdraft.spec.ts`) that draws a
2-leg profile, records the Blank Width/Bend Count readout, Alt+drags
starting exactly on the profile's bend vertex (proving Alt overrides the
ordinary vertex-grab there rather than only working over empty canvas),
and asserts both readouts are unchanged afterward. Extracted the existing
test's profile-drawing steps into a small shared `drawTwoLegProfile()`
helper so both tests use identical setup.

Explicitly not touched: every other drag gesture (vertex drag, leg
reshape, hem creation/editing, bend-radius/angle panels, pan, wheel zoom,
drag-to-draw of new segments) — none of their code changed; the new branch
is purely additive and is checked before all of them.

Only `app/studio/draft/page.tsx` and `tests/e2e/flashdraft.spec.ts`
changed. `pnpm tsc --noEmit` and `pnpm run build` both run directly this
session: 0 errors, build passes. Per this file's own verification
standard, this is **IMPLEMENTED, UNCONFIRMED** — the user has not yet
independently confirmed Alt+drag moving a profile in the actual FlashDraft
canvas. Committed as `feat: FlashDraft whole-profile move affordance
(afs-sv-004)`.

---

## FLASHDRAFT PREPEND-LEG-FROM-FIRST-LEG ADDED (afs-sv-005) — 2026-08-20

Read the leg-creation, bend/angle, hem-endpoint, and blank-width code in
`app/studio/draft/page.tsx` in full before changing anything, per the
task's instruction, specifically to understand how appending a leg at the
end already works so prepending could be made to produce equivalent,
correct results at the other end.

**What "append" already does, and why it can't be copy-pasted onto point
0 unmodified:** the last point is deliberately excluded from
`hitTestVertex()` (see afs-sv-003's own root-cause writeup above) so that
grabbing it always means "continue drawing" — `commitPoints([...points,
newPoint])`. Point 0, after afs-sv-003, is the opposite: it's now a fully
hit-testable, directly draggable vertex (grabbing it moves it in place).
That fix was correct and is not being reverted, which means point 0's own
screen position has no empty hit-radius left where a plain click/drag
could unambiguously mean "start a new leg" instead of "move this one."

**Interaction chosen (a UX decision made without direct user confirmation
— documented per the task's instruction, same as afs-sv-004's Alt+drag):**
hold Shift and drag anywhere on the canvas while a profile exists. Reuses
this file's own existing modifier-key-for-a-distinct-drag-meaning
convention (`spacePressed` -> pan, `altPressed` -> whole-profile move,
now `shiftPressed` -> prepend) instead of touching `hitTestVertex` or the
afs-sv-003 fix, or inventing a click-radius-based disambiguation that
would be fragile at different zoom levels. Checked in `handlePointerDown`
right after the Alt branch, before any vertex/segment hit-testing, so it
always wins over grabbing point 0 directly — that move gesture only ever
runs while Shift is NOT held. A new `prependDragRef` records, for the
duration of one drag-drawing gesture, which end the live preview
(draw-loop) and the eventual commit (`handlePointerUp`) should extend
from; it's reset unconditionally at the top of both `handlePointerDown`
and `handlePointerUp`, the same defensive pattern already used for
`legBodyDragCandidateRef`/`legReshapeGrabOffsetRef`, so it can never leak
into an unrelated later gesture.

**Why no other code needed to change — confirmed by reading, not
assumed:** every bend-angle, blank-width, and hem computation in this file
already operates generically on the live `points` array and on
`hemStart`/`hemEnd`, never on a specific point's identity:
- `bendAngleAt` loops `i = 1..points.length-2` over whatever `points`
  currently is.
- Blank width (both the live `blankWidthInLive` readout and the two
  debounced sync effects for profile-matching and the 3D viewer) sums
  `dist(points[i], points[i+1])` across every adjacent pair, so a leg
  prepended onto the front contributes its own length automatically.
- `hemStart`/`hemEnd` render and compute allowance at structural index 0
  / `points.length - 1`, not at a remembered point identity — exactly the
  same structural convention that already lets an appended leg silently
  inherit `hemEnd` at the new last point. Prepending a new point 0 makes
  it inherit `hemStart` the same way, for free, with no hem-transfer code
  needed.
- The OLD point 0 (shifted to index 1 after a prepend) becomes an ordinary
  interior bend point with two legs: its `radius` was always `undefined`
  (point 0 is excluded from `selectedBendPoint`/`applyBendRadius` by the
  afs-sv-003 fix, so it could never have had one set), and
  `getEffectiveRadius(1)` already falls back to
  `defaultBendRadiusIn(material)` for any point with no radius — the exact
  same fallback an appended profile's old last point already relies on.
- The NEW point 0 is drag/edit-capable exactly like every other leg with
  no new code: `clampDragAngle`'s `mirrored` branch and
  `handlePointerMove`'s `idx === 0` branch are keyed to the array index,
  not a remembered identity, so they apply automatically to whichever
  point is *currently* at index 0 — this is what directly resolves the
  task's afs-sv-003-interaction requirement: after a prepend, the new
  point 0 supports full drag/edit exactly like every other leg, and the
  old point 0 (now an interior point) supports full angle/radius editing,
  both without any additional special-casing.

**One real correctness fix inside the new code, not pre-existing:**
`selectedBendPoint`/`selectedSegment` are explicitly cleared the moment
the Shift+drag gesture arms (`handlePointerDown`), not just by
`commitPoints`'s own `setSelectedSegment(null)`. A prepend shifts every
existing point's index by one — a selection left pointing at its old
index would silently reference the wrong vertex/leg after commit. Append
never shifts any existing index, so it never needed this.

Only `app/studio/draft/page.tsx` changed (full-file edits). `pnpm tsc
--noEmit` and `pnpm run build` both run directly this session: 0 errors,
build passes. No new Playwright test was added for this feature (unlike
afs-sv-004) — the existing `tests/e2e/flashdraft.spec.ts` suite was not
re-run this session. Per this file's own verification standard, this is
**IMPLEMENTED, UNCONFIRMED** — the user has not yet independently
confirmed Shift+drag from the first leg's free end in the actual
FlashDraft canvas. Committed as `feat: FlashDraft prepend leg from
first-leg free end (afs-sv-005)`.

---

## FLASHDRAFT AUTOSAVE TO LOCALSTORAGE ADDED (afs-sv-006) — 2026-08-20

Read the current canvas state model, the Clear action (`clearCanvas`),
and the Submit for Quote action (`submitQuoteRequest`/`openSubmitFlow`)
in `app/studio/draft/page.tsx` in full before changing anything, per the
task's instruction.

**What was implemented:** a new `AutosaveState` (`points`, `hemStart`,
`hemEnd`, `material`, `gauge`, `lengthFeet`, `lengthInches`, `quantity`,
`notes`, `rush`) is written to `localStorage` under key
`afs-flashdraft-autosave`, debounced 500ms (`AUTOSAVE_DEBOUNCE_MS`) after
the last change via a `useEffect` keyed on all ten fields. A new
`autosaveHydratedRef` guards this write effect so it never fires with the
pre-restore initial (empty) state on first mount — it only starts writing
once the restore effect below has run. On mount, a separate restore
effect reads the key, validates shape with new `isPointArrayShape`/
`isHemShape` helpers (lenient versions of the existing `isPointArray`
check — no `length >= 2` floor, since an autosaved profile may be
mid-draw), and repopulates all ten fields if valid.

**Why saved-profile identity fields are deliberately excluded from the
autosave payload:** `profileName`, `revision`, `savedProfileId`,
`profileCategoryId`, and `profileSubcategory` belong to the separate
Saved Profiles feature (the `saved_configurations` table, `performSave`).
Restoring a stale `savedProfileId` on every page load would make a later
click of the "Save" button silently overwrite whatever unrelated saved
profile that stale id pointed to, instead of creating a new one as the
user would expect from a fresh, unsaved autosaved draft.

**Clear conditions, and why they're synchronous `removeItem` calls, not
left to the debounce:** exactly two call sites remove the key —
`clearCanvas()` (the Clear toolbar button) and the success branch inside
`submitQuoteRequest()`, right after a quote request is created. Both call
`window.localStorage.removeItem(AUTOSAVE_KEY)` directly in the same tick
as the state reset, rather than relying on the debounced write effect to
eventually overwrite the entry — if a user clicked Clear (or submitted)
and closed the tab inside the 500ms debounce window, an entry only
removed by the debounce's next write would still hold the pre-clear/
pre-submit state, and the next visit would wrongly restore it. Navigation
away or a plain refresh never calls `removeItem` anywhere, so the last
autosaved state always survives those.

**Why the existing `afs-flashdraft-draft` key (written by the
pre-existing manual "Save Draft" button, `saveDraft()`) was left alone:**
grepped the whole repo for it first — it's written in exactly one place
(`saveDraft()`) and read back nowhere; a corresponding restore has never
existed anywhere in the codebase. Reusing it for autosave would have
conflated an explicit user-initiated
save with a silent auto-save under one key; `afs-flashdraft-autosave` is
a new, separate key instead.

**Why the three existing Load code paths (`loadFromLibrary`,
`loadSavedProfile`, `loadCanonicalFromHandoff`) needed zero changes to
satisfy "Load must replace the autosave for the current session":** all
three already call `setPoints`/`setHemStart`/`setHemEnd` directly, which
happens after the one-time mount-restore effect (the restore effect is
declared earlier in the component and, for the URL-param-triggered loads,
completes essentially instantly since it's a synchronous localStorage
read with no `await`, well before the async `fetch`-backed loads
resolve). Because the debounced write effect is keyed off that same
state, the very next 500ms-debounced write after any Load naturally
overwrites `afs-flashdraft-autosave` with the newly loaded profile — no
explicit `removeItem` was needed in any of the three.

Only `app/studio/draft/page.tsx` changed. `pnpm tsc --noEmit` run
directly this session: 0 errors. `pnpm run build` and
`tests/e2e/flashdraft.spec.ts` were not re-run this session. Per this
file's own verification standard, this is **IMPLEMENTED, UNCONFIRMED** —
the user has not yet independently confirmed autosave/restore behavior
in the actual FlashDraft canvas (draw → refresh → state restored; Clear
→ refresh → state stays empty; Submit → refresh → state stays empty).
Committed as `feat: FlashDraft autosave to localStorage with debounce and
Clear/Submit-only clearing (afs-sv-006)`.

---

## SHOP_PROFILE_LIBRARY POPULATED ON PATHFINDEREDGE SEND, PROFILE LIBRARY ADMIN PAGE ADDED (afs-sv-009) — 2026-08-20

Read both real PathfinderEdge-send routes in full before changing anything,
per the task's own instruction not to assume: confirmed
`app/api/admin/command-center/approve-quote-request/route.ts` (admin
approves a quote request, one push per line item) and
`app/api/studio/send-to-pathfinder/route.ts` (FlashDraft's direct button,
independent of the quote-request pipeline — that file's own header comment
says so explicitly) are the only two real, distinct code paths that call
`pushProfileToPathfinder`. Also checked and ruled out two look-alikes:
`app/api/admin/command-center/approve/route.ts` (approves a
`pending_approval` `machine_jobs` row) is dead code in practice — nothing
ever creates a `machine_jobs` row at `pending_approval`, since
`approve-quote-request/route.ts` always inserts `approved_for_machine`
directly; and `app/api/admin/pathfinder/push-profile/route.ts` is a
generic stubbed test route (`SITEMAP.md`: "POST — stubbed, not live").

**Renderer reuse — the task's central constraint ("do not write new
rendering logic, find and call the existing renderer") — resolved
per source tool:**
- **FlashDraft:** its canvas draw loop
  (`app/studio/draft/page.tsx`'s "Draw loop" `useEffect`) is imperative and
  tightly coupled to live interaction state (zoom, pan, hover, drag-preview)
  — not a callable pure function. Both `sendToPathfinder()` and
  `submitQuoteRequest()` now call `canvasRef.current.toDataURL('image/png')`
  right before sending — an exact pixel snapshot of that same canvas, zero
  new drawing code. The direct-send route uses this snapshot immediately;
  the approval route (server-side, no canvas) reads back the snapshot
  captured at **submission** time, stored verbatim in
  `quote_requests.line_items[].geometryImage` (a plain passthrough field —
  `app/api/quote-requests/route.ts` stores whatever the client sends, no
  whitelist strips it).
- **Configurator:** items with no drawn `points` (`profileType` +
  width/height/legA/legB) are rendered via `lib/utils/profile-svg.ts`'s
  existing `generateProfileSVG()` — the same function `app/configure/
  page.tsx` and `app/upload/page.tsx` already call — via
  `slugToProfileType()`, wrapped in a `data:image/svg+xml` URI. An
  unmappable `profileType` (Quote Builder / Blueprint Takeoff AI items)
  gets `geometry_svg: null`, not a guessed diagram.

`geometry_points` (FlashDraft items only) stores `item.points` verbatim —
confirmed via `page.tsx`'s own `Point` interface (`{x, y, radius?}`) and
`getEffectiveRadius` that this IS FlashDraft's real internal point/bend
structure, not the separately-computed `bendRadiiIn` array used only for
the PathfinderEdge adapter's own feature-list construction.

New `lib/data/shop-profile-library.ts` holds `insertShopProfileLibraryRecord()`
(fails soft — try/catch, logs, never throws, same reasoning as
`logAdminAction` and every notification send per ARCHITECTURE.md §9: a
shop-record side effect must not roll back a response that already
reflects a real PathfinderEdge push) and `getShopProfileLibrary()` (the one
place `deleted_at IS NULL` is filtered, so a soft-deleted row disappears
from this admin page and from whatever afs-sv-010's Shop View turns out to
be, without either needing its own copy of that filter).

New `app/admin/profile-library/page.tsx` + `components/admin/
ProfileLibraryTable.tsx`: search/sort/filter table, `<img>` thumbnail per
row from `geometry_svg`, trash-can → confirm modal (same modal pattern as
`CommandCenterJobCard`) → `DELETE /api/admin/profile-library/[id]`, which
sets `deleted_at` only. "Profile Library" added to both occurrences of the
Command Center header nav bar in `app/admin/command-center/page.tsx`,
styled with the exact non-active-link className the existing CRM tab links
already use.

**Migration 016 is now CONFIRMED APPLIED LIVE** (see the updated afs-sv-007
entry below — Reid ran it in the Dashboard SQL Editor on 2026-08-20, then
independently verified via `information_schema` in the Dashboard) —
`shop_profile_library` exists and `quote_requests.source_tool` is real, so
these inserts should no longer fail at the database level.
`pnpm tsc --noEmit`: 0 errors, run directly this session. Per this file's
verification standard: **IMPLEMENTED, UNCONFIRMED** — no browser check has
been done, so the actual rendered thumbnails/table behavior has not been
confirmed by the user (the migration's live-apply status is no longer the
open question here; the UI/insert behavior itself still is). Committed as
`feat: populate shop_profile_library on PathfinderEdge send, add Profile
Library admin page (afs-sv-009)`.

---

## SOURCE_TOOL WIRED — QUOTE_REQUESTS INSERTS TAGGED, COMMAND CENTER SOURCE BADGE ADDED (afs-sv-008) — 2026-08-20

Grepped every `.from('quote_requests')` call site in the codebase directly
(per the task's own instruction not to assume from spec docs) rather than
trusting `SPEC_PHOTO_TO_QUOTE_AI.md`'s framing. Confirmed: **there is
exactly one real insert path**, `admin.from('quote_requests').insert(...)`
in `app/api/quote-requests/route.ts`. Everything else touching
`quote_requests` — both admin command-center routes, the chat AI's
order-history lookup, the machine bridge's pending-jobs poll, both
dashboard/list data files — only `select`s or `update`s it.

That one insert route is shared by four distinct front-end tools (found by
grepping for callers of `POST /api/quote-requests`), confirmed real by
reading each page:

1. **`app/studio/draft/page.tsx` (FlashDraft)** → `afs-flashdraft`
2. **`app/configure/page.tsx` (Custom Flashing Configurator)** →
   `afs-configurator`
3. **`app/quote/page.tsx` (Quick Quote / "Build Your Quote")** →
   `afs-quote-builder`
4. **`app/upload/page.tsx`** → `afs-takeoff`. This is the one genuinely
   ambiguous case worth flagging: `app/studio/page.tsx` markets this same
   page under two different tiles, "Scan to Quote" AND "Photo to Quote"
   (both `ctaHref: '/upload'`) — there is no separate photo-specific insert
   path despite the SPEC_PHOTO_TO_QUOTE_AI.md name; internally the code
   calls this feature "takeoff" throughout (`/api/takeoff`,
   `takeoff_uploads` table, `TAKEOFF_SYSTEM_PROMPT`), so `afs-takeoff` was
   used rather than inventing a name matching either marketing tile.

Each of the four pages now sends `sourceTool: '<token>'` in its
`POST /api/quote-requests` body. The route (`app/api/quote-requests/route.ts`)
validates it against a new shared allow-list module,
`lib/data/quote-request-source-tool.ts` (`isSourceTool` /
`SOURCE_TOOL_LABEL` / `sourceToolLabel`), and writes it to the new
`source_tool` column (migration 016, afs-sv-007 below) added to the
`quote_requests` insert — falling back to `'unknown'` for anything missing
or unrecognized, since the column has no CHECK constraint.

**Command Center UI — badge added everywhere a quote request is shown,**
matching the existing `Badge` component's `chrome` (neutral) variant used
elsewhere on these same cards for non-status tags:
- `components/admin/PendingQuoteRequestCard.tsx` — the Pending Approval
  tab's list view.
- `components/admin/CommandCenterDashboard.tsx` — the dashboard's "Quote
  Requests" recent-activity list view.
- `app/admin/quote-requests/[id]/page.tsx` — the detail page both list
  views link out to.

`lib/data/pending-quote-requests.ts` and `lib/data/command-center-dashboard.ts`
both now select `source_tool` and pass it through their row types.

**Migration 016 is now CONFIRMED APPLIED LIVE** (see the updated afs-sv-007
entry immediately below — Reid ran it in the Dashboard SQL Editor on
2026-08-20, then independently verified via `information_schema` in the
Dashboard). `select`/`insert` statements touching
`quote_requests.source_tool` should no longer fail at the database level.
`pnpm tsc --noEmit` passes (0 errors, run directly this session). Per this
file's verification standard (see top of file): this is **IMPLEMENTED,
UNCONFIRMED** — no browser check has been done, so the badge's actual
rendered behavior has not been confirmed by the user (the column's
live-apply status is no longer the open question here). Committed as
`feat: tag quote_requests inserts with source_tool, show
source badge in Command Center (afs-sv-008)`.

---

## SOURCE_TOOL COLUMN + SHOP_PROFILE_LIBRARY TABLE MIGRATION WRITTEN, THEN CONFIRMED APPLIED LIVE (afs-sv-007) — 2026-08-20

**UPDATE 2026-08-20:** Reid ran migration 016 in the Supabase Dashboard SQL
Editor and confirmed it completed with no errors, then independently
verified both `shop_profile_library` (table) and `quote_requests.source_tool`
(column) exist via a direct `information_schema` query in the Dashboard —
this closes the FILE-ONLY status this entry originally recorded (see below
for the original write-up, left intact for history) with the same standard
of evidence migrations 013/015 already carry. No session has had a working
Supabase MCP connection to this project's actual instance
(`lxfiziwsqezjjybeguqq` per `.env.local`) to run that check itself — the
only connection available this pass pointed at unrelated projects named
"tarritrix"/"tarritrix-audit" — the `information_schema` verification above
was run by Reid directly in the Dashboard.

Read every file in `supabase/migrations/` in full (001 through 015)
before choosing a migration number, per the task's instruction, and
confirmed `015_machine_jobs_delivery_method.sql` is in fact the
highest-numbered file on disk (no gaps) — so the new migration is
correctly numbered 016.

**Live-apply status check, done directly against this file's current
text rather than assumed, per the task's explicit instruction:**

- **Migration 015:** this file's own "CORRECTED 2026-08-20" note (under
  the "Command Center — added `machine_jobs.delivery_method`" prior-
  session entry, further down this file) states migration 015 **is
  confirmed applied to the live Supabase project**, verified via a direct
  `information_schema` query — not the "written and committed as a file
  only, not yet applied" status this task's own prompt described. That
  correction is this file's current, standing word on 015's status; it
  was not re-verified or changed by this session.
- **Migration 013:** contrary to this task's framing that it "is not
  addressed in SESSION_STATE.md," this file already contains a dedicated
  "MIGRATION 013 (bid_documents) — CONFIRMED APPLIED LIVE, 2026-08-20"
  section further down, stating Reid verified it directly via
  `information_schema` in the Dashboard SQL Editor.
- **MIGRATIONS_STATUS.md**, also checked directly: it only covers
  migrations 007–010 (its own title is "Migrations 007–010 — Live
  Status"); it says nothing about either 013 or 015.

Neither finding changes anything about migration 016 itself — recorded
here only because the task asked that the actual current text be checked
rather than trusted from memory or from the prompt's own framing, and
both findings are relevant discrepancies a future session should not
re-litigate from scratch.

**New migration `016_source_tool_and_shop_profile_library.sql` — written
FILE ONLY at the time this paragraph was first recorded; now CONFIRMED
APPLIED LIVE per the UPDATE note at the top of this entry.** Per this
project's standing migration-verification standard (no schema_migrations
ledger exists on this project), 016 now carries the same
`information_schema`-based confirmation migrations 013 and 015 already
have — see the UPDATE note above for exactly what evidence this status
rests on.

What it does:
1. `quote_requests.source_tool TEXT NOT NULL DEFAULT 'unknown'` — additive
   `ADD COLUMN IF NOT EXISTS`, defaults every existing row so no backfill
   is needed.
2. New table `shop_profile_library` — admin-only internal shop record of
   a profile job's full intake context, independent of (but optionally
   linked to via nullable `quote_request_id`/`machine_job_id` FKs) both
   `quote_requests` and `machine_jobs`. Full column list: `id`,
   `quote_request_id`, `machine_job_id`, `order_number`, `profile_name`,
   `customer_name`, `company`, `customer_email`, `customer_phone`,
   `account_notes`, `material`, `gauge`, `quantity`, `length_ft`,
   `due_date`, `hem_instructions`, `painted_edge` (default false),
   `special_instructions`, `geometry_points` (JSONB), `geometry_svg`,
   `source_tool`, `pathfinder_profile_id`, `status` (default `'queued'`),
   `created_at`, `deleted_at`.
3. RLS: admin only, matching `machine_jobs`' (005) inline
   `EXISTS (... role = 'admin')` pattern exactly — not the
   operator-inclusive pattern `bid_documents` (013) uses, since this is
   an internal shop record with no named operator user.
4. Indexes on `customer_name`, `profile_name`, `status`, `due_date`,
   `created_at`.

`SCHEMA.md` updated to document both the new column and the new table
(header counts, migration file list — also backfilled missing one-line
entries for migrations 014/015, a pre-existing gap in that list, not
caused by this change — TABLE 15 note, and a new SHOP PROFILE LIBRARY
TABLE section). `pnpm tsc --noEmit` — 0 errors. See
STATE_OF_THE_BUILD.md's matching afs-sv-007 entry for the full writeup.
Committed as `feat: add source_tool column and shop_profile_library
table migration, file only (afs-sv-007)`.

---

## CURRENT STATUS

**FOURTH revision applied (2026-08-20): bend angle now emits SIGNED
INTERIOR angle, not turn-angle. IMPLEMENTED, PENDING Reid's visual
verification matrix below — not yet confirmed.**

**Why the prior (turn-angle) revision's own confirmation didn't count as
real evidence:** the chevron test (profileId 32911527, 60°/-120° turn
values, "clean, correct leg lengths, no self-intersection") only checked
angle-blind criteria — leg lengths, vertex count, and self-intersection
are all invariant under a supplement swap (a 60/120 vs 120/60 interior
split both produce *some* clean chevron), so it could not actually
discriminate turn-angle from interior-angle semantics. This resolves the
contradiction flagged earlier this session — it was never real
counter-evidence, just a weak test.

**The decisive evidence:** profileId 32912069, a single-bend FlashDraft
"V" with a real, FlashDraft-canvas-confirmed interior angle of 45°,
pushed under the turn-angle formula (which sent 135°, the supplement) —
rendered in PathfinderEdge as ~135°, not 45°. A single-bend, single-value
test is angle-explicit in a way the multi-bend chevron wasn't, and is a
direct confirmation that PathfinderEdge wants the signed interior angle
directly.

**Formula, both `lib/integrations/flashdraft-to-pathfinder.ts`'s
`bendAngleAt()` and `approve-quote-request/route.ts`'s
`bendAngleFromPoints()` (identical, duplicated per this codebase's
established client/server-boundary precedent):** `sign(turn) × (180 −
|turn|)`, algebraically `-interiorSigned` everywhere except `turn === 0`.
Cross-product-equivalent sign-determination logic (the atan2-difference)
is unchanged from the prior revision. Two boundaries handled explicitly:
`|turn| = 180` (interiorSigned = 0, a hairpin/flat fold — formula
naturally emits `0`, correct, no meaningful handedness to sign in 2D at
that exact limit) and `turn === 0` (interiorSigned = 180, a dead-straight
non-bent point — the literal formula breaks here since `Math.sign(0) ===
0` would wrongly collapse it to `0`, the *opposite* degenerate case;
special-cased to return `180` directly).

**Item 1 — the staircase self-intersection verdict (profileId 32911526)
stays explicitly UNEVALUATED, NOT re-explained or resolved by this
revision.** That verdict rests entirely on two of Reid's own chat
messages (quoted in this file's git history), never independently
visually confirmed by any session (no session has browser access to
PathfinderEdge's web UI). It has not been re-checked this session. If it
turns out to genuinely contradict this revision once re-checked, this
revision is wrong too and needs to be revisited — it is not being
swept aside, just deprioritized behind the more decisive V-test evidence
per explicit instruction.

**Also still untested:** whether a bare `radius: 0` → `Angle`-type
feature behaves differently from the `Radius`-type feature every real
test so far has used (32911526, 32911527, 32912069 all appear to have
used material-default nonzero radii, based on `bendCount: 0` in each).

**Diagnostic capture made permanent:** the ad-hoc `console.log` used to
capture live POST bodies this session is replaced with an opt-in,
env-gated file capture in `pathfinder-edge.ts` — set
`PATHFINDER_DEBUG_CAPTURE=1` to write each outgoing POST body to
`diagnostics/pathfinder-capture-<timestamp>.json` (gitignored, silent/
zero-overhead when unset).

**VERIFICATION MATRIX — PENDING, Reid's own visual checks, none done
yet as of this write-up:**
| # | Test | Expected if this revision is correct |
|---|---|---|
| 1 | Single-bend V, sharp (~45°) | Renders as ~45°, not ~135° |
| 2 | 4-leg "W" profile, turns 45°/-60°/45°/-60° (mixed, non-90°) | Renders as the correct W shape, not distorted |
| 3 | Near-90° bend(s) (regression check) | Still renders correctly — this revision and the superseded turn-angle revision coincide at exactly 90°, so this must not have moved |
| 4 | A bend adjacent to a hem, and/or a near-180°/near-0° (straight-through) bend | Renders correctly at the boundary this revision's `turn === 0` special-case addresses |

**Not done, not claimed done:** no push was made by Claude this session
for this revision — per explicit instruction, Reid runs the verification
matrix above himself.

---

**Prior session (2026-08-19): CRITICAL fix — PathfinderEdge bend
angle was unsigned, then found to be the wrong angle model entirely, not
just missing a sign.** Scope: `lib/integrations/flashdraft-to-
pathfinder.ts`'s `bendAngleAt()`, `approve-quote-request/route.ts`'s
duplicated `bendAngleFromPoints()` — the single source of the `angle`
value PathfinderEdge receives for every real, drawn-geometry profile
pushed to the machine, via both the direct "Send to PathfinderEdge"
button and Command Center approval.

**Starting point (given, not re-diagnosed):** both functions used
`Math.acos`, which can only return 0–180 — incapable of a negative
number. PathfinderEdge's profile-object doc requires a signed angle
("the sign sets the bend direction"). Sending every bend unsigned
collapsed a real zigzag (signed 68°/-45°/75°/-45° on FlashDraft's own
canvas) into a closed triangular loop when pushed.

**First fix attempt — signed but still wrong, caught by a real push:**
made the angle signed by reusing `page.tsx`'s `signedAngleBetween`
exactly (same v1/v2 vectors, same atan2 formula the canvas already uses
to draw its own signed bend labels). Pushed a plain 4-leg right-angle
staircase through the real, unmodified `flashDraftToMachineProfile` +
`pushProfileToPathfinder` (profileId `32911526`, catalog 20115). **Reid's
own visual check: self-intersecting / geometrically impossible, not a
mirrored staircase** — ruled out a simple backwards-sign explanation,
since a mirror would still be a valid, buildable shape.

**Root cause, found via a captured POST body (intercepted `fetch`, not
hand-transcribed) compared side-by-side against the source points:**
`signedAngleBetween` returns the *interior* angle between the two legs
(180° = straight through) — but PathfinderEdge's `[Straight, Angle,
Straight, Angle, Straight...]` feature list expects a turtle-graphics
*turn-from-heading* angle (0° = straight through). These are different
quantities (`turn = interior + 180°`, wrapped), not sign-flip-equivalent
in general — they only happen to coincide (as a pure negation) when every
bend is exactly 90°, which is all the first test profile had. This exact
ambiguity was already flagged, unconfirmed, in `pathfinder-edge.ts`'s own
`buildFeatures` comment before this session.

**Final fix:** both functions now compute the signed interior angle as an
explicit intermediate step, then convert to the turn angle
(`turn = interiorSigned + 180°`, wrapped to `(-180, 180]`).

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 133/133
static pages.

**Second real push, deliberately non-90°** (a 90°-only test cannot tell
sign-flip apart from the turn-vs-interior-angle-model bug — they coincide
at exactly 90°, per Reid's own instruction to test something like
"60°/120°, not just right angles"): `+60°`/`-120°` turtle turns, profileId
`32911527`, catalog 20115. **Reid's own direct visual check, confirmed
explicitly as a genuine pass:** clean three-segment shape, correct 10"
leg lengths on all three segments, two distinct non-overlapping vertices,
no self-intersection.

**Not independently tested this session:** Command Center approval
(`approve-quote-request/route.ts`) was not pushed end-to-end through a
real quote request + admin click. Its real PathfinderEdge payload for
drawn-geometry items is provably identical to the direct-button path
already tested live (`buildMachineProfileForItem` calls the same
`flashDraftToMachineProfile` for that case) — a reasoned inference, not a
separately observed result. `route.ts`'s own `bendAngleFromPoints` was
fixed identically for consistency, even though its only real consumer is
`machine_jobs.custom_bends` (a human-review display column), never the
actual PathfinderEdge payload for that code path. Also untested: a bend
with an explicit `radius: 0` (a bare `Angle` feature rather than the
`Radius`-type feature both live tests exercised) — no evidence it behaves
differently, but not confirmed.

**Cleanup not done:** both test profiles (`32911526`, `32911527`) are
still live in PathfinderEdge catalog 20115 — flagged, not deleted, since
Reid may still want to look at them.

Stays **IMPLEMENTED, UNCONFIRMED** — a real visual check happened twice
this session and both passed, but per Reid's own standing instruction
mid-session ("do not conclude anything from your own screenshot alone"),
a session's own observation doesn't substitute for his independent
sign-off on this document.

**Follow-up (2026-08-19, later same day): read-only re-audit, requested
explicitly by Reid rather than trusting the fix session's own account —
no source files touched.** Read both `bendAngleAt()` (`flashdraft-to-
pathfinder.ts`) and `bendAngleFromPoints()` (`approve-quote-request/
route.ts`) directly: confirmed byte-for-byte identical logic in both,
and confirmed both currently carry the turn-angle fix, not the original
unsigned `Math.acos` version — `git status` clean on both files at time
of check.

Computed (via a throwaway script duplicating each formula, not importing
the real source) what both the current and original implementations
would emit for a constructed 5-leg, same-handed 45°/45°/38°/45° profile:
**current fix → `45, 45, 38, 45`** (reproduces the intended turn angles
exactly, by construction). **original unsigned version →
`135, 135, 142, 135`** — always positive, and (except coincidentally at
90°) a different magnitude than the true turn angle, not just a missing
sign — matching, numerically, the self-intersecting/collapsed-loop
failures already seen live earlier this session. No new live
PathfinderEdge push in this pass; this only confirms the already-pushed
fix is actually present in both files.

**Second follow-up (2026-08-19, same day): live GET on profiles
`32911527` and `32911528` — no source files touched.** Found a hard API
limitation: `GET /api/v1/profiles/{id}` does not return per-feature
geometry (confirmed via `404` on `/features` and `/geometry` sub-paths
for both IDs) — only summary fields (`profileName`, `blankWidth`,
`bendCount`, `hemCount`, etc.). **No bend-angle sign/magnitude, hem
parameters, or leg lengths are retrievable via this API for an existing
profile** — so no verdict is possible on what `32911528`'s stored bend
angles actually are; none of "alternating ~135", "same-signed ~135", or
"~45/45/60/45" could be confirmed or ruled out from available data.

`32911528` (`hemCount: 2`, `blankWidth: 34.375`) is **not** one of this
session's test pushes — its name matches the live "Send to
PathfinderEdge" button's own format exactly, so this looks like Reid
testing the fix live himself.

**Blank-width gap flagged, not resolved:** FlashDraft displayed 33 1/4"
for this profile, PathfinderEdge returned 34 3/8" (+1 1/8"). These are
two independently-computed values (FlashDraft: raw leg distances +
`hemAllowanceIn`, explicitly a display-only estimate per its own code
comment; PathfinderEdge: its own undocumented recompute from the
submitted features, plausibly including bend-radius contributions
FlashDraft's display never accounts for) that were never designed to
match. Exact reconciliation isn't possible without the original drawn
points/hem settings, which aren't available via the API. Real, open
question — separate from the bend-angle fix, worth its own look if
quoting accuracy matters here.

---

**Prior session (2026-08-18): Command Center — the full approval
pipeline now reaches PathfinderEdge automatically, with hems included as
real features, not just blank-width numbers.** Scope: `approve-quote-
request/route.ts`, `pathfinder-edge.ts`, `flashdraft-to-pathfinder.ts`,
`app/studio/draft/page.tsx`, `PendingQuoteRequestCard.tsx`, `lib/data/
pending-quote-requests.ts`. Direct answer to what this prompt asked:
approving a quote request in the Command Center now pushes every line
item to PathfinderEdge for real, as part of that one click — confirmed
via a real end-to-end test through the actual UI, not assumed.

**`delivery_method` default flipped from `machine_bridge` to
`pathfinder_edge`** — the real, intended change, confirmed explicitly
with Reid in this conversation (separate from migration 015's earlier,
deliberately-zero-behavior-change default).

**Every line item now gets pushed, not just item 0** — this route used
to hard-reject multi-item quote requests (a 422). Removed; now creates
one `machine_jobs` row per item, each pushed to PathfinderEdge
individually. `PendingQuoteRequestCard.tsx`'s Approve button is no longer
disabled for multi-item requests (was permanently disabled before) — now
shows an informational note instead. **Flagged for Reid, not decided
here:** N items now show as N separate cards sharing one request number
in the Sent tab — whether that should visually group into one card is a
real product decision.

**Fails loud on any PathfinderEdge push failure** — every item pushes
before any DB write; one failure aborts the whole approval with nothing
inserted and the quote request left `submitted`, so nothing looks
approved when it wasn't.

**Hems now convert to real OpenHem/ClosedHem/TearDropHem features — the
gap flagged at the end of last session, fixed as explicitly instructed,
not left partial.** `MachineProfile` gained `hemStart`/`hemEnd`;
`buildFeatures` constructs real hem features placed exactly per the
profile-object doc's own worked example (a short "leader" Straight using
the hem's own length, between the hem feature and the real leg
material). `page.tsx`'s two hem-sending call sites now also send `kick`
(needed for hem direction — was never sent before, a gap this session
found and closed while fixing the bigger one). Two mappings stay
explicitly UNCONFIRMED — `hemDirection` (kick → Positive/Negative has no
empirical basis yet) and `hemClampOffset` (defaulted to 0, no source
data anywhere).

**Diagnostic finding worth recording:** PathfinderEdge's `bendCount`
field only counts `Angle`-type features, not `Radius`-type ones —
confirmed with two isolated test profiles (posted and deleted). Not a
bug; the real end-to-end test below shows `bendCount: 0` for a profile
with one real bend because that bend used a material-default `Radius`,
not a bare `Angle`.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 133/133
static pages.

**Real end-to-end test, through the actual Command Center UI:** posted a
real quote request (guest, via the real `/api/quote-requests` route) — a
2-leg/1-bend Copper profile with a real `open` hem at the start. Logged
in as a throwaway admin via Playwright, clicked "Approve & Send to
Machine" on the live page, watched it move to the Sent tab showing
"Approved — Sent to PathfinderEdge". Resolved the real PathfinderEdge
profileId via the audit log and called `GET /api/v1/profiles/{id}`
directly: **`"hemCount":1`** — confirmed by PathfinderEdge itself, not
inferred. `blankWidth: 19.25` reconciles exactly (0.5 hem leader + 10 +
0.75 radius allowance + 8 = 19.25). Screenshots: `proof-hem-e2e-before-
approve.png`, `proof-hem-e2e-approved-card.png`.

**Cleanup — mostly complete, one thing flagged rather than forced:** the
test PathfinderEdge profile, `machine_jobs` row, and `quote_requests` row
were all deleted. The throwaway admin account
(`hem-e2e-admin@afs-internal.test`) could NOT be deleted — real
`admin_audit_log` rows this test created foreign-key to it, and forcing
that deletion by removing audit trail data seemed like the wrong call to
make alone. It has `role: 'admin'` and is still in the system — Reid
should decide whether to remove it.

Stays **IMPLEMENTED, UNCONFIRMED** — mechanism proven end-to-end with a
real hem confirmed by PathfinderEdge itself, but `hemDirection`'s
correctness, the multi-item Command Center UI question, and the leftover
test admin account all need Reid's review.

---

**Prior session (2026-08-18): FlashDraft — added a direct "Send to
PathfinderEdge" button, entirely separate from the quote-request/
job-approval pipeline.** Scope: new `lib/integrations/flashdraft-to-
pathfinder.ts`, new `app/api/studio/send-to-pathfinder/route.ts`,
`app/studio/draft/page.tsx`. Does not touch `machine_jobs`,
`delivery_method`, `approve-quote-request`, or any of the routing work
from earlier tonight — a user can now push the CURRENTLY DRAWN canvas
profile straight to PathfinderEdge with one click, independent of
everything else.

`pushProfileToPathfinder` reused exactly as-is (not rewritten, per this
prompt's explicit instruction) — a new adapter converts FlashDraft's own
`points`/`hemStart`/`hemEnd`/`material`/`thicknessIn` state (the same
data already driving the Profile Info Panel) into the `MachineProfile`
shape that function already accepts. The route is admin-gated the same
way `approve/route.ts` already is (checked that existing pattern rather
than inventing one) — the button itself only renders for a signed-in
admin, and the route independently re-checks server-side. Catalog is
hardcoded to `20115`, not configurable in the UI, per instruction.

**Known, inherited, not-fixed-here gap:** hems only feed into the
blank-width calculation, not as real PathfinderEdge hem features — same
gap already flagged in `pathfinder-edge.ts` from last session, now also
reachable through this direct button.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 133/133
static pages (new route added one).

**Real click-test performed, not just tsc/build.** No standing E2E test
credentials exist in this repo, so a throwaway admin account was created
via the Supabase service-role client, used once through a live Playwright
session against the real `pnpm dev` server (logged in, drew an 11"
segment, clicked the button), and confirmed the live UI showed
"PathfinderEdge profileId: 32910125" — independently verified via a
direct `GET /api/v1/profiles/32910125` (200, `blankWidth: 11.0`,
`owningCatalogId: 20115`, exactly matching). Both the test PathfinderEdge
profile and the throwaway admin account were deleted immediately after —
nothing left behind in either system. Screenshot saved at repo root:
`proof-flashdraft-send-to-pathfinderedge.png`.

Stays **IMPLEMENTED, UNCONFIRMED** — this session's test used a temporary
account, not Reid's own login, and proves the mechanism works, not that
the button placement/UX is what Reid actually wants.

---

**Prior session (2026-08-18): Command Center — added
`machine_jobs.delivery_method` to eliminate a genuine double-send risk
between PathfinderEdge and the Machine Bridge.** Scope: new migration
`015_machine_jobs_delivery_method.sql`, `approve-quote-request/route.ts`,
`approve/route.ts`, `pending-jobs/route.ts`, `lib/data/machine-jobs.ts`,
`CommandCenterJobCard.tsx`.

**The problem, confirmed from code, not re-diagnosed:** the Machine
Bridge's poll and PathfinderEdge's push (wired last session) both keyed
off the exact same `machine_jobs.status = 'approved_for_machine'` value —
a job could reach the physical Thalmann via both, independently, with no
human decision about which path to use. Fixed with a new, orthogonal
column (`delivery_method: 'pathfinder_edge' | 'machine_bridge'`) — status
stays purely an approval-state field, not overloaded.

**A real finding worth knowing regardless of urgency:** grepped every
write site to `machine_jobs.status` and confirmed `approve-quote-request/
route.ts`'s insert is the ONLY place a `machine_jobs` row is ever created,
and it always sets `status: 'approved_for_machine'` directly — meaning no
job has ever actually reached `pending_approval` through the app, so the
PathfinderEdge push wired last session has never fired against a real
job yet. This risk is real and structural, not something that has
already caused an actual double-send in production.

**Default confirmed directly with Reid, not assumed** (per this prompt's
explicit instruction to ask rather than guess a business default):
`'machine_bridge'`, because that's exactly what already happens for every
quote-request-originated job today — zero behavior change, just makes
the existing behavior explicit and queryable. Set both as the migration's
column default AND explicitly in `approve-quote-request/route.ts`'s
insert (not left to the default alone).

**Every write site checked, full list:** `approve-quote-request/route.ts`
(insert, now sets `delivery_method` explicitly) and `approve/route.ts`
(update, now refuses with a 409 if `delivery_method !== 'pathfinder_edge'`
before doing anything else) are the only two that ever set
`status = 'approved_for_machine'`. `request-changes/route.ts`,
`mark-delivered/route.ts`, `reject/route.ts`, and `machine-bridge/
job-delivered/route.ts` were each grepped directly and confirmed to only
ever set other status values — safe, not touched.

`pending-jobs/route.ts` now filters on `delivery_method = 'machine_bridge'`
in addition to the status check, so a PathfinderEdge-routed job can never
be picked up by the Bridge's poll. `CommandCenterJobCard.tsx`'s stale
"Approved — Queued for Bridge" label (shown for every approved job
regardless of which system actually had it) now reads `deliveryMethod`
and shows the correct one of two real labels.

**CORRECTED 2026-08-20 — Migration 015 CONFIRMED applied to the live
Supabase project.** The note directly above this one, claiming the
migration was file-only and not yet applied, was wrong. Verified
2026-08-20 via a direct `information_schema` query: `machine_jobs.
delivery_method` exists on the live schema. This project's live Supabase
database has **no migration ledger** — there is no `schema_migrations`
table; migrations are applied manually via the Dashboard SQL Editor, with
no automated record of what has and hasn't run. Because of that, a
migration's live-apply status must never be assumed from its presence in
`supabase/migrations/`, from git history, or from a prior note in this
doc — it must be verified directly via `information_schema` (or
`pg_proc` for functions) each time it actually matters.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages, no errors.

---

**Prior session (2026-08-18): PathfinderEdge — the stub is now a
real, live integration, and the "Approve & Send to Machine" button makes
a genuine API call instead of only flipping a DB status flag.** Scope:
`lib/integrations/pathfinder-edge.ts`, `app/api/admin/command-center/
approve/route.ts`, `.env.example`, `ARCHITECTURE.md`, new
`scripts/pathfinder-roundtrip-test.ts` (manual-run only, not wired to
CI/build).

**Direct answer to the question this task existed to settle: yes — the
live approve button now makes a real PathfinderEdge API call** (confirmed
by reading `approve/route.ts` both before and after the change, not
assumed).

The prior stub's premise — "no REST API discoverable" — was wrong. The
real API (https://docs.amscontrols.com/pathfinderEdge/publicapi,
https://docs.amscontrols.com/pathfinderEdge/profile-object, both fetched
and read in full this session before writing any code) needs the key raw
in the `Authorization` header, no `Bearer`/`X-API-Key` prefix — the
earlier discovery pass tried the wrong auth format and concluded nothing
existed. `GET /api/v1/catalogs` now returns real data.

**A separate, unrelated blocker surfaced mid-session and was root-caused,
not worked around:** `.env.local`'s stored `PATHFINDER_EDGE_API_KEY` was
stale, not the key Reid had just confirmed live minutes earlier — every
request with it returned a clean 401. Ruled out key corruption (verified
byte-for-byte via hex dump — clean) and network/proxy issues (same
sandbox, same request shape; the correct key worked on the very next
call) before concluding it was simply the wrong stored value. Reid
supplied the current key; `.env.local` (gitignored) now holds it.

**Units — the open question this task called out three times — are
confirmed empirically as inches**, via two independent signals in
`scripts/pathfinder-roundtrip-test.ts`: (1) 10 real pre-existing profiles
already in catalog 20115 have blankWidth values (2.375-23.5) that are
only plausible as inches for real flashing parts — e.g. "PJC Austin" = 6,
"Standing Seam Drip Edge" = 8; (2) a known 6" bendless/hemless profile
posted, its server-assigned profileId resolved (POST's response never
echoes it — confirmed via the doc, worked around with a follow-up
catalog-scoped list-by-name call), read back as `blankWidth: 6` exactly,
then deleted. Reid confirmed this result live before Part 3 (wiring the
approve button) proceeded, per this prompt's explicit gate.

**Three things intentionally NOT resolved this session, flagged rather
than silently shipped:**
1. No hem data flows through `machine_jobs`/`machine_profile_bends`
   anywhere in the schema yet, so profiles pushed to PathfinderEdge today
   never include `OpenHem`/`TearDropHem` features even when the real job
   has hems — a data-model gap, not a client-code bug.
2. The bend-angle sign convention and the `radiusQuality: 'Medium'`
   placeholder default are best-effort mappings, not empirically
   confirmed — the round-trip test deliberately used a bendless profile
   to isolate the units question alone.
3. **Possibly the most important open item:** the separate
   `afs-machine-bridge` project still polls `approved_for_machine` jobs
   and generates `.ds1` files for a human to manually review and copy to
   the machine. Approving a job now ALSO pushes it into PathfinderEdge's
   catalog 20115, which the machine polls automatically. Both paths can
   now reach the same physical machine for the same job independently —
   whether one should be disabled, and which, was out of scope for this
   prompt and needs an explicit decision from Reid, not a default choice
   made silently by a future session.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages, no errors.

---

**Prior session (2026-08-18): FlashDraft — flipped the inverted Kick
mapping, split the shared Open/Smashed gap default into type-specific
values, and widened the double-click re-open radius for an existing
hem.** Scope: `app/studio/draft/page.tsx`, `lib/types/profile.ts`. Three
independent fixes, all root-caused and confirmed live by Reid before this
prompt (not re-diagnosed this session):

1. **Kick direction was inverted.** `mirrorGlyph = hem.kick === 'inside'`
   rendered backwards — Reid confirmed live that selecting "Outside"
   visually produced the inside result and vice versa. Flipped the single
   comparison to `mirrorGlyph = hem.kick === 'outside'`.
2. **Open and Smashed shared one default gap** (`HEM_DEFAULT_GAP_IN` =
   0.0625"/1/16"), reading as visually identical — confirmed by Reid live.
   Replaced with `HEM_DEFAULT_GAP_IN_OPEN = 0.1875` (3/16") and
   `HEM_DEFAULT_GAP_IN_SMASHED = 0.03125` (1/32") in `lib/types/profile.ts`.
   `gapIn` stays fully per-hem editable; this only changes a newly created
   hem's starting value. `applyHem` now resolves the type-specific default
   directly from the type button clicked (rather than filtering through
   the `hemGapDraft` text field, which the old single-constant version did
   but which the Gap input can't actually have been user-edited through
   before a hem exists) and re-syncs `hemGapDraft` to the resolved value
   so the displayed field never lags the real `hem.gapIn`. Teardrop has no
   gap concept (confirmed `hem-glyph.ts`'s teardrop branch never reads
   `gapPx`) — it inherits Open's default only because `gapIn` is a
   required field on `Hem`, not because either constant matters for it.
3. **Re-opening an existing hem's popup was too easy to miss** — the only
   trigger was double-clicking the exact `HEM_TRIGGER_OFFSET_IN`-offset
   point, with no feedback on a near-miss and no way to distinguish it
   from the neighboring bend-radius control. Added
   `HEM_HIT_RADIUS_EXISTING_PX = 38` (~1.75x the existing
   `HEM_HIT_RADIUS_PX = 22`, within Reid's requested 1.5x-2x range),
   applied only when `hemStart`/`hemEnd` is already set at that endpoint —
   new-hem creation keeps the original tighter radius.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated, no errors.

Verified on a live `pnpm dev` server via a standalone Playwright script
(the Claude-in-Chrome extension was not connected this session, so this
went through Playwright directly against the same real dev server and
canvas rather than the usual extension-driven flow). Five screenshots
saved at repo root: `proof-hem-kick-direction-full.png` (one profile, both
endpoints — Outside default at the start, Inside explicitly picked at the
end) with tight closeups `proof-hem-kick-start-outside-closeup.png` /
`proof-hem-kick-end-inside-closeup.png` (Hem Length/Gap temporarily bumped
to 3"/1" via the popup's own editable fields, purely so the mirrored
U-shape reads clearly at 1x app zoom, not a code default change);
`proof-hem-gap-defaults-full.png` (Open at the start reading "OPEN 3/16"
gap", Smashed at the end, with the popup's own Gap field read back as
0.1875 and 0.03125 respectively before closing); `proof-hem-reopen-
reliability.png` (an existing Open hem re-opened 3/3 times via
double-clicks offset 18-22px from the true vertex — inside the new 38px
radius, outside the old 22px one).

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own visual check — specifically whether the
flipped kick mapping now matches his reference sketch (this session had
no access to that sketch, only his description that the old mapping was
backwards) and whether 3/16"/1/32" read as sufficiently distinct at
default zoom in normal use, not just in the length/gap-exaggerated
closeups used here for clarity.

---

**Prior session (2026-08-17): FlashDraft teardrop — restored the
validated tangent-circle proportions and enforced a real minimum visible
size, fixing a regression from the immediately-prior teardrop-sizing
session.** Scope: `lib/flashdraft/hem-glyph.ts`, `app/studio/draft/page.tsx`.
Root cause was given directly in the prompt (not re-diagnosed this
session) — two distinct problems, both introduced by the earlier
"decouple teardrop size from Hem Length, derive from material thickness"
pass:

1. **Proportions had drifted.** `hem-glyph.ts`'s `d = R * 0.3, r = R *
   0.22` were tighter than the earlier Reid-confirmed `d = R * 0.42, r =
   R * 0.36`. Restored those two literals exactly as given.
2. **The floor was too small to read as a closed loop.** With no gauge
   selected, `effectiveThicknessIn` falls back to 0.0625", and the prior
   session's `Math.max(HEM_GLYPH_R, ...)` (6px floor) meant `R` always
   collapsed to exactly 6px in that case — at the tangent-circle ratios
   above, under 4px across, reading as a dot rather than a loop. This is
   Reid's own reported failing case (his live test had no gauge
   selected). Added a new `MIN_TEARDROP_R = 14` constant and switched the
   floor to `Math.max(MIN_TEARDROP_R, ...)`, deliberately separate from
   `HEM_GLYPH_R`/`MIN_READABLE_R` (Open/Smashed's own floor) since
   Teardrop is supposed to look tighter than Open's hook, not the same
   size.

`TEARDROP_THICKNESS_TO_R` itself, the straight connecting-line logic, and
the Open/Smashed branches were explicitly out of scope and untouched —
confirmed via `git diff` that only the two lines above changed in each
file. The popup icon (`HemGlyphIcon`/`HEM_ICON_GLYPH_R`) was also
explicitly out of scope this prompt (tracked separately) and not touched.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded on the first
attempt this session (no repeat of the OneDrive `.next/trace` lock from
two sessions ago — `.next` was already writable throughout), 132/132
static pages generated.

Verified on a live `pnpm dev` server (no Chrome DevTools extension
connected in this environment, same limitation as recent sessions) via a
throwaway Playwright script that explicitly reproduced Reid's exact
failing case — drew a leg, applied Teardrop, left `#material`/`#gauge`
unset, and read both fields back as empty strings before screenshotting
to confirm the no-gauge fallback path was actually exercised, not
assumed. Zoomed the canvas to 177% via the toolbar's own zoom-in control
(not just a tight image crop) before capturing. Two screenshots saved at
repo root: `proof-teardrop-no-gauge-full.png` (1400×900px, 134KB, full
canvas with sidebar/toolbar for context) and `proof-teardrop-no-gauge-
closeup.png` (160×120px — small file size is expected for a mostly-flat-
background PNG, not a sign of a broken/near-empty capture; visually
confirmed before reporting — a tight crop centered by scanning the
canvas's own pixel data for the crimson glyph, rather than a guessed
screen offset, on the loop location). Both clearly show a small closed
circle at the tip, distinct from a dot, with the long straight run
visible leading into it.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own visual check — the two numeric constants
(`0.42`/`0.36` ratios, `MIN_TEARDROP_R = 14`) were specified exactly in
the prompt rather than derived or tuned by this session, so what remains
unconfirmed is specifically whether they combine to produce the loop
tightness/size he actually wants, not whether the code correctly
implements the numbers given.

---

**Prior session (2026-08-17): site-wide legibility fix for small
uppercase crimson "eyebrow label" text on dark backgrounds — one new
shared `.eyebrow-label` CSS class applied across 9 files (10 call
sites).** Scope: `app/globals.css` plus the 9 files listed in this
prompt — `app/(public)/about/page.tsx`, `app/(public)/contact/page.tsx`,
`app/(public)/flashchat/page.tsx`, `components/account/
ProductionTimeline.tsx`, `components/admin/BidMonitorProjectsTable.tsx`,
`components/admin/CommandCenterJobCard.tsx`, `components/admin/
PendingQuoteRequestCard.tsx`, `components/ai/ChatWidget.tsx`,
`components/resources/ResourcesBrowser.tsx`.

**Root cause (per Reid, confirmed via DevTools computed style, not
guessed):** small `font-label uppercase tracking-wide text-xs
text-afs-crimson`-style text computes to the correct `--afs-crimson`
value (`rgb(192 0 26)`) but reads visibly less saturated than solid
crimson shapes at the same value — an antialiasing/small-text legibility
effect, not a wrong color. `--afs-crimson` itself was intentionally left
untouched.

**Fix — one shared class, not a token change.** `.eyebrow-label` added to
`app/globals.css`: sets font-family (Barlow, = `font-label`),
`text-transform: uppercase`, `color: var(--afs-crimson)`, `text-shadow:
var(--afs-crimson-glow)` (reused the already-defined glow token, adds
perceived brightness without changing the base color), and
`font-weight: 600` (Barlow's next loaded weight step above these labels'
previous unstyled 400 default — heavier strokes at small sizes reduce
the antialiasing-driven desaturation).

**Deliberately did NOT bake in font-size or letter-spacing**, despite the
prompt's literal wording describing the pattern as including
`tracking-wider text-xs` — a judgment call worth flagging. The 9 files'
10 call sites use genuinely different sizes/tracking on purpose (a hero
kicker at `text-lg`, a dense admin-table badge at `text-[10px]`,
`tracking-wide` vs `tracking-widest` elsewhere), and `globals.css`'s
plain (non-`@layer`) CSS rules are emitted in the compiled stylesheet
*after* Tailwind's own generated utility classes — at equal (single-
class) specificity, a `font-size` set inside `.eyebrow-label` would
always win over an element's own `text-xs`/`text-lg`/etc. utility
regardless of className order in the JSX, silently shrinking/growing
every instance to match `.eyebrow-label`'s own value. Baking in
`tracking-wider` would have the same problem for the several instances
that use `tracking-wide` or `tracking-widest` on purpose. Kept those two
properties out of the shared class entirely so every instance keeps its
own existing `text-*`/`tracking-*` utility class untouched — only
`font-label`, `uppercase`, and `text-afs-crimson` were replaced with the
single `eyebrow-label` class at each of the 10 call sites, per this
prompt's own "do not remove non-color-related classes" instruction. If
Reid actually wants full normalization to one size/tracking value
site-wide, that's a one-line follow-up (add `font-size`/`letter-spacing`
to `.eyebrow-label` and drop the per-instance `text-*`/`tracking-*`
classes) rather than a redesign.

**Real bug caught by the build gate, not code review.** The first draft
of the explanatory CSS comment above `.eyebrow-label` used the literal
phrase `text-*/tracking-*` — its `*/` substring is a valid CSS
comment-close token, so it silently terminated the comment early inside
`globals.css`. `pnpm tsc --noEmit` doesn't parse CSS so it stayed green,
but `pnpm run build`'s CSS minification step (`cssnano`, via webpack)
failed with `Unexpected '/'. Escaping special characters with \ may
help.` at the generated stylesheet's exact broken position. Fixed by
rewording the comment to avoid any literal `*/` sequence, confirmed via
`grep '\*/'` against the whole comment block before rebuilding. Worth
remembering for future CSS comments in this file: never use a
glob-style `word-*/word-*` shorthand inside a `/* ... */` block.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded on the
second attempt (first attempt failed on the `*/` bug above, real error,
not environmental — full CSS minifier stack trace pasted in
STATE_OF_THE_BUILD.md's matching entry), 132/132 static pages generated.
No repeat of the prior session's OneDrive `.next/trace` lock — `.next`
already existed from that session's last successful build and stayed
writable throughout this one, no pause needed.

Verified live on a real `pnpm dev` server (this environment has no
Chrome DevTools extension connected, same limitation as last session) via
a throwaway Playwright script — screenshots of 4 distinct locations
across 3 of the 9 files, saved at repo root: `proof-eyebrow-
resources.png` (`/resources` — the exact "INDUSTRY STANDARDS & MANUALS"
card Reid referenced as his reference case), `proof-eyebrow-about-
hero.png` (`/about` hero "ABOUT AFS" kicker), `proof-eyebrow-about-
equipment.png` (`/about`'s three bordered equipment badges), `proof-
eyebrow-contact.png` (`/contact`'s PHONE/GENERAL/OWNER card labels — a
different visual treatment, plain text inside a card rather than a
kicker above a heading or a bordered chip, confirming the class works
across all three JSX shapes it was applied to).

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own check against the live site on his own
screen — this is fundamentally a perceptual call (does the text actually
read as more vibrant now) that no automated gate or session screenshot
can confirm on his behalf.

---

**Prior session (2026-08-17): FlashDraft teardrop curl now sized
from material thickness (not Hem Length) — root cause confirmed against
Reid's own reference photos of real formed material; investigated the
Inside/Outside kick "no visible difference" report and found the mirror
already renders correctly on the current code.** Scope:
`lib/flashdraft/hem-glyph.ts`, `app/studio/draft/page.tsx`, per this
prompt.

**Part 1 — Teardrop sizing.** `renderHemAt`'s teardrop branch computed its
glyph radius `R` with the exact same length-driven formula as Open —
`Math.max(MIN_READABLE_R, hem.lengthIn * PIXELS_PER_INCH * zoom *
HEM_GLYPH_LENGTH_SCALE)` — so raising Hem Length (meant to control the
visible straight fold-back run) ballooned the curl itself, contradicting
Reid's reference photos: a small, tight, closed loop only at the very
tip, with the strip running flat and straight almost its full length. Root
cause: the curl's real-world size should track material thickness, not
fold-back length. Fixed for the teardrop branch only (Open/Smashed's
length-driven `R` is unchanged, per this prompt's explicit instruction):
new `TEARDROP_THICKNESS_TO_R` constant (`= 1 / 0.22`, derived from
`hem-glyph.ts`'s own teardrop construction, where the loop's circle radius
is `R * 0.22` — this scale makes that circle's real-world radius work out
to ~1x material thickness) drives `R` from `effectiveThicknessIn` (`gauge
? thicknessIn : 0.0625`, the existing per-hem `thicknessIn` already
computed in this component) instead of `hem.lengthIn`. Floors at
`HEM_GLYPH_R` (6px, the same "never collapse to invisible" constant the
popup icons already use) rather than the 10px `MIN_READABLE_R` — that
larger floor is sized for Open's hook and reproduced the same "oversized
loop" symptom at typical zoom/gauge combinations. The straight connecting
line from the true vertex to the curl is unchanged — still driven by
`hem.lengthIn`, which matches the reference photos (the strip does stay
flat and straight until the tip).

Verified live at `/studio/draft` via a Playwright script (no Chrome
extension available in this environment — see below): with Hem Length set
to a deliberately generous 1.5", the curl renders as a small, tight,
closed loop right at the tip, with the long straight run clearly visible
before it — matching the reference photos' proportions described in this
prompt (the old formula would have rendered a ~30px oversized loop at
that length; the new one floors at 6px regardless of length). Screenshots
checked in at repo root: `proof-teardrop-thickness-sized.png` (tight crop)
and `proof-teardrop-thickness-sized-full.png` (full canvas, showing Hem
Length = 1.5" alongside the small curl).

**Part 2 — Kick mirror investigation.** Reproduced Reid's exact E/F test
setup (start endpoint, Open type, 3/4" gap, only Kick toggled) against the
current code and found the mirror **already works correctly** — Outside
renders the hook on one side of the leg line, Inside renders it flipped to
the other side, both via raw canvas pixel sampling (`getImageData`, not
just a visual screenshot read) and via a from-scratch standalone
reproduction of `drawHemGlyph`'s exact math outside the app. No code
change was needed or made to `lib/flashdraft/hem-glyph.ts` or the
kick/mirror logic in `page.tsx` — confirmed via `git diff` that
`hem-glyph.ts` has zero changes this session. The most likely explanation
for Reid's original "no visible difference" report: it was observed before
the prior session's `3fa8c704` fix (which rebuilt Kick as a true
`ctx.scale(1,-1)` mirror, replacing an earlier 180°-rotation approach that
was never actually a mirror), and the E/F screenshots simply predate that
fix. This session's own first attempt to reproduce the bug also produced
misleadingly-cropped screenshots that looked identical at a glance — worth
noting for future sessions debugging this: crop tightly and precisely
around the glyph's actual tip coordinates (read from the real
`worldToScreen` output, not guessed from the page layout), or better,
sample raw pixel color data directly, before concluding a visual diff is
absent.

Screenshots proving the mirror, same setup as the original E/F pair:
`proof-kick-start-outside-full.png` / `proof-kick-start-inside-full.png`
(repo root, full canvas — Outside/Inside buttons visibly toggled in the
popup, hook visibly flipped to the opposite side of the leg line, gap
label unchanged at "OPEN 3/4\" gap").

`pnpm tsc --noEmit` — 0 errors (exit code 0, no output). `pnpm run build`
— succeeded:

```
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (132/132)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                                        Size     First Load JS
┌ ○ /                                                              192 B          99.1 kB
...
├ ○ /studio/draft                                                  18.4 kB         337 kB
├ ○ /studio/hem-debug                                              1.37 kB        88.5 kB
...
+ First Load JS shared by all                                      87.1 kB
ƒ Middleware                                                       84.3 kB
```

(full 132-route table omitted here for length — every route built with no
errors; the two warnings present, a Supabase Edge Runtime notice and a
`@supabase/supabase-js` Node-version deprecation notice, are pre-existing
and unrelated to this session's changes.) Note the build required
temporarily pausing OneDrive.Sync.Service.exe (restarted immediately after
the build completed, confirmed with Reid before pausing it) — this
environment's `.next/trace` file was being locked by OneDrive syncing the
project's `Documents`-folder location during repeated build attempts, an
environment issue unrelated to this prompt's code changes.

No Chrome DevTools extension was connected in this environment
(`tabs_context_mcp` reported "Browser extension is not connected"), so
verification used a standalone Playwright script driving a real `pnpm dev`
server instead — same approach prior sessions have used for this reason.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own visual check against his own reference
photos, specifically for the teardrop's proportions — this session
compared against the photos' description as given in the prompt, not
against the photo files themselves (not present in the repo).

---

**Prior session (2026-08-14): fixed Open hem's inverted fold
direction, rebuilt Kick as a true perpendicular mirror (was a 180°
rotation, not a mirror), wired the real per-hem Gap value through to
the glyph (it was being silently ignored), renamed Kick's values
`inward`/`outward` → `inside`/`outside`.** Coordinated pass across
`lib/flashdraft/hem-glyph.ts`, `lib/types/profile.ts`, and
`app/studio/draft/page.tsx` — see STATE_OF_THE_BUILD.md's
"OPEN FOLD-DIRECTION BUG FIXED..." entry for the full technical writeup.

Summary of what changed:
- **Open's fold direction now matches Teardrop/Smashed.** The `open`
  branch of `renderHemAt` computed `foldTip` from a separately-negated
  `foldDir` vector while the other two branches used `u` directly — same
  endpoint mechanism, disagreeing answers. `foldDir` is deleted; `open`
  now uses the identical formula the other two already used.
- **Kick is a real mirror now, not a rotation.** The old
  `kickSign`/`glyphAngle` mechanism rotated the glyph's local frame by
  180°, which is a different transform from mirroring it and doesn't
  reliably flip which side of the leg line the hook curls toward.
  `drawHemGlyph` (`lib/flashdraft/hem-glyph.ts`) gained a real
  `mirror: boolean` parameter — `ctx.scale(1, -1)` inserted after
  `ctx.rotate()` — applied to both `drawHookGlyph` and the teardrop
  construction. Verified in this session: toggling Kick at a FIXED
  endpoint (same gap, same length) flips the hook to the opposite side
  of the leg line with nothing else changing.
- **`HemKick` renamed `'inward' | 'outward'` → `'inside' | 'outside'`**
  (the type itself, in `lib/types/profile.ts` — not just UI labels).
- **Gap now actually reaches the glyph — was a real bug, not cosmetic.**
  `drawHookGlyph` previously hardcoded a `gapFraction` per hem type and
  never read `Hem.gapIn` at all, which is why editing the popup's Gap
  field visibly did nothing. It now takes a real `gapPx` (absolute
  screen pixels) computed from `hem.gapIn * PIXELS_PER_INCH * zoom`,
  independent of Hem Length (`R`).
- **First-pass, flagged for Reid:** which literal kick value maps to
  `mirror: true` (currently `'inside'`) is a guess, not a confirmed
  mapping against his reference sketch — a one-line flip if wrong.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded. Screenshots
checked in at `studio-hem-fix-screenshots/` (repo root):
`A_full_outside_vs_inside_same_gap.png` / `B_both_hooks_same_gap_zoom.png`
(one leg, Open hem at each end, start=Outside/end=Inside, same 3/4" gap —
the literal side-by-side comparison this prompt asked for);
`E_start_kick_OUTSIDE.png` / `F_start_kick_INSIDE.png` and
`G_end_kick_OUTSIDE.png` / `H_end_kick_INSIDE.png` (same endpoint, same
gap/length, only Kick toggled — isolates the mirror mechanism itself
from the base angle difference between the two endpoints);
`C_gap_small_0.0625in.png` / `D_gap_large_0.75in.png` (same hem, same
Kick, same Hem Length — Gap changed 1/16"→3/4", showing the fix works).
Driven via a Playwright script (`page.mouse` drag to draw, `getByRole`
button clicks for the popup, `locator(...).fill(...)` for Gap) against a
real `pnpm dev` server — same rationale as before: the Chrome DevTools
extension's coordinate mapping has been unreliable for multi-step canvas
interaction in prior sessions (see below).

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own check against his reference sketch — do
not mark DONE.

---

**Prior session (2026-08-14): FlashDraft hem length now scales the
glyph itself (root-cause fix), Gap returns as a per-hem editable field
(reversing the prior pass's decision), inward/outward Kick direction
added.** Single coordinated pass across `lib/types/profile.ts` and
`app/studio/draft/page.tsx` (`lib/flashdraft/hem-glyph.ts`'s internal
shape math explicitly out of scope, not touched) — see
STATE_OF_THE_BUILD.md's new consolidated FlashDraft entry for the full
technical writeup.

Summary of what changed:
- **Root cause fix — Hem Length actually scales the fold glyph.**
  Previously `drawHemGlyphHere` always used a fixed screen-pixel radius
  (`HEM_GLYPH_DISPLAY_R = 12`) regardless of `hem.lengthIn`, so increasing
  Hem Length only pushed the same-size icon further away along a longer
  connecting line — never grew the fold shape, reading as "extending the
  leg." `HEM_GLYPH_DISPLAY_R` deleted; every call site now computes `R =
  Math.max(MIN_READABLE_R, hem.lengthIn * PIXELS_PER_INCH * zoom *
  HEM_GLYPH_LENGTH_SCALE)` — a real, zoom-aware radius derived from the
  hem's actual inch length. `MIN_READABLE_R = 10` and
  `HEM_GLYPH_LENGTH_SCALE = 1.0` are both new, both first-pass values not
  yet confirmed by Reid.
- **Gap is editable again** (Reid reversed the prior pass's "fixed shop
  constant" decision same-day). `HEM_DEFAULT_GAP_IN` 0.125"→0.0625"
  (still just a new-hem default). The popup's "Gap (in)" field is back,
  reusing the pre-removal `hemGapDraft` state naming pulled from `git
  show` on the removal commit, generalized to show for all three hem
  types (not just `open`) and to preserve the value across type switches,
  matching how Hem Length already behaved.
- **New `kick: 'inward' | 'outward'` field on `Hem`**, default `'outward'`
  (matches prior behavior — no change for existing/default hems). A new
  Kick toggle in the popup flips both the fold-direction vector and the
  glyph's own rotation angle together. First-pass mirror implementation
  (a 180° rotation of the glyph's local frame — `drawHemGlyph` only takes
  a rotation angle, no true perpendicular-mirror parameter, and
  hem-glyph.ts was out of scope) — **specifically needs Reid's live
  visual confirmation that it reads as "the physically opposite side,"**
  not just that something visibly changes.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded. Screenshots
checked in at repo root: `hem-audit-2026-08-14-length-scale-small.png` /
`-length-scale-large.png` (same hem, 0.5" vs. 2" length, showing the fold
shape itself grow), `-popup-length-gap-kick.png` (Hem Length, Gap, and
Kick together in the popup), `-kick-outward.png` / `-kick-inward.png`
(same endpoint, before/after toggling Kick), `-both-hems-full-canvas.jpg`
(one endpoint kicked inward, the other outward, in one profile). Driven
via direct `PointerEvent`/`MouseEvent` dispatch in the page's own JS
context against a real `pnpm dev` server — the Chrome DevTools
extension's click/screenshot coordinate mapping was unreliable for this
multi-step canvas interaction in this session (same caveat as several
prior sessions below), so canvas events were dispatched directly via
`element.dispatchEvent(...)` using `canvas.getBoundingClientRect()` for
coordinates instead of relying on the extension's own click targeting.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own check — do not mark DONE. Also newly
identified this session, tracked as its own NOT STARTED item in
STATE_OF_THE_BUILD.md: `ProfileViewer3D` has no hem-related props at
all, confirmed by direct inspection — the 3D view renders no hems
regardless of what's set in the 2D draft canvas. Not attempted this
session, needs real scoping.

---

**Prior session (2026-08-14): FlashDraft comprehensive hem-system
fix — Gap removed in favor of per-hem Hem Length, mid-leg hems deleted
entirely, teardrop retightened, glyph size shrunk, leg-shrink bug
investigated and resolved.** One coordinated pass across
`lib/types/profile.ts`, `app/studio/draft/page.tsx`, and
`lib/flashdraft/hem-glyph.ts`, per this prompt's own instruction to
rewrite the FlashDraft section rather than append — see
STATE_OF_THE_BUILD.md's consolidated FlashDraft hem-system entry for the
full technical writeup (prior incremental history collapsed into a
`<details>` block there rather than deleted).

Summary of what changed:
- **Gap is no longer user-editable** (`HEM_DEFAULT_GAP_IN` 0.1875"→0.125",
  the real shop-confirmed constant). The popup's "Gap (in)" field is
  gone; `Hem` gained its own `lengthIn` (default 0.5"), editable via a
  new "Hem Length (in)" field in the same popup slot.
- **Positioning fix**: `foldTip` now uses the hem's own `lengthIn`; the
  perpendicular gap-offset positioning (`offsetTip`) is gone —
  `drawHemGlyphHere` renders directly at `sFoldTip`, matching how
  teardrop/smashed already worked.
- **Vertex dot suppressed** at any endpoint carrying a hem (the glyph is
  the marker there now).
- **Mid-leg hems deleted entirely** — `LegHem` interface, every
  `legHem*`-prefixed state/ref/handler, `renderLegHemAt`, the whole
  backward-drag-becomes-a-hem disambiguation system in
  `handlePointerDown`/`handlePointerMove`. Grep-confirmed zero remaining
  references. Leg reshaping (drag a leg's body or a vertex directly)
  keeps working, now uniformly regardless of drag direction.
- **Teardrop tightened further**: `d = 0.42R, r = 0.36R` (still a "first
  pass" per the 08-13 entry below) → `d = 0.3R, r = 0.22R`.
- **Glyph display size**: `HEM_GLYPH_DISPLAY_R` 22 → 12.
- **Leg-shrink bug** ("leg 1 lengthens but won't shorten, later legs work
  fine") — traced to the now-deleted `legHemRearmCandidateRef`
  mechanism: dragging any interior bend point armed a hem-rearm
  candidate unconditionally, so a first movement pointing backward along
  the incoming leg (the natural shrink gesture) silently redirected into
  hem-creation instead of reshaping. Verified via a standalone
  Playwright script (the Chrome extension tool proved unreliable for
  this precise a multi-step interaction this session — coordinate-space
  mismatches and page-scroll drift, a tooling issue, not a code issue)
  that the current code shrinks leg 0 and leg 1 identically via both
  leg-body drag and direct vertex-drag, with snap on or off. No residual
  asymmetry found — no separate fix beyond the mid-leg-hem deletion was
  needed.

Required gates: `pnpm tsc --noEmit` — 0 errors. `pnpm run build` —
succeeded, `.next/BUILD_ID` confirmed present (an earlier attempt in
this session reported false success with a truncated log after a stray
duplicate build process got killed mid-run; the run reported here was
isolated and re-verified). Screenshots checked in at repo root:
`hem-audit-2026-08-14-open-popup.png`, `-endpoint-zoom.png`,
`-teardrop.png`, `-teardrop-closeup.png`, `-full-canvas.png`. Per the
verification standard above, this stays **IMPLEMENTED, UNCONFIRMED**
pending Reid's own visual check — do not mark DONE.

**Prior session (2026-08-13): FlashDraft hem glyph — matched line
weight to the leg stroke, tightened the teardrop loop.** Scope:
`lib/flashdraft/hem-glyph.ts` only, per this prompt — `page.tsx` untouched.
Two fixes inside `drawHemGlyph`/`drawHookGlyph`:

1. **Line weight.** Every `ctx.lineWidth` assignment was `R * 0.22` —
   scaling the hem's stroke weight with glyph size instead of matching the
   leg's own fixed 2px stroke in `page.tsx`. Replaced all of them (both
   `drawHookGlyph`, used for open/smashed, and the teardrop branch) with a
   single new `HEM_LINE_WIDTH = 2` constant, used directly with no
   R-derived scaling.

2. **Teardrop loop proportions.** The tangent-circle construction used
   `d = R * 1.2` (distance from tip to circle center) and `r = R * 0.5`
   (circle radius), producing a wide, open-looking loop. Tightened to
   `d = R * 0.42`, `r = R * 0.36` — `d` still strictly greater than `r`, so
   the construction remains non-self-intersecting, just proportioned so the
   loop reads as a tight curl-back-and-close. `angleC`, the tangent-point
   math, and the arc sweep direction were left exactly as-is, per this
   prompt's scope — only the two input values changed. The open/smashed
   hook construction (`drawHookGlyph`) itself was not touched, since its
   shape was already confirmed correct.

Verified on the live `/studio/draft` canvas (not the debug page) with a
manually-drawn profile carrying all three hem types — Open at the start
endpoint, Teardrop at the end endpoint, Smashed via leg-mid drag-back.
Screenshots checked in at repo root:
`hem-audit-2026-08-13-line-weight-full.jpg` (full canvas, all three hems)
and `hem-audit-2026-08-13-line-weight-closeup.png` (a leg and the teardrop
glyph zoomed together for a direct line-weight comparison). Visually, hem
stroke weight now reads the same as the leg stroke, and the teardrop loop
is noticeably tighter than the prior wide-circle version.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
passed. Commit `e9b5060` is pushed to `origin/main`. Per the verification
standard above, this stays **IMPLEMENTED, UNCONFIRMED** pending Reid's own
visual check. Flagging specifically: the teardrop's tightness
(`d = 0.42R`, `r = 0.36R`) is a first pass at the proportion Reid
described from memory, not a value confirmed against a real reference —
it may need one more adjustment once Reid sees it live. Do not treat this
as the final teardrop proportion until he confirms.

**Prior session (2026-08-13): FlashDraft live canvas — restored the
leg-to-fold connecting line, fixed hem glyph size to a constant on-screen
radius.** Scope: `renderHemAt` and `renderLegHemAt` in
`app/studio/draft/page.tsx` only, per this prompt — `lib/flashdraft/hem-glyph.ts`
untouched. Two bugs from the prior (`440d047`) pass, which deleted the
duplicate hand-coded geometry but over-deleted alongside it:

1. **Missing connecting line.** The stroke from the leg's true vertex (`p`)
   to `foldTip`/`sFoldTip` — real material, present regardless of hem type —
   had been removed along with the duplicate geometry it was cleaned up
   with. Added back once per branch (all three hem types, both functions),
   immediately before each `drawHemGlyphHere` call, computing `sP =
   worldToScreen(p, canvas)` in every branch that was missing it (the
   `open` branches in both functions were also missing `sFoldTip` itself,
   since `foldTip` was previously only used for the offset math, never
   converted to screen space).

2. **Glyph size tracking real-world dimensions.** Every `R` computation was
   `Math.max(MIN_HEM_GLYPH_R, hem.gapIn * PIXELS_PER_INCH * zoom)` or the
   `effectiveThicknessIn` equivalent — scaling with the hem's real gap/
   thickness and with zoom. This directly contradicts `hem-glyph.ts`'s own
   header comment: "Fixed screen-pixel-size cross-section glyph radius,
   unscaled by zoom or real-world fold depth." Replaced all six call sites
   (three hem types × two functions) with a single fixed constant,
   `HEM_GLYPH_DISPLAY_R = 22` (px), used directly as `R` — independent of
   `zoom` or any real-world dimension. Removed the now-unused
   `MIN_HEM_GLYPH_R` constant (a `HEM_GLYPH_R` alias) it replaced, since
   every call site that referenced it is gone. Text labels showing the true
   `gapIn`/thickness value are unchanged.

Verified on the live `/studio/draft` canvas (not the debug page) with a
manually-drawn 5-point profile (not a template — the "Coping Cap" template
button did not visibly load geometry when clicked during this session;
drawing was done via direct click/drag instead): an Open hem at the start
endpoint, a Teardrop hem at the end endpoint, and a Smashed hem via
leg-mid drag-back on an interior leg. Screenshot shows all three hem types
with their connecting line visible and the glyph a consistent, generous
size regardless of each leg's real gap/thickness — matching this prompt's
intent. Screenshot checked in at repo root:
`hem-audit-2026-08-13-live-canvas-connecting-lines.jpg`. Per this prompt's
instructions, `HEM_GLYPH_DISPLAY_R = 22` was used as specified and not
second-guessed — Reid should confirm from the screenshot whether 22px reads
as the right size before this is considered final.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
passed. Commit `171f88c` is pushed to `origin/main`. Per the verification
standard above, this stays **IMPLEMENTED, UNCONFIRMED** — the screenshot
proves the connecting line is back and the glyph size no longer tracks real
dimensions, but does not by itself confirm Reid agrees the result
(including the `R = 22` size choice) is correct to his eye. Do not mark
this complete until Reid confirms against the screenshot and the live
canvas.

**Prior session (2026-08-13): FlashDraft live canvas — deleted
duplicate hand-coded hem geometry, canvas now draws only the validated
glyph.** Root cause of the hem geometry still looking wrong on the live
`/studio/draft` canvas after the `7de79db` `hem-glyph.ts` rebuild (below):
`renderHemAt` and `renderLegHemAt` (`app/studio/draft/page.tsx`) each
contained TWO hem-rendering systems — a manually hand-coded
`ctx.moveTo`/`lineTo`/`arc`/`fill` construction (an offset-line cap for
open, a filled semicircle for teardrop, two parallel lines for smashed)
predating the `hem-glyph.ts` fix and never touched by it, followed by a
`drawHemGlyphHere` call drawing the correct shape on top as a small
fixed-size icon. The debug view at `/studio/hem-debug` calls `drawHemGlyph`
directly and so never exercised the first (buggy) system, which is why
prior passes' debug-view screenshots looked correct while the live canvas
did not.

Deleted the manual construction entirely in both functions, for all three
hem types — `drawHemGlyphHere` (and by extension `drawHemGlyph` in
`lib/flashdraft/hem-glyph.ts`, itself untouched) is now the only hem
renderer on the canvas. Added a real-scale radius argument: `R` is derived
from the hem's `gapIn` (open/smashed) or effective material thickness
(teardrop, same `effectiveThicknessIn` calculation already present),
multiplied by `PIXELS_PER_INCH * zoom`, floored at `MIN_HEM_GLYPH_R`
(`= HEM_GLYPH_R`, the same constant the popup icons use) so a near-zero
smashed gap or a small gap at low zoom never collapses the glyph to an
unreadable point. The `drawHemGlyphHere` wrapper (`app/studio/draft/page.tsx`)
now takes and passes through this `R`.

Verified on the live `/studio/draft` canvas (not the debug page, per this
prompt's explicit requirement) using the "Coping Cap" template: applied an
Open hem at the start endpoint, a Teardrop hem at the end endpoint, and a
Smashed hem via leg-mid drag-back on the bottom leg. Open and Teardrop both
render as a single clean glyph matching the debug view's validated shapes,
with no second shape underneath. Smashed renders correctly but is very
small on screen, because its real `gapIn` is architecturally always `0`
(SMACNA definition: gap crushed flush) — `R` floors to `MIN_HEM_GLYPH_R` in
that case, same as the popup icon size; this is expected, not a rendering
bug. Screenshots saved to the local scratchpad (not checked into the repo):
`live-canvas-all-three-hems-final.jpg`.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
passed. Commit `440d047` is pushed to `origin/main`. Per the verification
standard above, this stays **IMPLEMENTED, UNCONFIRMED** — the live-canvas
screenshots prove the duplicate geometry is gone and Open/Teardrop render
as a single correct shape, but do not by themselves confirm Reid agrees the
geometry is correct to his eye. Do not mark this complete until Reid
confirms against the live canvas himself.

**Prior session (2026-08-13): FlashDraft hem glyph geometry rebuilt
from validated SMACNA construction.** Replaced the shape logic inside
`drawHemGlyph()` (`lib/flashdraft/hem-glyph.ts`) entirely — the only file
this prompt was scoped to. Prior passes built every shape backward over the
leg's own material (-x territory), which is why Open rendered as a short
stub and Teardrop as two disconnected primitives. Rebuilt per SMACNA/
press-brake hem definitions, spanning outward from the tip into the hem's
own fold material (+x territory): Open and Smashed now share one
`drawHookGlyph()` hairpin construction (180-degree bend, U cross-section,
gap fraction 0.7 vs. 0.12), and Teardrop is an exact tangent-line-to-circle
construction (`d = R*1.2 > r = R*0.5` algebraically guarantees no
self-intersection) forming one closed loop. Angle/tip-point computation and
all call sites in `app/studio/draft/page.tsx` were left untouched, per
scope.

While verifying via the existing `/studio/hem-debug` debug view (as
instructed, rather than building a new one), the first screenshot showed
the new shapes clipped off-canvas — Open as two disconnected bars, Teardrop
as an open "<" with no closed loop. Root cause: the debug page's `ANCHOR`
constant (`app/studio/hem-debug/page.tsx`) was calibrated for the old
leftward/downward-extending geometry and didn't leave room for the new
rightward-extending shapes. Flagged this to Reid before proceeding, since
fixing it meant touching a second file outside the prompt's stated
one-file scope; Reid approved expanding scope to fix it. Moved `ANCHOR`
from `{x:200,y:50}` to `{x:30,y:85}` so all three shapes render fully
within the existing 280x180 canvas. Re-screenshotted after the fix — all
three shapes now render complete and unclipped. Screenshots checked in at
repo root: `hem-audit-2026-08-13-open.png`, `-smashed.png`, `-teardrop.png`,
`-full-page.png`.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded, after
stopping a separately-running `next dev` server whose `.next` cache was
lock-contending with the build) both passed. Commit `7de79db` is pushed to
`origin/main`. Per the verification standard above, this stays
**IMPLEMENTED, UNCONFIRMED** — the screenshots prove the shapes are no
longer clipped and no longer visibly broken, but do not by themselves
confirm the geometry matches real PathfinderEdge/SMACNA reference hems to
Reid's eye. Do not mark this complete until Reid confirms against the
screenshots and the live canvas. See STATE_OF_THE_BUILD.md for the full
writeup.

**Prior session (2026-08-11): FlashDraft hem-menu trigger offset from
true endpoint.** In `handleDoubleClick` (`app/studio/draft/page.tsx`), added
`HEM_TRIGGER_OFFSET_IN = 0.5` and changed the hem double-click hit-test
targets from the true vertex positions to points extrapolated 0.5in past
each true endpoint, along that end's own leg direction, computed in world
space before conversion to screen space. Reported symptom: hit-testing
directly against the true vertex collided with vertex-drag, making
double-click near a leg's end unreliable. The single-point case
(`points.length === 1`) still hit-tests directly against `points[0]`,
unchanged, since no leg direction exists yet. `HEM_HIT_RADIUS_PX` and the
`dStart <= dEnd` tie-break logic are unchanged, now measured against the new
offset targets. The hem popup's on-screen anchor position still anchors at
the true vertex — only the hit-test target changed; `drawHemGlyph` and
`HEM_GLYPH_R` were not touched. `pnpm tsc --noEmit` (0 errors) and `pnpm run
build` (succeeded) both passed in this session; commit `e5eb3a7` is pushed
to `origin/main`. Per the verification standard above, this is canvas
double-click/hit-test behavior — it stays **IMPLEMENTED, UNCONFIRMED** until
Reid independently confirms double-clicking near a leg's end reliably opens
the hem popup on the live canvas. See STATE_OF_THE_BUILD.md for the full
writeup.

**Prior session (2026-08-11): FlashDraft auto-fit view after manual
length entry.** Single addition at the end of `applySegmentLength`
(`app/studio/draft/page.tsx`): after `commitPoints(newPoints)`, the view is
now re-fit via the same `computeFitView` mechanism already used by
`fitToScreen` and `loadTemplate` (reused exactly, not reimplemented).
Reported symptom: typing a new length into the manual segment-length box
(e.g. resizing a leg to 96") could leave the resized geometry off-screen at
the previously-set zoom/pan. `commitPoints`, `computeFitView`, `fitToScreen`,
and `loadTemplate` were left untouched; no new UI element was added. `pnpm
tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both passed in
this session; commit `b9a8d54` is pushed to `origin/main`. Per the
verification standard above, this is canvas view/zoom/pan behavior — it
stays **IMPLEMENTED, UNCONFIRMED** until Reid independently confirms a
resized leg is visible on screen after typing a new length, on the live
canvas. See STATE_OF_THE_BUILD.md for the full writeup.

**Prior session (2026-08-11): FlashDraft leg-body grab cursor fix.**
Single one-line change in `handlePointerMove` (`app/studio/draft/page.tsx`):
leg-body segment hover now sets `canvas.style.cursor = 'grab'` instead of
`'pointer'`, matching the vertex-hover behavior that was already correct.
Reported symptom was "I have to click multiple times before the grab hand
shows up" — the grab cursor had never been wired to leg hover at all, only
to vertex hover and to an in-progress drag past the movement threshold. The
`'grabbing'` active-drag cursor set elsewhere was untouched. `pnpm tsc
--noEmit` (0 errors) and `pnpm run build` (succeeded) both passed in this
session; commit `a551366` is pushed to `origin/main`. Per the verification
standard above, this is canvas hover/cursor behavior — it stays
**IMPLEMENTED, UNCONFIRMED** until Reid independently confirms the grab
cursor appears on leg-body hover on the live canvas. See STATE_OF_THE_BUILD.md
for the full writeup.

**Prior session (2026-08-11): documentation-accuracy pass.** No
application code was changed. Scope: rewrite STATE_OF_THE_BUILD.md and this
file to reflect actually-verified current state, after this project's
history of status claims not matching reality.

Verified directly this session, not assumed from prior summaries:

- `git log --oneline -20` — matches the RECENT COMMITS list below.
- `git status` — clean except `tsconfig.tsbuildinfo` (build artifact).
- Local `main` vs. `origin/main` — 0 ahead / 0 behind, fully synced.
- `pnpm tsc --noEmit` — 0 errors, exit code 0.
- `app/studio/draft/page.tsx` — directly inspected: the leg-mid hem
  drag-back gesture (`LEG_HEM_MIN_DRAG_IN`, `legHemPreview`, `angleFold`) is
  still present and wired up. The "remove mid-leg hems, keep only endpoint
  double-click hems" fix has **not** been implemented — `git log --all`
  turned up no matching commit.
- `lib/integrations/pathfinder-edge.ts` — directly inspected: 100 lines,
  every exported function returns a hardcoded `not_configured` result, zero
  `fetch()` calls. Confirmed stub, matching its own header comment.
- Repo-wide search for "PAC-CLAD" / "Painted Color" and for any
  `app/studio/**` template files — no FlashDraft template-rebuild work
  exists.

See STATE_OF_THE_BUILD.md for the full current status of FlashDraft hem
geometry, mid-leg hem removal, the template rebuild, canvas/sidebar UI
changes, and the PathfinderEdge integration — each is broken out with its
own section there rather than duplicated here.

---

## RECENT COMMITS (verified via `git log --oneline -20`, most recent first)

```
edece4e  feat: add operator-controlled queue reordering to Profile Library, writing shop_profile_library.queue_position (afs-cv-005)
3e3f769  docs: record Shop View focus-mode rework status, mark IMPLEMENTED/UNCONFIRMED (afs-cv-004)
3700f03  feat: rework Shop View to one-job-at-a-time focus mode with numbered queue strip (afs-cv-004)
b762175  docs: record Command Center color swatch + shop_profile_library.color write-through status, mark IMPLEMENTED/UNCONFIRMED (afs-cv-003)
971eb1c  feat: show selected color in Command Center quote views, populate shop_profile_library.color on both send paths (afs-cv-003)
c9afb05  docs: record color picker wiring status, mark IMPLEMENTED/UNCONFIRMED (afs-cv-002)
de63f33  feat: full-page color picker required for painted materials, wired into FlashDraft/quote builder (afs-cv-002)
1dfa118  feat: extract McElroy and PAC-CLAD color chart data into lib/data/metal-colors.ts (afs-cv-001)
1781c50  feat: add color, queue_position, completed_at columns migration, file only (afs-cv-000)
54c4d6f  docs: confirm migration 016 applied live via information_schema
cd3f75a  docs: canonical FORGE launch procedure
f6f1383  docs: record Shop View build status and known data gaps (afs-sv-010)
63b7cee  feat: add Shop View operator page for shop-floor profile confirmation (afs-sv-010)
9461dc2  feat: populate shop_profile_library on PathfinderEdge send, add Profile Library admin page (afs-sv-009)
bb1bb1f  docs: record source_tool wiring and Command Center badge in governance docs (afs-sv-008)
8358df3  feat: tag quote_requests inserts with source_tool, show source badge in Command Center (afs-sv-008)
fe13f69  feat: add source_tool column and shop_profile_library table migration, file only (afs-sv-007)
9ff65ae  feat: FlashDraft autosave to localStorage with debounce and Clear/Submit-only clearing (afs-sv-006)
86b9213  docs: record FlashDraft prepend-leg feature and rationale (afs-sv-005)
22e4017  feat: FlashDraft prepend leg from first-leg free end (afs-sv-005)
ad8b812  docs: record FlashDraft whole-profile move affordance and rationale (afs-sv-004)
1e19c0a  feat: FlashDraft whole-profile move affordance (afs-sv-004)
4866dea  fix: stray drag state on mere cursor movement, undo/redo history gaps
```

---

## OPEN ITEMS FOR THE NEXT SESSION

1. **Admin nav restructuring (afs-fl-031)** — unconfirmed by the user, and
   two judgment calls need a yes/no: (a) the Settings item renamed
   "Settings" → "General" to avoid reading as "Settings > Settings" under
   the Settings section header — say if a different label is wanted; (b)
   GBP Photo Queue review relocated to `/admin/gbp-photos`, reachable only
   via the existing dashboard stat card (not a tab, not a left-nav item) —
   confirm that placement is right. Also surfaced but explicitly NOT
   fixed: `/admin/consultations` 404s (pre-existing, predates this
   session per `git log`).
2. **FlashDraft leg-body grab cursor** — unconfirmed by the user. Fix is
   pushed (`a551366`); needs Reid to hover a leg body on the live canvas and
   confirm the grab hand now appears immediately on hover.
3. **FlashDraft hem system (glyph-scales-with-length, Gap re-added, Kick
   direction, mid-leg removal, teardrop retighten, leg-shrink bug)** —
   unconfirmed by the user. Do not do another silent rewrite pass; get
   Reid to look at the live canvas and confirm: increasing Hem Length
   visibly grows the fold shape (not just the connecting line); the popup
   shows Hem Length, Gap, AND a Kick toggle together; toggling Kick
   mirrors the fold to the physically opposite side (not just "changes
   something"); no vertex dot at a hemmed endpoint; the teardrop curl
   reads as tight, not round; dragging mid-leg does nothing (no
   hem-creation gesture left); and that leg 1 shrinks the same as any
   other leg now.
4. ~~Mid-leg hem removal~~ — **DONE** as of the 2026-08-14 session above.
   No longer an open item.
5. **FlashDraft 3D view renders no hems** — newly identified this session.
   `ProfileViewer3D` has no hem-related props at all. Needs real scoping
   as its own task (prop plumbing plus a design decision on how to
   represent `kick`/`lengthIn` in 3D) — not a quick prop pass-through.
6. **FlashDraft template rebuild (Pass 1–4)** — not started. 20-item
   template list + Coping Cap/Valley variant pickers + PAC-CLAD "Painted
   Color" picker, all locked with the user, zero implementation.
7. **Canvas/sidebar UI** — not started. Lighter gray canvas background,
   compact sidebar redesign.
8. **PathfinderEdge** — blocked on AMS Controls (Seth Oliver) providing
   server-side logs to root-cause the 401s on the freshly rotated API key.
   Do not guess at request/response shapes in `lib/integrations/pathfinder-edge.ts`
   without a real documented API surface — it drives a physical bending
   machine.
9. **Credential rotation** — deliberately deferred to one pass immediately
   before DNS cutover, per standing user instruction. Not an open action
   item for the current build phase; do not re-raise it as a gap.
10. **Shop View focus-mode rework (afs-cv-004)** — unconfirmed by the user.
   Needs Reid to open `/admin/shop-view` and confirm: the focus panel and
   geometry render correctly at full size, the numbered queue strip switches
   focus on click without a reload, overdue chips render in the crimson
   treatment, marking a job complete removes it from the queue and
   auto-advances focus, and "Show Completed Today" reveals same-day
   completions without pulling them back into the active queue. Migration
   017 (afs-cv-000, `color`/`queue_position`/`completed_at`) is now
   **CONFIRMED APPLIED LIVE** — Reid verified all four columns via a direct
   `information_schema` query in the Dashboard, four `true` results (see
   the afs-cv-000 entry above). That dependency is closed; the browser
   confirmation items above are still open.

---

## FILE LOSS — LETTER TO SETH (AMS CONTROLS), 2026-08-20

`letter to seth of AMS.docx` (see item 7 above — Seth Oliver, AMS
Controls, PathfinderEdge 401 root-cause) was lost during a pre-FORGE
working-tree cleanup that moved stray untracked files out of the repo to
`C:\Users\manag\Documents\afs-evidence\`. A malformed move command (see
lesson learned below) ran first and errored out without moving anything;
by the time a corrected command ran, the file was no longer present in
`afs-website`. A full recursive search of `C:\Users\manag\Documents`,
`afs-website`, and `FORGE` (including a 7-day-recency filter) and a
Windows Recycle Bin check (via Shell COM, not just filesystem search)
both came up empty. Root cause not conclusively identified — the search
is closed per direct user instruction, no further recovery attempted.

**Not a blocker.** The letter is reconstructible from this file's
Thalmann-sync evidence, and per the user, sending it was already on hold.
Regenerate it post-verification (once the PathfinderEdge 401
investigation with Seth actually needs it sent) rather than treating this
as an open task now.

---

## LESSON LEARNED — NO WINDOWS BACKSLASH PATHS IN THE BASH TOOL

The Bash tool in this environment runs Git Bash (POSIX sh), not
cmd.exe/PowerShell. A command that mixed Windows-style backslash paths
(`C:\Users\manag\Documents\afs-evidence\`) into double-quoted Bash
strings broke quoting — a trailing `\"` is parsed as an escaped literal
quote character, not a closing quote, silently merging the rest of the
command line (including later `&&`-chained commands, one of which was the
move that lost the Seth letter, above) into one malformed invocation.

**Rule going forward: POSIX paths only in the Bash tool** —
`/c/Users/manag/Documents/...` or forward-slash `C:/Users/manag/...`,
never backslash-escaped Windows paths. Use the PowerShell tool instead
when a command genuinely needs native Windows path syntax.

---

## MIGRATION 013 (bid_documents) — CONFIRMED APPLIED LIVE, 2026-08-20

`013_bid_documents.sql` (four tables: `bid_documents`,
`bid_document_sections`, `bid_document_line_items`,
`bid_document_viewers` — see `BID_DOCUMENT_SCOPE.md`) is **confirmed
applied to the live Supabase project**, verified by Reid directly via
`information_schema` in the Dashboard SQL Editor — not checked through
this session's own PostgREST access, per this project's standing
migration-verification standard (PostgREST checks on this project have
produced false positives before; see migration 015's stale-schema-cache
incident in `MIGRATIONS_STATUS.md`).

This confirms the migration's schema objects exist live.

**CORRECTION, 2026-08-27 (afs-fl-021):** the line above ("that remains a
separate, unaddressed build phase") was wrong and is corrected here. A
prompt on 2026-08-27 was given to build any genuinely missing
Bid Documents application code, but was scoped to check live reality
first rather than trust either conflicting record blindly. `git log`
confirms `37e920d`/`640f9c2` (2026-07-31) built the real application
code — matching an orchestrator log of prompts `bid-doc-001/002/003`
run that same day — and a full read of every relevant file (data layer,
all ~11 API routes, `BidBuilder.tsx`, the PDF generator, the Resend
email util, the Command Center tab and nav entry) confirmed real,
complete, non-stub code implementing claim-lock collaboration, pricing
entry with server-computed totals, real PDF generation (not the
browser-print fallback `BID_DOCUMENT_SCOPE.md` §7.3 had planned —
`lib/utils/simple-pdf.ts` plus the `pdf-lib` dependency), an
approval/send gate in the builder UI, and real Resend delivery with a
PDF attachment. `pnpm tsc --noEmit` passes with 0 errors on it today.
See the matching, more detailed correction in `STATE_OF_THE_BUILD.md`'s
migration 013 section for exactly which file covers which piece of the
scope doc's workflow.

**No new application code was built this session** — there was no
genuine gap to fill. The one thing this session could not do: exercise
a real `bid_documents` row end-to-end (claim → price → preview → send),
because the Supabase MCP connection available in this session is scoped
to unrelated projects, not this app's live project. That remains the
one open confidence-building step, not a missing feature.

---

## PRIOR HISTORY

This file previously contained several thousand lines of session-by-session
narrative going back to the start of the project. That narrative is not
reproduced here — condensing it was part of this rewrite, since the file
had grown to a size that worked against the "quick, trustworthy status
check" purpose it exists for. Nothing is lost: the full prior text is
available via `git log -p -- SESSION_STATE.md`, and the authoritative
record of what actually shipped, at what commit, is `git log` on this repo
directly — not this file's prose description of it.

---

*SESSION_STATE.md | AFS — Architectural Flashing Supply | Reid Whitesides | Rewritten 2026-08-11 |*
