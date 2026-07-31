# MATERIAL_CALC_SCOPE.md
## AFS — Auto Material Calculator: Current State + What matcalc-002 Should Build

Prepared per request to read `specs/SPEC_AUTO_MATERIAL_CALCULATOR.md` in
full, confirm it is distinct from the AI takeoff feature
(`app/api/takeoff/route.ts`), check `lib/utils/profile-svg.ts` and
`app/studio/draft/page.tsx` for any partial calculator logic, and grep the
rest of the repo for what's actually built vs. only documented. Sourced
from a live read of the spec, `COMPONENT_MAP.md`, `queue.yaml`,
`SCHEMA.md`, `app/quote/page.tsx`, `app/configure/page.tsx`,
`lib/data/pricing.ts`, `lib/data/catalog.ts`, and
`app/api/recommendations/cross-sell/route.ts` — not from memory.

**Verdict: this is a real, ungated code gap — not a data blocker.** The
Auto Material Calculator (`AutoMaterialCalculator.tsx`) is documented in
`COMPONENT_MAP.md` and referenced by a later-built feature
(`CrossSellPanel.tsx`, which literally says "embedded below
AutoMaterialCalculator in wizard Step 3") but it was never assigned a
queue task and never built. Only its §2.1 waste-factor calculation is
buildable today without inventing data; §2.2 (accessories) and §2.3
(stock length) are genuinely blocked, same as the spec's own §5 already
says.

---

## 1. CONFIRMED: NOT THE SAME FEATURE AS AI TAKEOFF

`app/api/takeoff/route.ts` is the AI drawing-extraction feature
(SPEC_PHOTO_TO_QUOTE_AI.md / SPEC_DOCUMENT_UPLOAD.md territory, despite
the route name). It sends an uploaded PDF/image to Claude
(`claude-sonnet-4-6`) with a system prompt that extracts profile type,
material, gauge, dimensions, length, and quantity from a construction
drawing, then writes the result to `takeoff_uploads.result_items`. It
never touches waste factors, accessories, or stock-length math — its job
ends the moment it hands back a raw item list for the user to confirm.

SPEC_AUTO_MATERIAL_CALCULATOR.md is a pure deterministic calculator that
starts *after* dimensions/quantity are known (whether typed by hand,
confirmed from a takeoff, or set in the configurator) and computes
waste-adjusted billed quantity, required/suggested accessories, and
optional cut optimization. No AI call, no drawing involved. Confirmed
distinct.

---

## 2. CONFIRMED: NO PARTIAL CALCULATOR HIDING IN FLASHDRAFT

`lib/utils/profile-svg.ts` (`generateProfileSVG`) computes 2D path
geometry in **inches**, purely for rendering the schematic SVG diagram
and its dimension labels (`formatInches`). It has no concept of linear
feet ordered, waste percentage, or billed quantity.

`app/studio/draft/page.tsx` (FlashDraft) computes **blank width** — the
flat sheet width consumed per linear foot of a bent profile, in
millimeters (`blankWidthInLive`, `viewerBlankWidthMm`, the `dist()` +
`hemAllowanceIn()` + `sumLegHemAllowanceIn()` chain around lines
1100–1180 and 2043–2057). That's a cross-section calculation (how wide a
coil strip needs to be to produce one bend profile) — a completely
different axis from the Auto Material Calculator's job (how many linear
feet of that profile, with what waste padding, does this *order*
need). The two could theoretically feed into a real fabrication
material-cost model together, but neither one computes the other's
output today, and FlashDraft has no waste-factor or accessory logic at
all. Confirmed: no partial calculator exists anywhere.

---

## 3. WHAT EXISTS TODAY (the pieces that look adjacent but aren't it)

- **`pricing_rules.waste_factor`** — a real column (`SCHEMA.md` TABLE 9),
  read by `lib/data/pricing.ts:getPricingRulesRows()` for the **admin**
  pricing table (`components/admin/PricingRulesEditorTable.tsx`,
  `/admin/pricing`). Admin can view/edit a per-product waste factor.
  Nothing customer-facing ever reads this column — grepping
  `app/**/*.tsx` and `components/**/*.tsx` (excluding `admin/`) for
  `waste` returns zero matches.
- **`CrossSellPanel.tsx`** (`components/ai/CrossSellPanel.tsx`, wired into
  `app/quote/page.tsx` Step 3) — this is SPEC_AI_CROSS_SELL.md, a
  *different* spec, built by queue task `p7-002`. It calls
  `POST /api/recommendations/cross-sell`, which sends a Claude prompt
  asking for 1–2 forgotten accessories from a **hardcoded** static list
  (`ACCESSORIES` in `lib/data/catalog.ts`, 7 items) and returns AI-authored
  suggestions with a plain-language reason. This is judgment-based and
  probabilistic — the opposite of §2.2's deterministic
  `calc_method`/`calc_rate` arithmetic (`per_lf`/`per_piece`/`fixed`)
  against the real `product_accessories` table. `product_accessories` is
  never queried anywhere in application code — only referenced in
  `SCHEMA.md`, the migration file, and the specs themselves.
- **Length + Quantity inputs already exist** in both places the spec
  wants the calculator embedded:
  - `app/quote/page.tsx` Step 2 (`lengthFt`, `quantity` fields, lines
    ~490–501) — Step 3 (Project Details) is where `CrossSellPanel` sits
    today, but there is no quantity math anywhere in the wizard.
  - `app/configure/page.tsx` (`lengthFt`, `quantity` fields, lines
    ~519–526) — SPEC_FLASHING_CONFIGURATOR.md §4 Section 6 explicitly
    calls for a `WasteFactorDisplay` here ("Auto-adding X% waste = X LF
    total") that was never built; the section exists with just the two
    raw inputs.
- **No `AutoMaterialCalculator.tsx`, no `/api/calculator/materials`
  route, no `MaterialCalcResponse`/`AccessoryRequirement`/
  `StockCutResult` types anywhere.** Confirmed via repo-wide grep — zero
  matches outside the spec and `COMPONENT_MAP.md` itself.

---

## 4. WHY THIS IS A GAP, NOT A SKIPPED-ON-PURPOSE BLOCKER

`queue.yaml` phase 2 has exactly two tasks touching the quote/configurator
flow — `p2-001` (wizard backend wiring) and `p2-002` (configurator page).
Neither mentions the Auto Material Calculator, `AutoMaterialCalculator.tsx`,
or waste factors at all. Yet `COMPONENT_MAP.md` documents
`AutoMaterialCalculator.tsx` ("Quantity math only — no prices. Shows: raw
qty, waste factor, adjusted qty, recommended accessories") and `p7-002`
(built later) explicitly assumes it already exists ("CrossSellPanel —
embedded **below AutoMaterialCalculator** in wizard Step 3"). The
component was documented, depended on by a downstream task, and then
silently dropped from the queue — not deferred with a documented reason
the way `SPEC_FREIGHT_ESTIMATOR.md`'s carrier-rate half was (see
`FREIGHT_ESTIMATOR_SCOPE.md` for that comparison). This is the same
pattern that also produced `LIVE_INVENTORY_SCOPE.md` and
`PICKUP_SCHEDULING_SCOPE.md`'s recent gap findings.

---

## 5. WHAT'S GENUINELY BLOCKED (per the spec's own §5 — confirmed still true)

- **§2.2 Accessory calculation** — needs real `product_accessories` rows
  (`calc_method`, `calc_rate` per product). `products` and
  `product_accessories` are both empty; blocked on CLAUDE.md data blocker
  checklist #17. `CrossSellPanel`'s AI-suggestion approach is already
  filling this UI slot today with a static accessory list — it is not a
  replacement for the deterministic calc, but it means Step 3 isn't
  silently missing accessory guidance entirely.
- **§2.3 Stock length optimization** — needs `product_profiles`
  standard/max stock lengths; blocked on checklist #21, exactly as
  SPEC_TRIM_LENGTH_OPTIMIZER.md's own header says ("BLOCKED: Standard
  stock lengths pending checklist #21").
- **Material-specific waste factors** — `pricing_rules.waste_factor` is
  real schema, but `products`/`pricing_rules` are empty (blocked on
  catalog data #12–21, same blocker documented in
  `lib/data/pricing.ts`'s own comment). There is no `productId` to look
  a rule up by outside `/admin/pricing` anyway — see §6 below.

---

## 6. THE WRINKLE: THE CALCULATOR CAN'T BE `productId`-KEYED YET

SPEC §4's `POST /api/calculator/materials` contract takes a `productId`.
But neither `app/quote/page.tsx` nor `app/configure/page.tsx` has a
product selection step — `profileType` and `material` are free-text
labels picked from hardcoded arrays (`PROFILE_TYPES`, `MATERIALS` in
`app/quote/page.tsx`; equivalent constants in `app/configure/page.tsx`),
not foreign keys into the (currently empty) `products` table. This is the
same free-text-vs-FK gap `FREIGHT_ESTIMATOR_SCOPE.md` §3 hit with
`quote_requests.line_items.material`/`gauge`. A `productId`-keyed route
would have nothing real to key against today. Building it as specified
would mean either faking a `productId` or leaving the route dead code.

---

## 7. RECOMMENDED SCOPE FOR matcalc-002

**Build only §2.1 (waste factor), using the spec's own documented
default, and skip the `productId` contract entirely for now:**

- A pure helper, e.g. `applyWasteFactor(rawQtyLf: number, wasteFactorMultiplier = 1.10): number`
  in `lib/utils/material-calc.ts` — `Math.ceil(rawQtyLf * wasteFactorMultiplier)`,
  exactly as SPEC §2.1 specifies. No API route needed for this — it's a
  pure function of `lengthFt × quantity`, callable client-side, same
  pattern as `lib/utils/profile-svg.ts`'s pure `generateProfileSVG()`.
- A `WasteFactorDisplay`-style component (name it per SPEC_FLASHING_
  CONFIGURATOR.md §4 Section 6, which already calls for this exact
  name) reading live `lengthFt`/`quantity` state and rendering the
  spec's §3 layout: raw quantity, "+ waste factor (10%, estimated)",
  total billed quantity. Always show the "(estimated)" qualifier and use
  the flat 10% default — do **not** attempt to look up a per-product
  `waste_factor`, since there is no real product selection to key off
  (§6 above) and `pricing_rules` is empty.
- Embed it in the two places both governance docs already call for:
  - `app/configure/page.tsx`, directly below the existing Length +
    Quantity inputs (SPEC_FLASHING_CONFIGURATOR.md §4 Section 6's exact
    slot).
  - `app/quote/page.tsx` Step 2 (Dimensions), directly below the
    existing `lengthFt`/`quantity` inputs — not Step 3, since Step 3 has
    no quantity fields and `CrossSellPanel` already occupies that slot
    per `COMPONENT_MAP.md`'s own stacking order (calculator above,
    cross-sell below — Step 2 having the calculator and Step 3 keeping
    cross-sell is the closest honest match to that intent given the
    wizard's actual step layout).
- Do not name the component `AutoMaterialCalculator.tsx` if it only ever
  renders the waste-factor line — that name implies the full §2
  calculator (accessories + stock optimization included). Name it for
  what it does now (`WasteFactorDisplay.tsx`) and expand/rename only
  when §2.2/§2.3 unblock.

**Do not build:**
- `POST /api/calculator/materials` or any `productId`-keyed route — no
  real product to key against yet (§6).
- Accessory calculation via `product_accessories`/`calc_method` — blocked
  on #17, and the AI-suggestion path already occupies that UI slot via
  `CrossSellPanel` without pretending to be a priced/deterministic
  system.
- `TrimLengthOptimizer`/`StockCutResult` — blocked on #21, per
  SPEC_TRIM_LENGTH_OPTIMIZER.md's own header.
- Any per-product waste factor lookup — `pricing_rules` is empty; showing
  a looked-up value that silently falls back to a hardcoded default
  without the "(estimated)" label would misrepresent it as real data.

---

*MATERIAL_CALC_SCOPE.md | AFS | prepared from live codebase audit, 2026-07-30*
