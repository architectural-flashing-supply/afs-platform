# STATE_OF_THE_BUILD.md
## AFS — Current Build Status
**Updated from an actual audit of the codebase, not from memory or prior session summaries.**

---

## VERIFICATION STANDARD — READ THIS FIRST

This project has a documented history of governance docs claiming a fix was
"complete" or "verified live" when the underlying behavior was later found
broken, not visible in production, or not actually committed. A Claude Code
session's own claim of having "verified live" something (via Playwright, a
build pass, or code review) is **not sufficient** to mark an item complete
in this document. That standard is met only when:

1. The relevant automated gates actually pass (`pnpm tsc --noEmit`, `pnpm
   run build`), run directly in this session, not assumed from a prior one, AND
2. For anything visual or interactive (canvas rendering, UI behavior), **the
   user has independently confirmed the behavior themselves** — a session's
   own screenshot or Playwright pass is evidence to bring to the user, not a
   substitute for their confirmation.

Items below are marked accordingly: **DONE** (both gates above met),
**IMPLEMENTED, UNCONFIRMED** (code exists and compiles/builds, but the user
has not confirmed the actual behavior is correct), or **NOT STARTED**.

This file was rewritten in full on 2026-08-11 as a documentation-accuracy
pass — no application code was touched in that pass. The prior version of
this file (several thousand lines of session-by-session narrative) is not
reproduced here; it remains available via `git log -p -- STATE_OF_THE_BUILD.md`
for anyone who needs the granular history. Going forward, `git log` is the
authoritative record of what was actually committed — this file is a status
summary, not a replacement for it.

---

## VERIFIED THIS PASS (2026-08-11)

```
git log --oneline -20              Confirmed. Local main matches the commits
                                    listed under RECENT COMMITS below.
git status                         Clean except tsconfig.tsbuildinfo
                                    (build artifact, not source).
origin/main sync                   0 ahead / 0 behind — local main is fully
                                    pushed, nothing sitting uncommitted or
                                    unpushed.
pnpm tsc --noEmit                  0 errors. Exit code 0.
```

---

## FLASHDRAFT — HEM GEOMETRY: UNRESOLVED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

Multiple passes have gone into `drawHemGlyph()` (now `lib/flashdraft/hem-glyph.ts`,
called from both the live canvas and the popup selector icons in
`app/studio/draft/page.tsx`):

- `912f0b9` (2026-08-06) — rewrote Open/Smashed/Teardrop using literal
  coordinates traced from a real PathfinderEdge reference screenshot and
  hand-drawn sketches, replacing an earlier descriptive-shape version.
  Normalized the local coordinate convention so the two call-site mechanisms
  (endpoint hems vs. leg-mid hems) can no longer produce mirrored glyphs.
- `0a117eb` (2026-08-06) — extracted `drawHemGlyph` into a standalone debug
  view at `/studio/hem-debug` (all three shapes at 15x scale) and fixed the
  popup icons being illegibly small.
- `3786ff0` (2026-08-06) — added audit evidence screenshots (`hem-audit-*.png`,
  repo root) from a no-code-change diagnostic pass.
- `abb5da8` (2026-08-07) — three targeted fixes from that audit: (1) the main
  production canvas gained DPR-awareness (`devicePixelRatio` backing store +
  `ctx.setTransform`), which it previously lacked entirely, requiring every
  coordinate-math site (`worldToScreen`, `screenToWorld`, grid bounds, two
  `computeFitView` call sites — 18 places) to switch from reading
  `canvas.width`/`height` to `getBoundingClientRect()`; (2) unified the three
  previously-disconnected glyph-scale constants (`HEM_GLYPH_R`,
  `HEM_ICON_GLYPH_R`, the debug view's `DEBUG_R`) so they derive from one
  base constant; (3) made Open and Smashed visually distinguishable at popup
  button scale (shorter + thinner stroke for Smashed) since their real
  differentiator — offset from the leg centerline — isn't visible without a
  reference leg line next to an isolated icon.

`abb5da8` is the most recent commit touching hem rendering and is the
"literal, exact canvas-path-command fix" referenced in this project's
history — it exists and is pushed to `origin/main`. What it is **not** is
user-confirmed: every one of the passes above was reported "verified live"
by the session that made it (via Playwright screenshots, DPR-simulated
browser checks, or byte-identical-screenshot comparisons), and every one of
those self-reports has so far been insufficient — the actual PathfinderEdge
hem shapes (Open/Smashed/Teardrop) have not yet been confirmed correct by
the user looking at the real rendered canvas against real reference
evidence. Treat hem geometry as **open** until that confirmation happens.

---

## FLASHDRAFT — MID-LEG HEM REMOVAL: NOT DONE

**Status: NOT STARTED.**

The fabrication-impossibility fix — removing the leg-mid drag-back hem
gesture entirely and keeping only endpoint double-click hems, because a
hem folded mid-leg (not at an endpoint) cannot actually be fabricated — has
**not** been implemented. Searched `git log --all` for any commit matching
this change; none exists. Directly confirmed in the current
`app/studio/draft/page.tsx` (as of `abb5da8`, the tip of `main`):

- `LEG_HEM_MIN_DRAG_IN` (line 174) — minimum drag-back distance to create a
  hem on a leg — still defined and still used.
- `legHemPreview` (referenced at line 1958 and elsewhere) — the drag-back
  preview state — still present.
- `angleFold` (lines 1277+) — the leg-mid hem-fold angle calculation — still
  present, still called at multiple `drawHemGlyphHere` sites.

The leg-mid gesture is fully intact in the shipped code. This is still
pending, not partially done.

---

## FLASHDRAFT TEMPLATE REBUILD (Pass 1–4): NOT STARTED

**Status: NOT STARTED. Zero implementation work has begun.**

The full 20-item template list — Z Closure, Sill, J-Channel, Z-Spacer Trim,
Outside Corner, Inside Corner, Window Drip, Siding Starter, Stucco
Perimeter, Pitch Change, Drip Edge, Drip Edge with Kick, Hook Drip Edge,
Sidewall, Head Wall, Ridge Cap Vented, Counter, Peak Wall, Gutter, Valley —
plus Coping Cap and Valley as variant-picker categories, was locked with the
user but no code exists for it. Confirmed via directory search: no
`app/studio/**` path contains any `template` file or route beyond what
already existed before this list was locked.

The PAC-CLAD "Painted Color" picker (Pass 4) is also entirely unbuilt — a
repo-wide search for "PAC-CLAD" and "Painted Color" found no matches inside
`app/studio/**` or any FlashDraft-related component. Zero hours have been
spent on it despite being requested.

---

## FLASHDRAFT — CANVAS/SIDEBAR UI CHANGES: NOT STARTED

**Status: NOT STARTED.**

The lighter-gray canvas background and compact sidebar redesign requested
by the user have not been implemented. `CANVAS_COLORS.background` in
`app/studio/draft/page.tsx` has not changed as part of this request, and no
sidebar-layout commit exists for it.

---

## PATHFINDEREDGE MACHINE INTEGRATION: BLOCKED (external dependency)

**Status: BLOCKED. This is a genuine production-blocking issue for the
physical shop, separate from the software platform.**

- Catalog `20115` (`afs`, lowercase) is confirmed as the correct sync
  target.
- Confirmed via AMS Controls (Seth Oliver) that a profile (`32890799`) was
  successfully created via `POST /api/v1/profiles` at some point in the
  past — but **not** from this application's own code.
  `lib/integrations/pathfinder-edge.ts` remains a complete stub: verified
  directly this pass — 100 lines, every exported function
  (`discoverApiEndpoints`, `getPathfinderCatalogs`, `pushProfileToPathfinder`,
  `submitJobToMachine`, `getJobStatus`) returns a hardcoded
  `{ status: 'not_configured' }` result and contains zero `fetch()` calls
  or any other network I/O. The successful profile creation AMS Controls
  observed happened through some other path, not this codebase.
- Root cause of current 401 errors on a freshly rotated API key is
  unresolved — waiting on AMS Controls server-side logs.
- On 2026-08-11, the user attempted to send a real job from PathfinderEdge
  to the Thalmann machine directly (not via this application) and it failed
  to reach the machine. Cause unknown, pending AMS Controls log review.
- Env vars `PATHFINDER_EDGE_API_KEY`, `PATHFINDER_EDGE_BASE_URL`,
  `PATHFINDER_EDGE_MACHINE_SERIAL` are wired but unused, per CLAUDE.md.

No code changes should be attempted here until AMS Controls confirms a real,
documented REST surface — see the stub's own header comment for why
guessing at request/response shapes against a machine that physically bends
metal is not acceptable.

---

## SECURITY — CREDENTIAL ROTATION: DEFERRED BY DESIGN, NOT AN OPEN ISSUE

Per explicit, repeated user instruction, credential rotation (Stripe,
Supabase, Anthropic, PathfinderEdge, Google Maps, the machine-bridge shared
secret) is deferred to a single pass immediately before DNS cutover/go-live,
not done incrementally now. **Do not flag this as an open action item
needing attention in the current build phase** — it is a deliberate,
standing decision, not an oversight.

---

## GOVERNANCE STACK

| Document | Status |
|---|---|
| CLAUDE.md | Current — master index |
| BLUEPRINT.md | Current — FORGE operational rules |
| ARCHITECTURE.md | Current — system architecture |
| SCHEMA.md | Current — database tables + RLS |
| DESIGN_TOKENS.md | Current — Gunmetal theme, afs-* tokens |
| SITEMAP.md | Current — route map |
| COMPONENT_MAP.md | Current — component index |
| PRICING_ENGINE.md | Current — internal commodity pricing system |
| PRD.md | Current — platform requirements |
| STATE_OF_THE_BUILD.md | This file — rewritten 2026-08-11 |
| SESSION_STATE.md | Rewritten 2026-08-11 — session handoff log |
| MASTER_DOCUMENT_REGISTRY.md | FORGE project-folder document index |

---

## DATA BLOCKERS — UNRESOLVED

These items block specific features but do not block the build. Code is
built now; data populates the existing structure when received.

| Item | Checklist # | Blocks |
|---|---|---|
| Product catalog — SKUs, finishes | #12–21 | Catalog content beyond profile/material/gauge dropdowns (seeded) |
| Pricing cost basis and margin rules | #22–23, #26 | Pricing engine activation |
| Supplier price history | Internal records | Trend projection accuracy |
| Production stage names (shop language) | #39 | Timeline labels, notification triggers |
| AFS address, phone, hours | #5, #6 | Contact page, freight origin, email footer |
| Tax nexus states | #31 | TaxJar configuration |
| Carrier / freight method | #27–28, #80 | Freight calculation |
| Industry certifications | #8 | Trust badges, spec language |
| Logo vector file (SVG) | #1 | Asset quality — PNG in use as fallback |
| Photography | #9 | Product and gallery images |
| CAD/BIM library files (DWG/DXF/Revit) | SPEC_CAD_BIM_LIBRARY.md | `/architects/cad-library` content — code path is complete, zero rows exist because zero files have been received |
| Privacy Policy | #65 | Legal — launch blocker |

*Not independently re-verified in this pass; carried forward from the last
codebase audit that specifically checked each row. If a client deliverable
listed here has since arrived, confirm against the code before trusting
this table.*

---

## BUILD PHASE STATUS

*Carried forward from the last full-codebase audit (not re-verified route
by route in this documentation pass). Believed accurate as of the commits
in RECENT COMMITS below; if in doubt, verify a specific route or feature
directly rather than trusting this table blind — that is exactly the
failure mode this rewrite exists to correct.*

```
Phase 0 — Scaffold + Design System:    BUILT
Phase 1 — Drawing Tool + Upload:       BUILT (app/upload, app/api/upload, app/api/takeoff)
Phase 2 — Quote Request System:        BUILT (app/quote, app/configure, app/api/quote-requests)
Phase 3 — Product Catalog + Auth:      BUILT (app/(public)/products, app/(auth)/**, app/checkout)
Phase 4 — Customer Portal:             BUILT (app/account/**)
Phase 5 — Architect Portal:            BUILT (app/(public)/architects/**)
Phase 6 — Admin + Operations:          BUILT (app/admin/**)
Phase 7 — AI Layer:                    BUILT — chatbot, product finder/cross-sell/
                                        material recs, installation advisor
Phase 8 — Integrations + Deploy:       BUILT. QuickBooks is a CONDITIONAL,
                                        stubbed build (blocked on client
                                        confirmation, zero real QBO API calls).
                                        Supabase integration functional.
                                        Vercel deploy prep done (vercel.json,
                                        .env.example).

Design Studio (beyond the original 9-phase queue):
  Thalmann machine profile import:     Migration + import script built;
                                        migration NOT yet applied to the
                                        live Supabase project (confirm
                                        before assuming machine_profiles
                                        rows exist in production).
  PathfinderEdge integration:          BLOCKED — see PATHFINDEREDGE
                                        MACHINE INTEGRATION above.
  FlashDraft + Design Studio UI:       Core two-panel canvas tool BUILT.
                                        Hem geometry UNRESOLVED, mid-leg
                                        removal NOT STARTED, template
                                        rebuild NOT STARTED, canvas/sidebar
                                        UI changes NOT STARTED — see the
                                        dedicated FlashDraft sections above.

Machine Bridge + Command Center:       afs-machine-bridge (separate repo)
                                        last audited 2026-07-13: running on
                                        the dev machine only, not the
                                        shop-floor computer; polling the
                                        deployed app but failing auth (401,
                                        likely AFS_BRIDGE_SECRET mismatch);
                                        zero .ds1 files ever generated as a
                                        result. Not re-verified in this
                                        documentation pass — if this is
                                        being relied on, re-check
                                        afs-machine-bridge's own logs
                                        directly rather than trusting this
                                        line.

3D Profile Configurator:               BUILT — Three.js viewer integrated
                                        into FlashDraft, upload results, and
                                        a standalone shareable route.
```

---

## RECENT COMMITS (verified via `git log`, most recent first)

```
abb5da8  fix: DPR-aware live canvas, unified glyph scale constants, Open/Smashed differentiation
3786ff0  audit: add hem glyph rendering audit evidence images
0a117eb  feat: add hem glyph debug view, fix illegible popup icon size
4866dea  fix: stray drag state on mere cursor movement, undo/redo history gaps
912f0b9  fix: rewrite drawHemGlyph with literal capsule/loop coords, unify popup icons, fix drag-artifact bug
875c51e  fix: clamp bend angle to prevent reflex/collinear states, redesign hem glyphs, fix reshape UX conflict with length input
1292e0f  feat: leg-body reshape gesture via direction-based disambiguation, extending the hem-drag pattern
36579a0  fix: direction-based disambiguation lets leg-hem-drag arm correctly from interior vertices and the last point
4cec386  fix: resolve informal profile labels to canonical geometry, infer topology from extracted dimension shape for unmapped types
88c98a5  fix: replace fabricated 16in roof panel default with drawing-first extraction + user width selection; fix catalog copy and profile-type dropdown gap
```

Local `main` is in sync with `origin/main` (0 ahead / 0 behind) as of this
pass.

---

## DNS MIGRATION CHECKLIST

When migrating DNS to the live domain, these must be updated BEFORE go-live:

1. Vercel Environment Variables — update `NEXT_PUBLIC_APP_URL` from
   `https://afs-website-alpha.vercel.app` to the live domain
2. Supabase Auth — update Site URL in Authentication settings to the live
   domain
3. Stripe webhook endpoint URL — update in Stripe dashboard to the live
   domain
4. Redeploy on Vercel after env var change
5. Credential rotation pass (Stripe, Supabase, Anthropic, PathfinderEdge,
   Google Maps, machine-bridge shared secret) — deliberately deferred to
   this step, see SECURITY above

---

## NEXT ACTION

1. Get the user's own confirmation on FlashDraft hem geometry against real
   PathfinderEdge reference evidence — do not mark it complete until that
   happens, regardless of how many rendering passes have been made.
2. Mid-leg hem removal — implement removing the leg-mid drag-back gesture,
   keeping only endpoint double-click hems.
3. FlashDraft template rebuild (Pass 1–4) — not started, needs scoping into
   actual FORGE prompts against the locked 20-item list + PAC-CLAD picker.
4. Canvas/sidebar UI changes — not started.
5. PathfinderEdge — blocked on AMS Controls (Seth Oliver) providing
   server-side logs for the 401 root cause; no code work possible until a
   real, documented API surface is confirmed.

---

*STATE_OF_THE_BUILD.md | AFS — Architectural Flashing Supply | Reid Whitesides | Rewritten 2026-08-11 from direct verification (git log, tsc, git status) |*
