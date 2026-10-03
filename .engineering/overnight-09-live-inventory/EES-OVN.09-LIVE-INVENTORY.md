# EES-OVN.09-LIVE-INVENTORY

## 1. IDENTITY

| Field | Value |
|---|---|
| Prompt ID | EES-OVN.09 |
| Prompt Name | Live Inventory — Shop Material Stock, Adjustment Ledger, Low-Stock Signal |
| Queue item | `09-live-inventory` |
| Branch | `ovn/09-live-inventory` (git worktree of `C:\Users\manag\Documents\afs-website`) |
| Governing spec | `specs/SPEC_LIVE_INVENTORY.md` |
| Prior audit | `LIVE_INVENTORY_SCOPE.md` (2026-07-30) |
| Date | 2026-10-03 |
| Run type | Unattended overnight. No question can be answered; every ambiguity is resolved conservatively and recorded here. |

---

## 2. OBJECTIVE

Give AFS an admin-only record of the **raw material it physically has in the
shop** — material, gauge, finish, coil width, quantity on hand, quantity
reserved, reorder point — together with an **append-only adjustment ledger**
that records every change with a reason and the person who made it, and a
**low-stock indicator** derived from that data.

The feature ships with **zero rows and no invented numbers**. Nothing it adds is
visible to a customer.

### 2.1 What this is NOT, and why that matters

`specs/SPEC_LIVE_INVENTORY.md` governs a different, already-built thing: the
three-value **stock signal** (`products.stock_type` ∈ `stock | fabricated |
special_order`) plus `products.lead_time_days`, shown to customers as a coloured
dot in the product catalogue. §1 of that spec says in terms: *"This is NOT a
real-time inventory management system. It is a signal system."* Its header marks
**stock levels (#56) and ERP/inventory (#55) as BLOCKED**.

The queue item for this run asks for something the spec does not describe: real
quantity columns (`on-hand`, `reserved`, `reorder point`) on real material rows,
an adjustment log, and a low-stock indicator. Those are **numeric inventory**,
which the spec defers to §4 "WHEN ERP INTEGRATION ARRIVES".

**Resolution, and it is the central scoping decision of this run.** The item's
instruction is explicit and repeated — build the table, *"Ship with an empty
table and a clear empty state; no invented stock numbers"* — and CLAUDE.md's own
DATA BLOCKERS section states the house rule for exactly this situation:
*"Features that depend on this data are built with correct architecture and
explicit placeholder behavior — they are not skipped. When data arrives, it
populates the existing structure."* So:

- The **structure** is built, in full, to the elite standard.
- **No quantity is invented.** The tables ship empty, and a never-counted row
  stores `NULL` on hand, not `0` (see §9.3).
- **Nothing customer-facing changes.** Not one byte of the catalogue, the quote
  wizard, `StockBadge`, or any public route is touched. The spec permits a
  customer to see the *signal* and the *lead time*; it permits no quantity, and
  this build shows none to anybody but an admin.
- **ERP remains unbuilt.** No `/api/admin/inventory/sync` webhook receiver is
  created (SPEC §4 defers it; #55/#56 are still BLOCKED). The schema is shaped
  so that an ERP writer later becomes one more adjustment `source`, with no
  refactor — see §9.6.

---

## 3. ENGINEERING CONTEXT

### 3.1 Stack, verified from `package.json` and `pnpm-lock.yaml`

| Concern | Actual |
|---|---|
| Framework | `next@14.2.5`, App Router |
| Language | TypeScript `^5`, `strict` (verified in `tsconfig.json`) |
| Package manager | pnpm (per CLAUDE.md rule #2) |
| Database | Supabase / PostgreSQL, `@supabase/supabase-js@^2.110.2`, `@supabase/ssr@^0.12.0` |
| Unit tests | `vitest@^5.0.0` — script `pnpm test:unit` → `vitest run` |
| E2E | `@playwright/test@^1.48.0` — script `pnpm test:e2e` → `playwright test` |
| Type check | `pnpm tsc --noEmit` (no dedicated script; invoked directly, as CLAUDE.md rule #3 does) |
| Lint | `pnpm lint` → `next lint` |
| Styling | Tailwind `^3.4.17`, `afs-*` tokens only (CLAUDE.md rule #4) |

There is **no** `vitest --coverage` provider installed (`@vitest/coverage-v8` is
absent from `devDependencies`). Coverage is therefore reported by **test-to-
branch enumeration** in §14.4 rather than by a fabricated percentage, and the
absence is recorded as a limitation. Adding a coverage dependency is a
package-manifest change this item does not authorise (LAW 7).

### 3.2 Repository facts this build depends on

Each was read, not recalled.

| Fact | Where verified |
|---|---|
| `is_admin()` exists: `SECURITY DEFINER`, `STABLE`, `search_path = public`, returns `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role='admin')` | `supabase/migrations/001_initial_schema.sql:15-23` |
| `materials` table: `id`, `name`, `slug`, `category`, `is_active`, `sort_order`; RLS `authenticated_read_materials` (SELECT where active) | `001_initial_schema.sql:94-121` |
| `gauges` table: `id`, `material_id → materials(id)`, `label`, `thickness_inches`, `is_active`, `sort_order`; RLS read-for-authenticated + `admin_write_gauges` | `001_initial_schema.sql:123-141` |
| `profiles(id)` is the FK target for "who did it" everywhere in this schema | `001_initial_schema.sql`, `035_*.sql` (`created_by uuid REFERENCES profiles(id)`) |
| `afs_append_only()` trigger function already exists, raises `42501`, reads `to_jsonb(OLD) ->> 'test_tag'` deliberately | `035_price_book_ledger_quotes_invoices.sql:114-126` |
| Admin-only RLS shape in this codebase is `FOR ALL USING (is_admin())`; a ledger gets SELECT + INSERT policies **only** | `035_*.sql:449-483` |
| Highest existing migration number is **038** | `ls supabase/migrations/` |
| `requireAdminUser(supabase)` redirects `/login` when unauthenticated and `/account` when `profiles.role !== 'admin'` | `lib/admin/auth.ts` |
| `createAdminClient()` sets `cache: 'no-store'` on every request (CLAUDE.md rule #22) | `lib/supabase/admin.ts` |
| `logAdminAction()` writes `admin_audit_log` through the service role and never throws | `lib/admin/audit.ts` |
| `/admin/settings` already renders an "Inventory / Stock Status" section with `ProductStockTable` + an `EmptyState` | `app/admin/settings/page.tsx` |
| `/admin/settings/price-book` is the established pattern for a Settings **sub-page**: `LightWorkingArea`, `export const dynamic = 'force-dynamic'`, a `← Settings` back link | `app/admin/settings/price-book/page.tsx` |
| The contrast build gate derives its screens from `lib/data/admin-nav.ts` **plus every `page.tsx` on or beneath those routes** — so a new page under `/admin/settings` is measured automatically | `scripts/audit/contrast-check.mjs:20-24` |
| On a light surface the placeholder colour is `afs-ink-700` (10.3:1 on `afs-bg-card`); `afs-chrome-silver` measures 1.55:1 there | CLAUDE.md rule #23, `lib/design/placeholder-contrast.test.ts` |
| Orders are created in exactly one function, `createOrderFromQuote()`, from two call sites (Stripe webhook; net-terms checkout) | `ORDER_LIFECYCLE_DECISION.md §1`, `lib/data/orders.ts` |

### 3.3 What already exists for this feature (STEP 1 existence check)

Grepped `app/`, `components/`, `lib/`, `supabase/migrations/` for
`inventory`, `stock`, `qty_on_hand`, `reserved`, `reorder`.

**BUILT — do not rebuild:**

| Artefact | Status |
|---|---|
| `products.stock_type`, `products.lead_time_days` | In `001_initial_schema.sql` with CHECK constraints |
| `app/api/admin/inventory/products/[productId]/route.ts` | PATCH, admin-gated, validates `stockType` + `leadTimeDays` |
| `app/api/admin/inventory/bulk/route.ts` | POST, admin-gated, "set all [material] to [type]" per SPEC §3 |
| `components/admin/ProductStockTable.tsx` | Client table, per-row save, bulk bar, per-row error/saved states |
| `lib/data/product-stock.ts` | `withLiveStock()` overlay + `getProductStockRows()` |
| `app/admin/settings/page.tsx` → "Inventory / Stock Status" | Section with `EmptyState` when there are no product rows |
| `components/product/StockBadge.tsx` | Presentational signal badge, two call sites |

**GAP — this run's scope:**

| Gap | Evidence it is absent |
|---|---|
| Any table holding a real quantity | Zero matches for `qty_on_hand\|quantity_on_hand\|inventory_items\|reorder` in `supabase/migrations/` |
| Material/gauge/finish/coil-width stock rows | No table, no lib module, no route |
| Append-only adjustment log for inventory | `afs_append_only()` is bound only to `pricing_ledger` and `price_book_versions` |
| Low-stock indicator | No matches for `low_stock\|lowStock\|reorderPoint` anywhere in `app/ components/ lib/` |
| Admin CRUD for stock rows | No route, no page, no component |
| Reservation on order approval | No reservation concept exists; see §8 (non-goal, recorded gap) |

---

## 4. REQUIRED REPOSITORY INSPECTION — WHAT WAS ACTUALLY READ

Full files: `CLAUDE.md`, `specs/SPEC_LIVE_INVENTORY.md`, `LIVE_INVENTORY_SCOPE.md`,
`lib/data/product-stock.ts`, `app/admin/settings/page.tsx`,
`app/admin/settings/price-book/page.tsx`, `components/admin/ProductStockTable.tsx`,
`components/ui/EmptyState.tsx`, `lib/admin/auth.ts`, `lib/admin/audit.ts`,
`lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/data/admin-nav.ts`,
`lib/data/admin-working-area.ts`, `app/api/admin/inventory/bulk/route.ts`,
`app/api/admin/inventory/products/[productId]/route.ts`, `playwright.config.ts`,
`tests/e2e/auth.setup.ts`, `package.json`.

Partial: `supabase/migrations/001_initial_schema.sql` (§`is_admin`, `materials`,
`gauges`, `admin_audit_log`), `supabase/migrations/035_price_book_ledger_quotes_invoices.sql`
(the append-only trigger, the RLS block, the seed), `scripts/audit/contrast-check.mjs`
(the derivation header and thresholds), `lib/data/workbench.test.ts` (the light
working-area assertion), `ORDER_LIFECYCLE_DECISION.md §1`, `SCHEMA.md` (company_id
usage, TABLE 2), `lib/data/metal-colors.ts` (finish naming rule),
`tests/e2e/shop-deliveries.spec.ts` (admin spec conventions).

Commands run for baseline (§5.2): `git status`, `git log`, `ls supabase/migrations`,
`pnpm tsc --noEmit`, `pnpm test:unit`, `node scripts/audit/contrast-check.mjs`.

---

## 5. PRECONDITIONS

### 5.1 Environment

- Node + pnpm installed; `node_modules` present (verified: `pnpm tsc` runs).
- `.env.local` present with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` (names read; **no value was read,
  printed or copied**).
- **Migration 039 is NOT applied to any Supabase project.** The run's hard rules
  forbid it. Therefore `inventory_items`, `inventory_adjustments` and
  `inventory_apply_adjustment()` **do not exist in the live database** while this
  item is verified. This is not an edge case to be hand-waved — it is the state
  the UI will actually be in, and §9.7/§11.4 make it a first-class, designed,
  tested state.

### 5.2 Baseline, measured before any file was modified

| Measurement | Result |
|---|---|
| `git status --short` | clean |
| `HEAD` | `75118cb` |
| `pnpm tsc --noEmit` | **clean**, zero output |
| `pnpm test:unit` | **484 passed, 1 failed, 31 files** |
| The one failure | `lib/design/v7-css.test.ts` — "`app/styles/command-center-v7.generated.css` is stale". The diff is **whitespace only** (trailing-space / blank-line normalisation in this worktree's checkout of the generated file). **PRE-EXISTING at `75118cb` with a clean tree. Not caused by this item and not repaired by it** — regenerating that file would modify a v7 artefact, which this run's hard rules forbid. |
| `node scripts/audit/contrast-check.mjs` | **PASS** — 24 screens, 248 pairs, **0 unresolved**, 0 below threshold |

---

## 6. SCOPE

### 6.1 CREATED

| Path | Purpose |
|---|---|
| `supabase/migrations/039_inventory_items_and_adjustments.sql` | **FILE ONLY, never applied.** `inventory_items`, `inventory_adjustments`, the `inventory_apply_adjustment()` transaction function, the inventory append-only trigger + its own trigger function, indexes, RLS. |
| `lib/inventory/stock-math.ts` | The ONE place that decides what available, low-stock and a legal adjustment mean. Pure; no I/O. |
| `lib/inventory/stock-math.test.ts` | Vitest. Reservation math, low-stock thresholds, boundaries, rounding, refusals. |
| `lib/inventory/migration-rls.test.ts` | Static test over the **text** of migration 039: RLS enabled, admin-only policies present, no UPDATE/DELETE policy on the ledger, append-only trigger bound, `company_id` deliberately absent. |
| `lib/data/inventory.ts` | Server-side reads. Returns a discriminated load state (`ready` / `not_provisioned` / `error`). |
| `lib/data/inventory.test.ts` | Vitest. Row mapping, the three load states, the 42P01 detection. |
| `app/api/admin/inventory/items/route.ts` | `GET` list, `POST` create. |
| `app/api/admin/inventory/items/[itemId]/route.ts` | `PATCH` edit definition, `DELETE` retire. |
| `app/api/admin/inventory/items/[itemId]/adjustments/route.ts` | `GET` log, `POST` apply an adjustment. |
| `app/admin/settings/inventory/page.tsx` | The admin screen. Server component, admin-gated, `force-dynamic`. |
| `components/admin/InventoryManager.tsx` | The client UI: table, low-stock indicator, create form, adjust dialog, per-row log, every real state. |
| `tests/e2e/inventory.spec.ts` | Playwright. Admin-gated page renders, honest state when the migration is unapplied, and the API refuses an unauthenticated write. |

### 6.2 MODIFIED

| Path | Change |
|---|---|
| `app/admin/settings/page.tsx` | Add ONE link card, inside the existing "Inventory / Stock Status" section, pointing at `/admin/settings/inventory`. Nothing else on that page changes. |
| `SCHEMA.md` | Append a dated section documenting the two new tables, their constraints and their RLS. |
| `STATE_OF_THE_BUILD.md` | Append a dated entry (ADR + Elite Compliance checklist). |
| `SESSION_STATE.md` | Append a dated session entry. |
| `queue.yaml` | Mark `09-live-inventory` done, per the run's end-of-run rule. |

### 6.3 EXPLICITLY LEFT UNTOUCHED

`middleware.ts`; everything under `docs/design/command-center-v7/`; every pixel-gate
baseline; `tests/visual/*`; `lib/data/catalog.ts` (including `MATERIAL_STOCK_STATUS`,
which `LIVE_INVENTORY_SCOPE.md §4` rules a separate placeholder); `components/product/StockBadge.tsx`;
`lib/data/product-stock.ts`; `components/admin/ProductStockTable.tsx`; both existing
`/api/admin/inventory/*` routes; `lib/data/orders.ts` and every order status
transition; `lib/data/admin-nav.ts`; `lib/data/admin-working-area.ts`; `package.json`;
`tailwind.config.js`; `app/styles/command-center-v7.generated.css`.

---

## 7. NON-GOALS (S37)

1. **No ERP sync endpoint.** SPEC §4 defers `/api/admin/inventory/sync` until ERP
   integration arrives; #55/#56 are BLOCKED.
2. **No customer-facing quantity, ever.** Not a number, not a bar, not an
   "approximately". The spec authorises the three-value signal and a lead-time
   range; it authorises no quantity, and CLAUDE.md's RFQ rule plus this run's
   hard rules forbid inventing one.
3. **No change to `products.stock_type` / `lead_time_days`, nor to the catalogue
   overlay.** That half of the spec is built and working.
4. **No automatic reservation on order approval.** See §8.5 and the recorded gap
   in §16.1.
5. **No nesting the new screen into the Command Center navigation**, and no v7
   screen touched. The new page is a Settings sub-page, exactly like
   `/admin/settings/price-book`.
6. **No migration applied, no deploy, no merge, no push to `main`.**
7. **No holiday/lead-time/stock numbers invented.** Zero seeded rows.
8. **No hard delete of an inventory item.** Retire only — see §9.5.

---

## 8. INVARIANTS (S38)

| # | Invariant | How it is held |
|---|---|---|
| INV-01 | No customer-facing surface changes. | No file under `app/(marketing)`, `app/products`, `app/quote*`, `app/account`, or `components/product/` is modified. Verified by `git diff --name-only`. |
| INV-02 | Order status transitions are byte-identical. | `lib/data/orders.ts` and every order route are untouched. Verified by `git diff --name-only`. |
| INV-03 | Nothing reaches the bending machine. | No file imports `lib/integrations/pathfinder-edge.ts`. `lib/integrations/pathfinder-single-door.test.ts` (static, pre-existing) fails if it did. |
| INV-04 | The ledger is immutable. | Two independent refusals: a BEFORE UPDATE OR DELETE trigger that RAISES, and RLS with SELECT + INSERT policies only — no UPDATE policy and no DELETE policy exists. Same belt-and-braces as CLAUDE.md rule #20. |
| INV-05 | A quantity can only change through a logged adjustment. | `PATCH /items/[itemId]` rejects any quantity field with 400. The only writer of `qty_on_hand` / `qty_reserved` is `inventory_apply_adjustment()`, which inserts the ledger row in the same transaction. |
| INV-06 | Every admin route checks auth **and** `role='admin'` server-side. | Each route calls `supabase.auth.getUser()` then reads `profiles.role`, the same shape as the two existing inventory routes. The page additionally calls `requireAdminUser`. |
| INV-07 | RLS is enforced at the database, not only in code. | `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + `is_admin()` policies in migration 039, asserted by `lib/inventory/migration-rls.test.ts`. The reads/writes use the **session** client (RLS applies), never the service role. |
| INV-08 | A never-counted quantity is `NULL`, never `0`. | Column is NULLABLE with **no DEFAULT**; `stockLevel()` returns `'uncounted'`; the UI prints "Not counted". |
| INV-09 | `afs-*` tokens only; zero literal hex in JSX. | No `#` colour literal in any new `.tsx`. Verified by grep in §14.2. |
| INV-10 | TypeScript strict, zero `any`. | `pnpm tsc --noEmit` clean; grep for `any`/`@ts-ignore` in new files returns nothing. |
| INV-11 | The contrast build gate still passes with `0 unresolved`. | The new page is auto-discovered beneath `/admin/settings`. Gate re-run in §14.1. |
| INV-12 | The existing 484 passing unit tests still pass. | Full `pnpm test:unit` re-run; the only failure remains the pre-existing `v7-css` one. |

---

## 9. REQUIREMENTS

### 9.1 R-01 — `inventory_items`: the identity of a thing AFS stocks

```sql
CREATE TABLE IF NOT EXISTS inventory_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id    uuid NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  gauge_id       uuid NOT NULL REFERENCES gauges(id)    ON DELETE RESTRICT,
  finish         text,                  -- the printed colour NAME, or NULL for mill finish
  coil_width_in  numeric(6,2),          -- NULL for a unit that has no coil width
  stock_unit     text NOT NULL,         -- CHECK, no default: the admin must say
  qty_on_hand    numeric(12,2),         -- NULL = NEVER COUNTED. Never 0 by default.
  qty_reserved   numeric(12,2) NOT NULL DEFAULT 0,
  reorder_point  numeric(12,2),         -- NULL = nobody has said what "low" means
  retired_at     timestamptz,
  retired_by     uuid REFERENCES profiles(id),
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

- **`material_id` / `gauge_id` are real foreign keys into the existing
  vocabulary**, not free text. The price book's seed already proves
  `materials ⋈ gauges` yields the shop's real 24 material+gauge pairs, so there
  is no need — and no licence — to invent a second vocabulary.
- **`gauge_id` is NOT NULL.** Sheet metal stock without a gauge is not a thing
  AFS can bend. ASSUMPTION A-03 records the consequence.
- **`finish` is free text, nullable, capped at 120 chars by CHECK.** It holds the
  *printed colour name*, because `lib/data/metal-colors.ts` states in its own
  header that "THE NAME IS THE SOURCE OF TRUTH FOR FABRICATION AND ORDERING" and
  that the hex values are display approximations. A SQL CHECK against the 69
  catalogued names was rejected: the two colour charts are vendor documents that
  change, and a database constraint that goes stale silently refuses real stock.
  The UI offers the known names as a `<datalist>`, so the common case is a pick
  and the unusual case is still possible.
- **`coil_width_in` is nullable** because a `sheet` row's size is the sheet, not
  a coil width; `CHECK (coil_width_in IS NULL OR coil_width_in > 0)`.
- **`stock_unit` has a CHECK and no DEFAULT**: `('sheet','coil','linear_foot','pound')`.
  A quantity without a unit is not a fact, and defaulting the unit would put a
  guess in the data. All three quantities on a row share that row's unit, which
  is what lets the math be unit-agnostic.

**Identity / uniqueness.** `CREATE UNIQUE INDEX uq_inventory_items_identity ON
inventory_items (material_id, gauge_id, COALESCE(finish,''), COALESCE(coil_width_in,-1), stock_unit)
WHERE retired_at IS NULL`. It must be an **expression index over `COALESCE`**,
not a table constraint: PostgreSQL's default `NULLS DISTINCT` means a plain
`UNIQUE (…, finish, coil_width_in, …)` would let an unlimited number of
duplicate mill-finish rows coexist. It must be **partial on `retired_at IS NULL`**
so retiring a row and re-creating the same item later is possible.

### 9.2 R-02 — `inventory_adjustments`: the append-only ledger

```sql
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  kind              text NOT NULL,   -- count | receipt | consumption | reserve | release
  source            text NOT NULL DEFAULT 'admin_ui',  -- admin_ui | erp_sync | import
  delta_on_hand     numeric(12,2),
  counted_on_hand   numeric(12,2),
  delta_reserved    numeric(12,2),
  on_hand_after     numeric(12,2),
  reserved_after    numeric(12,2) NOT NULL,
  reason            text NOT NULL,   -- REQUIRED. "with reason and who".
  adjusted_by       uuid NOT NULL REFERENCES profiles(id),
  client_request_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

Constraints, each with a named reason:

| Constraint | Rule |
|---|---|
| `inventory_adjustments_kind_check` | `kind IN ('count','receipt','consumption','reserve','release')` |
| `inventory_adjustments_source_check` | `source IN ('admin_ui','erp_sync','import')` — the ERP writer of SPEC §4 becomes a `source`, not a schema change |
| `inventory_adjustments_reason_not_blank` | `length(btrim(reason)) >= 3` — a blank reason is not a reason |
| `inventory_adjustments_shape` | Exactly the fields the kind means are present, and the others are NULL. `count` → `counted_on_hand IS NOT NULL` and both deltas NULL. `receipt`/`consumption` → `delta_on_hand IS NOT NULL` and the others NULL. `reserve`/`release` → `delta_reserved IS NOT NULL` and the others NULL. |
| `inventory_adjustments_sign` | `receipt`: `delta_on_hand > 0`. `consumption`: `delta_on_hand < 0`. `reserve`: `delta_reserved > 0`. `release`: `delta_reserved < 0`. `count`: `counted_on_hand >= 0`. A "receipt" of a negative amount is a mis-keyed consumption and the database says so. |
| `inventory_adjustments_after_non_negative` | `(on_hand_after IS NULL OR on_hand_after >= 0) AND reserved_after >= 0` |
| `uq_inventory_adjustments_client_request` | `UNIQUE (item_id, client_request_id)` — the idempotency key (§9.8) |

**Deliberately NOT constrained:** `on_hand_after >= reserved_after`. A physical
count that comes in **below** what is reserved is a real event (shrinkage,
mis-count, metal walked). The count is the truth, and refusing it would force
somebody to record a number they did not measure. The shortfall surfaces as a
negative *available* and the UI names it; see §9.4 and AC-09.

**Append-only.** `ALTER TABLE … ENABLE ROW LEVEL SECURITY` with a SELECT policy
and an INSERT policy and **nothing else**, plus a `BEFORE UPDATE OR DELETE`
trigger that RAISES `42501`. Two independent refusals, matching CLAUDE.md rule
#20's reasoning: the trigger binds the table owner and the service role, which a
missing policy would not, and the missing policy binds a session even if a future
migration drops the trigger.

**A NEW trigger function, not the existing one.** `afs_append_only()` from
migration 035 raises a message that says *"This table is the pricing history"*,
and it carries a `test_tag` escape hatch that is specific to the pricing ledger.
Reusing it would print a misleading error and import an exception the inventory
ledger must not have. Migration 039 therefore defines
`afs_inventory_append_only()` — same shape, inventory's own wording, **no escape
hatch at all** — and does not touch 035's function (LAW 7, and CLAUDE.md rule
#20's "do not simplify the trigger away"). Consequence recorded as ASSUMPTION
A-05.

### 9.3 R-03 — A blank is never a zero

Mirrors CLAUDE.md rule #19, for quantities instead of prices.

- `qty_on_hand` is NULLABLE with **no DEFAULT**. `NULL` means *nobody has counted
  this yet*. It renders as a marked **"Not counted"** chip, never as `0`.
- `reorder_point` is NULLABLE with no DEFAULT. `NULL` means *nobody has said what
  low means for this item*, so no low-stock judgement is possible and none is
  shown.
- `qty_reserved` **is** `NOT NULL DEFAULT 0`, and that is the one deliberate
  exception, for the same reason `extras` is the exception in rule #19: a new row
  with no reservations against it genuinely has zero reserved. Zero reservations
  is a fact; zero metal is a guess.

### 9.4 R-04 — The math, in one module: `lib/inventory/stock-math.ts`

The ONLY place that decides what available, low-stock, and a legal adjustment
mean. No second copy anywhere, including SQL (§9.8 explains how the database
stays transactional without owning a second copy of the math).

```ts
export type StockUnit = 'sheet' | 'coil' | 'linear_foot' | 'pound';
export type AdjustmentKind = 'count' | 'receipt' | 'consumption' | 'reserve' | 'release';
export type StockLevel = 'uncounted' | 'out' | 'no_threshold' | 'low' | 'ok';

export interface StockQuantities {
  onHand: number | null;
  reserved: number;
  reorderPoint: number | null;
}
```

**`availableQty(q): number | null`** = `onHand === null ? null : round2(onHand - reserved)`.
May be **negative** — see §9.2's deliberate non-constraint.

**`stockLevel(q): StockLevel`**, evaluated in this exact order, and the order is
part of the contract:

1. `onHand === null` → `'uncounted'`. There is no number, so nothing downstream
   can be judged.
2. `available <= 0` → `'out'`. A fact that does not need a threshold to be true.
3. `reorderPoint === null` → `'no_threshold'`. The quantity is known; what counts
   as low is not.
4. `available <= reorderPoint` → `'low'`. **At** the reorder point you reorder —
   the comparison is `<=`, not `<`, and AC-07 pins the boundary.
5. otherwise → `'ok'`.

**`applyAdjustment(current, request): AdjustmentOutcome`** — a pure function
returning either the new quantities or a refusal with a sentence a person can act
on. Refusals, each with its reason:

| Kind | Refused when | Message shape |
|---|---|---|
| any | `!Number.isFinite(amount)` | "Enter an amount as a number." |
| any | `amount < 0` | The amount is always a positive magnitude; the **kind** carries the sign, because asking somebody to type a minus sign to use metal is how a mis-keyed receipt happens |
| any except `count` | `amount === 0` | "Enter an amount other than zero." A count of zero is a real measurement, so `count` is the one kind that allows it |
| any | result would exceed `MAX_QTY` (`9999999999.99`, the limit of `numeric(12,2)`) | "That is larger than this field can store." — caught here so the user sees a sentence, not a Postgres `22003` |
| `count` | `counted < 0` | "A count cannot be negative." |
| `receipt` / `consumption` | `onHand === null` | "Record a count first — this item has never been counted." (naming the fix, as rule #19's quote refusal does) |
| `consumption` | would push `onHand` below `0` | "You cannot consume more than is on hand." |
| `consumption` | would push `onHand` below `reserved` | "That metal is reserved. Release the reservation first." |
| `reserve` | `onHand === null` | "Record a count first — this item has never been counted." |
| `reserve` | `amount > available` | "Only {available} {unit} are available to reserve." |
| `release` | `amount > reserved` | "Only {reserved} {unit} are reserved." |

`count` is **never** refused for coming in below `reserved`: a measurement is a
measurement.

**Rounding.** All three quantities are `numeric(12,2)` in the database, so the
module rounds to 2 decimal places with `Math.round(x * 100) / 100` at every
boundary. Without it, `0.1 + 0.2` reaches PostgREST as `0.30000000000000004` and
is silently truncated server-side, so the number the UI shows and the number
stored disagree. AC-11 pins it.

### 9.5 R-05 — CRUD, where "delete" is "retire"

An inventory item with adjustment history **cannot be deleted**: the ledger
references it `ON DELETE RESTRICT`, and deleting the thing the history is about
would orphan an append-only record. So `DELETE /items/[itemId]` performs a
**retire** — sets `retired_at` / `retired_by` — exactly as `price_book_items`
does (`035_*.sql:33-42`). Retired rows leave the active table, keep their
history, and free their identity slot so the same item can be created again.

### 9.6 R-06 — The ERP seam, without building ERP

`inventory_adjustments.source` already admits `'erp_sync'` and `'import'`. When
#55/#56 unblock, an ERP receiver becomes a new caller that writes adjustments
with `source='erp_sync'`; the ledger, the math, the low-stock signal and the UI
need no change. SPEC §4's *"Architecture already supports this — no refactor
needed"* is therefore true of this build, and no webhook route is created now.

### 9.7 R-07 — Real UI states, including the one this run actually produces

Because migration 039 is deliberately **not applied**, the live state of this
screen tonight is "the tables do not exist". That is designed for, not
discovered:

| State | Trigger | What the user sees |
|---|---|---|
| Loading | Server render in flight / client mutation pending | Next.js `loading.tsx` for the route; buttons show "Saving…" and are `disabled` |
| **Not provisioned** | PostgREST `42P01` (undefined table) or `PGRST202`/`42883` (function not found) | A plainly-worded panel: the database part of this feature has not been applied yet, nothing is lost, and the migration filename to run. **No fake rows, no silent empty table.** |
| Empty | Tables exist, zero active rows | `EmptyState`: nothing is being tracked yet, and no number has been invented |
| Error | Any other PostgREST error | An error panel naming what did **not** happen, per CLAUDE.md rule #30's wording rule |
| Populated | ≥1 active row | The table, with a low-stock indicator per row |

The distinction between **Not provisioned** and **Error** is load-bearing: "the
migration has not been run" is an operator action, and reporting it as a generic
failure would send somebody debugging the wrong thing.

### 9.8 R-08 — Atomicity, idempotency and concurrency

Two writes have to happen together: the item's quantities change, and the ledger
row is inserted. Doing them as two PostgREST calls has two failure modes, and
both are real: the item moves and the log row is lost, or the log row claims a
change that was rejected.

**Solution: one SQL function, `inventory_apply_adjustment()`, `SECURITY INVOKER`.**
It runs in a single transaction, takes `FOR UPDATE` on the item row, and:

1. If a row with this `(item_id, client_request_id)` already exists, returns it
   **unchanged**. A double-click or a retried fetch cannot double-apply a delta.
2. Compares the caller's `p_expected_on_hand` / `p_expected_reserved` against the
   locked row using `IS NOT DISTINCT FROM` (so `NULL` compares correctly). A
   mismatch means another admin moved the number between the read and the write:
   it raises, the route answers **409**, and the UI says to reload.
3. Writes the new quantities and inserts the ledger row.

It is `SECURITY INVOKER` on purpose, so the caller's RLS still applies — a
`SECURITY DEFINER` function here would be a way around the admin-only policies.

**Three further holes were found by an adversarial review of the drafted
migration and closed in it (added after the first draft; see §16.3):**

- **The actor was taken on trust.** `p_adjusted_by` was just a parameter, so one
  admin could record a change against another admin's name — in a ledger whose
  whole value is *the reason and who*. Now: when `auth.uid()` is non-null the
  actor **is** `auth.uid()`, a disagreeing `p_adjusted_by` raises, and the
  INSERT policy independently pins `adjusted_by = auth.uid()`.
- **Provenance was forgeable.** A session could pass `source='erp_sync'`. Now
  pinned to `'admin_ui'` whenever there is a session; the other two sources are
  service-role only, which is how the deferred ERP/import writers arrive.
- **A quantity could move with no ledger row.** `admin_all_inventory_items` is
  `FOR ALL`, so an admin session could `PATCH qty_on_hand` straight through
  PostgREST. The route refused it, but a route refusing something is not
  enforcement — CLAUDE.md rule #14's own standard. Now a
  `BEFORE INSERT OR UPDATE` trigger on `inventory_items` refuses any change to
  `qty_on_hand`/`qty_reserved` (and any insert carrying one) unless the
  **transaction-local** flag `afs.inventory_apply` is on, and
  `inventory_apply_adjustment()` is the only thing that ever sets it, around its
  own `UPDATE`. INV-05 is therefore a database fact rather than a convention,
  and it binds the service role too.

**It does not recompute the business math.** It is handed `p_on_hand_after` /
`p_reserved_after`, already computed by `stock-math.ts`, and enforces only
atomicity, the lock, the expectation and the table's own CHECK constraints. That
is what keeps ONE source of truth for the math while still getting a
transaction. The CHECKs are the independent backstop: if the TS math ever
computed a negative result, the database refuses it.

### 9.9 R-09 — The low-stock indicator

Rendered from `stockLevel()`, never from an inline comparison in a component:

| Level | Chip | Tokens (light working area) |
|---|---|---|
| `uncounted` | "Not counted" | `afs-amber-bg` / `afs-amber-ink` |
| `out` | "Out of stock" | `afs-crimson` fill, white text |
| `low` | "Low — reorder" | `afs-amber-bg` / `afs-amber-ink` |
| `no_threshold` | "No reorder point set" | `afs-bg-band` / `afs-ink-700` |
| `ok` | "In stock" | `afs-green-soft` / `afs-green-ink` |

Colour choice obeys CLAUDE.md rule #23 (this is a **light** surface, so text
tokens are the dark `afs-ink-*` / `afs-*-ink` family, never `afs-chrome-*` and
never the `*-on-dark` family, which rule #29 measures at 1.3–1.6:1 on light).

### 9.10 R-10 — API contracts

All six handlers: `supabase.auth.getUser()` → 401 if absent; `profiles.role` →
403 unless `'admin'`; `request.json()` parsed defensively (`.catch(() => null)`);
every field validated and narrowed before use; `no-store` not needed (session
client); errors logged with a bracketed tag as the existing routes do.

**`GET /api/admin/inventory/items`** → `200 { state, items }` where `state` is
`ready | not_provisioned | error`.

**`POST /api/admin/inventory/items`**
Body: `{ materialId: string; gaugeId: string; finish?: string | null;
coilWidthIn?: number | null; stockUnit: StockUnit; reorderPoint?: number | null }`.
Never accepts a quantity (INV-05, INV-08). Validates: both ids are UUIDs that
exist and `gaugeId.material_id === materialId` (a 20 oz copper gauge cannot be
attached to an aluminium row); `stockUnit` is in the enum; `coilWidthIn` is
either absent/null or a finite number `> 0`; `finish` trimmed, ≤120 chars, empty
→ `null`; `reorderPoint` absent/null or a finite number `>= 0`. → `201 { item }`,
or `409` on the identity unique index with a sentence naming the duplicate.
Writes `admin_audit_log` via `logAdminAction`.

**`PATCH /api/admin/inventory/items/[itemId]`**
Accepts `finish`, `coilWidthIn`, `reorderPoint`, `stockUnit`. **Rejects
`qtyOnHand`, `qtyReserved`, `onHand`, `reserved` with 400** and a message saying
quantities change through an adjustment — INV-05 made explicit at the boundary
rather than left implicit. **Refuses a `stockUnit` change when `qty_on_hand IS
NOT NULL` or `qty_reserved > 0`** with 409: changing the unit under existing
numbers silently reinterprets every one of them and every ledger row about them.

**`DELETE /api/admin/inventory/items/[itemId]`** → retire (§9.5). Already
retired → `200` with "This item was already retired." (never a bare 409; same
courtesy as CLAUDE.md rule #16's already-sent case).

**`POST /api/admin/inventory/items/[itemId]/adjustments`**
Body: `{ kind: AdjustmentKind; amount: number; reason: string;
clientRequestId: string }`. Reads the item, runs `applyAdjustment`, and on
refusal answers **422** with the module's own sentence — so the message the user
reads is generated by the one module that decides the rule. On acceptance calls
the RPC (§9.8) → `200 { item, adjustment }`; `409` on an expectation mismatch;
`200` with the original row when the `clientRequestId` was already used.
`reason` is required, trimmed, ≥3 chars.

**`GET /api/admin/inventory/items/[itemId]/adjustments`** → the log, newest
first, capped at 200 with the cap stated in the response (`truncated: boolean`)
rather than silently applied.

---

## 10. CONSTRAINTS — WHAT MUST NOT BE CHANGED OR ASSUMED

1. `middleware.ts` — not touched.
2. No migration applied anywhere. No deploy, no merge, no `main`.
3. No v7 artefact, baseline, or `tests/visual/*` file touched.
4. No new npm dependency; `package.json` dependencies unchanged.
5. No `any`, no `@ts-ignore`, no `eslint-disable`, no skipped or weakened test.
6. No literal hex colour in JSX; `afs-*` tokens only.
7. No seeded inventory row, no default quantity, no example number anywhere in
   the migration or the UI.
8. No second implementation of the stock math, in TypeScript or in SQL.
9. The existing stock-signal feature (`products.stock_type`, `ProductStockTable`,
   `withLiveStock`, `StockBadge`) is not refactored, renamed, or re-pointed.
10. `company_id` is **not** added to either new table. Reasoning and its
    deviation record: §15.

---

## 11. IMPLEMENTATION GUIDANCE (ordering)

1. This document (LAW 1 — the spec exists before the code). Commit.
2. `supabase/migrations/039_inventory_items_and_adjustments.sql`. Commit.
3. `lib/inventory/stock-math.ts` + `stock-math.test.ts`; run them. Commit.
4. `lib/inventory/migration-rls.test.ts`; run it. Commit.
5. `lib/data/inventory.ts` + `inventory.test.ts`; run them. Commit.
6. The three API route files. `pnpm tsc --noEmit`. Commit.
7. `components/admin/InventoryManager.tsx`, `app/admin/settings/inventory/page.tsx`,
   `loading.tsx`, and the Settings link. `tsc`, then
   `node scripts/audit/contrast-check.mjs`. Commit.
8. `tests/e2e/inventory.spec.ts`; run it against a local dev server. Commit.
9. END-OF-RUN VERIFICATION (§14), then governance (§6.2), then push.

Each numbered step is one commit, so a dead session loses at most one unit.

---

## 12. ACCEPTANCE CRITERIA

| ID | Criterion |
|---|---|
| **AC-01** | `supabase/migrations/039_inventory_items_and_adjustments.sql` exists, is the next free number (039), and creates `inventory_items` and `inventory_adjustments` with every column, CHECK, index and FK in §9.1/§9.2. It is **additive only**: no `DROP`, no `ALTER … DROP COLUMN`, no `DELETE`, no `UPDATE` of existing data. |
| **AC-02** | The migration enables RLS on both tables; `inventory_items` has an admin-only `FOR ALL USING (is_admin())` policy; `inventory_adjustments` has an admin `SELECT` policy and an admin `INSERT` policy and **no UPDATE or DELETE policy at all**. |
| **AC-03** | The migration binds a `BEFORE UPDATE OR DELETE` trigger on `inventory_adjustments` to a function that `RAISE`s, and that function is inventory's own — migration 035's `afs_append_only()` is not modified. |
| **AC-04** | The migration text contains **no** `company_id`, no seeded `INSERT` into either table, and no `DEFAULT` on `qty_on_hand` or `reorder_point`. |
| **AC-05** | The migration is idempotent: every object is `IF NOT EXISTS` / `CREATE OR REPLACE`, every constraint is added only when `pg_constraint` lacks it, every policy is `DROP POLICY IF EXISTS` before `CREATE`. |
| **AC-06** | `availableQty` returns `null` for an uncounted item, `onHand - reserved` otherwise, and a **negative** number when reserved exceeds a fresh count. |
| **AC-07** | `stockLevel` returns `uncounted` / `out` / `no_threshold` / `low` / `ok` in the precedence of §9.4, and the boundary `available === reorderPoint` returns **`low`**. |
| **AC-08** | `applyAdjustment` produces the right new quantities for each of the five kinds, and refuses each case in §9.4's refusal table with a non-empty, actionable message. |
| **AC-09** | A `count` lower than `reserved` is **accepted**, and the resulting `available` is negative. |
| **AC-10** | `applyAdjustment` refuses a result above `MAX_QTY` (`9999999999.99`) rather than letting PostgreSQL raise `22003`. |
| **AC-11** | Every quantity returned by the module is rounded to 2dp: `0.1 + 0.2` yields exactly `0.3`. |
| **AC-12** | `getInventoryItems` returns `{state:'not_provisioned'}` for PostgREST code `42P01`, `{state:'error'}` for any other error, and `{state:'ready', items}` on success with every field mapped. |
| **AC-13** | All six handlers answer `401` with no session and `403` for a non-admin profile, before touching any inventory data. |
| **AC-14** | `PATCH /items/[itemId]` answers `400` for any quantity field in the body, and `409` for a `stockUnit` change on an item with a counted or reserved quantity. |
| **AC-15** | `POST …/adjustments` answers `422` carrying `stock-math.ts`'s own refusal sentence; a repeated `clientRequestId` applies the delta **once**; a stale expectation answers `409`. |
| **AC-16** | `DELETE /items/[itemId]` retires rather than deletes, and answers `200` with a plain sentence when the item was already retired. |
| **AC-17** | `/admin/settings/inventory` renders for an admin and renders each of the five states in §9.7 from real data — including the **not-provisioned** panel, which is the state the unapplied migration actually produces. |
| **AC-18** | A non-admin is redirected away from the page by `requireAdminUser`, and an unauthenticated POST to the items route answers `401`. |
| **AC-19** | The low-stock indicator's five chips come from `stockLevel()` alone; no component contains its own `<=` threshold comparison. |
| **AC-20** | No customer-facing file is modified. `git diff --name-only` contains nothing under `components/product/`, `app/products`, `app/quote*`, `app/account`, `app/(marketing)`. |
| **AC-21** | No order-status file is modified: `git diff --name-only` contains no `lib/data/orders.ts` and no `app/api/**/order*`. |
| **AC-22** | `pnpm tsc --noEmit` is clean. |
| **AC-23** | `pnpm lint` reports zero errors and zero warnings attributable to the new/modified files. |
| **AC-24** | `pnpm test:unit` shows **every** pre-existing passing test still passing, plus the new tests passing. The only failure is the pre-existing `lib/design/v7-css.test.ts` one recorded in §5.2. |
| **AC-25** | `node scripts/audit/contrast-check.mjs` passes with **0 unresolved** and 0 pairs below threshold, with the new screen included in its screen count. |
| **AC-26** | No new file contains `any`, `@ts-ignore`, `eslint-disable`, `TODO`, `FIXME`, a `.skip`/`.todo` test, or a literal `#rrggbb` in JSX. |
| **AC-27** | Governance updated by **append**: a dated section in `STATE_OF_THE_BUILD.md` (with the Elite Compliance checklist), one in `SESSION_STATE.md`, one in `SCHEMA.md`, and `queue.yaml` marked. No existing text rewritten. |
| **AC-28** | The automatic-reservation-on-order-approval gap is recorded explicitly in the final report and in `STATE_OF_THE_BUILD.md`, with the reason it was not built. |
| **AC-29** | The migration binds a `BEFORE INSERT OR UPDATE` trigger on `inventory_items` that refuses a change to `qty_on_hand`/`qty_reserved` unless the transaction-local `afs.inventory_apply` flag is on, and `inventory_apply_adjustment()` is the only place in the file that calls `set_config` for it. |
| **AC-30** | `inventory_apply_adjustment()` binds the actor to `auth.uid()` and pins `source` to `'admin_ui'` whenever there is a session, and the `inventory_adjustments` INSERT policy carries `adjusted_by = auth.uid()`. |

---

## 13. VALIDATION — MAPPED TO THE ACCEPTANCE CRITERIA

| AC | Verification |
|---|---|
| AC-01 … AC-05, AC-29, AC-30 | `lib/inventory/migration-rls.test.ts` — a **static test over the migration's text**. Reads the `.sql` file and asserts each clause. This is the item's own stated test requirement ("RLS policy presence in the migration text") and it is the only honest check available, because the migration is deliberately unapplied. |
| AC-06 … AC-11 | `lib/inventory/stock-math.test.ts` |
| AC-12 | `lib/data/inventory.test.ts` |
| AC-13 … AC-16 | Code inspection against the written contract **plus** the E2E 401 assertion (AC-18). Honestly stated: a full authenticated matrix for all six handlers cannot be exercised while the tables do not exist, and that limitation is reported rather than papered over with a mock that proves only itself. |
| AC-17 | `tests/e2e/inventory.spec.ts` against a local dev server with the real (alpha) Supabase, which produces the **not-provisioned** state for real |
| AC-18 | `tests/e2e/inventory.spec.ts` |
| AC-19 | `grep` for a threshold comparison in `components/admin/InventoryManager.tsx` |
| AC-20, AC-21 | `git diff --name-only` |
| AC-22 | `pnpm tsc --noEmit` |
| AC-23 | `pnpm lint` |
| AC-24 | `pnpm test:unit` |
| AC-25 | `node scripts/audit/contrast-check.mjs` |
| AC-26 | `grep` sweep over the new files |
| AC-27, AC-28 | `git diff` of the governance files |

---

## 14. REQUIRED TESTS, BY CLASS AND BEHAVIOUR

### 14.1 Unit — `lib/inventory/stock-math.test.ts` (ARRANGE / ACT / ASSERT)

Fixtures are explicit, named constants in the file — never random, never
generated. Behaviours, each one test, each asserting an exact value with a
diagnostic message:

*availableQty:* uncounted → `null`; counted with no reservation; counted with a
reservation; reserved above a counted amount → negative; 2dp rounding.

*stockLevel:* uncounted beats everything; `out` when available is `0`; `out` when
available is negative; `out` beats `no_threshold`; `no_threshold` when the
quantity is known and the point is not; `low` at exactly the reorder point
(boundary); `low` below it; `ok` above it; `reorderPoint = 0` is a real threshold
and not treated as unset (the `null`-vs-`0` trap).

*applyAdjustment, acceptances:* `count` on an uncounted item; `count` that lowers
a counted item; `count` below `reserved` (AC-09); `receipt`; `consumption` down
to exactly `reserved`; `reserve` up to exactly `available`; `release` of exactly
all reserved; `release` of part.

*applyAdjustment, refusals:* zero amount; `NaN`; `Infinity`; negative `count`;
`receipt` on uncounted; `reserve` on uncounted; `consumption` on uncounted;
`consumption` beyond on hand; `consumption` that would eat reserved metal;
`reserve` of one more than available; `release` of one more than reserved; a
result above `MAX_QTY`. Each asserts the refusal **and** that the message is a
non-empty sentence.

*rounding:* `0.1 + 0.2 === 0.3` through a `receipt`; a `consumption` of `0.07`
from `1.00`.

### 14.2 Unit — `lib/inventory/migration-rls.test.ts`

Static, over the migration text: both tables created; RLS enabled on both; the
`is_admin()` policies present; `inventory_adjustments` has SELECT and INSERT
policies and **zero** occurrences of `FOR UPDATE`/`FOR DELETE` in a `CREATE
POLICY`; the append-only trigger is bound `BEFORE UPDATE OR DELETE`; the trigger
function `RAISE`s; migration 035's `afs_append_only` is not redefined here; no
`company_id`; no `DROP TABLE`/`DROP COLUMN`/`DELETE FROM`/`TRUNCATE`; no
`INSERT INTO inventory_`; no `DEFAULT` on `qty_on_hand`; `reason` is `NOT NULL`;
the identity index is `UNIQUE` and partial; `inventory_apply_adjustment` is
`SECURITY INVOKER` and takes `FOR UPDATE`.

It also asserts the file is the **next free number** by reading the migrations
directory — so a future migration that reuses 039 fails here rather than in
production.

### 14.3 Unit — `lib/data/inventory.test.ts`

The three load states against hand-built fake PostgREST responses (a local
object, not a mocking library): `42P01` → `not_provisioned`; `42883` and
`PGRST202` → `not_provisioned` for the RPC path; another code → `error` carrying
a message; success → `ready` with every field mapped, including `NULL` on hand
surviving as `null` and not becoming `0`.

### 14.4 E2E — `tests/e2e/inventory.spec.ts`

Skips honestly (not fails) without `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, in the
established pattern of `tests/e2e/auth.setup.ts`.

1. The page renders for an admin: the heading and the back link are present.
2. The screen is in exactly one of the designed states, and whichever it is, it
   says so in words — **and because migration 039 is not applied, the assertion
   this run exercises is the not-provisioned panel.**
3. `POST /api/admin/inventory/items` with no session answers `401` — proving the
   write boundary without needing the tables to exist.
4. Nothing is created, so there is nothing to tear down. Stated, not implied.

### 14.5 Coverage

No coverage provider is installed (§3.1). Coverage is therefore reported as the
enumerated branch list above — every branch of `stockLevel` (9), every branch of
`applyAdjustment` (8 acceptances + 12 refusals), every branch of the load-state
mapper (4) — rather than as a number that cannot be measured. **No percentage
will be claimed that was not computed.**

---

## 15. DOCUMENTED DEVIATIONS (LAW 8 / S17)

**D-01 — `company_id` is deliberately NOT on either new table.**

The run's hard rules say "schema with RLS and company_id". In **this** schema
`companies` is not a tenant of AFS: it is the **customer's** organisation — a
contractor or architecture firm — reached through `profiles.company_id`
(`001_initial_schema.sql:60-89`, `SCHEMA.md` TABLE 2). Migration 023's own header
spells this out: *"`companies` (TABLE 2) is a separate, optional grouping"*, and
`orders` references `profiles(id)` directly rather than `companies(id)`.

Raw coil and sheet stock sitting in the Burnet, Texas shop belongs to AFS. A
`company_id` on `inventory_items` could only be always-`NULL` — a dead column,
which the implementation-quality prohibitions forbid — or else assert that a
contractor owns AFS's metal, which is false and would make the RLS policy wrong
in a dangerous direction.

The correct tenancy boundary here is the one this codebase already uses for every
AFS-internal back-office table: **`is_admin()`**. `price_book_items`,
`price_book_versions` and `pricing_ledger` (migration 035) are all admin-only
with no `company_id`, and that is the precedent followed. `lib/inventory/
migration-rls.test.ts` asserts both halves — the `is_admin()` policies are
present, and `company_id` is absent — so the decision is a test rather than a
memory.

**D-02 — The new screen is a Settings sub-page, not a Command Center nav entry.**
SPEC §3 places stock management under `/admin/settings`. `/admin/settings/
price-book` is the established shape for a Settings sub-page that is too big for
a section. Adding a nav entry would touch `lib/data/admin-nav.ts`, which the v7
pixel gate and `lib/data/admin-nav.test.ts` both measure.

**D-03 — The page uses `LightWorkingArea` but is NOT added to
`LIGHT_WORKING_AREA_SCREENS`.** That list is asserted as an exact array in
`lib/data/workbench.test.ts:275` under the heading *"names exactly the screens
converted so far (v2-02 + v2-04 + v2-05 + v7 Phase 2 + v7 Stage G)"* — it is a
record of **v7 conversion stages**, and `/admin/settings/price-book`, a v2-03
Settings sub-page using the same wrapper, is likewise absent from it. Following
the price-book precedent keeps a v7-adjacent test untouched. **The inconsistency
between that list's doc comment ("Add a row here in the same commit that converts
a screen's tokens") and price-book's absence is a pre-existing discrepancy and is
reported under S27, not silently resolved either way.**

**D-04 — A new append-only trigger function rather than reusing
`afs_append_only()`.** Reasoned in §9.2.

---

## 16. RECORDED GAPS AND ASSUMPTIONS

### 16.1 GAP-01 — No automatic reservation on order approval. NOT BUILT, BY INSTRUCTION.

The queue item says: *"reservation on order approval **ONLY if the spec defines
it** and it can be done without touching existing order status transitions
(otherwise record the gap)"*.

`specs/SPEC_LIVE_INVENTORY.md` **does not define reservation at all** — the word
does not appear in it, and §1 scopes the whole document to a signal system. Both
halves of the condition fail besides: there is no mapping anywhere in the
repository from an order, a quote line, or a `machine_job` to a material + gauge
+ finish + coil-width stock row, and no quantity on an order expressed in a stock
unit, so any automatic reservation would have to **invent** the quantity to
reserve — which this run's rules forbid outright. Order creation also happens in
`createOrderFromQuote()` from two call sites (`ORDER_LIFECYCLE_DECISION.md §1`),
and hooking it would mean editing an order path INV-02 holds fixed.

**What is built instead:** `reserve` and `release` are first-class, fully
implemented, fully tested adjustment kinds that an admin applies by hand with a
reason. The reservation **math** is therefore real and under test, which is what
the item's test requirement asks for, and an automatic caller later is one more
caller of the same function — no refactor.

### 16.2 Assumptions, each conservative and each recorded

| # | Assumption | Why it is the conservative reading |
|---|---|---|
| A-01 | The item's quantity columns are an authorised **extension** of SPEC_LIVE_INVENTORY.md, not a contradiction of it, and are admin-only. | The item states it twice and bounds it ("empty table", "no invented stock numbers"); CLAUDE.md's DATA BLOCKERS rule says blocked features are built as structure with placeholder behaviour. The spec's own prohibition is on a **customer-facing** real-time system, and nothing customer-facing is built. |
| A-02 | `stock_unit` is the enumerated set `sheet \| coil \| linear_foot \| pound`. | A quantity needs a unit. These four are the units implied by the repository itself — the price book is built on a 10 ft × 4 ft **sheet** (rule #19), the item names **coil** width, and linear feet / pounds are how coil is bought. No fifth unit is guessed, and the CHECK makes adding one a visible migration. |
| A-03 | Every inventory item has a gauge (`gauge_id NOT NULL`). | Sheet metal without a gauge cannot be quoted or bent. Consequence: a material with no active `gauges` row cannot have inventory. The 24 price-book rows prove the real pairs exist. |
| A-04 | `finish` is a free-text printed colour name, not an FK. | `lib/data/metal-colors.ts` states the printed NAME is the source of truth for ordering and that its hexes are approximations. There is no `metal_colors` table (grepped). A CHECK over 69 vendor names would go stale and silently refuse real stock. |
| A-05 | The inventory ledger gets **no** `E2E-TEST-` escape hatch. | Rule #20's exception exists so pricing E2E data can be removed; this run creates no inventory rows at all (the tables are unapplied), so an escape hatch would be a hole with no user. |
| A-06 | "Delete" in "admin CRUD" means retire. | An append-only ledger `ON DELETE RESTRICT`-references the item; `price_book_items` sets the precedent. |
| A-07 | The low-stock comparison is on **available** (`onHand - reserved`), not on `onHand`. | Reserved metal is spoken for. Comparing on hand would say "in stock" about metal already promised, which is the more dangerous error. |
| A-08 | `reorderPoint = 0` means "tell me when it is out", and is distinct from `null`. | `0` is a threshold somebody set; `null` is nobody having said. Pinned by a test, because conflating them is the classic falsy bug. |

### 16.3 Post-draft hardening of migration 039

An adversarial security pass over the drafted migration found three real holes,
all of them in the same class — *the route enforced it, the database did not* —
and all three were closed in the migration before it was used. They are
described in §9.8 and covered by AC-29 and AC-30. Recording them here rather
than quietly rewriting the spec: the first draft's INV-05 was true of the API
and not of the database, and the difference matters on a platform whose own rule
#14 says "hiding a button is not enforcement; the database check is".

---

## 17. COMPLETION EVIDENCE (filled during execution, in the final report)

Files created / modified; the migration SQL printed in full; every command run
with its real output; unit test pass/fail counts before and after; the contrast
gate's screen and pair counts; the E2E result (pass or honest skip, with the
reason); acceptance criteria table with each AC marked met / not met and how;
pre-existing failures restated; new failures (expected: none); unresolved items;
browser verification steps for a human.

---

## 18. SELF-AUDIT

Performed after drafting, reading as a reviewer hunting defects.

| Dimension | Max | Score | Note |
|---|---|---|---|
| Technical correctness | 15 | 15 | Schema, constraints and the atomicity/idempotency design were each checked against the real precedent in migration 035 and against PostgreSQL semantics (`NULLS DISTINCT`, `IS NOT DISTINCT FROM`, `numeric(12,2)` range, partial unique index). |
| Completeness | 15 | 15 | Every artefact the item names has a path, a contract and an AC. The one item it names that the spec does not support (automatic reservation) is a recorded gap with its condition quoted. |
| Repository grounding | 10 | 10 | §3.2 and §4 list what was read, with line references. The existence check found and preserved the already-built half. |
| Architectural consistency | 10 | 10 | `is_admin()` RLS, the append-only trigger shape, retire-not-delete, Settings sub-page, `LightWorkingArea`, `logAdminAction` — each taken from an existing precedent rather than invented. |
| Requirement clarity | 10 | 10 | Columns, CHECKs, status codes, refusal sentences and chip tokens are all literal. |
| Acceptance-test quality | 10 | 10 | 28 ACs, each objectively checkable, each mapped to a named command or test. |
| Edge-case / failure coverage | 10 | 10 | NULL-vs-zero, the `reorderPoint = 0` falsy trap, count-below-reserved, float rounding, `numeric` overflow, double-click idempotency, two-admin race, unit change under existing numbers, and the unapplied-migration state the run actually produces. |
| Security / data integrity | 5 | 5 | 401/403 on every handler, RLS at the database, `SECURITY INVOKER` chosen deliberately over `DEFINER`, two independent immutability refusals, no secret read, no service-role read where a session read is correct. |
| Implementation executability | 10 | 10 | Ordered steps, one commit each, with the verification command for each. |
| Reviewability / evidence | 5 | 5 | §17 fixes the evidence shape; the baseline in §5.2 separates pre-existing from new failure. |
| **Total** | **100** | **100** | |

**Critical-defect sweep.** Ambiguous requirements: none found — every quantity
field, status code and refusal message is specified. Incorrect repository
assumptions: the two highest-risk ones (that `companies` is an AFS tenant; that
`afs_append_only()` is generic) were checked and both turned out to need the
documented deviations in §15. Missing critical AC: reservation math,
immutability, low-stock thresholds and RLS-in-migration-text — the item's four
named test areas — are AC-06/07/08/09, AC-02/03, AC-07 and AC-02 respectively.
Contradictory requirements: the item-versus-spec tension is the real one, and it
is resolved explicitly in §2.1 with the governing quotation from both documents
rather than by picking the convenient reading. Unsafe security requirement: none;
the only privilege question (`DEFINER` vs `INVOKER`) is resolved toward least
privilege. Destructive migration: none — AC-01 and the static test both forbid
every destructive statement. Incorrect contract: the API contracts are new, so
there is nothing to break. Undeterminable completion: §12 + §13 make every
criterion a command. Data-integrity risk: the identified one — a quantity moving
without a ledger row — is the reason §9.8 exists.

**Self-Audit Status: PASS (100 ≥ 95).**

---

ENGINEERING COMPLETION RECORD
Prompt ID: EES-OVN.09
Prompt Name: Live Inventory — Shop Material Stock, Adjustment Ledger, Low-Stock Signal
Word Count: 8399
Engineering Proficiency Score: 100/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES
