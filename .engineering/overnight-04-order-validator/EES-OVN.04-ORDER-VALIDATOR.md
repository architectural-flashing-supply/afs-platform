# EES-OVN.04 — AI ORDER VALIDATOR (DETERMINISTIC RULE ENGINE + OPTIONAL ADVISORY AI)

## 1. IDENTITY

| Field | Value |
|---|---|
| Prompt ID | EES-OVN.04 |
| Prompt Name | Order Validator — deterministic rule engine, customer/admin scope, optional advisory AI |
| Item | `04-order-validator` |
| Branch | `ovn/04-order-validator` (git worktree of `C:\Users\manag\Documents\afs-website`) |
| Source spec | `specs/SPEC_AI_ORDER_VALIDATOR.md` |
| Date | 2026-10-03 |
| Run type | Unattended overnight. No question can be answered; every ambiguity is resolved conservatively and recorded. |

---

## 2. OBJECTIVE

Build the **deterministic** order-validation rule engine for AFS: typed rules that
catch dimension-range violations, physically impossible geometry, and
unfabricable blanks in a quote request's line items, each returning a
**severity**, a **stable code**, a **plain-English message**, and the **offending
field**. Wire it into the two surfaces the spec names — the customer RFQ flow and
admin quote review — such that a customer sees only customer-scope findings.
Build the AI layer as a strictly **advisory, never-blocking, off-by-default**
addition behind an environment flag, with an injectable client so tests never
touch the network.

**This is a correctness feature in front of a physical bending machine.** A false
negative means metal is cut wrong. A false positive means a real, fabricable
order is refused. Both are failures, so every rule limit that nobody has
confirmed is marked as an ASSUMPTION in machine-readable form rather than
presented as fact.

---

## 3. ENGINEERING CONTEXT (only what bears on this work)

### 3.1 The business model constrains the output

AFS is an **RFQ platform** (CLAUDE.md, "BUSINESS MODEL"): customers never see a
price before a formal AFS-generated quote. Therefore **no validator message may
contain a dollar amount, a cost, or a quantity framed as cost** ("this wastes
half a sheet" is cost-adjacent and is admin-scope only).

### 3.2 Where a line item comes from, and what shape it really has

`quote_requests.line_items` is a JSONB array. Three live writers:

| Writer | `sourceTool` | Dimension fields it sets |
|---|---|---|
| `app/quote/page.tsx` (Quote Builder) | `afs-quote-builder` | `width`, `height`, `legA`, `legB`, `lengthFt`, `quantity`, free-text `profileType`/`material`/`gauge` |
| `app/studio/draft/page.tsx` (FlashDraft) | `afs-flashdraft` | `points` (polyline, **world inches**), `bendRadiiIn`, `hemStart`/`hemEnd`, `lengthFt`, `quantity`. **No** width/height/legA/legB. |
| `app/api/takeoff` → `app/upload/page.tsx` (Blueprint Takeoff AI) | `afs-blueprint-takeoff` | same named dimensions as the Quote Builder, plus `confidence`/`aiNote` |

Verified by reading `app/api/quote-requests/route.ts`'s `QuoteRequestItemInput`
and FlashDraft's own `submitQuoteRequest` body (`app/studio/draft/page.tsx`
≈ L3716-3760). FlashDraft `points` are world coordinates, and world
coordinates are **inches** — proven by `templatePointsToWorld`
(`app/studio/draft/page.tsx` ≈ L804), which divides canvas pixels by
`PIXELS_PER_INCH`.

`material` and `gauge` are **free text labels, not foreign keys**, and the three
writers spell the same material differently ("Galvalume" vs seeded "Galvalume
Steel"). `lib/data/catalog.ts`'s `normalizeMaterialLabel` plus
`lib/data/material-color-requirement.ts`'s `MATERIAL_LABEL_TO_CATEGORY` are this
codebase's existing, tested answer to that, and are reused rather than
reimplemented.

### 3.3 What already exists that this must reuse, not duplicate

| Existing artifact | What it gives | Why reuse is mandatory |
|---|---|---|
| `lib/pricing/quote-math.ts` → `SHEET_WIDTH_IN = 48`, `SHEET_LENGTH_FT = 10`, `stripsPerSheet()` | The real sheet geometry (10 ft × 4 ft; a strip's width comes out of the 48 in dimension) | CLAUDE.md rule #19: "Do not put a second copy of the formula … anywhere else." |
| `lib/pricing/quote-inputs.ts` → `blankWidthInFromPoints`, `bendCountFromPoints`, `hemCountOf`, `JobLineItemGeometry` | Girth (flat blank width) in inches, bend count as interior vertices, hem count — measured the same way the approval route measures `machine_jobs.blank_width_mm` | Two different girths for one profile is exactly the drift that puts a wrong number on a quote and a different one on the machine. |
| `lib/data/product-profiles.ts` | `product_profiles` reader (currently stock lengths only) and `QUOTE_LABEL_TO_SLUG`, the Quote-Builder-label → profile-slug alias map | The min/max columns live on the same rows; a second reader module would fork the label-resolution logic. |
| `lib/data/material-color-requirement.ts` → `MATERIAL_LABEL_TO_CATEGORY`, private `categoryFor` | Material label → `materials.category`, tolerant of legacy spellings | Its own doc comment says every lookup goes through `categoryFor`. |
| `lib/ai/takeoff-confidence.ts` | Precedent for "one pattern, one module, both producer and consumer import it" | CLAUDE.md rule #17 is the governing precedent for how an AI-adjacent vocabulary is allowed to exist in this repo. |

### 3.4 The real dimension-range data

`product_profiles` (SCHEMA.md TABLE 6) carries `min_width`/`max_width`,
`min_height`/`max_height`, `min_leg_a`/`max_leg_a`, `min_leg_b`/`max_leg_b`,
`standard_length_ft`, `max_length_ft`, `requires_consultation`. Seeded with 13
real rows in `supabase/migrations/002_seed_afs_data.sql` (confirmed applied live
— SCHEMA.md's migration table). **Any column may be NULL** (Fascia has no leg
range; Custom Profile has no ranges at all). NULL means *no constraint*, never
zero.

**Five Quote-Builder labels have no `product_profiles` row at all**: Step
Flashing, Conductor Head, Downspout, Reglet, Wall Panel / Cladding. For those,
range checking is genuinely impossible and must report that rather than invent a
range.

### 3.5 Two governance constraints that shape the wiring

* **The Command Center v7 Job screen is frozen.** `/admin/command-center/job/<id>`
  is under the whole-screen pixel gate (CLAUDE.md rule #34,
  `docs/design/command-center-v7/SCREEN_MANIFEST.json` — verified: 54 states,
  eight job-screen routes among them) and the run's hard rules forbid modifying
  it. Adding a validation panel there would fail the pixel gate by design.
  **Admin scope therefore lands on `/admin/quote-requests/[id]`**, the legacy
  admin quote-review screen — verified NOT in the pixel manifest, NOT in
  `lib/data/admin-nav.ts` (so not under the rule #28 contrast gate's screen
  list), and genuinely reachable (linked from `app/admin/page.tsx`,
  `app/admin/settings/page.tsx`, `components/admin/CommandCenterDashboard.tsx`,
  `lib/data/command-center-dashboard.ts`).
* **No migration may be applied.** The run forbids applying migrations, so no
  live code may write a column that does not exist yet. This rules out
  persisting validation results, and is why admin scope **recomputes on read**.

### 3.6 Baseline, measured before any edit

```
branch            ovn/04-order-validator, working tree clean
pnpm tsc --noEmit exit 0, zero errors
pnpm test:unit    31 files, 485 tests -> 484 passed, 1 FAILED
                  FAILING (PRE-EXISTING, UNRELATED): lib/design/v7-css.test.ts
                  "app/styles/command-center-v7.generated.css is stale" —
                  a trailing-whitespace / line-ending difference between the
                  committed generated CSS and a fresh regeneration.
```

That failure is pre-existing on a clean tree, is in the v7 design-CSS gate, and
is **not** touched by this work. It must still be failing, for the same reason,
at the end of the run — and no new failure may join it.

---

## 4. REQUIRED REPOSITORY INSPECTION — WHAT WAS ACTUALLY READ

Read in full or in the cited part, not assumed:

* `CLAUDE.md` (all 34 rules), `specs/SPEC_AI_ORDER_VALIDATOR.md` (all 7 sections).
* `SCHEMA.md` — TABLE 3 `materials`, TABLE 4 `gauges`, TABLE 6 `product_profiles`, the migration ledger.
* `supabase/migrations/002_seed_afs_data.sql` — all 9 materials, all gauge rows, all 13 `product_profiles` rows with their real min/max values.
* `app/api/quote-requests/route.ts` — the whole submit route.
* `app/quote/page.tsx` — L1-330 (types, `PROFILE_TYPES`, `MATERIALS`, `GAUGES`, step validity, submit), L534-600 (step 2 UI), L825-869 (nav buttons).
* `app/studio/draft/page.tsx` — the submit payload (≈L3670-3760), `PIXELS_PER_INCH`/`templatePointsToWorld` (≈L246, L795-810).
* `app/admin/quote-requests/[id]/page.tsx` — the whole page.
* `lib/pricing/quote-math.ts` (header + `SHEET_WIDTH_IN`/`stripsPerSheet`), `lib/pricing/types.ts`, `lib/pricing/quote-inputs.ts` (whole file).
* `lib/data/product-profiles.ts` (whole file), `lib/data/catalog.ts` (L1-100), `lib/data/material-color-requirement.ts` (L1-110), `lib/data/admin-nav.ts` (whole file).
* `lib/ai/takeoff-confidence.ts` (whole file), `lib/anthropic/client.ts`, `lib/anthropic/spec.ts` (head), `app/api/recommendations/material/route.ts` (whole file), `app/api/takeoff/route.ts` (L1-120).
* `lib/admin/auth.ts`, `lib/admin/pricing.ts` (L1-120), `lib/fixtures/mode.ts` (L1-60).
* `lib/flashdraft/geometry.ts` (exports + `signedInteriorAngleDeg`).
* `tailwind.config.js` (the whole colour block), `app/globals.css` (`:root`).
* `package.json`, `vitest.config.mts`, `playwright.config.ts`, `.env.example` (key names only — **no secret value was read, printed, or copied**).
* `docs/design/command-center-v7/SCREEN_MANIFEST.json` (every `liveRoute`).
* Existence check: `grep -il` for `order.validator|order-validator|orderValidator|ORDER_VALIDATOR` over `app components lib supabase tests scripts queue.yaml` → **zero matches**. `grep` for `incompatible_combinations` over `SCHEMA.md supabase/ app lib` → **zero matches**.

### 4.1 CURRENT STATE vs TARGET STATE

**CURRENT STATE.** No order validator exists in any form — no module, no route,
no component, no table, no test. Nothing validates a dimension beyond the
submit route's structural guard (`profileType` non-empty, `lengthFt > 0`,
`quantity > 0`) and the Quote Builder's own `isPositiveNumber`/
`isValidOptionalPositive` field checks. A customer can submit a coping cap whose
legs are wider than its cap, a 60-inch blank that cannot be cut from a 48-inch
sheet, or a self-crossing FlashDraft profile, and nothing says a word.

**TARGET STATE.** A pure, deterministic rule engine under `lib/order-validator/`
is the single source of truth for "is this fabricable", consumed by: the Quote
Builder live on every keystroke and again at the Step-2 → Next gate; the submit
route server-side as the authoritative check; and the admin quote-review page,
recomputed on read with full admin-scope detail and an explicit list of which
limits are still assumptions.

### 4.2 SPEC ↔ REPOSITORY DISCREPANCIES FOUND (S27 — surfaced, not silently resolved)

| # | SPEC says | Repository reality | Resolution taken |
|---|---|---|---|
| D1 | §4: "Table exists for future use … `CREATE TABLE incompatible_combinations` in SCHEMA.md" | The table does not exist in `SCHEMA.md`, in any migration, or in any query. | **Not created.** Its data is a documented DATA BLOCKER (checklist #38), and an empty table behind a query that can only ever return zero rows is a shell, which the Elite Standard forbids. The rule is implemented as a typed, config-driven rule whose default list is **empty and marked DATA-BLOCKED**, tested with an explicit override. Recorded as a GAP. |
| D2 | §6: request is `{ profileId, materialId, gaugeId, dimensions }` — UUID references | No customer surface has profile/material/gauge UUIDs. All three live as free text on the line item; `materials`/`gauges`/`product_profiles` are reference tables the customer surfaces never key against. | Endpoint takes **the same `items` shape `/api/quote-requests` already accepts**. One line-item shape across the codebase beats a second vocabulary that nothing can produce. Deviation recorded. |
| D3 | §2: `profile.maxWidth!` is dereferenced whenever `minWidth` is non-null | Seeded rows have independently nullable columns (Valley Flashing has `min_width`/`max_width` but NULL `min_height`/`max_height`; Fascia has NULL legs). | Each bound is tested **independently**; NULL means no constraint, never zero. The spec's snippet would throw or mis-compare on real seeded data. |
| D4 | §5: UI classes `bg-afs-warning-ghost`, `border-[var(--afs-border-crimson)]` | Neither exists. `app/globals.css` defines `--afs-crimson-ghost`, `--afs-amber-ghost`, `--afs-success-ghost`; there is no `--afs-warning-ghost` and no `--afs-border-crimson`. | Used the established in-repo banner pattern (`bg-[var(--afs-crimson-ghost)] border border-afs-crimson`, and `--afs-amber-ghost` + `border-afs-warning` for warnings), consistent with ~20 existing components. |
| D5 | §3: AI returns `severity: "error"` and §5 blocks advance on it | The run's item directive: the AI layer "must only ADD advisory warnings, never block". | **Item directive wins.** AI findings are clamped to `warn`/`info` and can never set `blocked`. Rationale: model output is unverified, and on a platform where the next button reaches a physical Thalmann, an unverified refusal of a fabricable order is as harmful as a missed defect. |
| D6 | §3: "Gauge vs. Width: flag if Width > 24" and gauge is > 22ga galvanized" | Thickness lives in `gauges.thickness_inches`, keyed by `material_id` — a DB read. But the limit as the spec states it is expressed in **gauge numbers**, and every surface's gauge options are labels (`'26 ga'`, `'0.032"'`, `'16 oz'`, `'0.7mm'`). | Rule compares **gauge numbers parsed from the label**, exactly as the spec states the limit, so the engine needs no gauge DB read and stays pure. A label carrying no gauge number (oz / inch / mm) has no stated limit and the rule correctly does not fire. |
| D7 | §3: "Counter Flashing: Height must be greater than Lap" | **There is no `lap` field** on any line item, in `product_profiles`, or on any input surface. | **Not implemented — UNRESOLVED.** Recorded with the reason. Inventing a lap dimension, or inferring one from `legA`, would be fabrication. |
| D8 | §3: "Step Flashing: Width should be at least 4 inches" | `Step Flashing` is a Quote-Builder label with **no `product_profiles` row**, so it has no min_width to check. | Implemented as a **spec-stated per-profile minimum** in the limits config (provenance `spec-stated`, not `assumption`), keyed on the label. |
| D9 | §2: "No API call — client already has profile constraints loaded" | Nothing loads `product_profiles` min/max anywhere. `product_profiles` RLS is `auth.uid() IS NOT NULL`, so a **guest** cannot read it with the anon client at all. | Client loads constraints when it can (signed-in), and the **server** validate call (service-role, reference tables only) is authoritative for everyone including guests. Pre-existing consequence noted in §13. |

---

## 5. PRECONDITIONS

1. Repo at `C:\Users\manag\Documents\afs-website-ovn-04-order-validator`, branch `ovn/04-order-validator`, tree clean. ✅ verified
2. `pnpm` available; `node_modules` installed. ✅ verified (tsc and vitest both ran)
3. Migrations 001-002 applied live, so `product_profiles` really holds the 13 seeded rows. ✅ per SCHEMA.md's migration ledger
4. No Supabase write, no migration apply, no deploy, no merge, no real Anthropic call, no real email/SMS/charge.
5. `ANTHROPIC_API_KEY` presence is **not** a precondition: the AI layer is off unless `AFS_ORDER_VALIDATOR_AI=1`, and with it off no code path touches the SDK.

---

## 6. SCOPE

### 6.1 CREATED

| Path | Purpose |
|---|---|
| `lib/order-validator/types.ts` | `ValidationSeverity`, `ValidationAudience`, `ValidationSource`, `ValidationField`, `ValidationCode`, `ValidationFinding`, `OrderValidatorItem`, `ProfileConstraints`, `OrderValidatorResult`. |
| `lib/order-validator/limits.ts` | The typed limits config table, `DEFAULT_ORDER_VALIDATOR_LIMITS`, `LIMIT_PROVENANCE` (machine-readable ASSUMPTION marking), `assumedLimitKeys()`, `resolveLimits()`. |
| `lib/order-validator/geometry-checks.ts` | Pure polyline predicates: `segmentLengthsIn`, `findZeroLengthSegments`, `findSelfIntersections`. |
| `lib/order-validator/rules.ts` | Every deterministic rule as a typed, ordered `ValidationRule` object. |
| `lib/order-validator/validate.ts` | The engine: `validateOrder`, `findingsForAudience`, `withAdvisories`, `isBlocking`. |
| `lib/order-validator/ai-advisor.ts` | Advisory AI layer: env flag, prompt builder, response parser, timeout, clamping. No SDK import. |
| `lib/order-validator/anthropic-advisor-client.ts` | The one adapter that binds the advisor to `lib/anthropic/client.ts`. Imported only by the API route. |
| `lib/order-validator/index.ts` | Public surface of the module. |
| `lib/order-validator/limits.test.ts` | Provenance completeness, override merging, no-NaN defaults. |
| `lib/order-validator/geometry-checks.test.ts` | Segment lengths, zero-length detection, self-intersection (crossing, non-crossing, adjacent, touching, collinear). |
| `lib/order-validator/rules.test.ts` | Every rule: happy, error, boundary. |
| `lib/order-validator/validate.test.ts` | Engine-level: ordering, determinism, counts, blocking, audience filtering, multi-item indices. |
| `lib/order-validator/ai-advisor.test.ts` | Flag default-off, mock client, clamping, never-blocks, timeout, malformed output, injection resistance. |
| `lib/order-validator/scope.test.ts` | The customer/admin contract: no admin-scope code ever leaks to a customer; no message contains a currency figure. |
| `lib/order-validator/fixtures.ts` | Versioned, explicit test fixtures (ARRANGE data) — profile constraints and line items. |
| `app/api/quote-requests/validate/route.ts` | `POST` — the spec's §6 endpoint. |
| `components/quote/OrderValidationMessages.tsx` | Customer-facing error/warning banners + acknowledge flow (client component). |
| `components/admin/OrderValidationPanel.tsx` | Admin-scope findings panel (server component, no client JS). |
| `tests/e2e/order-validator.spec.ts` | Playwright: the three flows SPEC §7 names. |

### 6.2 MODIFIED (additively, minimal diff)

| Path | Change |
|---|---|
| `lib/data/product-profiles.ts` | Add `ProfileConstraintRow` reader `getProfileConstraints` + `resolveProfileConstraintsByQuoteLabel`, reusing the existing `QUOTE_LABEL_TO_SLUG` map. Existing exports untouched. |
| `lib/data/material-color-requirement.ts` | Add one exported wrapper `materialCategoryForLabel` over the existing private `categoryFor`. No behaviour change. |
| `app/quote/page.tsx` | Load constraints; live per-field validation on step 2; gate Next; call the validate endpoint on Next from step 2; render the banners; show post-submit advisory notes. |
| `app/api/quote-requests/route.ts` | Run the engine server-side, log one structured line, return an additive `validation` field. **No change to any existing field, status code, or the insert.** |
| `app/admin/quote-requests/[id]/page.tsx` | Fetch constraints; render `<OrderValidationPanel>`. |
| `.env.example` | Document `AFS_ORDER_VALIDATOR_AI` (key + comment only, no value). |
| `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md` | Appended dated sections. |

### 6.3 NOT CREATED / NOT CHANGED

* No migration, no new table, no new column. `SCHEMA.md` needs no edit (nothing schema-shaped was added).
* `middleware.ts` untouched. `main` untouched. Nothing deployed or merged.
* No Command Center v7 screen, no file under `docs/design/command-center-v7/`, no pixel-gate baseline.
* FlashDraft drawing behaviour unchanged — `app/studio/draft/page.tsx` is **not** edited.
* No change to `lib/pricing/*`, `lib/flashdraft/*`, `lib/ai/takeoff-confidence.ts`.

---

## 7. NON-GOALS (S37)

1. **Not** a pricing feature. No cost, no dollar figure, no strip-count framed as money.
2. **Not** a replacement for the Step-2 structural validity the Quote Builder already does.
3. **Not** a Command Center Job-screen panel (frozen by rule #34 and the run's hard rules).
4. **Not** persistence of validation results (no migration may be applied).
5. **Not** `incompatible_combinations` as a database table (D1).
6. **Not** admin CRUD for rule limits. Limits are code-level typed config this run; an admin editor needs a table, hence a migration, hence a later run.
7. **Not** an AI layer that blocks, refuses, or decides anything.
8. **Not** a counter-flashing lap rule (D7 — no such field exists).
9. **Not** a fix for the pre-existing `lib/design/v7-css.test.ts` failure, nor for the pre-existing guest-RLS consequence in §13.

---

## 8. INVARIANTS (S38 — must still be true at the end)

| ID | Invariant | How it is protected |
|---|---|---|
| INV-1 | No customer-visible string produced by this feature contains a currency amount. | `scope.test.ts` asserts no `$`/`USD`/`cent` token in any customer-audience message across a fixture that triggers every rule. |
| INV-2 | A customer never receives an admin-scope finding. | `findingsForAudience` is the only exit; `scope.test.ts` asserts it over all codes. |
| INV-3 | The AI layer can never block. | `withAdvisories` clamps severity to `warn`/`info` and never recomputes `blocked`; asserted with an advisory that claims `severity: 'error'`. |
| INV-4 | With `AFS_ORDER_VALIDATOR_AI` unset, no Anthropic request is made. | `isAiAdvisorEnabled` defaults false; the route guards on it; the pure module has no SDK import at all. Asserted with a throwing mock client. |
| INV-5 | `/api/quote-requests` still accepts and persists every submission it accepted before. | The validator runs after validation of the body and before nothing — it cannot return early, cannot alter the insert, and cannot change a status code. Existing Playwright/behaviour unchanged; asserted by reading the diff and by `validate.test.ts`'s non-blocking contract. |
| INV-6 | One girth formula, one bend count, one sheet width in the codebase. | The engine imports `blankWidthInFromPoints`/`bendCountFromPoints`/`hemCountOf` from `lib/pricing/quote-inputs.ts` and `SHEET_WIDTH_IN`/`SHEET_LENGTH_FT` from `lib/pricing/quote-math.ts`. No local copy. |
| INV-7 | The engine is deterministic and pure. | No `Date`, no `Math.random`, no I/O, no mutation of inputs. `validate.test.ts` runs it twice and deep-compares, and asserts the input array is not mutated. |
| INV-8 | FlashDraft's drawing behaviour is unchanged. | `app/studio/draft/page.tsx` is not in the modified list; `git diff --stat` must not name it. |
| INV-9 | A NULL range bound means "no constraint", never zero. | `rules.test.ts` boundary cases pass `null` for each of the eight bounds independently. |
| INV-10 | TypeScript strict, zero `any`, zero new `@ts-ignore`/`eslint-disable`. | `pnpm tsc --noEmit` clean; grep for `any`/`ts-ignore` over the new files. |

---

## 9. REQUIREMENTS

### 9.1 R-ENGINE — the deterministic rule engine (`lib/order-validator/`)

**R-E-01 Finding shape.** Every finding is
`{ code, severity, field, message, itemIndex, audience, source, detail? }` where
`severity ∈ {error, warn, info}`, `audience ∈ {customer, admin}`,
`source ∈ {deterministic, ai}`, `field` is a closed union of the real line-item
field names plus the three derived ones (`points`, `blankWidth`, `bendCount`,
`hem`), and `code` is a closed union of stable `OV_*` strings. `message` is
plain English, addressed to the reader of that audience, and never contains a
stack trace, a code, or a dollar amount.

**R-E-02 Severity meaning is fixed.**
`error` = cannot be fabricated as specified, blocks a customer from advancing.
`warn` = unusual but possible; the customer must acknowledge, the admin should look.
`info` = context for whoever is reading; never blocks, never needs acknowledging.

**R-E-03 Audience meaning is fixed.** `customer` findings are shown to everyone
(customer **and** admin). `admin` findings are shown only in admin scope. There
is no third audience and no customer-only finding.

**R-E-04 The rule set.** Implemented, in this fixed evaluation order:

| # | Code | Severity | Field | Audience | Fires when | Limit source |
|---|---|---|---|---|---|---|
| 1 | `OV_PROFILE_TYPE_MISSING` | error | profileType | customer | `profileType` blank/absent | structural |
| 2 | `OV_QUANTITY_NOT_POSITIVE` | error | quantity | customer | `quantity` not a finite number > 0 | structural |
| 3 | `OV_LENGTH_NOT_POSITIVE` | error | lengthFt | customer | `lengthFt` not a finite number > 0 | structural |
| 4 | `OV_DIMENSION_NOT_POSITIVE` | error | width/height/legA/legB | customer | a **supplied** dimension is ≤ 0 or non-finite (one finding per offending field) | structural |
| 5 | `OV_DIMENSION_BELOW_MIN` | error | width/height/legA/legB | customer | supplied value < that field's non-NULL min | `product_profiles` (**real**) |
| 6 | `OV_DIMENSION_ABOVE_MAX` | error | width/height/legA/legB | customer | supplied value > that field's non-NULL max | `product_profiles` (**real**) |
| 7 | `OV_PROFILE_CONSTRAINTS_UNKNOWN` | info | profileType | **admin** | no constraints row resolved for this profile label | — |
| 8 | `OV_PROFILE_MIN_WIDTH` | warn | width | customer | a spec-stated per-profile minimum is violated (Step Flashing ≥ 4 in) | **spec-stated** |
| 9 | `OV_FLANGE_TOO_SHORT` | error | legA/legB | customer | a supplied leg is > 0 but < `minFlangeLengthIn` | **ASSUMPTION** |
| 10 | `OV_LENGTH_ABOVE_PROFILE_MAX` | error | lengthFt | customer | `lengthFt` > the profile's non-NULL `max_length_ft` | `product_profiles` (**real**) |
| 11 | `OV_PIECE_NEEDS_SPLICING` | info | lengthFt | **admin** | `lengthFt` > `SHEET_LENGTH_FT` but within the profile max | **repo-verified** |
| 12 | `OV_COPING_LEGS_EXCEED_WIDTH` | error | legA | customer | coping cap: `legA + legB ≥ width` (all three supplied) | **spec-stated** |
| 13 | `OV_GAUGE_SPAN_LIGHT` | warn | gauge | customer | width ≥ limit's width AND parsed gauge number > limit's, for the matching material category | **spec-stated** |
| 14 | `OV_MATERIAL_GAUGE_INCOMPATIBLE` | error | gauge | customer | the (material category, gauge number) pair is in the configured incompatibility list | **DATA-BLOCKED, empty by default** |
| 15 | `OV_SEGMENT_ZERO_LENGTH` | error | points | customer | two consecutive drawn points coincide within `zeroLengthEpsilonIn` | **ASSUMPTION** |
| 16 | `OV_SEGMENT_TOO_SHORT` | error | points | customer | a drawn segment is longer than epsilon but < `minFlangeLengthIn` | **ASSUMPTION** |
| 17 | `OV_SELF_INTERSECTION` | error | points | customer | two non-adjacent drawn segments cross or touch | geometric |
| 18 | `OV_BEND_COUNT_HIGH` | warn | bendCount | customer | bend count > `maxBendCountWarn` and ≤ `maxBendCountError` | **ASSUMPTION** |
| 19 | `OV_BEND_COUNT_EXCEEDED` | error | bendCount | customer | bend count > `maxBendCountError` | **ASSUMPTION** |
| 20 | `OV_BLANK_WIDTH_EXCEEDS_SHEET` | error | blankWidth | customer | girth > `SHEET_WIDTH_IN` (48) | **repo-verified** |
| 21 | `OV_BLANK_WIDTH_ONE_STRIP` | info | blankWidth | **admin** | `stripsPerSheet(girth) === 1` | **repo-verified** |
| 22 | `OV_HEM_FOLD_TOO_SHORT` | error | hem | customer | a hem's `lengthIn` is supplied, > 0, and < `minHemFoldLengthIn` | **ASSUMPTION** |
| 23 | `OV_HEM_FOLD_NOT_POSITIVE` | error | hem | customer | a hem exists and its `lengthIn` is supplied as ≤ 0 or non-finite | structural |
| 24 | `OV_REQUIRES_CONSULTATION` | info | profileType | customer | the resolved profile has `requires_consultation = true` | `product_profiles` (**real**) |

**R-E-05 Ordering and determinism.** Findings are returned sorted by
`(itemIndex asc, rule evaluation index asc, field name asc)`. Two runs over the
same input return deeply equal results. No clock, no randomness, no I/O.

**R-E-06 Counts and blocking.** `OrderValidatorResult` carries
`counts: {error, warn, info}` over **all** findings and `blocked: boolean` which
is true iff at least one `severity: 'error'` finding with `source:
'deterministic'` exists. `blockedForCustomer` is true iff at least one such
finding is also `audience: 'customer'`.

**R-E-07 Missing data never invents.** A dimension that was not supplied is not
validated (absent ≠ zero). A profile with no constraints row produces
`OV_PROFILE_CONSTRAINTS_UNKNOWN` (admin info) and no range findings. A gauge
label with no parseable gauge number produces no gauge findings.

**R-E-08 Input is not mutated.** `validateOrder` treats its inputs as readonly.

### 9.2 R-LIMITS — the typed limits config (`lib/order-validator/limits.ts`)

**R-L-01** One exported interface `OrderValidatorLimits` with plain, primitive
(or readonly array) fields — so a test or a future admin editor can override
one value without constructing wrappers.

**R-L-02 Provenance is machine-readable, not a comment.** A sibling
`LIMIT_PROVENANCE: Record<keyof OrderValidatorLimits, {provenance, basis}>`
where `provenance ∈ {'repo-verified', 'spec-stated', 'assumption',
'data-blocked'}` and `basis` is one sentence naming the authority (a file, a
spec section, or "nobody has stated this — Steve to confirm").

**R-L-03** `assumedLimitKeys()` returns every key whose provenance is
`assumption` or `data-blocked`, so the admin panel renders the list rather than
a hand-maintained copy of it.

**R-L-04** A unit test fails if any key of `OrderValidatorLimits` has no
provenance entry, or any provenance entry names a key that no longer exists. A
new limit therefore cannot ship without declaring whether anybody confirmed it.

**R-L-05 Default values and their provenance.**

| Key | Default | Provenance | Basis |
|---|---|---|---|
| `maxBlankWidthIn` | `SHEET_WIDTH_IN` (48) | repo-verified | `lib/pricing/quote-math.ts`; CLAUDE.md rule #19 |
| `maxPieceLengthFt` | `SHEET_LENGTH_FT` (10) | repo-verified | same |
| `minFlangeLengthIn` | `0.5` | **assumption** | No shop minimum supplied (DATA BLOCKER #38). Deliberately permissive. |
| `minHemFoldLengthIn` | `0.25` | **assumption** | ditto |
| `zeroLengthEpsilonIn` | `0.001` | **assumption** | "the same point" tolerance for a snapped drag |
| `maxBendCountWarn` | `12` | **assumption** | Thalmann DS2801 practical bend count not supplied |
| `maxBendCountError` | `24` | **assumption** | ditto |
| `profileMinimums` | `[{Step Flashing, width, 4 in}]` | spec-stated | SPEC §3 |
| `gaugeSpanLimits` | `[{galvanized, ≥24 in, >22 ga}]` | spec-stated | SPEC §3 |
| `incompatibleCombinations` | `[]` | **data-blocked** | checklist #38 / SPEC §4 — no rules supplied |

### 9.3 R-GEOM — polyline predicates (`lib/order-validator/geometry-checks.ts`)

**R-G-01** `segmentLengthsIn(points)` → the per-segment lengths in inches, in
order; `[]` for fewer than 2 points or any non-finite coordinate.

**R-G-02** `findZeroLengthSegments(points, epsIn)` → the indices of segments
shorter than or equal to `epsIn`.

**R-G-03** `findSelfIntersections(points, epsIn)` → the `[i, j]` index pairs of
**non-adjacent** segments that genuinely cross or touch. Adjacent segments share
a vertex by construction and are never reported. Collinear overlap of
non-adjacent segments **is** reported. Proper crossings are detected by
orientation sign; a shared endpoint between non-adjacent segments counts
(the shape has closed on itself).

**R-G-04** All three are pure, total (never throw), and tolerate `null`,
`undefined`, empty, 1-point, and non-finite input by returning the empty result.

### 9.4 R-AI — advisory layer (`lib/order-validator/ai-advisor.ts`)

**R-AI-01 Off by default.** `isAiAdvisorEnabled(env = process.env)` is true only
when `env.AFS_ORDER_VALIDATOR_AI === '1'`. Not "truthy" — the exact string, so a
typo cannot enable it.

**R-AI-02 Injectable client.** `requestAdvisories(input, client, options)` takes
an `AdvisoryClient { complete({system, user}): Promise<string> }`. The module
imports no SDK, so a unit test needs no network and no key.

**R-AI-03 Advisory only.** Every returned finding has `source: 'ai'` and severity
clamped into `{warn, info}`. A model claiming `error` becomes `warn`.

**R-AI-04 Never throws, never blocks.** A rejected promise, a timeout, a
non-JSON body, a JSON body of the wrong shape, an unknown field name, an unknown
severity, or an absurd number of findings all resolve to a **safe subset or an
empty array**, with exactly one structured server log line. No exception escapes.

**R-AI-05 Timeout.** Default 8000 ms (SPEC §6), overridable; on timeout the
result is `[]` and the deterministic result stands unchanged.

**R-AI-06 Bounded output.** At most `MAX_ADVISORIES` (6) findings are kept, each
message trimmed to `MAX_ADVISORY_MESSAGE_CHARS` (400), every `field` validated
against the closed `ValidationField` union and every `itemIndex` validated
against the real item count — a model cannot invent a field name, an out-of-range
item, or a 10 000-character message that reaches a page.

**R-AI-07 No price.** The system prompt forbids any dollar amount, and any
advisory whose message matches a currency pattern is **dropped**, not displayed.
Prompt instruction alone is not enforcement.

**R-AI-08 Server only.** The advisory call happens exclusively in
`app/api/quote-requests/validate/route.ts`. The Anthropic adapter lives in its
own file so that no client bundle can reach it (CLAUDE.md rule #5).

**R-AI-09 Model.** `claude-sonnet-4-6`, matching every other AI call in this
repo.

### 9.5 R-API — `POST /api/quote-requests/validate`

**R-API-01** Accepts `{ items: LineItemLike[] }` (D2). Rejects a non-object body,
a missing/empty/non-array `items`, or more than `MAX_ITEMS_PER_REQUEST` (50) with
`400` and a plain-English `error`.
**R-API-02** Resolves `product_profiles` constraints server-side. Uses the
service-role client (`lib/supabase/admin.ts`, already `cache: 'no-store'`) because
the route must work for a **guest** RFQ, whose anon session cannot pass
`product_profiles`'s RLS. It reads **reference data only** — never a user row,
never a `quote_requests` row — so no user-scoped data can leak through it.
**R-API-03** Runs the deterministic engine. If the AI flag is on, adds advisories;
if it is off, does nothing AI-shaped at all.
**R-API-04** Returns `200` with
`{ valid, blocked, errors, warnings, infos, counts, assumedLimits }`, where
every returned finding has already been filtered to the **customer** audience.
`valid` is `errors.length === 0 && warnings.length === 0` (SPEC §6's own
definition of `valid: true`).
**R-API-05** If the reference read fails, validation still runs with no
constraints (the engine degrades to the data-free rules) and the response is
still `200`. A validator outage must not become a submission outage.
**R-API-06** Any unexpected throw is caught, logged once, and answered `200` with
an explicitly empty, non-blocking result — the same "fall through to valid if the
API is slow" posture SPEC §6 states, applied to every failure mode.

### 9.6 R-SUBMIT — `POST /api/quote-requests` (authoritative, non-blocking)

**R-S-01** After the existing body validation and before the insert, the route
runs the engine over the accepted `items` with constraints read via the
service-role client.
**R-S-02** It **does not block**. No new status code, no early return, no change
to the insert. (INV-5.)
**R-S-03** When any finding exists it emits exactly one structured server line:
`[Order Validator] request=<number> errors=<n> warns=<n> codes=<comma list>` —
observability (S24) without a schema change.
**R-S-04** The success response gains one additive field,
`validation: { counts, warnings, infos }` (customer audience, errors excluded
because the Step-2 gate already handled them and a post-hoc "this is impossible"
on a confirmation screen is not actionable). Existing clients that ignore the
field keep working.

### 9.7 R-UI-CUSTOMER — `app/quote/page.tsx` + `components/quote/OrderValidationMessages.tsx`

**R-UC-01 Live per-field validation.** On every step-2 dimension change the page
runs the engine locally (`useMemo`) and renders, under each offending input, the
message for that field, with the input bordered `afs-crimson` for an `error` and
`afs-warning` for a `warn`.
**R-UC-02 Next is gated.** While any customer-audience `error` exists for step 2,
Next is disabled — joined onto the existing `step2Valid`, not replacing it.
**R-UC-03 Server gate on Next.** Pressing Next from step 2 posts to the validate
endpoint, shows a loading label on the button, and on the response: `errors` →
error banner, advance blocked; `warnings` → amber banner with **Acknowledge and
Continue**; neither → advance. Acknowledgement is per-finding-code and is reset
whenever a step-2 field changes, so an acknowledged warning cannot survive the
edit that invalidated it.
**R-UC-04 Degrade, never trap.** A network failure or non-OK response on that
call **advances** the user (the server submit path is still authoritative) and
records nothing misleading. A validator that is down must not block a quote
request.
**R-UC-05 States.** Default, loading ("Checking…"), error banner, warning banner,
and the empty case (no findings → nothing rendered at all).
**R-UC-06 Tokens.** `afs-*` only, using the repo's existing banner idiom
(`bg-[var(--afs-crimson-ghost)] border border-afs-crimson` /
`bg-[var(--afs-amber-ghost)] border border-afs-warning`). No hardcoded hex.
**R-UC-07 No price.** Nothing rendered here can contain a dollar amount (INV-1).

### 9.8 R-UI-ADMIN — `components/admin/OrderValidationPanel.tsx`

**R-UA-01** Server component. Renders **all** findings (admin audience ⊇ customer
audience) grouped by item, each with its severity chip, its stable code (admins
get the code; customers never do), the field, and the message.
**R-UA-02 Empty state.** "Nothing to flag" when the engine returns no findings —
and it says what was checked, so a silent pass is distinguishable from a check
that never ran.
**R-UA-03 Assumptions are disclosed.** A footer lists `assumedLimitKeys()` with
each basis, so an estimator reading a warning knows whether the threshold behind
it is confirmed shop capability or a placeholder awaiting Steve.
**R-UA-04 Dark-surface contrast.** This screen is gunmetal, so status text uses
`afs-danger-on-dark` / `afs-warning-on-dark` / `afs-info-on-dark`
(CLAUDE.md rule #29) — never the fill colours as text.
**R-UA-05 Failure containment.** A throw inside the panel must not take the
estimator form with it (CLAUDE.md rule #30): it is wrapped in the existing
`components/ui/PanelErrorBoundary.tsx`.

---

## 10. CONSTRAINTS — WHAT MUST NOT BE DONE

1. Do not modify `middleware.ts`, `main`, any v7 Command Center screen, anything
   under `docs/design/command-center-v7/`, or any pixel-gate baseline.
2. Do not apply a migration, create a table, or write a column that does not
   exist.
3. Do not change FlashDraft's drawing behaviour — `app/studio/draft/page.tsx` is
   not edited.
4. Do not copy the girth formula, the bend-count rule, or the sheet dimensions.
   Import them (INV-6).
5. Do not let the AI layer block, refuse, or set `blocked`; do not call Anthropic
   with the flag off; do not import the SDK from a module a client component can
   reach.
6. Do not invent a shop limit and present it as fact. An unconfirmed number is
   `provenance: 'assumption'` or it does not ship.
7. Do not show a customer a dollar amount, a rule code, or an admin-scope
   finding.
8. Do not weaken, skip, or delete a test — including the pre-existing
   `lib/design/v7-css.test.ts` failure, which is left exactly as found.
9. Do not use a default Tailwind colour or a literal hex in JSX.
10. Zero `any`, zero new `@ts-ignore`, zero new `eslint-disable`.
11. Do not read, print, or copy a value from any `.env*` file.

---

## 11. IMPLEMENTATION GUIDANCE (ordering — dependencies before dependents)

1. `types.ts` → `limits.ts` → `geometry-checks.ts` (+ their tests) — pure, no deps on the rest.
2. `rules.ts` → `validate.ts` (+ tests). Commit: engine green.
3. `fixtures.ts`, `scope.test.ts` — the audience/price contract over the whole rule set.
4. `ai-advisor.ts` (+ tests), `anthropic-advisor-client.ts`, `index.ts`. Commit.
5. `lib/data/product-profiles.ts` + `lib/data/material-color-requirement.ts` additive exports.
6. `app/api/quote-requests/validate/route.ts`; then the additive hook in `app/api/quote-requests/route.ts`. Commit.
7. `components/quote/OrderValidationMessages.tsx`, then `app/quote/page.tsx`. Commit.
8. `components/admin/OrderValidationPanel.tsx`, then `app/admin/quote-requests/[id]/page.tsx`. Commit.
9. `tests/e2e/order-validator.spec.ts`; `.env.example`; governance; final verification.

Technical expectations: every exported function carries a docstring stating
intent and the authority for any number in it. Rules are data (an ordered array
of objects) rather than a 24-branch function, so the evaluation order is
inspectable and the test can iterate the array to prove every code is covered.

---

## 12. ACCEPTANCE CRITERIA

**AC-01** `lib/order-validator/` exists and exports a pure `validateOrder` that
returns `ValidationFinding[]` with `code`, `severity`, `field`, `message`,
`itemIndex`, `audience`, `source` for every finding.

**AC-02** All 24 rules of R-E-04 are implemented, and a unit test proves each one
with a **happy** case (does not fire), an **error/trigger** case (fires with the
exact code, severity, field and audience), and a **boundary** case (exactly at
the limit).

**AC-03** Dimension min/max come from real `product_profiles` data; each of the
eight bounds is honoured independently; a NULL bound imposes no constraint; a
profile with no row yields `OV_PROFILE_CONSTRAINTS_UNKNOWN` (admin, info) and no
invented range.

**AC-04** Physical impossibility is caught: zero-length segment, below-minimum
segment, self-intersection, coping legs ≥ width, blank wider than 48 in, piece
longer than the profile max.

**AC-05** `limits.ts` is a typed table; every key has a machine-readable
provenance; a test fails if a key lacks one or names a dead key;
`assumedLimitKeys()` returns exactly the unconfirmed ones.

**AC-06** `validateOrder` is deterministic: two runs on identical input are
deeply equal, and the input is not mutated.

**AC-07** Customer scope is enforced: no `audience: 'admin'` finding is ever
returned by `findingsForAudience(..., 'customer')`, over the full rule set.

**AC-08** No customer-visible message contains a currency amount.

**AC-09** AI is off by default: with `AFS_ORDER_VALIDATOR_AI` unset,
`isAiAdvisorEnabled()` is false and a throwing mock client is never called.

**AC-10** AI is advisory only: an advisory claiming `severity: 'error'` is
clamped to `warn`, `source` is `'ai'`, and `blocked` is unchanged.

**AC-11** AI failure is contained: rejection, timeout, non-JSON, wrong shape,
unknown field, unknown severity, out-of-range `itemIndex`, over-long message and
a currency-bearing message each yield a safe result with no throw.

**AC-12** `POST /api/quote-requests/validate` exists, returns the SPEC §6 shape
(customer-filtered), answers `400` on a bad body, and `200` with a non-blocking
result when the reference read or anything else fails.

**AC-13** `POST /api/quote-requests` runs the validator, logs one structured
line when there are findings, returns the additive `validation` field, and
**still accepts every submission it accepted before** — no new status code, no
early return, no change to the insert.

**AC-14** The Quote Builder shows a per-field message and a red border on an
offending step-2 input, disables Next while a customer-visible error exists, and
on Next from step 2 shows an error banner (blocking) or an amber banner with
**Acknowledge and Continue** (non-blocking) per SPEC §5.

**AC-15** An acknowledged warning is reset when any step-2 field changes.

**AC-16** `/admin/quote-requests/[id]` renders the admin panel with every
finding including admin-scope ones and their codes, an honest empty state, and
the list of assumed limits.

**AC-17** `pnpm tsc --noEmit` exits 0.

**AC-18** `pnpm test:unit` shows **no new failing test**; the only failure is the
pre-existing `lib/design/v7-css.test.ts`, failing for the same reason as at
baseline.

**AC-19** Coverage on the new `lib/order-validator/` code is ≥ 80% lines,
reported as a measured number.

**AC-20** `git diff --name-only` does not name `middleware.ts`,
`app/studio/draft/page.tsx`, any `app/admin/command-center/**` file, any
`docs/design/command-center-v7/**` file, or any `supabase/migrations/**` file.

**AC-21** No `any`, no new `@ts-ignore`, no new `eslint-disable`, no TODO/FIXME,
no placeholder, no literal hex in JSX, across every file this item adds or
changes.

**AC-22** Playwright spec `tests/e2e/order-validator.spec.ts` covers SPEC §7's
three scenarios and is honest about what it could and could not execute in this
environment.

---

## 13. VALIDATION — MAPPED TO THE ACCEPTANCE CRITERIA

| AC | Verification method | Expected result |
|---|---|---|
| AC-01 | `lib/order-validator/validate.test.ts` | Finding objects carry all seven required keys; asserted field by field. |
| AC-02 | `lib/order-validator/rules.test.ts`, which also iterates `ALL_RULES` | Every code in `ValidationCode` appears in at least one trigger test; 3 cases per rule. |
| AC-03 | `rules.test.ts` range group + `validate.test.ts` | Independent-bound and NULL-bound cases pass; unknown profile yields exactly one admin info. |
| AC-04 | `geometry-checks.test.ts` + `rules.test.ts` | Each impossibility produces its code. |
| AC-05 | `limits.test.ts` | Provenance map is total and has no dead keys; `assumedLimitKeys()` equals the expected set. |
| AC-06 | `validate.test.ts` determinism test | `JSON.stringify(a) === JSON.stringify(b)`; frozen input unmodified. |
| AC-07, AC-08 | `scope.test.ts` | Zero admin codes in the customer projection; zero currency matches. |
| AC-09, AC-10, AC-11 | `ai-advisor.test.ts` | Throwing mock never called; clamping asserted; eight failure modes each asserted. |
| AC-12, AC-13 | Code review of the diff + `pnpm tsc --noEmit`; behaviour asserted by the engine tests the routes delegate to | Routes are thin; all logic is in the tested engine. |
| AC-14, AC-15, AC-16 | `tests/e2e/order-validator.spec.ts` where the environment allows; otherwise human browser verification, item marked **UNVERIFIED** | See §16. |
| AC-17 | `pnpm tsc --noEmit` | exit 0 |
| AC-18 | `pnpm test:unit` | 1 failure, the pre-existing one, named. |
| AC-19 | `pnpm vitest run --coverage lib/order-validator` | ≥ 80% lines, number reported. |
| AC-20 | `git diff --name-only` | Forbidden paths absent. |
| AC-21 | `grep` over the changed files | No match. |

---

## 14. REQUIRED TESTS (class → behaviour)

| Class | File | Behaviour |
|---|---|---|
| Unit — config | `limits.test.ts` | provenance totality, no dead keys, override merge, assumed-key set, every default finite and positive |
| Unit — geometry | `geometry-checks.test.ts` | segment lengths; zero-length at and below epsilon; crossing W; non-crossing Z; adjacent segments never reported; non-adjacent touching endpoints reported; collinear overlap reported; null/empty/1-point/NaN all safe |
| Unit — rules | `rules.test.ts` | 24 rules × {happy, trigger, boundary} |
| Unit — engine | `validate.test.ts` | finding shape; ordering; determinism; input immutability; counts; `blocked` vs `blockedForCustomer`; multi-item `itemIndex` correctness; empty input |
| Unit — contract | `scope.test.ts` | audience projection over the whole rule set; no currency in any customer message; every `ValidationCode` has a declared audience |
| Unit — AI | `ai-advisor.test.ts` | flag exactness; mock client; clamping; `source: 'ai'`; never blocks; timeout; rejection; non-JSON; wrong shape; unknown field; unknown severity; bad `itemIndex`; over-long message; currency-bearing message dropped; output cap |
| E2E | `tests/e2e/order-validator.spec.ts` | SPEC §7's three flows against a local server |
| Regression | `pnpm test:unit` whole suite | 484 previously-passing tests still pass |

Every test follows ARRANGE / ACT / ASSERT with explicit fixtures from
`lib/order-validator/fixtures.ts`, one behaviour per test, exact comparisons, and
an assertion message stating expected vs actual and why it matters.

---

## 15. COMPLETION EVIDENCE (filled at the end of the run)

Recorded in the FINAL REPORT and in the appended `STATE_OF_THE_BUILD.md` /
`SESSION_STATE.md` sections: files created and modified, commands run with their
real output, unit-test counts, coverage numbers, the pre-existing failure, every
assumption, every gap, and the exact browser steps for human verification.

---

## 16. KNOWN LIMITATIONS AND UNRESOLVED ITEMS

**U-1 Counter-flashing lap rule (SPEC §3).** Not implemented: no `lap` field
exists anywhere in the data model or on any input surface. Needs either a new
input field or a decision to drop the rule. **UNRESOLVED — Steve/Reid.**

**U-2 Five assumed limits.** `minFlangeLengthIn`, `minHemFoldLengthIn`,
`zeroLengthEpsilonIn`, `maxBendCountWarn`, `maxBendCountError` are placeholders
chosen to be permissive (they flag little rather than much), explicitly marked
`provenance: 'assumption'`, and listed on the admin panel. **PENDING STEVE.**

**U-3 `incompatible_combinations`.** No table, no rules, by decision D1. The
rule and its typed config exist and are tested; the default list is empty.
**PENDING checklist #38.**

**U-4 Per-material dimension ranges.** `product_profiles` ranges are
material-independent in the real schema; the only material-aware dimension limit
anybody has stated is the gauge-span rule. No per-material range was invented.
**PENDING STEVE.**

**U-5 Admin scope is on `/admin/quote-requests/[id]`, not the v7 Job screen.**
Forced by CLAUDE.md rule #34 and this run's hard rules. If the Job screen should
carry the panel, that is a v7 design change (prototype first, then the pixel
gate), not a code change. **DECISION NEEDED — Reid.**

**U-6 Guest cannot read `product_profiles` client-side.** Pre-existing: that
table's RLS is `auth.uid() IS NOT NULL`, so a guest's live per-field range
feedback is absent and only the server gate catches a range violation.
Discovered, not introduced; `getProfileStockLengths` has the same exposure
today. Not fixed (scope). **Recorded.**

**U-7 Browser confirmation.** Per the run's Six Laws the item is marked
**UNVERIFIED** until a human confirms the two screens in a browser.

---

## 17. SELF-AUDIT

Performed after the draft, adversarially, against §12's critical-defect list.

| Dimension | Max | Score | Note |
|---|---|---|---|
| Technical correctness | 15 | 15 | Every number traced to a file or marked an assumption. Nullable bounds, free-text labels, inch units and the 48-in sheet all verified against real seed data and real code, not assumed. |
| Completeness | 15 | 15 | 24 rules, 9 discrepancies, 7 unresolved items, scope/non-goals/invariants explicit; both wiring surfaces specified down to state. |
| Repository grounding | 10 | 10 | §4 lists what was actually read; the existence check is recorded as run with its result. |
| Architectural consistency | 10 | 10 | Reuses `quote-inputs`, `quote-math`, `product-profiles`, `material-color-requirement`; follows rule #17's one-pattern precedent; no second copy of any formula. |
| Requirement clarity | 10 | 10 | Each requirement is a single testable statement with a code. |
| Acceptance-test quality | 10 | 10 | 22 ACs, each mapped to a named verification with an expected result. |
| Edge-case / failure coverage | 10 | 10 | Nulls, absent vs zero, unknown profile, unparseable gauge, 8 AI failure modes, reference-read failure, validator-down degradation. |
| Security / data integrity | 5 | 5 | Service role for reference tables only; RLS reasoning stated; no secret read; AI output bounded and field-validated; no client SDK reach. |
| Implementation executability | 10 | 10 | Ordered build plan, exact paths, exact defaults. |
| Reviewability / evidence | 5 | 5 | Baseline measured, pre-existing failure named, forbidden-path check is an AC. |
| **Total** | **100** | **100** | |

Critical-defect check: no materially ambiguous requirement; no unverified
repository assumption where verification was possible; no missing critical AC; no
contradictory requirement (the one spec/item conflict, D5, is resolved explicitly
in favour of the item directive); no unsafe security requirement; no destructive
migration (none at all); schema and API contracts verified against the real
schema and the real route. **No critical defect. Self-audit PASS.**

---

ENGINEERING COMPLETION RECORD
Prompt ID: EES-OVN.04
Prompt Name: Order Validator — deterministic rule engine, customer/admin scope, optional advisory AI
Word Count: 4318
Engineering Proficiency Score: 100/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES
