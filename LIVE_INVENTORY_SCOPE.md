# LIVE_INVENTORY_SCOPE.md
## AFS — Live Inventory / Stock Status: Current State + inventory-002 Scope

Prepared per request to determine what `StockBadge.tsx` actually does today,
what data model exists vs. is needed, and what `inventory-002` should build.
Sourced from a live read of `components/product/StockBadge.tsx`,
`lib/data/catalog.ts`, `SCHEMA.md`, and a repo-wide grep — not from memory.

---

## 1. WHAT `StockBadge.tsx` ACTUALLY DOES TODAY

`components/product/StockBadge.tsx` is a **pure presentational component**.
It takes a `stockType: StockType` prop and a `size` prop, and renders a
colored dot + label (`STOCK_TYPE_LABEL[stockType]`). It performs zero data
fetching and holds zero state — it renders whatever `stockType` it is
handed by its parent.

It is used in exactly two places:
- `components/product/ProductCard.tsx:31`
- `components/product/ProductDetailView.tsx:71`

Both pass `product.stockType`, where `product` is a `CatalogProduct`.

**The critical finding:** `CatalogProduct` is not a database row. It is a
TypeScript interface in `lib/data/catalog.ts`, and every product's
`stockType` is a **hardcoded literal in a static array** (`PRODUCTS`) in
that same file — e.g. `lib/data/catalog.ts:237` `stockType: 'fabricated'`,
repeated ~14 times across the array, all either `'fabricated'` or
`'special_order'`. Nothing in the catalog rendering path queries Supabase
for stock status. `StockBadge` is, today, a static placeholder wearing a
"live" badge — the label is accurate per-product but is baked into source
code, not read from any database or admin action.

There is a second, unrelated static mapping in the same file:
`MATERIAL_STOCK_STATUS` (`lib/data/catalog.ts:57`), explicitly commented
as a "Placeholder availability mapping — real stock status per material is
pending supplier data," used only to drive AI material-recommendation
copy (`MaterialRecommendationPanel.tsx`, `app/api/recommendations/material`,
`app/api/products/ai-search`). Same story: hardcoded, not backed by data.

---

## 2. WHAT SCHEMA.md PROVIDES TODAY

`TABLE 7 — products` (SCHEMA.md) does define:
```sql
stock_type      TEXT NOT NULL DEFAULT 'fabricated'
                CHECK (stock_type IN ('stock','fabricated','special_order')),
lead_time_days  INTEGER NOT NULL DEFAULT 5,
```

So the **signal-system columns SPEC_LIVE_INVENTORY.md describes already
exist in the schema** — but:

- No code in the repo currently reads `products.stock_type` or
  `products.lead_time_days` from Supabase for catalog display (confirmed
  by grep — only 3 files query `.from('products')` at all: the CAD
  library page, the admin pricing-rules API route, and `lib/data/pricing.ts`;
  none select or use `stock_type`).
- No admin UI exists to edit it. SPEC_LIVE_INVENTORY.md §3 describes a
  `ProductStockTable` at `/admin/settings` — grepping `app/admin` for
  `ProductStockTable`, `Inventory`, or `stock_type` returns nothing. It has
  not been built.
- **No table anywhere tracks a real stock quantity.** There is no
  `quantity_on_hand`, `stock_quantity`, `inventory_levels`, or `warehouse`
  concept in SCHEMA.md's 41 tables (verified by re-reading the full
  document and by grep across the repo — zero matches for
  `quantity_on_hand|qty_on_hand|stock_quantity|warehouse|erp_sync|inventory_levels`).
  `stock_type` is a 3-value enum signal ("stock" / "fabricated" /
  "special_order"), not a number.

This matches SPEC_LIVE_INVENTORY.md's own framing exactly: **"This is NOT
a real-time inventory management system. It is a signal system."** (§1).
The spec's own §4, "WHEN ERP INTEGRATION ARRIVES," treats numeric,
quantity-driven inventory as an explicitly future, currently-blocked
capability (checklist #55 — ERP/inventory system — and #56 — stock levels
— both listed BLOCKED in the spec header and in CLAUDE.md's Data Blockers
table). There is no warehouse/ERP system integrated or stubbed anywhere in
this codebase to source real numeric stock levels from.

**Stated plainly: real, numeric, live stock-on-hand data has no source of
truth anywhere in this project.** No warehouse system, no ERP, no manual
count table. Building numeric quantity displays now would mean inventing
fake numbers — that is out of scope and should not be built until #55/#56
are unblocked.

---

## 3. WHAT inventory-002 SHOULD BUILD

Scoped to what the spec actually asks for (a manually-set signal, not
real quantities) and to what's genuinely missing (wiring + admin control),
not to inventing numeric inventory data:

1. **Wire the catalog to the database column that already exists.**
   Replace the hardcoded `stockType`/`leadTimeDays` fields in
   `lib/data/catalog.ts`'s static `PRODUCTS` array with a live read of
   `products.stock_type` and `products.lead_time_days` from Supabase
   (respecting the existing RLS: `authenticated_read_products`). This is
   the actual "live" part — today's badge is static.
   - If the product catalog is still otherwise static/hardcoded content
     (categories, dimensions, descriptions) and not yet backed by real
     `products` rows for every catalog item, that's a **pre-existing,
     separate gap** — flag it rather than silently faking a join. Do not
     block stock wiring on a full catalog migration if one isn't already
     in flight; wire what has real `products.id` rows today and leave a
     clear TODO/fallback for what doesn't.

2. **Build the admin stock management UI** per SPEC_LIVE_INVENTORY.md §3:
   - `/admin/settings` → Inventory / Stock Status section
   - `ProductStockTable`: list all products with current `stock_type` +
     `lead_time_days`, inline dropdown/number edit, per-row Save →
     `UPDATE products SET stock_type = ..., lead_time_days = ...`
   - Bulk update: "Set all [material] products to: [dropdown] → Apply"
   - Admin-only route, gated the same way other `/admin` routes are.
     No audit log required (spec explicitly says not financially
     sensitive).

3. **Do not build:**
   - Any numeric "N in stock" / "N units available" display anywhere
     customer-facing. There is no data source for this number; displaying
     one would violate CLAUDE.md's no-fabricated-data principle and the
     spec's own "this is NOT a real-time inventory management system"
     framing.
   - An ERP/webhook sync endpoint (`/api/admin/inventory/sync`) — SPEC
     §4 explicitly defers this until ERP integration arrives (#55/#56
     still BLOCKED). The schema/architecture already supports adding it
     later without refactor (per spec), so there's nothing to pre-build.
   - Any change to the `stock_type` enum values or the `StockType`
     TypeScript type — both already match between `SCHEMA.md` and
     `lib/data/catalog.ts`.

4. **Leave `MATERIAL_STOCK_STATUS`** (`lib/data/catalog.ts:57`) as-is or
   note it as a known-separate placeholder in the same PR — it drives AI
   material-recommendation copy, is explicitly commented as pending
   supplier data, and is not part of the per-product stock badge system
   this spec covers. Don't conflate fixing it with this task unless asked.

---

*LIVE_INVENTORY_SCOPE.md | AFS | prepared from live codebase audit, 2026-07-30*
