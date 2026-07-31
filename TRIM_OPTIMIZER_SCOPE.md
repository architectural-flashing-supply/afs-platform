# TRIM_OPTIMIZER_SCOPE.md
## AFS — Trim Length Optimizer: Current State + What trim-opt-002 Should Build

Prepared per request to read `specs/SPEC_TRIM_LENGTH_OPTIMIZER.md` in full,
grep the repo broadly for any existing trim/optimizer/stock-length/cut-list
code, and check `lib/data/catalog.ts` + `SCHEMA.md` for whether stock-length
data exists anywhere already. Sourced from a live read of the spec,
`SCHEMA.md`, `supabase/migrations/002_seed_afs_data.sql`,
`supabase/README.md`, `STATE_OF_THE_BUILD.md`, `MATERIAL_CALC_SCOPE.md`,
`app/quote/page.tsx`, `app/configure/page.tsx`,
`components/quote/WasteFactorDisplay.tsx`,
`components/admin/QuoteEstimatorForm.tsx`, and
`app/(public)/architects/cad-library/page.tsx` — not from memory.

**Verdict: the spec's own header ("BLOCKED: Standard stock lengths pending
checklist #21") is stale.** `product_profiles.standard_length_ft` and
`max_length_ft` (`SCHEMA.md` TABLE 6) are real, live-seeded data —
confirmed applied to the live Supabase project (`STATE_OF_THE_BUILD.md`
afs-041, 2026-07-14 audit: "`product_profiles` (12 rows) are genuinely
seeded"). This is not a data blocker anymore for most profiles. No new
table or migration is needed. What's missing is application code: zero
files anywhere in the repo reference `optimizeTrimLength`,
`StockCutResult`, `CutPiece`, or any stock-length/cut-list logic outside
the spec itself.

---

## 1. GREP RESULTS — NOTHING BUILT

A broad, case-insensitive search across the repo for `trim`, `optimizer`,
`stock length`, `cut list`, `optimizeTrimLength`, `StockCutResult`,
`CutPiece` returns matches only in: the spec itself
(`specs/SPEC_TRIM_LENGTH_OPTIMIZER.md`), `MASTER_DOCUMENT_REGISTRY.md`,
`MATERIAL_CALC_SCOPE.md` (which explicitly lists this as blocked), and
unrelated hits where "trim" is a substring of something else entirely
(`.trim()` string calls, `Termination Bar`/`Trim` accessory category in
`lib/data/catalog.ts`, CSI section names, etc.). `queue.yaml` has no
`trim-opt` task. Confirmed: nothing exists today beyond the spec.

---

## 2. THE STOCK-LENGTH DATA ALREADY EXISTS

`SCHEMA.md` TABLE 6 (`product_profiles`) has always had
`standard_length_ft` and `max_length_ft` columns. What's new since the
spec was written is that they're populated with real values.
`supabase/migrations/002_seed_afs_data.sql` (lines 89–142) seeds 12
`product_profiles` rows, 10 of which have a real `standard_length_ft`:

| slug | standard_length_ft | max_length_ft |
|---|---|---|
| coping-cap | 10 | 12 |
| base-flashing | 10 | 12 |
| counter-flashing | 10 | 12 |
| drip-edge | 10 | 12 |
| gravel-stop | 10 | 12 |
| fascia | 10 | 12 |
| valley-flashing | 10 | 12 |
| expansion-joint | 10 | 20 |
| window-door-flashing | 10 | 12 |
| standing-seam-roofing | 20 | 40 |
| scupper | NULL | NULL |
| custom-profile | NULL | NULL |

The two NULL rows are exactly the two with `requires_consultation = true`
— scuppers and fully custom profiles genuinely have no standard stock
length, so `NULL` is correct data, not a gap.

Per `STATE_OF_THE_BUILD.md` (afs-041, corrected 2026-07-14, and the
gauges follow-up afs-gs-001), `product_profiles` is confirmed live and
seeded on the actual Supabase project — this is not "seed file exists but
never applied" the way `007`–`010` are. Two other live app routes already
query this exact table successfully:
`app/(public)/architects/cad-library/page.tsx:44` and
`app/api/chat/route.ts:168`. So a server- or client-side
`.from('product_profiles').select(...)` call is a proven, working
pattern here, not a new risk.

**This means §2 of the spec (`optimizeTrimLength`) is buildable today
for 10 of the 12 seeded profiles**, using real `stockLengthFt` input
instead of an invented placeholder.

---

## 3. THE WRINKLE: TWO CUSTOMER-FACING PROFILE PICKERS, NEITHER IS AN FK

This is the same free-text-vs-FK gap `MATERIAL_CALC_SCOPE.md` §6 already
found for the Auto Material Calculator, and it applies here too —
`product_profiles` has no ID anywhere in the quote/configure forms to
join against. There are two different pickers, with different partial
overlap against the 12 seeded `product_profiles` rows:

**`app/configure/page.tsx`** uses `ProfileType` (`lib/utils/profile-svg.ts`),
a 16-member slug union built for FlashDraft geometry rendering
(`PROFILE_OPTIONS` at `app/configure/page.tsx:70`). Only 5 of its 16
values are real `product_profiles.slug`s: `coping-cap`, `base-flashing`,
`drip-edge`, `gravel-stop`, `fascia`. The other 11 (`custom-flashing`,
`cleat`, `ridge`, `hip`, `downspout`, `pitch-change`, `z-closure`,
`inside-outside-corner`, `chimney-cap`, `gutter`, `door-window-pan`) have
no corresponding profile row at all — these are FlashDraft-drawable
shapes, not AFS's stocked-profile catalog.

**`app/quote/page.tsx`** uses `PROFILE_TYPES`, a 17-member free-text
label array (`app/quote/page.tsx:47`). 9 match a `product_profiles.name`
by exact string: `Coping Cap`, `Base Flashing`, `Counter Flashing`,
`Drip Edge`, `Gravel Stop`, `Fascia`, `Valley Flashing`, `Scupper`,
`Custom Profile` — of which `Scupper` and `Custom Profile` are the two
NULL-length rows, so 7 have both a match and a real length. 3 more are
near-misses that a small alias map would resolve: `Expansion Joint Cover`
→ `expansion-joint`, `Window / Door Flashing` → `window-door-flashing`,
`Standing Seam Roofing Panel` → `standing-seam-roofing`. The remaining 5
(`Step Flashing`, `Conductor Head`, `Downspout`, `Reglet`,
`Wall Panel / Cladding`) have no `product_profiles` row — genuinely no
stock-length data, same as the FlashDraft-only shapes above.

This is fine, not a blocker: the spec's own §3 already says the section
is "Only shown when product has standard stock lengths defined" — i.e.
no match is an expected, silent no-render case, not an error state.

---

## 4. WHERE THIS BELONGS

**Not admin-only, not Command Center, not a standalone route.** The spec
frames this as dual-purpose exactly like the Auto Material Calculator it's
embedded in: informational for the contractor ("helps the contractor plan
installation sequences") and operational for AFS ("helps AFS fabrication
plan cut schedules") — both from the same customer-facing calculation, no
pricing involved (spec §1: "No pricing involved"), so it does not trip
CLAUDE.md rule #1. `COMPONENT_MAP.md` places it embedded inside
`AutoMaterialCalculator`, and matcalc-002 already established exactly
that slot with `WasteFactorDisplay.tsx` in both customer-facing forms.
The Command Center / `machine_jobs` path was considered and rejected —
`machine_jobs` (migration 005) tracks bend geometry and approval-queue
status, not linear-footage/stock-length math, so there's no natural home
for a cut-list optimizer there today.

**Build it as a sibling to `WasteFactorDisplay.tsx`, embedded right next
to it, in the same two places matcalc-002 already wired up:**
- `app/quote/page.tsx` Step 2, directly below the existing
  `WasteFactorDisplay` (`app/quote/page.tsx` already imports it at line 7).
- `app/configure/page.tsx`, directly below its existing
  `WasteFactorDisplay` (`app/configure/page.tsx` line 6).

Both files are `'use client'` and already import
`createClient` from `@/lib/supabase/client` (browser client) — the exact
same client already used elsewhere in both files — so fetching
`product_profiles` needs no new API route, matching the pattern already
proven in `app/(public)/architects/cad-library/page.tsx`.

---

## 5. EXACT SCOPE FOR trim-opt-002

**Build:**

1. `lib/utils/trim-optimizer.ts` — a pure `optimizeTrimLength()` function,
   implemented exactly per spec §2 (unchanged algorithm — kerf allowance
   default `0.0208` ft, `Math.ceil` piece count, sequential cut-list
   assignment). Same pattern as `lib/utils/material-calc.ts`: no API
   route, pure function of `neededLf` + `stockLengthFt`.
2. A small profile-lookup helper (in the same file or
   `lib/data/product-profiles.ts`) that fetches
   `product_profiles(slug, name, standard_length_ft, max_length_ft)` for
   active rows via the browser Supabase client, once per mount, and
   resolves a picked profile to a stock length by:
   - `configure/page.tsx`: exact `slug` match against `ProfileType`.
   - `quote/page.tsx`: exact `name` match against the `PROFILE_TYPES`
     label, plus the 3-entry alias map from §3 above for the near-misses.
   - No match, or `standard_length_ft IS NULL` → return `null` (renders
     nothing, per spec §3 — do not fabricate a fallback length).
3. `components/quote/TrimLengthOptimizerSection.tsx` — collapsible,
   renders the spec's §3 layout (pieces × stock length, waste LF/%, per-
   piece cut list) driven by `optimizeTrimLength(neededLf, stockLengthFt)`
   where `neededLf` is the same `lengthFt × quantity` value
   `WasteFactorDisplay` already computes from. Returns `null` when the
   lookup in step 2 returns `null`, exactly like `WasteFactorDisplay`
   already returns `null` for invalid/zero inputs.
4. Embed it directly below `WasteFactorDisplay` in both
   `app/quote/page.tsx` Step 2 and `app/configure/page.tsx`.

**Do not build:**
- Any new table, column, or migration — `product_profiles.standard_length_ft`
  / `max_length_ft` already exist and are seeded live.
- A `productId`-keyed API route — same reasoning as
  `MATERIAL_CALC_SCOPE.md` §6, there is still no real `products` FK in
  either form, only the `product_profiles` geometry table, which is
  sufficient for this feature since it only needs the length columns.
- Fuzzy/AI-based profile matching — the alias map in §3 covers every
  recoverable near-miss; the remaining unmatched profile types
  genuinely have no stock-length concept (custom, one-off, or
  FlashDraft-only shapes) and should silently show nothing, per spec §3.
- Any Command Center / `machine_jobs` / admin-only integration — no
  linear-footage or stock-length concept exists on that data path today.

---

*TRIM_OPTIMIZER_SCOPE.md | AFS | prepared from live codebase audit, 2026-07-30*
