# SCHEMA.md
## AFS — Supabase Database Schema
**53 tables. RLS on every table. Indexes on every foreign key and filter
column.**

> **VERIFIED LIVE 2026-09-30 (Command Center V2, prompt v2-01).** 53 base
> tables in `public`, counted directly from `information_schema.tables`, not
> carried forward. It was 55 before this run, and the arithmetic is
> 55 − 3 + 1: migration 031 dropped `machine_profile_bends`,
> `machine_profiles` and `machine_profile_categories` (the 911-profile
> machine library — see MACHINE INTEGRATION TABLES below, which now
> documents its removal), and migration 022 — which had never actually been
> applied — was applied in the same run, adding
> `building_code_jurisdictions` (480 rows). Migrations 030–033 from that run
> are listed in MIGRATION FILE LOCATION.
 (This document's "TABLE N" numbering below
covers the original 25 sections designed in migration 001 — several of
those sections define more than one physical table, e.g. TABLE 8 =
`accessories` + `product_accessories`. The MACHINE INTEGRATION and MACHINE
BRIDGE sections near the end of this document add 5 more tables via
migrations 004 and 005, the CANONICAL PROFILE LIBRARY section adds 1
more via migration 006, and the DELIVERY TRACKING + EMPLOYEE PWA section
adds 3 more via migration 007. Migrations 008 and 009 are column-only
additions (no new tables — see the MIGRATION FILE LOCATION table below).
The BID MONITOR section adds 4 more tables via migration 010. Migration
011 is constraint-only (no new tables, no new columns — see TABLE 18
below). Migration 012 is column-only (adds `machine_jobs.
used_fallback_geometry` — see MACHINE BRIDGE TABLES). The BID DOCUMENT
TABLES section adds 4 more tables via migration 013. Migration 014 is
CHECK-constraint-only (widens `takeoff_uploads.status` — no new tables,
no new columns). Migration 015 is column-only (adds `machine_jobs.
delivery_method` — see MACHINE BRIDGE TABLES). The SHOP PROFILE LIBRARY
section adds 1 more table via migration 016, which also adds
`quote_requests.source_tool` (see TABLE 15). Migration 017 is column-only
(adds `quote_requests.color` — see TABLE 15 — and `shop_profile_library.
color` / `queue_position` / `completed_at` — see SHOP PROFILE LIBRARY
TABLE; no new tables). Migration 018 is also column-only (adds
job-identity fields `client_business_name` / `client_name` / `po_number`
/ `requested_by` and a `finish` field to both `quote_requests` — see
TABLE 15 — and `shop_profile_library` — see SHOP PROFILE LIBRARY TABLE;
no new tables; `quote_requests.po_number` pre-existed migration 018, see
TABLE 15 for that finding). Migration 019 is also column-only (adds
`job_name` to both `quote_requests` — see TABLE 15 — and
`shop_profile_library` — see SHOP PROFILE LIBRARY TABLE — plus
`requested_delivery_date` to `shop_profile_library` only; no new tables;
see both sections for the `requested_delivery`/`requested_delivery_date`
naming-asymmetry decision and the retirement of both tables'
migration-018 `requested_by` columns). The PROFILE PASSPORT section adds
2 more tables — `custom_profiles` and `profile_revisions` — via migration
023, which also adds `orders.custom_profile_id` (see TABLE 18). **023 is
FILE ONLY as of this writing — not applied to the live database. The repo
has no `supabase/config.toml`/`project-ref` (not linked) and `.env.local`
has no `SUPABASE_ACCESS_TOKEN`, so neither of the two apply paths in
SPEC_SUPABASE_INTEGRATION.md is available; a `supabase link` attempt in
this session failed outright. See STATE_OF_THE_BUILD.md's PROFILE
PASSPORT entry for the full blocker.** 54 is the table count
`supabase/README.md` should verify against the live database once all 19
migrations are applied (57 once 023 is also applied). Migration 018 is
**CONFIRMED APPLIED LIVE** (see
SESSION_STATE.md's afs-jf-000 entry — Reid verified all five of its new
`quote_requests` columns directly via `information_schema` in the
Supabase Dashboard on 2026-08-22). Migration 019 is also **CONFIRMED
APPLIED LIVE** (see SESSION_STATE.md's afs-jf-004 entry — verified via
`information_schema`, three `true` results, on 2026-08-23). See
SESSION_STATE.md for each migration's
individually verified live-apply status — it is never safe to assume
from a file's presence on disk alone.)

---

## MIGRATION FILE LOCATION

```
supabase/migrations/
  001_initial_schema.sql              All tables through TABLE 25 below + ADDITIONAL/SPEC TEMPLATES sections
  002_seed_afs_data.sql                Materials, gauges, product_profiles reference data
  003_pricing_rules_cost_notes.sql     Adds pricing_rules.cost_notes (see TABLE 9)
  004_machine_profiles.sql             Old machine profile library — REVERSED BY 031, do not repopulate (see MACHINE INTEGRATION TABLES)
  005_machine_jobs.sql                 Machine Bridge job queue (see MACHINE BRIDGE TABLES)
  006_canonical_profiles.sql           Canonical profile library (see CANONICAL PROFILE LIBRARY TABLE)
  007_delivery_tracking.sql            Delivery tracking + Employee PWA + GBP photo queue (see DELIVERY TRACKING + EMPLOYEE PWA TABLES)
  008_order_geocoding.sql              Adds orders.geocoded_lat/geocoded_lng — no new tables
  009_command_center_crm.sql           Adds profiles.internal_notes, orders.invoice_paid_at — no new tables
  010_bid_monitor.sql                  Bid Monitor — sources/projects/keywords/alerts (see BID MONITOR TABLES)
  011_orders_quote_id_unique.sql       Adds UNIQUE(orders.quote_id) — no new tables/columns (see TABLE 18)
  012_machine_jobs_fallback_geometry.sql  Adds machine_jobs.used_fallback_geometry — no new tables (see MACHINE BRIDGE TABLES)
  013_bid_documents.sql                Bid Documents — project-level GC bid pricing (see BID DOCUMENT TABLES)
  014_takeoff_uploads_pending_status.sql  Widens takeoff_uploads.status CHECK to add 'pending', new default — no new tables/columns
  015_machine_jobs_delivery_method.sql    Adds machine_jobs.delivery_method — no new tables (see MACHINE BRIDGE TABLES)
  016_source_tool_and_shop_profile_library.sql  Adds quote_requests.source_tool (see TABLE 15), creates shop_profile_library (see SHOP PROFILE LIBRARY TABLE) — FILE ONLY, not yet applied live
  017_color_and_queue_position.sql        Adds quote_requests.color (see TABLE 15) and shop_profile_library.color/queue_position/completed_at (see SHOP PROFILE LIBRARY TABLE) — no new tables — FILE ONLY, not yet applied live
  018_job_identity_and_finish.sql         Adds client_business_name/client_name/po_number/requested_by/finish to quote_requests (see TABLE 15; po_number pre-existing) and to shop_profile_library (see SHOP PROFILE LIBRARY TABLE, all five new) — no new tables — CONFIRMED APPLIED LIVE 2026-08-22, see SESSION_STATE.md
  019_job_name_and_delivery_date.sql      Adds job_name to quote_requests (see TABLE 15) and job_name/requested_delivery_date to shop_profile_library (see SHOP PROFILE LIBRARY TABLE); retires (documents as dead, does not drop) both tables' migration-018 requested_by columns — no new tables — CONFIRMED APPLIED LIVE 2026-08-23, see SESSION_STATE.md
  020_completion_events.sql            Adds completion_events (shop-floor "Mark Complete" event log) — CONFIRMED APPLIED LIVE 2026-08-24/26 — not otherwise documented in this file's table sections, see the migration file itself
  021_gbp_photo_queue_shop_job_link.sql   Adds gbp_photo_queue.shop_profile_library_id (links a delivery photo to its shop job) — no new tables — FILE ONLY, not applied live — not otherwise documented in this file's table sections, see the migration file itself
  022_building_code_jurisdictions.sql   Building code jurisdiction directory — creates building_code_jurisdictions. Long carried as "FILE ONLY"; found to genuinely NOT be applied on 2026-09-30 (the admin page was reading a missing relation) and APPLIED LIVE that day, 480 rows (254 TX counties + 226 cities). Read surface is now the PUBLIC /resources/building-codes page — see 033. Not otherwise documented in this file's table sections, see the migration file itself
  030_command_center_v2_clean_slate.sql   Deletes pre-V2 job data (quote_requests/machine_jobs/orders/quotes/takeoff_uploads/saved_configurations/notifications + dependents) created before a fixed cutoff; keeps all accounts, reference data, canonical_profiles and shop_profile_library — data-only, no schema change — APPLIED LIVE 2026-09-30
  031_drop_machine_profile_library.sql    DROPS machine_profile_bends/machine_profiles/machine_profile_categories and machine_jobs.machine_profile_id (see MACHINE INTEGRATION TABLES) — APPLIED LIVE 2026-09-30
  032_quote_requests_job_stage.sql        Adds quote_requests.job_stage + CHECK + index, and backfills it (see TABLE 15) — APPLIED LIVE 2026-09-30, verified via information_schema
  033_building_codes_public_read.sql      Adds an anonymous SELECT policy on building_code_jurisdictions so the public /resources/building-codes page can read it; writes stay admin-only — APPLIED LIVE 2026-09-30 (022 itself was applied in the same run, 480 rows)
  034_command_center_v2_workbench.sql     Adds 15 columns to quote_requests for the Workbench and Job screen — per-stage clocks, the returned PathfinderEdge profile numbers, send-failure state, rush provenance, approval channel and the follow-up draft — plus four CHECK constraints and two partial indexes (see TABLE 15) — APPLIED LIVE 2026-09-30, applied twice to prove idempotency, verified via information_schema + pg_constraint, and the rush constraint exercised six ways, INSERT and UPDATE alike
  023_profile_passport.sql             Profile Passport — custom_profiles + profile_revisions (see PROFILE PASSPORT TABLES below), adds orders.custom_profile_id (see TABLE 18) — FILE ONLY, not applied live (no linked Supabase project, no SUPABASE_ACCESS_TOKEN; see STATE_OF_THE_BUILD.md)
```

Run in numeric order — see `supabase/README.md` for the exact procedure.
As of 2026-07-22, all 6 migrations (001–006) are confirmed applied to the
live Supabase project — verified directly via the service-role client
across two sessions (STATE_OF_THE_BUILD.md's afs-041 correction for
001–005, and this session's direct pre/post query for 006), not carried
forward from this line's long-stale "001–003 and 005 NOT yet applied"
claim. 007–010's live-apply status was not independently reverified in
this session — go by `supabase/README.md`'s own tracking, not this line.
Migration 013 (`013_bid_documents.sql`, bid-doc-002/003) is new code as of
this session and has not been applied to the live Supabase project — see
`supabase/README.md`'s own note on it.

**Naming note (010):** this migration was requested as
`008_bid_monitor.sql`, but `008` and `009` were already real, applied-
looking files on disk (see above) by the time this task ran — numbered
`010` instead of colliding with or overwriting either.

---

## TABLE 1 — profiles

Extends auth.users. Created via server action after successful registration.

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  company         TEXT,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('admin','contractor','architect','customer')),
  pricing_tier    TEXT NOT NULL DEFAULT 'standard'
                  CHECK (pricing_tier IN ('standard','contractor','preferred','wholesale')),
  net_terms       INTEGER NOT NULL DEFAULT 0
                  CHECK (net_terms IN (0,15,30,60)),
  credit_limit    DECIMAL(10,2),
  tax_exempt      BOOLEAN NOT NULL DEFAULT false,
  company_id      UUID,                              -- FK added after companies table
  company_role    TEXT CHECK (company_role IN ('owner','admin','estimator','pm','accounting','viewer')),
  sms_opt_in      BOOLEAN NOT NULL DEFAULT false,
  email_opt_in    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);
CREATE POLICY "admin_all_profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 2 — companies

```sql
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  billing_address JSONB,
  phone           TEXT,
  primary_user_id UUID REFERENCES profiles(id),
  pricing_tier    TEXT NOT NULL DEFAULT 'standard',
  net_terms       INTEGER NOT NULL DEFAULT 0,
  credit_limit    DECIMAL(10,2),
  require_po      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members" ON companies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = companies.id)
  );
CREATE POLICY "admin_all_companies" ON companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Add FK back to profiles
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_company
  FOREIGN KEY (company_id) REFERENCES companies(id);
```

---

## TABLE 3 — materials

```sql
CREATE TABLE materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  alloy_grade     TEXT,
  category        TEXT NOT NULL
                  CHECK (category IN ('copper','zinc','aluminum','galvanized',
                                      'stainless','galvalume','painted_steel')),
  commodity_key   TEXT NOT NULL
                  CHECK (commodity_key IN ('copper','aluminum','zinc',
                                          'steel_hrc','stainless_surcharge','galvalume')),
  unit_weight_lbs_per_sqft DECIMAL(8,4),
  density_lbs_per_cubic_in DECIMAL(10,6),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_materials" ON materials
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_materials" ON materials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 4 — gauges

```sql
CREATE TABLE gauges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     UUID NOT NULL REFERENCES materials(id),
  label           TEXT NOT NULL,
  thickness_inches DECIMAL(8,5) NOT NULL,
  weight_lbs_sqft DECIMAL(8,4),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_gauges_material ON gauges(material_id);

ALTER TABLE gauges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_gauges" ON gauges
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_gauges" ON gauges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 5 — finishes

```sql
CREATE TABLE finishes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     UUID NOT NULL REFERENCES materials(id),
  name            TEXT NOT NULL,
  manufacturer    TEXT,
  color_code      TEXT,
  hex_preview     TEXT,
  is_standard     BOOLEAN NOT NULL DEFAULT true,
  upcharge_pct    DECIMAL(5,4) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_finishes_material ON finishes(material_id);

ALTER TABLE finishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_finishes" ON finishes
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_finishes" ON finishes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 6 — product_profiles

```sql
CREATE TABLE product_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  category              TEXT NOT NULL,
  description           TEXT,
  min_width             DECIMAL(8,3),
  max_width             DECIMAL(8,3),
  min_height            DECIMAL(8,3),
  max_height            DECIMAL(8,3),
  min_leg_a             DECIMAL(8,3),
  max_leg_a             DECIMAL(8,3),
  min_leg_b             DECIMAL(8,3),
  max_leg_b             DECIMAL(8,3),
  standard_length_ft    DECIMAL(6,2),
  max_length_ft         DECIMAL(6,2),
  requires_consultation BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_profiles" ON product_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_profiles" ON product_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 7 — products

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT UNIQUE,
  profile_id      UUID NOT NULL REFERENCES product_profiles(id),
  material_id     UUID NOT NULL REFERENCES materials(id),
  gauge_id        UUID REFERENCES gauges(id),
  name            TEXT NOT NULL,
  description     TEXT,
  stock_type      TEXT NOT NULL DEFAULT 'fabricated'
                  CHECK (stock_type IN ('stock','fabricated','special_order')),
  lead_time_days  INTEGER NOT NULL DEFAULT 5,
  rush_eligible   BOOLEAN NOT NULL DEFAULT true,
  online_quotable BOOLEAN NOT NULL DEFAULT true,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_profile ON products(profile_id);
CREATE INDEX idx_products_material ON products(material_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 8 — accessories

```sql
CREATE TABLE accessories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT,
  description     TEXT,
  unit            TEXT NOT NULL DEFAULT 'EA',
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE product_accessories (
  product_id      UUID NOT NULL REFERENCES products(id),
  accessory_id    UUID NOT NULL REFERENCES accessories(id),
  calc_method     TEXT NOT NULL CHECK (calc_method IN ('per_lf','per_piece','per_sqft','fixed')),
  calc_rate       DECIMAL(8,4) NOT NULL DEFAULT 1,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, accessory_id)
);

ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_accessories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_accessories" ON accessories
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "authenticated_read_product_accessories" ON product_accessories
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_write_accessories" ON accessories
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_write_product_accessories" ON product_accessories
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

## TABLE 9 — pricing_rules (internal pricing engine)

**Migration 003 (`003_pricing_rules_cost_notes.sql`) adds `cost_notes
TEXT`** (nullable, additive — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
for `/admin/pricing`'s manual pricing mode, used while the commodity-indexed
engine described below is still waiting on real cost/margin data (see
PRICING_ENGINE.md §9). Not shown in the `CREATE TABLE` below since it was
added after this table was originally designed — it is a real column on
the live schema once 003 is applied.

```sql
CREATE TABLE pricing_rules (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                UUID NOT NULL REFERENCES products(id),
  fabrication_cost_lf       DECIMAL(10,4),
  overhead_pct              DECIMAL(5,4) NOT NULL DEFAULT 0.25,
  margin_pct                DECIMAL(5,4) NOT NULL DEFAULT 0.35,
  waste_factor              DECIMAL(5,4) NOT NULL DEFAULT 1.10,
  material_cost_multiplier  DECIMAL(6,4) NOT NULL DEFAULT 1.00,
  rush_surcharge_pct        DECIMAL(5,4) NOT NULL DEFAULT 0.25,
  min_order_lf              DECIMAL(8,2),
  tier_1_qty                DECIMAL(8,2),
  tier_1_discount_pct       DECIMAL(5,4),
  tier_2_qty                DECIMAL(8,2),
  tier_2_discount_pct       DECIMAL(5,4),
  tier_3_qty                DECIMAL(8,2),
  tier_3_discount_pct       DECIMAL(5,4),
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_product ON pricing_rules(product_id);

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
-- Admin only — no customer access
CREATE POLICY "admin_only_pricing_rules" ON pricing_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 10 — contractor_pricing (negotiated rates)

```sql
CREATE TABLE contractor_pricing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  discount_pct    DECIMAL(5,4),
  fixed_price_lf  DECIMAL(10,4),
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, product_id)
);

CREATE INDEX idx_contractor_pricing_profile ON contractor_pricing(profile_id);

ALTER TABLE contractor_pricing ENABLE ROW LEVEL SECURITY;
-- Admin only — not visible to customers
CREATE POLICY "admin_only_contractor_pricing" ON contractor_pricing
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 11 — commodity_prices (pricing engine data)

```sql
CREATE TABLE commodity_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity       TEXT NOT NULL
                  CHECK (commodity IN ('copper','aluminum','zinc','steel_hrc',
                                       'stainless_surcharge','galvalume')),
  price_per_lb    DECIMAL(10,6) NOT NULL,
  price_date      DATE NOT NULL,
  data_source     TEXT,
  is_manual       BOOLEAN NOT NULL DEFAULT false,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commodity, price_date)
);

ALTER TABLE commodity_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_commodity" ON commodity_prices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 12 — supplier_price_history

```sql
CREATE TABLE supplier_price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     UUID NOT NULL REFERENCES materials(id),
  supplier_name   TEXT,
  effective_date  DATE NOT NULL,
  price_per_lb    DECIMAL(10,6),
  price_per_lf    DECIMAL(10,4),
  notes           TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_supplier_history" ON supplier_price_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 13 — pricing_trend_analysis

```sql
CREATE TABLE pricing_trend_analysis (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id                 UUID NOT NULL REFERENCES materials(id),
  analysis_date               DATE NOT NULL,
  commodity_30d_change_pct    DECIMAL(8,4),
  commodity_90d_change_pct    DECIMAL(8,4),
  commodity_365d_change_pct   DECIMAL(8,4),
  supplier_commodity_correlation DECIMAL(6,4),
  projected_cost_30d          DECIMAL(10,6),
  projected_cost_60d          DECIMAL(10,6),
  projected_cost_90d          DECIMAL(10,6),
  margin_risk_flag            BOOLEAN NOT NULL DEFAULT false,
  margin_risk_note            TEXT,
  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, analysis_date)
);

ALTER TABLE pricing_trend_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_trend_analysis" ON pricing_trend_analysis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 14 — projects

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  company_id      UUID REFERENCES companies(id),
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','completed','archived')),
  jobsite_address TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON projects(user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_projects" ON projects
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_all_projects" ON projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 15 — quote_requests

**Migration 034 (`034_command_center_v2_workbench.sql`, APPLIED LIVE
2026-09-30) adds fifteen columns**, all nullable, all `ADD COLUMN IF NOT
EXISTS`. They exist because the Workbench card and the Job screen have to
state things truthfully that this table had no source for.

| Column | Type | What it is for |
|---|---|---|
| `stage_changed_at` | timestamptz | When `job_stage` last moved. **`quote_requests` has no `updated_at` at all**, so before this there was literally no source for "how long has this been waiting". Backfilled from `COALESCE(reviewed_at, quoted_at, submitted_at)`. |
| `approved_at` | timestamptz | "Customer approved 20 minutes ago" |
| `approval_channel` | text | `phone` \| `email` \| `admin`. CHECK-constrained. How the approval arrived — what makes "Customer approved by phone" an auditable record rather than an unexplained stage jump. |
| `approved_by` | uuid → profiles | Which admin recorded it |
| `sent_to_machine_at` | timestamptz | "Sent to the machine an hour ago" |
| `done_at` | timestamptz | The Done lane's 14-day auto-archive is measured from here |
| `pathfinder_profile_ids` | text[] | **The profile numbers PathfinderEdge ACTUALLY returned**, one per line item, in line-item order. Empty/NULL means no send is confirmed, and neither the card nor the Job screen will claim a number. |
| `send_status` | text | NULL \| `failed` \| `unconfirmed`. CHECK-constrained. `failed` = nothing reached the machine, retry is safe. `unconfirmed` = the profile WAS created but its number did not come back, so do **not** retry — a retry would duplicate a real profile in catalog 20115. |
| `send_error` | text | The real reason, shown to the admin verbatim |
| `send_attempted_at` | timestamptz | When the last send was tried |
| `rush_source` | text | `customer_checkbox` \| `admin_toggle`. CHECK-constrained. See the rush constraint below. |
| `rush_set_by` | uuid → profiles | Who turned rush on |
| `rush_set_at` | timestamptz | When |
| `followup_draft` | text | The drafted follow-up for a stale quote, stored so it survives a reload |
| `followup_drafted_at` | timestamptz | When it was drafted |

**Four CHECK constraints, and one of them has a trap worth recording.**

```sql
quote_requests_send_status_check       send_status IS NULL OR send_status IN ('failed','unconfirmed')
quote_requests_approval_channel_check  approval_channel IS NULL OR approval_channel IN ('phone','email','admin')
quote_requests_rush_source_check       rush_source IS NULL OR rush_source IN ('customer_checkbox','admin_toggle')
quote_requests_rush_needs_explicit_source
    NOT is_rush OR (rush_source IS NOT NULL AND rush_source IN ('customer_checkbox','admin_toggle'))
```

The last one is what makes "rush is never inferred" a database fact rather
than a code convention: `is_rush = true` is impossible without one of the two
explicit sources, and there is no third value a would-be inference could
write.

**The `IS NOT NULL` half is load-bearing and was learned the hard way.** The
constraint was first written as `CHECK (is_rush = false OR rush_source IN
(...))` and applied live — and an insert of `is_rush = true, rush_source =
NULL` **SUCCEEDED**. With a NULL the `IN` yields UNKNOWN, `false OR UNKNOWN`
is UNKNOWN, and a CHECK constraint accepts UNKNOWN. Corrected to the form
above and re-proven against the live database: no source REFUSED, an invented
source (`inferred_from_due_date`) REFUSED, `customer_checkbox` ACCEPTED,
`admin_toggle` ACCEPTED. Do not simplify it back.

**Re-proven a second time on 2026-09-30, adding the UPDATE path.** All four of
the original proofs were INSERTs, and an inference would most plausibly arrive
as an UPDATE on an existing row — so that was the untested case. Six attempts
now: the four above, plus a second invented source (`asap_keyword`) REFUSED,
plus **an UPDATE of an already-accepted row to `is_rush = true,
rush_source = NULL`, which is REFUSED by the same constraint.** A CHECK is
evaluated per-row on UPDATE as well as INSERT, so there is no write path that
can set rush without provenance. Every proof row was deleted afterwards.

**Two partial indexes:** `idx_quote_requests_done_at` (the Done lane's archive
filter) and `idx_quote_requests_send_status` (finding jobs that need
attention).

**Migration 016 (`016_source_tool_and_shop_profile_library.sql`) adds
`source_tool TEXT NOT NULL DEFAULT 'unknown'`** (nullable-safe `ADD
COLUMN IF NOT EXISTS`, same additive pattern as migration 003's
`cost_notes` / migration 012's `used_fallback_geometry`) — records which
intake tool a request actually came through (e.g. FlashDraft, a future
phone/walk-in entry path, PathfinderEdge), defaulting to `'unknown'` for
every pre-existing row so the column is safe to add without a backfill
pass. Not shown in the `CREATE TABLE` below since it was added after this
table was originally designed — it is a real column on the live schema
once 016 is applied. **FILE ONLY as of this writing — 016 has not been
applied to the live Supabase project; see SESSION_STATE.md.**

**Migration 017 (`017_color_and_queue_position.sql`) adds `color TEXT`**
(nullable, additive `ADD COLUMN IF NOT EXISTS` — no default, no backfill
needed) — the metal/finish color called out at intake (e.g. off a Metal
Color Chart), captured alongside material/gauge/finish rather than only
living inside the request's `line_items` JSONB. Not shown in the `CREATE
TABLE` below since it was added after this table was originally designed
— it is a real column on the live schema once 017 is applied. **FILE ONLY
as of this writing — 017 has not been applied to the live Supabase
project; see SESSION_STATE.md.**

**Migration 018 (`018_job_identity_and_finish.sql`) adds
`client_business_name TEXT`, `client_name TEXT`, `po_number TEXT`,
`requested_by TEXT`, `finish TEXT`** (all nullable, additive `ADD COLUMN
IF NOT EXISTS`, no defaults) — job-identity intake fields (the client's
business name, the individual contact's name, and who at AFS/the
customer requested the job) plus a `finish` field, captured consistently
alongside the same five fields added to `shop_profile_library` by this
same migration (see SHOP PROFILE LIBRARY TABLE below).

**Pre-existing column, not new:** `po_number TEXT` already exists on
`quote_requests` — added in `001_initial_schema.sql` (see the `CREATE
TABLE` block below, where it is already present) — verified directly
against that migration file, not assumed. Migration 018 includes it only
via `ADD COLUMN IF NOT EXISTS` for idempotent-migration-style safety (a
harmless no-op against the live column, matching this project's existing
pattern), not as a new addition. Only `client_business_name`,
`client_name`, `requested_by`, and `finish` are actually new columns on
this table from migration 018.

`client_business_name`, `client_name`, `requested_by`, and `finish` are
not shown in the `CREATE TABLE` below since they were added after this
table was originally designed. **Migration 018 is CONFIRMED APPLIED
LIVE** — Reid verified all five columns (including the pre-existing
`po_number`) directly via `information_schema` in the Supabase Dashboard
on 2026-08-22 (see SESSION_STATE.md's afs-jf-000 entry) — they are real
columns on the live schema now, not merely on disk.

**`requested_by TEXT` (migration 018) is DEAD — retired by migration 019,
not removed.** It was a naming mistake: the column was meant to capture a
delivery date, not a person's name. It remains in place, untouched, and
must be treated as always-null going forward — no UI or logic should read
or write it. (Three submission surfaces still write to it as of migration
019 — see SESSION_STATE.md's afs-jf-004 entry for that known,
deliberately out-of-scope gap.) Do not confuse this column with
`machine_jobs.requested_by UUID REFERENCES profiles(id)` (MACHINE BRIDGE
TABLES below, an earlier and unrelated migration, actively used — set to
the requesting user's id on every Command Center approval) — same column
name, different table, different meaning, no relationship between them.

**Migration 019 (`019_job_name_and_delivery_date.sql`) adds `job_name
TEXT`** (nullable, additive `ADD COLUMN IF NOT EXISTS`, no default) — the
project/job name (e.g. "Smith Residence Reroof"), distinct from
`client_name` (the individual contact person, migration 018) and
`client_business_name` (the company, migration 018). Not shown in the
`CREATE TABLE` below since it was added after this table was originally
designed. **CONFIRMED APPLIED LIVE 2026-08-23** — verified via
`information_schema`; see SESSION_STATE.md's afs-jf-004 entry.

**`quote_requests` gets no new date column from migration 019.** The
customer's requested-delivery date is captured via the pre-existing
`requested_delivery DATE` column below (added in `001_initial_schema.sql`,
not new) instead of a same-named `requested_delivery_date` column —
deliberately reused rather than duplicated. As of migration 019,
`requested_delivery` is still unpopulated by every submission surface
(FlashDraft, Configurator, Quote Builder, Blueprint Takeoff AI upload)
despite being read at
`app/api/admin/command-center/approve-quote-request/route.ts` (the
`qr.requested_delivery` select feeding `machine_jobs.due_date` on every
approval) — wiring a submission surface to actually populate it is a
future prompt's work, not part of migration 019. This produces an
intentional **naming asymmetry** with `shop_profile_library.
requested_delivery_date` (new in migration 019, see SHOP PROFILE LIBRARY
TABLE below) — same real-world concept, two different column names,
because `quote_requests` already had a column for it and
`shop_profile_library` did not. Also distinct from
`shop_profile_library.due_date` (migration 016) — see that table's own
section for the due-date-vs-requested-delivery-date distinction, which
applies symmetrically to `quote_requests.requested_delivery`: what the
customer asks for at intake is not the shop's committed date.

```sql
CREATE TABLE quote_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number  TEXT UNIQUE NOT NULL,  -- AFS-QR-2026-XXXXX
  user_id         UUID REFERENCES profiles(id),
  guest_email     TEXT,
  project_id      UUID REFERENCES projects(id),
  status          TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','reviewing','quoted','expired','cancelled')),
  line_items      JSONB NOT NULL,
  jobsite_address JSONB,
  requested_delivery DATE,
  po_number       TEXT,
  is_rush         BOOLEAN NOT NULL DEFAULT false,
  upload_id       UUID,                  -- FK to takeoff_uploads if from drawing
  notes           TEXT,
  quote_id        UUID,                  -- Set when formal quote is created
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  quoted_at       TIMESTAMPTZ
  -- job_stage TEXT DEFAULT 'new' added by migration 032 — see below
);

CREATE INDEX idx_quote_requests_user ON quote_requests(user_id);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_submitted ON quote_requests(submitted_at DESC);

-- Command Center V2 (migration 032_quote_requests_job_stage.sql, applied
-- live 2026-09-30). THE ONE JOB STAGE MODEL: a quote_requests row IS the
-- Job, and job_stage is the Workbench lane it sits in.
--
--   ladder order:  new -> quoted -> approved -> shop -> done
--   job_stage IS NULL  = archived (today: cancelled). Off the Workbench and
--                        not a rung on the ladder — which is why the CHECK
--                        permits NULL rather than forbidding it.
--
-- DEFAULT 'new' so an arriving request lands in the New lane without every
-- insert path having to say so.
--
-- TRANSITIONS ARE NOT ENFORCED HERE. A CHECK constraint can police the SET
-- of values but not from -> to, which is the part that matters. That lives in
-- lib/data/job-stage.ts (planStageTransition), which every server route that
-- moves a job goes through: forward moves allowed and may skip rungs (a phone
-- approval is new -> approved with no quote sent), same-stage is a no-op with
-- a plain-English message, backward is refused.
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS job_stage text DEFAULT 'new';
ALTER TABLE quote_requests
  ADD CONSTRAINT quote_requests_job_stage_check
  CHECK (job_stage IS NULL OR job_stage IN ('new','quoted','approved','shop','done'));
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_stage
  ON quote_requests (job_stage, submitted_at DESC);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_requests" ON quote_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_requests" ON quote_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "admin_all_requests" ON quote_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 16 — quotes (formal AFS-generated quotes)

```sql
CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    TEXT UNIQUE NOT NULL,  -- AFS-Q-2026-XXXXX
  request_id      UUID REFERENCES quote_requests(id),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','approved','expired','converted','cancelled')),
  subtotal        DECIMAL(10,2) NOT NULL,
  freight         DECIMAL(10,2),
  rush_surcharge  DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax             DECIMAL(10,2),
  total           DECIMAL(10,2) NOT NULL,
  valid_until     DATE,
  estimator_notes TEXT,
  created_by      UUID REFERENCES profiles(id),  -- Admin estimator
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ
);

CREATE INDEX idx_quotes_user ON quotes(user_id);
CREATE INDEX idx_quotes_status ON quotes(status);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_quotes" ON quotes
  FOR SELECT USING (auth.uid() = user_id AND status != 'draft');
CREATE POLICY "admin_all_quotes" ON quotes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 17 — quote_line_items

```sql
CREATE TABLE quote_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  finish_id       UUID REFERENCES finishes(id),
  description     TEXT NOT NULL,
  width_in        DECIMAL(8,3),
  height_in       DECIMAL(8,3),
  leg_a_in        DECIMAL(8,3),
  leg_b_in        DECIMAL(8,3),
  length_ft       DECIMAL(8,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'LF',
  unit_price      DECIMAL(10,4) NOT NULL,
  line_total      DECIMAL(10,2) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_owner_line_items" ON quote_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quotes WHERE id = quote_id AND user_id = auth.uid()
      AND status != 'draft'
    )
  );
CREATE POLICY "admin_all_line_items" ON quote_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 18 — orders

**Migration 023 (`023_profile_passport.sql`) adds `custom_profile_id UUID
REFERENCES custom_profiles(id)`** (nullable, additive `ADD COLUMN IF NOT
EXISTS`) — an optional link from an order to the Profile Passport record
(see PROFILE PASSPORT TABLES below) it was reordered from, when applicable.
Not shown in the `CREATE TABLE` below since it was added after this table
was originally designed. **FILE ONLY as of this writing — not applied to
the live Supabase project; see STATE_OF_THE_BUILD.md's PROFILE PASSPORT
entry for the blocker.**

**Migration 011 (`011_orders_quote_id_unique.sql`) adds
`UNIQUE (quote_id)`** (not shown in the `CREATE TABLE` below since it was
added after this table was originally designed). `createOrderFromQuote()`
(`lib/data/orders.ts`) is called from two independently-triggered paths for
the same card payment — the Stripe webhook and the client-side
`app/api/checkout/confirm-order` fallback (see ORDER_LIFECYCLE_DECISION.md)
— and its only prior guard was a non-atomic SELECT-then-INSERT check. This
constraint is the real duplicate-order guard: a losing concurrent INSERT now
fails with a Postgres unique-violation instead of silently creating a second
`orders` row for the same quote, and that function catches exactly that
error code to return the winning row.

```sql
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT UNIQUE NOT NULL,  -- AFS-2026-XXXXX
  quote_id            UUID NOT NULL REFERENCES quotes(id),  -- UNIQUE as of migration 011
  user_id             UUID NOT NULL REFERENCES profiles(id),
  project_id          UUID REFERENCES projects(id),
  status              TEXT NOT NULL DEFAULT 'submitted'
                      CHECK (status IN (
                        'submitted','received','in_queue','cutting',
                        'bending','qc','ready','shipped','delivered','cancelled'
                      )),
  is_rush             BOOLEAN NOT NULL DEFAULT false,
  subtotal            DECIMAL(10,2) NOT NULL,
  freight             DECIMAL(10,2),
  tax                 DECIMAL(10,2),
  rush_surcharge      DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_paid        BOOLEAN NOT NULL DEFAULT false,
  total               DECIMAL(10,2) NOT NULL,
  payment_method      TEXT CHECK (payment_method IN ('card','ach','net_terms')),
  net_terms           INTEGER NOT NULL DEFAULT 0,
  po_number           TEXT,
  delivery_method     TEXT NOT NULL DEFAULT 'ship'
                      CHECK (delivery_method IN ('ship','pickup')),
  delivery_address    JSONB,
  delivery_scheduled_at TIMESTAMPTZ,
  delivery_window     TEXT,
  tracking_number     TEXT,
  carrier             TEXT,
  shop_photo_url      TEXT,
  notes               TEXT,
  admin_notes         TEXT,
  stripe_payment_intent_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admin_all_orders" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 19 — order_line_items

```sql
CREATE TABLE order_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  finish_id   UUID REFERENCES finishes(id),
  description TEXT NOT NULL,
  width_in    DECIMAL(8,3),
  height_in   DECIMAL(8,3),
  leg_a_in    DECIMAL(8,3),
  leg_b_in    DECIMAL(8,3),
  length_ft   DECIMAL(8,2) NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'LF',
  unit_price  DECIMAL(10,4) NOT NULL,
  line_total  DECIMAL(10,2) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_order_line_items_order ON order_line_items(order_id);

ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_owner_line_items" ON order_line_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid())
  );
CREATE POLICY "admin_all_order_items" ON order_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 20 — order_status_history

```sql
CREATE TABLE order_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  changed_by  UUID REFERENCES profiles(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_owner_history" ON order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid())
  );
CREATE POLICY "admin_all_history" ON order_status_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 21 — order_attachments

```sql
CREATE TABLE order_attachments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attachment_type         TEXT NOT NULL
                          CHECK (attachment_type IN (
                            'approved_drawing','pre_ship_photo',
                            'delivery_confirmation','signed_bol',
                            'quality_report','other'
                          )),
  filename                TEXT NOT NULL,
  storage_key             TEXT NOT NULL,
  file_size_bytes         BIGINT,
  uploaded_by             UUID REFERENCES profiles(id),
  uploaded_by_role        TEXT CHECK (uploaded_by_role IN ('admin','customer')),
  is_visible_to_customer  BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_attachments_order ON order_attachments(order_id);

ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_owner_attachments" ON order_attachments
  FOR SELECT USING (
    is_visible_to_customer = true AND
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid())
  );
CREATE POLICY "admin_all_attachments" ON order_attachments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 22 — notifications

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES orders(id),
  user_id     UUID REFERENCES profiles(id),
  channel     TEXT NOT NULL CHECK (channel IN ('email','sms')),
  type        TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('sent','delivered','failed')),
  error       TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_order ON notifications(order_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_notifications" ON notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 23 — takeoff_uploads

```sql
CREATE TABLE takeoff_uploads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id),
  guest_email      TEXT,
  storage_key      TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  file_size_bytes  BIGINT,
  page_count       INTEGER,
  status           TEXT NOT NULL DEFAULT 'pending'
                   -- 'pending' added in migration 014: the row is now created
                   -- when a signed Storage upload URL is issued, before the
                   -- browser has actually PUT the file bytes to Storage.
                   CHECK (status IN ('pending','uploaded','processing','complete','partial','failed')),
  result_items     JSONB,
  confirmed_items  JSONB,
  request_id       UUID REFERENCES quote_requests(id),
  overall_confidence TEXT,
  processing_notes TEXT,
  processing_ms    INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_takeoff_uploads_user ON takeoff_uploads(user_id);
CREATE INDEX idx_takeoff_uploads_status ON takeoff_uploads(status);

ALTER TABLE takeoff_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_uploads" ON takeoff_uploads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_uploads" ON takeoff_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "admin_all_uploads" ON takeoff_uploads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 24 — vault_documents

```sql
CREATE TABLE vault_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id),
  project_id        UUID REFERENCES projects(id),
  order_id          UUID REFERENCES orders(id),
  folder_name       TEXT,
  filename          TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  file_size_bytes   BIGINT NOT NULL,
  storage_key       TEXT NOT NULL UNIQUE,
  description       TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  is_shared         BOOLEAN NOT NULL DEFAULT false,
  download_count    INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_documents_user ON vault_documents(user_id);
CREATE INDEX idx_vault_documents_project ON vault_documents(project_id);
CREATE INDEX idx_vault_documents_order ON vault_documents(order_id);

ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_documents" ON vault_documents
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_all_documents" ON vault_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## TABLE 25 — cad_library_files

```sql
CREATE TABLE cad_library_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES product_profiles(id),
  format            TEXT NOT NULL CHECK (format IN ('dwg','dxf','pdf','rfa','rvt')),
  filename          TEXT NOT NULL,
  storage_key       TEXT NOT NULL,
  description       TEXT,
  version           TEXT,
  revit_version     TEXT,
  file_size_bytes   BIGINT,
  preview_image_key TEXT,
  download_count    INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  uploaded_by       UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cad_download_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID NOT NULL REFERENCES cad_library_files(id),
  user_id     UUID REFERENCES profiles(id),
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cad_library_profile ON cad_library_files(profile_id);
CREATE INDEX idx_cad_download_log_file ON cad_download_log(file_id);

ALTER TABLE cad_library_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_cad" ON cad_library_files
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_cad" ON cad_library_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE cad_download_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_downloads" ON cad_download_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## ADDITIONAL TABLES (smaller, supporting)

```sql
-- Saved configurator configurations
CREATE TABLE saved_configurations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  name        TEXT,
  profile_id  UUID REFERENCES product_profiles(id),
  material_id UUID REFERENCES materials(id),
  gauge_id    UUID REFERENCES gauges(id),
  finish_id   UUID REFERENCES finishes(id),
  dimensions  JSONB NOT NULL,
  length_ft   DECIMAL(8,2),
  quantity    INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saved_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_configs" ON saved_configurations
  FOR ALL USING (auth.uid() = user_id);
```

**Profile Passport additions (Phase 3, afs-pp-001/003) — NEITHER APPLIED TO
THE LIVE DATABASE as of this writing.** This session series has no
Supabase access to the real afs-website project, so both migrations below
exist only as reviewed files; someone with real project access must run
them before the columns/policies they describe actually exist. Until then,
FlashDraft's Save/Duplicate/Lock Profile & Save all fail outright, since
`performSave` (`app/studio/draft/page.tsx`) writes these columns
unconditionally — see STATE_OF_THE_BUILD.md's matching entries for the
full blast-radius explanation.

- `supabase/migrations/024_profile_passport_company_scope.sql` — adds
  `company_id UUID REFERENCES companies(id)`, `is_locked BOOLEAN NOT NULL
  DEFAULT false`, `job_info JSONB`, `category TEXT`, `subcategory TEXT`.
  Replaces the single `users_own_configs` policy above with four
  company-aware ones (`profile_passport_select/insert/update/delete`) —
  any teammate on the same `company_id` can SELECT; UPDATE requires
  `company_role` estimator-or-above; DELETE requires owner/admin; a row
  with `company_id IS NULL` keeps exactly the original per-user behavior.
  `category`/`subcategory` are plain display-only TEXT, deliberately
  separate from `dimensions.categoryId`, which holds a value from the
  curated `AFS_PROFILE_CATEGORIES` vocabulary in
  `lib/data/profile-categories.ts`. (Until 2026-09-30 `categoryId` was a
  FK-shaped reference into the old machine library's category table; that
  library was dropped by migration 031, so the vocabulary moved into code.)
- `supabase/migrations/025_profile_passport_thumbnail.sql` — adds
  `thumbnail_image TEXT`, a `data:image/png;base64,...` capture of the
  FlashDraft canvas at save time (`HTMLCanvasElement.toDataURL()`, no
  library). No index — never filtered/searched, only fetched by primary
  key alongside its own row.

```sql
-- Saved quote request templates
CREATE TABLE quote_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  company_id       UUID REFERENCES companies(id),
  name             TEXT NOT NULL,
  description      TEXT,
  is_company_shared BOOLEAN NOT NULL DEFAULT false,
  items            JSONB NOT NULL,
  use_count        INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_templates" ON quote_templates
  FOR ALL USING (auth.uid() = user_id);

-- Saved CSI specification sections
CREATE TABLE saved_specifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  project_id  UUID REFERENCES projects(id),
  csi_section TEXT NOT NULL,
  csi_title   TEXT NOT NULL,
  spec_data   JSONB NOT NULL,
  is_sole_source BOOLEAN NOT NULL DEFAULT true,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE saved_specifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_specs" ON saved_specifications
  FOR ALL USING (auth.uid() = user_id);

-- Admin audit log (all admin actions)
CREATE TABLE admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES profiles(id),
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  before_value  JSONB,
  after_value   JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No RLS delete — audit records are permanent
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Credit applications
CREATE TABLE credit_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  company_id       UUID REFERENCES companies(id),
  status           TEXT NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted','under_review','approved','denied')),
  application_data JSONB NOT NULL,
  requested_limit  DECIMAL(10,2),
  requested_terms  INTEGER,
  approved_limit   DECIMAL(10,2),
  approved_terms   INTEGER,
  reviewer_id      UUID REFERENCES profiles(id),
  reviewer_notes   TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);

ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_applications" ON credit_applications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_applications" ON credit_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_all_applications" ON credit_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Design consultation requests
CREATE TABLE consultation_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id),
  name             TEXT NOT NULL,
  firm_name        TEXT,
  email            TEXT NOT NULL,
  phone            TEXT,
  project_name     TEXT,
  project_type     TEXT,
  project_location TEXT,
  topic            TEXT,
  description      TEXT,
  attachment_keys  TEXT[],
  preferred_contact TEXT,
  preferred_days   TEXT[],
  preferred_times  TEXT[],
  status           TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new','contacted','completed','no_response')),
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_consultations" ON consultation_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "public_insert_consultations" ON consultation_requests
  FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_all_consultations" ON consultation_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Chat conversations (AI chatbot history)
CREATE TABLE chat_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id),
  guest_session_id TEXT,
  messages         JSONB NOT NULL DEFAULT '[]',
  escalated        BOOLEAN NOT NULL DEFAULT false,
  escalated_at     TIMESTAMPTZ,
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_chats" ON chat_conversations
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "admin_all_chats" ON chat_conversations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Team invitations (SPEC_TEAM_ACCOUNTS.md — /account/team, /invite/[token])
CREATE TABLE team_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  email        TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('owner','admin','estimator','pm','accounting','viewer')),
  token        TEXT NOT NULL UNIQUE,
  message      TEXT,
  invited_by   UUID NOT NULL REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at   TIMESTAMPTZ NOT NULL,
  accepted_at  TIMESTAMPTZ,
  accepted_by  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_invitations_company ON team_invitations(company_id);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
-- Token lookups for the public /invite/[token] page happen server-side via the
-- service role client (unauthenticated by design, like a password reset link).
CREATE POLICY "company_admins_manage_invitations" ON team_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND company_id = team_invitations.company_id
      AND company_role IN ('owner','admin')
    )
  );
CREATE POLICY "admin_all_invitations" ON team_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## SPEC TEMPLATES (CSI)

```sql
CREATE TABLE spec_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csi_section         TEXT NOT NULL,
  csi_title           TEXT NOT NULL,
  applicable_profiles TEXT[],
  standards_refs      TEXT[],
  part_1_template     TEXT,
  part_2_template     TEXT,
  part_3_template     TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE spec_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_spec_templates" ON spec_templates
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin_write_spec_templates" ON spec_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## MACHINE INTEGRATION TABLES — DROPPED (migration 031)

**`machine_profile_categories`, `machine_profiles` and
`machine_profile_bends` NO LONGER EXIST.** Migration 004 created them and an
importer filled them with 46 categories, 911 profiles and 4,537 bend steps
read out of the OLD Thalmann DS2801's own job-history database.
`031_drop_machine_profile_library.sql` dropped all three, child-to-parent
(bends, then profiles, then categories), on 2026-09-30.

It also dropped **`machine_jobs.machine_profile_id`**, the FK into
`machine_profiles`. That column was NULL on every one of the 34 rows that
ever existed, so no job lost a bend sequence; `machine_jobs.custom_bends`
(FlashDraft-drawn geometry) is now the only bend source, which is what every
real job already used.

**Why.** The geometry was AI-read out of a legacy database and was never
geometrically validated, so matching a customer's drawing against it produced
confident-looking nonsense. And most profile names were real customer,
hospital and project names, which is not catalog content. Full reasoning:
`docs/COMMAND_CENTER_V2_SPEC.md` §2.8.

**Before it was dropped.** Every row of all three tables was dumped to
`C:\Users\manag\Documents\afs-backups\2026-10-01\` as JSON plus a
chunked restore statement, and each dump was proven to rehydrate into typed
rows. The raw source files (`ds2801db.bdb`, the `.ds1` samples) were copied
to `C:\Users\manag\Documents\afs-assets\old-machine-files\` — OUTSIDE
the repo — and verified byte-for-byte by size and sha256. **They are the only
copies of that machine's database.**

**Do not recreate these tables.**
`lib/data/removed-machine-library.test.ts` is a static test over `app/
components/ lib/ scripts/ tests/` that fails on any reference to them, to the
deleted modules (`/api/studio/match-profile`, `load-profile`, `library-list`,
`/studio/profile-viewer`, `ProfileLibraryBrowser`, the importer scripts) or to
the deleted `machine-data/` folder.

**Two tables that sound similar and are deliberately KEPT** — the same static
test asserts both are still referenced in source, so an over-eager cleanup
cannot take them too:

| Table | What it is |
|---|---|
| `shop_profile_library` | Real send history to the CURRENT Thalmann, including `pathfinder_profile_id`. See SHOP PROFILE LIBRARY TABLE. |
| `canonical_profiles` | The hand-authored starter library, and now the ONLY profile library. See CANONICAL PROFILE LIBRARY TABLE. |

---

## MACHINE BRIDGE TABLES (migration 005_machine_jobs.sql)

Links a customer order/quote request to a Thalmann bend sequence and
tracks its approval → generation → delivery lifecycle, separate from
`orders.status` (which only tracks physical fabrication stage and has no
machine-delivery states). See ARCHITECTURE.md §11 for the full lifecycle
and the Machine Bridge service that consumes `approved_for_machine` jobs.
Admin-only — internal production-queue tool, not customer-facing.

**Migration 012 (`012_machine_jobs_fallback_geometry.sql`) adds
`used_fallback_geometry BOOLEAN NOT NULL DEFAULT false`** (nullable-safe
`ADD COLUMN IF NOT EXISTS`, same pattern as migration 003's `cost_notes`).
Set by `app/api/admin/command-center/approve-quote-request/route.ts`
whenever the source `quote_requests` line item had no real FlashDraft-drawn
points and was missing `legA`/`legB`/`width`(-or-`height`), so the route
substituted its hardcoded 12"/2"/2" placeholder box instead of real
geometry — surfaced as a visible warning badge on both
`PendingQuoteRequestCard.tsx` (before approval) and
`CommandCenterJobCard.tsx` (after). Not shown in the `CREATE TABLE` below
since it was added after this table was originally designed — it is a
real column on the live schema once 012 is applied.

```sql
CREATE TABLE machine_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID REFERENCES orders(id),
  quote_request_id   UUID REFERENCES quote_requests(id),
  -- machine_profile_id was DROPPED by migration 031 with the machine
  -- profile library it pointed at. It was NULL on every row that ever
  -- existed, so no job lost its geometry; custom_bends is now the only
  -- bend source. Do not re-add it.
  custom_bends       JSONB,                                 -- FlashDraft-drawn bend sequence (the only source)
  profile_name       TEXT NOT NULL,
  material           TEXT,
  gauge              TEXT,
  quantity           INTEGER NOT NULL DEFAULT 1,
  blank_width_mm     DECIMAL(10,4),
  is_rush            BOOLEAN NOT NULL DEFAULT false,
  notes              TEXT,
  status             TEXT NOT NULL DEFAULT 'pending_approval'
                     CHECK (status IN (
                       'pending_approval','approved_for_machine','staged_for_review',
                       'sent_to_machine','machine_error','completed','rejected',
                       'changes_requested'
                     )),
  rejection_reason   TEXT,
  requested_by       UUID REFERENCES profiles(id),
  approved_by        UUID REFERENCES profiles(id),
  approved_at        TIMESTAMPTZ,
  staged_at          TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: admin only (FOR ALL)

-- Singleton row tracking the last time the Machine Bridge polled
-- pending-jobs, so the Command Center can show a connection-status dot.
CREATE TABLE machine_bridge_status (
  id           BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  last_ping_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: admin read only

-- Also part of 005: admin_audit_log.admin_id relaxed to nullable, since the
-- bridge's automated job-delivered report has no admin session to attribute
-- audit entries to:
ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
```

---

## CANONICAL PROFILE LIBRARY TABLE (migration 006_canonical_profiles.sql)

**THE profile library, as of 2026-09-30** — it began as a second source
alongside the imported machine library, and migration 031 dropped that
library, so this is now the only one. 25 hand-crafted, mathematically
correct flashing profiles stored as pre-computed XY point sequences,
populated via `scripts/seed-canonical-profiles.ts` (`pnpm tsx
scripts/seed-canonical-profiles.ts`). These do NOT go through the bend-angle
turtle-graphics reconstruction in `lib/flashdraft/geometry.ts` at read time
— `points` is the exact, final polyline, computed once at seed time from an
explicit turtle-graphics move list and stored as-is. That is precisely the
property the imported library lacked, and the reason this one survived it.
Public reference geometry, not shop job history, so there is no private-row
concept.

Read surfaces: `/studio/library` (the customer-facing browser, now
canonical-only), `/api/studio/canonical-profiles`, and
`/admin/geometry-test`, which validates `computeProfilePoints()` against
these rows because each carries BOTH authored points and authored bends.

```sql
CREATE TABLE canonical_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL,
  description     TEXT,
  blank_width_in  DECIMAL(8,3) NOT NULL,
  points          JSONB NOT NULL,  -- [{"x": 0, "y": 0}, ...] pre-computed SVG coordinates, inches
  bends           JSONB NOT NULL,  -- [{"leftLegIn": 4, "rightLegIn": 3, "angleDegrees": 90, "direction": "up"}, ...]
  tags            TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canonical_profiles_category ON canonical_profiles(category);
CREATE INDEX idx_canonical_profiles_sort ON canonical_profiles(sort_order);

ALTER TABLE canonical_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_canonical" ON canonical_profiles FOR SELECT USING (is_active = true);
CREATE POLICY "admin_write_canonical" ON canonical_profiles FOR ALL USING (is_admin());
```

Column notes:
- `slug` — unique, human-readable identifier (e.g. `standard-coping-cap`),
  used as the seed script's upsert key (`onConflict: 'slug'`), so re-running
  the seed script is safe.
- `category` — matches the AFS product category vocabulary, which now lives
  in `lib/data/profile-categories.ts` as `AFS_PROFILE_CATEGORIES` (e.g.
  "Coping Caps & Cleats", "Valley Flashing"). It used to live inside
  `app/studio/library/page.tsx`; it moved into `lib/` on 2026-09-30 when the
  FlashDraft category dropdown, which had been reading the dropped machine
  library's category table, was repointed at it.
- `points` / `bends` — both derived from the same turtle-graphics move list
  per profile in the seed script, so they can never drift out of sync with
  each other. `points` is consumed directly by
  `components/studio/CanonicalProfileDiagram.tsx` and by FlashDraft's
  `?loadCanonical=1` load path (`app/studio/draft/page.tsx`); `bends` is
  display/provenance data (the per-step breakdown in
  `components/studio/CanonicalProfileBrowser.tsx`'s card modal), not a data
  path FlashDraft loading uses — see STATE_OF_THE_BUILD.md's CANONICAL
  PROFILE LIBRARY section for why.
- Served by `app/api/studio/canonical-profiles/route.ts` (GET, service-role
  client, `category`/`search` query params, ordered by `sort_order`).

---

## DELIVERY TRACKING + EMPLOYEE PWA TABLES (migration 007_delivery_tracking.sql)

Backs SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md — the customer-facing
delivery tracking map (`/track/[orderId]`), the operator-facing Employee
PWA (`/employee`), and the GBP photo review queue inside the Command
Center CRM. Three new tables, five new columns on `orders`, and a new
`'operator'` profile role.

```sql
CREATE TABLE driver_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    UUID REFERENCES profiles(id),
  order_id     UUID REFERENCES orders(id),
  lat          DECIMAL(10,7) NOT NULL,
  lng          DECIMAL(10,7) NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: operator/admin can INSERT their own rows (auth.uid() = driver_id).
-- No direct SELECT policy for anon/public — see get_tracking_data() below.

CREATE TABLE delivery_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) UNIQUE,
  ten_mile_sent       BOOLEAN NOT NULL DEFAULT false,
  ten_mile_sent_at    TIMESTAMPTZ,
  dispatch_sms_sent   BOOLEAN NOT NULL DEFAULT false,
  dispatch_email_sent BOOLEAN NOT NULL DEFAULT false,
  invoice_sent        BOOLEAN NOT NULL DEFAULT false
);
-- RLS: admin only (FOR ALL) — same precedent as the pre-existing
-- `notifications` table; every write happens server-side via the
-- service-role client.

CREATE TABLE gbp_photo_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queued_by    UUID REFERENCES profiles(id),
  storage_key  TEXT NOT NULL,
  caption      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending_review'
               CHECK (status IN ('pending_review','approved','rejected','posted')),
  queued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES profiles(id),
  posted_at    TIMESTAMPTZ
);
-- RLS: operator/admin can INSERT their own row (queued_by = auth.uid());
-- operator/admin can SELECT/UPDATE all rows — the queue is shared, not
-- per-uploader-owned, since both operators review each other's photos.

ALTER TABLE orders
  ADD COLUMN packaged_at        TIMESTAMPTZ,
  ADD COLUMN dispatched_at      TIMESTAMPTZ,
  ADD COLUMN delivered_at       TIMESTAMPTZ,
  ADD COLUMN assigned_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN tracking_token     TEXT UNIQUE DEFAULT gen_random_uuid()::text;
```

**`is_operator()`** — a new `SECURITY DEFINER` helper (`supabase/migrations
/007_delivery_tracking.sql`), matching `is_admin()`'s existing pattern from
001_initial_schema.sql: `SELECT EXISTS (SELECT 1 FROM profiles WHERE id =
auth.uid() AND role IN ('operator', 'admin'))`. Used by every RLS policy
above instead of repeating the `EXISTS (...)` subquery inline. Admin is
included so an admin can do anything an operator can, matching the spec's
own "admin/operator" phrasing for CRM tab access.

**`get_tracking_data(p_tracking_token TEXT)`** — a `SECURITY DEFINER`
function, not an RLS policy, backing the public (unauthenticated)
`/track/[orderId]` page. Per the spec's own instruction ("use a function or
join — no direct token exposure"), the token match happens inside this
function rather than in a `USING()` clause on `driver_locations`, so no
anon-facing `SELECT` grant is ever needed on the table itself. Returns the
order's id/status/delivery_address joined (via `LEFT JOIN LATERAL`) to only
the single most recent `driver_locations` row for that order — never the
full location history. Granted `EXECUTE` to `anon` and `authenticated`.

**`profiles.role`** — `'operator'` added as a permitted value.
**Deviation from the spec, confirmed against the real schema before
writing the migration:** SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md ??6
says `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operator'`, but per
TABLE 1 above, `profiles.role` has never been a Postgres enum — it's
always been `TEXT` with an inline, unnamed `CHECK (role IN (...))`
constraint, so that statement would fail outright (`user_role` doesn't
exist as a type in this schema). The migration instead uses a `DO` block
that looks up the real, Postgres-auto-generated CHECK constraint name on
`profiles.role` via `pg_constraint` at apply time, drops it, and re-adds it
with `'operator'` appended — rather than hardcoding a guessed name (e.g.
`profiles_role_check`), which would risk silently no-op-ing via `DROP
CONSTRAINT IF EXISTS` and leaving the old, narrower constraint in place if
the guess were wrong. `profiles.role` now allows: `admin`, `contractor`,
`architect`, `customer`, `operator`.

**Known gap, not addressed by this migration:** `orders.status`'s existing
`CHECK` constraint (TABLE 18 above:
`submitted/received/in_queue/cutting/bending/qc/ready/shipped/delivered/
cancelled`) does not include the Employee PWA's own status vocabulary ???
SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md ??3 references `packaged` and
`out_for_delivery` (and `in_production`, used loosely) as order **status**
values, not just as the timestamp columns this migration adds. Only the 5
columns explicitly specified were added here; widening the live
`orders.status` CHECK constraint is a real follow-up, deliberately left
out of this migration rather than silently expanded beyond the requested
column list.

---

## BID MONITOR TABLES (migration 010_bid_monitor.sql)

Internal AFS sales-ops tool — tracks government/commercial procurement
portals, discovers individual bid opportunities from them, flags the ones
relevant to flashing/sheet-metal/Division 07 work by keyword match, and
logs notifications sent about them. Never customer-facing — every table
is admin-only (`FOR ALL` RLS, same `admin_all_*` pattern used throughout
this schema), matching the internal-only precedent already set by
`pricing_rules`/`commodity_prices`/`admin_audit_log`.

```sql
CREATE TABLE bid_sources (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  source_type             TEXT NOT NULL
                          CHECK (source_type IN (
                            'federal','state','city','county','dot','planroom','exchange'
                          )),
  state                   TEXT,
  url                     TEXT NOT NULL,
  api_url                 TEXT,
  api_key_env             TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  is_free                 BOOLEAN NOT NULL DEFAULT true,
  requires_membership     BOOLEAN NOT NULL DEFAULT false,
  membership_cost_annual  INTEGER,
  notes                   TEXT,
  last_checked_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bid_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           UUID REFERENCES bid_sources(id),
  external_id         TEXT,                          -- ID from the source system
  title               TEXT NOT NULL,
  description         TEXT,
  agency              TEXT,
  location_city       TEXT,
  location_state      TEXT,
  location_address    TEXT,
  bid_due_date        TIMESTAMPTZ,
  pre_bid_date        TIMESTAMPTZ,
  estimated_value     BIGINT,                        -- cents
  project_type        TEXT
                      CHECK (project_type IN (
                        'roofing','flashing','sheet_metal','general_construction','other'
                      )),
  division7_relevant  BOOLEAN NOT NULL DEFAULT false,
  keywords_matched    TEXT[],
  source_url          TEXT,
  raw_data            JSONB,                         -- full response from source
  status              TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN (
                        'new','reviewing','bidding','bid_submitted',
                        'won','lost','passed','expired'
                      )),
  assigned_to         UUID REFERENCES profiles(id),
  internal_notes      TEXT,
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bid_submitted_at    TIMESTAMPTZ,
  result_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_id)
);

CREATE TABLE bid_keywords (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword      TEXT NOT NULL UNIQUE,
  category     TEXT CHECK (category IN ('profile','material','division','trade')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  match_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bid_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES bid_projects(id),
  alert_type  TEXT CHECK (alert_type IN ('new_match','bid_due_soon','status_change')),
  sent_to     TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);
-- RLS on all 4 tables: admin only (FOR ALL), via the standard
-- EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
-- pattern.
```

**CHECK constraints** on every enum-like text column (`source_type`,
`project_type`, `status`, `category`, `alert_type`) were added beyond the
task's literal column list — not explicitly requested, but every other
status/type column in this schema (001–009) has one, and every seeded
value already falls inside its own enum, so this costs nothing at seed
time.

**Seed data:** `bid_keywords` seeded with 30 rows (trade/profile/
division/material terms — flashing, coping cap, Division 07, copper
flashing, etc.). `bid_sources` seeded with 81 rows: 2 federal (SAM.gov,
USASpending.gov), Texas ESBD + TxDOT, 11 Texas cities, 4 Texas counties,
49 other state procurement portals (all states except Texas, already
covered), 3 free plan-room/bid-board sites, and 10 state DOT letting
portals (including a second, differently-named `TxDOT` row alongside
`TxDOT Letting Calendar` — both given explicitly in the seed spec; kept
as two rows since `bid_sources.name` has no uniqueness constraint and
nothing in the spec asked to dedupe them).

**Seed column-mapping judgment call:** the seed spec gave 10 positional
values per `bid_sources` row (name, source_type, state, url, api_url,
api_key_env, is_active, `<bool>`, membership_cost_annual, notes), with
that 8th value always `false` and `membership_cost_annual` always
`null` — on every single row, including ones whose own notes describe
the source as free ("Free for subcontractors," "Free public API
available," "Free bid invitation tier"). Mapped literally onto `is_free`,
that would mark all 81 sources as *not* free, contradicting every note.
Mapped onto `requires_membership` instead (also always false/null in the
seed, and consistent with every note), it's self-consistent — so that's
the mapping used in `010_bid_monitor.sql`, leaving `is_free` at its
schema default (`true`) for all 81 rows.

---

## BID DOCUMENT TABLES (migration 013_bid_documents.sql)

Backs project-level GC bid pricing — see `BID_DOCUMENT_SCOPE.md` for the
full decision record; this section only restates the resulting schema, not
the reasoning behind it. Four new tables, deliberately independent of
`bid_projects`/`bid_sources` (BID MONITOR TABLES above — a different
feature that discovers procurement opportunities, not one that prices a
GC bid) and of `quote_requests`/`quotes`/`quote_line_items` (TABLE 15–17 —
shaped around one flashing profile per line via a configurator; a bid
document's line items are hand-typed free-text spec strings, grouped
under work-description section headings that the quote tables have no
equivalent of at all).

```sql
CREATE TABLE bid_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_number         TEXT UNIQUE NOT NULL,       -- AFS-BID-2026-XXXXX
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','awarded','lost','expired','withdrawn')),
  project_name       TEXT NOT NULL,
  gc_name            TEXT NOT NULL,               -- free text — a GC is very often not an AFS account holder
  gc_contact_name    TEXT,
  gc_contact_email   TEXT,
  gc_contact_phone   TEXT,
  project_location   TEXT,
  bid_project_id     UUID REFERENCES bid_projects(id),  -- optional link to a Bid Monitor opportunity
  price_valid_until  DATE,
  delivery_terms     TEXT,
  tax_note           TEXT NOT NULL DEFAULT 'Price excludes applicable sales tax.',
  customer_note      TEXT,
  subtotal           DECIMAL(10,2),                -- NULL until first line item exists
  claimed_by         UUID REFERENCES profiles(id),
  claimed_at         TIMESTAMPTZ,
  last_activity_at   TIMESTAMPTZ,                  -- heartbeat; drives lazy auto-release, see below
  created_by         UUID NOT NULL REFERENCES profiles(id),
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bid_document_sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id            UUID NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
  work_description  TEXT NOT NULL,                 -- e.g. "Coping Cap — North Parapet"
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bid_document_line_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id     UUID NOT NULL REFERENCES bid_document_sections(id) ON DELETE CASCADE,
  quantity       DECIMAL(10,2) NOT NULL,
  spec_text      TEXT NOT NULL,       -- free-text dimension/spec, e.g. `24 GA GALV, 12" girth, mill finish`
  unit           TEXT NOT NULL DEFAULT 'LF',
  unit_price     DECIMAL(10,4) NOT NULL,
  extended_price DECIMAL(10,2) NOT NULL,   -- server-computed = round2(quantity * unit_price), never client-trusted
  sort_order     INTEGER NOT NULL DEFAULT 0
);

-- Ephemeral presence rows — upserted on a 20s heartbeat while the builder
-- page is mounted, best-effort deleted on unmount. Staleness (last_seen_at
-- older than 60s) is what actually drops a closed tab from the viewer
-- list, not row deletion.
CREATE TABLE bid_document_viewers (
  bid_id        UUID NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bid_id, user_id)
);
-- RLS on all 4 tables: operator/admin (FOR ALL), via
-- EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
-- — NOT the admin-only pattern quotes/pricing_rules use. Deliberate: Steve,
-- one of exactly two named pricing staff, is scoped as 'operator', not
-- 'admin' (007_delivery_tracking.sql's is_operator()), and must not be
-- locked out of a feature he's named as one of the two real users of.
```

**Claim-lock is advisory, not a security boundary.** Every operator/admin
already has full RLS read/write access to every `bid_documents` row via
the single policy above — `claimed_by`/`claimed_at`/`last_activity_at`
exist purely as a UI coordination signal ("someone else is actively
working on this"), not an access gate. Per explicit business instruction,
overriding an existing claim is not admin-gated: any eligible user can
claim, release, or take over any bid's claim, including one currently held
by someone else — there is no 409/"already claimed" response anywhere in
this design. Auto-release on inactivity is computed lazily at read time
(`isClaimActive()`, `lib/data/bid-documents.ts`, 30-minute threshold) by
comparing `last_activity_at` against `Date.now()` — exactly the pattern
`MachineBridgeStatusDot.tsx` already uses for its connection dot. No cron
job ever clears these columns; a stale claim simply reads as unclaimed
everywhere until the next successful claim overwrites it.

**Presence** (`bid_document_viewers`) reuses the same `postgres_changes`
Realtime idiom already established by `ProductionQueueRealtime.tsx` and
`DeliveryTrackingMap.tsx`'s `useLiveDriverLocation` — a plain subscription
over a real table that triggers a refetch on any change, not Supabase's
separate ephemeral Presence-channel API (grepping this repo for
`.channel(` never turns up that API anywhere).

---

## SHOP PROFILE LIBRARY TABLE (migration 016_source_tool_and_shop_profile_library.sql)

**Live-apply status per migration — see SESSION_STATE.md for the
current, individually-verified apply status of every migration; do not
assume from a file's presence on disk alone.**

**Migration 017 (`017_color_and_queue_position.sql`) adds three columns —
also FILE ONLY, not yet applied live:**
- `color TEXT` (nullable) — the metal/finish color called out at intake,
  matching the new `quote_requests.color` (TABLE 15) this same migration
  adds.
- `queue_position INTEGER` (nullable) — manual shop-floor ordering of a
  row within the queue (e.g. for Shop View's card display), independent
  of `status` and `due_date`.
- `completed_at TIMESTAMPTZ` (nullable) — timestamp of the row's
  transition to a completed status, distinct from `created_at` (when the
  row was first entered).

Not shown in the `CREATE TABLE` below since all three were added after
this table was originally designed — they are real columns on the live
schema once 017 is applied.

**Migration 018 (`018_job_identity_and_finish.sql`) adds five columns —
FILE ONLY, not yet applied live, all new (none of the five pre-existed
this table — verified directly against migrations 016 and 017, the only
prior migrations touching this table):**
- `client_business_name TEXT` (nullable) — the client's business name.
- `client_name TEXT` (nullable) — the individual contact's name.
- `po_number TEXT` (nullable) — the customer's PO number for this job.
- `requested_by TEXT` (nullable) — who requested the job.
- `finish TEXT` (nullable) — finish spec called out at intake.

All five match the identically-named fields migration 018 also adds to
`quote_requests` (TABLE 15) — except `po_number`, which is new here but
pre-existed on `quote_requests` (see TABLE 15's own pre-existing-column
note). Not shown in the `CREATE TABLE` below since all five were added
after this table was originally designed. **Migration 018 is CONFIRMED
APPLIED LIVE** — Reid verified this migration's `quote_requests` columns
directly via `information_schema` in the Supabase Dashboard on
2026-08-22 (see SESSION_STATE.md's afs-jf-000 entry); `shop_profile_
library`'s five columns were added by the same migration file and are
real columns on the live schema now, not merely on disk.

**`requested_by TEXT` (migration 018) is DEAD — retired by migration 019,
not removed.** It was a naming mistake: the column was meant to capture a
delivery date, not a person's name. It remains in place, untouched, and
must be treated as always-null going forward — no UI or logic should read
or write it. Not to be confused with `machine_jobs.requested_by UUID
REFERENCES profiles(id)` (MACHINE BRIDGE TABLES above, an earlier and
unrelated migration, actively used) or with `quote_requests.requested_by`
(TABLE 15, also retired by migration 019, but a distinct column on a
distinct table) — three different `requested_by` columns exist across
this schema; see TABLE 15's own note for the full disambiguation.

**Migration 019 (`019_job_name_and_delivery_date.sql`) adds `job_name
TEXT` and `requested_delivery_date DATE`** (both nullable, additive `ADD
COLUMN IF NOT EXISTS`, no defaults) — both genuinely new on this table
(no pre-existing equivalent, unlike `quote_requests`; see below).
`job_name` is the project/job name, matching the identically-named field
migration 019 also adds to `quote_requests` (TABLE 15). Not shown in the
`CREATE TABLE` below since both were added after this table was
originally designed. **CONFIRMED APPLIED LIVE 2026-08-23** — verified via
`information_schema`; see SESSION_STATE.md's afs-jf-004 entry.

**`requested_delivery_date` vs. `quote_requests.requested_delivery` —
naming asymmetry, intentional, not an oversight:** both capture the same
real-world concept (what the customer asks for at intake), but the column
names differ across the two tables. `quote_requests` already had a
`requested_delivery DATE` column (pre-existing, `001_initial_schema.sql`)
before migration 019 — reused rather than duplicated with a second,
differently-named column. `shop_profile_library` had no equivalent
pre-existing column, so `requested_delivery_date` is new here. The `_date`
suffix on this table's column and its absence on `quote_requests`' is the
only difference; both mean the same thing.

**`requested_delivery_date` vs. `due_date` (migration 016) — distinct
concepts, not duplicates:** `requested_delivery_date` is what the
customer asks for at intake, captured from the same FlashDraft field that
(per the naming-asymmetry decision above) writes `quote_requests.
requested_delivery` on that table instead. `due_date` is the shop's own
committed date — what Steve sets/confirms in Command Center — and may
differ from what the customer originally requested. The same distinction
applies to `quote_requests.requested_delivery` relative to any date the
shop later commits to elsewhere in the order/machine-job lifecycle.

An admin-only, internal shop record of a profile job's full intake
context — customer/account info, material/geometry, hem/paint
instructions, and machine-routing identifiers — independent of both
`quote_requests` (TABLE 15, a customer-facing RFQ submission) and
`machine_jobs` (MACHINE BRIDGE TABLES above, the approval → generation →
delivery lifecycle for one bend program). `quote_request_id` and
`machine_job_id` are both nullable FKs, not a required link: a row can
exist with no matching quote request or machine job at all (e.g. a job
phoned or walked in and entered directly by shop staff), and can
optionally reference either or both when it does trace back to an online
submission and/or a real bend program.

```sql
CREATE TABLE shop_profile_library (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id      UUID REFERENCES quote_requests(id),
  machine_job_id        UUID REFERENCES machine_jobs(id),
  order_number          TEXT,
  profile_name          TEXT,
  customer_name         TEXT,
  company               TEXT,
  customer_email        TEXT,
  customer_phone        TEXT,
  account_notes         TEXT,
  material              TEXT,
  gauge                 TEXT,
  quantity              INTEGER,
  length_ft             NUMERIC,
  due_date              DATE,
  hem_instructions      TEXT,
  painted_edge          BOOLEAN DEFAULT false,
  special_instructions  TEXT,
  geometry_points       JSONB,   -- FlashDraft-style drawn point sequence, if captured
  geometry_svg          TEXT,    -- rendered SVG snapshot of the geometry, if captured
  source_tool           TEXT,    -- which intake tool produced this row
  pathfinder_profile_id TEXT,    -- PathfinderEdge profile id, if pushed there
  status                TEXT DEFAULT 'queued',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ  -- soft-delete marker; no hard-delete path
);
```

**Indexes:** `customer_name`, `profile_name`, `status`, `due_date`,
`created_at` — one plain B-tree index per column, matching this schema's
established one-index-per-filter-column convention (see e.g.
`bid_projects`' `status`/`bid_due_date`/`discovered_at` indexes in
migration 010).

**RLS: admin only** — `FOR ALL USING (EXISTS (SELECT 1 FROM profiles
WHERE id = auth.uid() AND role = 'admin'))`, the same inline admin-only
pattern `machine_jobs` (migration 005) uses, not the operator-inclusive
pattern `bid_documents` (migration 013) uses — this is an internal shop
record, not a feature any `operator`-role staff member is named as a user
of.

---

## PROFILE PASSPORT TABLES (migration 023_profile_passport.sql)

**FILE ONLY — not applied to the live Supabase project.** The repo has no
`supabase/config.toml`/`project-ref` (not linked) and `.env.local` has no
`SUPABASE_ACCESS_TOKEN`; a `supabase link --project-ref <afs-ref>` attempt
in the session that wrote this migration failed outright (`.env.local`
parse error, and the CLI's already-authenticated account has no access to
the AFS project ref regardless). Neither apply path in
SPEC_SUPABASE_INTEGRATION.md §5 is available. See STATE_OF_THE_BUILD.md's
PROFILE PASSPORT entry for the full detail — do not run `pnpm supabase db
push` against this assuming it will silently no-op; it will fail for the
same reason.

Backs SPEC_CUSTOM_PROFILE_LIBRARY.md's `/architects/custom-profiles`
saved-profile feature with real per-customer records (that spec's page
currently reads only `saved_configurations` and `order_line_items` — wiring
it to `custom_profiles` is separate, later work, not part of this
migration).

**`customer_id` FK target — read this before assuming `orders.customer_id`
exists, it does not:** there is no `customers` table anywhere in this
schema, and `orders` (TABLE 18) has no column literally named
`customer_id` — it identifies its owning customer via `user_id UUID NOT
NULL REFERENCES profiles(id)`. `companies` (TABLE 2) is a separate,
optional grouping reached only through `profiles.company_id`; orders does
not reference `companies` directly. `custom_profiles.customer_id` below
targets `profiles(id)` — the same FK target orders' own customer-
identifying column (`user_id`) points to — matching every other
user-scoped table in this schema (`projects`, `quote_requests`,
`takeoff_uploads`, `vault_documents` all key off `profiles(id)` directly,
never `companies(id)`).

```sql
CREATE TABLE custom_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES profiles(id),
  afs_number      TEXT NOT NULL,
  title           TEXT NOT NULL,
  material        TEXT NOT NULL,
  gauge           TEXT,
  finish          TEXT,
  drawing_url     TEXT,
  model_3d_url    TEXT,
  bend_schedule   JSONB,
  thumbnail_url   TEXT,
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_profiles_customer ON custom_profiles(customer_id);
CREATE INDEX idx_custom_profiles_afs_number ON custom_profiles(afs_number);

-- No updated_at trigger function exists anywhere else in this schema
-- (every other updated_at column is set manually by application code);
-- this one is scoped to custom_profiles only.
CREATE TRIGGER trg_custom_profiles_updated_at
  BEFORE UPDATE ON custom_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_custom_profiles_updated_at();

ALTER TABLE custom_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_custom_profiles" ON custom_profiles
  FOR ALL USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "admin_all_custom_profiles" ON custom_profiles
  FOR ALL USING (is_admin());

CREATE TABLE profile_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL REFERENCES custom_profiles(id) ON DELETE CASCADE,
  revision_number     INTEGER NOT NULL,
  changes             JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id  UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE (profile_id, revision_number)  -- also serves as the (profile_id, revision_number) index
);

ALTER TABLE profile_revisions ENABLE ROW LEVEL SECURITY;
-- No customer_id of its own — scoped through the parent custom_profiles
-- row, same join-through-parent shape as quote_line_items/order_line_items.
CREATE POLICY "users_own_profile_revisions" ON profile_revisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM custom_profiles WHERE id = profile_id AND customer_id = auth.uid())
  );
CREATE POLICY "admin_all_profile_revisions" ON profile_revisions
  FOR ALL USING (is_admin());
```

**RLS pattern note:** `users_own_custom_profiles` mirrors orders' actual
`users_own_orders` policy shape — a direct `auth.uid() = user_id`-style
match — not a companies-membership `EXISTS` join. Orders itself does not
use a company-membership pattern, so this migration doesn't invent one.

## PRICE BOOK, PRICING LEDGER, INVOICES AND THE APPROVE LINK
### (migrations 035_price_book_ledger_quotes_invoices.sql, 036_price_book_test_tag.sql)

**Applied live and verified 2026-09-30 (Command Center V2, prompt v2-03).** Both
migrations were applied twice in a row with no error; every column below was
read back out of `information_schema.columns`, every policy out of
`pg_policies`, and the append-only refusal was exercised against the live
database rather than asserted from the file.

Everything here is **ADMIN-ONLY** except `invoices`, where the customer who owns
an invoice may read their own row. CLAUDE.md's business rule is unchanged: a
customer sees a dollar amount only on a formal AFS-generated quote or invoice
delivered to them. The price book and the ledger are back-office.

---

### TABLE — price_book_items

The IDENTITY of a line in Steve's price book: one material + gauge. It can be
added and it can be RETIRED. Retiring never deletes, because a quote issued last
year was built on it.

```sql
CREATE TABLE price_book_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material      text NOT NULL,
  gauge         text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  retired_at    timestamptz,
  retired_by    uuid REFERENCES profiles(id),
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  test_tag      text,                       -- migration 036; NULL on every production row
  CONSTRAINT price_book_items_material_gauge_key UNIQUE (material, gauge)
);
ALTER TABLE price_book_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_price_book_items ON price_book_items FOR ALL USING (is_admin());
```

**Seeded with 24 rows and NOT ONE PRICE** — one per real material × active
gauge, taken from the `materials`/`gauges` catalog that already existed. Every
cell starts as a marked blank for Steve to fill in.

---

### TABLE — price_book_versions

WHAT IT COST, FROM WHEN. **An edit INSERTS a row; it never updates one.**

```sql
CREATE TABLE price_book_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          uuid NOT NULL REFERENCES price_book_items(id) ON DELETE RESTRICT,
  sheet_cost_cents integer,      -- ONE 10 ft x 4 ft sheet. NULL = blank.
  per_bend_cents   integer,      -- NULL = blank.
  per_hem_cents    integer,      -- NULL = blank.
  extras_cents     integer,      -- NULL = blank (and a row with no extras is still "priced").
  extras_note      text,
  effective_from   date NOT NULL,
  note             text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  test_tag         text,         -- migration 036; NULL on every production row
  CONSTRAINT price_book_versions_item_effective_key UNIQUE (item_id, effective_from),
  CONSTRAINT price_book_versions_non_negative CHECK (
    (sheet_cost_cents IS NULL OR sheet_cost_cents >= 0)
    AND (per_bend_cents IS NULL OR per_bend_cents >= 0)
    AND (per_hem_cents  IS NULL OR per_hem_cents  >= 0)
    AND (extras_cents   IS NULL OR extras_cents   >= 0)
  )
);
CREATE INDEX idx_price_book_versions_item_effective ON price_book_versions (item_id, effective_from DESC);
ALTER TABLE price_book_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_price_book_versions ON price_book_versions FOR ALL USING (is_admin());

CREATE TRIGGER price_book_versions_append_only
  BEFORE UPDATE OR DELETE ON price_book_versions
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();
```

**PRICES START EMPTY, AND A BLANK IS NEVER A ZERO.** Every money column is
NULLABLE with NO DEFAULT. `NULL` means "Steve has not filled this in": the
editor renders it as a marked **"Not set"** chip, and `lib/pricing/quote-math.ts`
refuses to issue a quote that needs it, in a sentence naming the row to fix.
There is deliberately no `DEFAULT 0` anywhere — a zero is a price, and a made-up
one.

**Which version is in force** is `lib/pricing/price-book.ts`'s `versionInForce`:
the latest `effective_from` that is not in the future relative to the date being
priced. A version dated tomorrow is not in force today, which is what makes
"enter next month's increase now" safe.

---

### THE APPEND-ONLY GUARANTEE — `afs_append_only()`

```sql
CREATE OR REPLACE FUNCTION afs_append_only() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' AND (to_jsonb(OLD) ->> 'test_tag') IS NOT NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'APPEND ONLY: % on % is refused. This table is the pricing history; a row is never changed or removed once written.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '42501';
END $fn$;
```

A BEFORE UPDATE OR DELETE trigger that raises. **It binds the table owner and
the service role too, which a REVOKE would not** — this is not a permission a
privileged connection can step around, it is a refusal. Exercised live:

```
UPDATE -> BLOCKED sqlstate=42501 :: APPEND ONLY: UPDATE on pricing_ledger is refused...
DELETE -> BLOCKED sqlstate=42501 :: APPEND ONLY: DELETE on pricing_ledger is refused...
```

**`to_jsonb(OLD) ->> 'test_tag'` rather than `OLD.test_tag`, and that matters.**
One function guards two tables and only one of them had that column at first.
PL/pgSQL compiles an `IF` condition into a single SQL expression and plans the
WHOLE thing, so `TG_TABLE_NAME = 'pricing_ledger' AND OLD.test_tag IS NOT NULL`
does **not** short-circuit — on `price_book_versions` the direct reference failed
`42703 undefined_column`, turning a refusal into the wrong error. A unit test
found that, not a reading of the file. Going through jsonb is column-agnostic
and cannot regress that way.

**THE TEST-TAG ESCAPE, AND WHY IT IS NOT A HOLE.** A row whose `test_tag` is not
NULL may be DELETED (never updated — UPDATE is refused on every row, tagged or
not). `test_tag` is written by exactly one code path, `lib/pricing/ledger.ts`'s
`ledgerTestTag()`, which returns a tag ONLY for a job whose name starts with the
reserved literal prefix `E2E-TEST-`; and a tagged row is excluded from the
`pricing_ledger_real` view and from the CSV export, so it can never reach the
dataset dynamic pricing learns from. The alternative was an end-to-end test that
either left fake prices in the shop's real price book forever, or never proved
the quote path at all.

---

### TABLE — pricing_ledger (APPEND-ONLY)

The dataset the future dynamic pricing engine will learn from. ONE table, so
"what did we quote, what did it cost us, and did they say yes" is one query.

```sql
CREATE TABLE pricing_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        text NOT NULL,     -- see the CHECK below
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  recorded_at       timestamptz NOT NULL DEFAULT now(),

  -- WHO
  actor_id          uuid REFERENCES profiles(id),
  actor_email       text,
  actor_role        text,
  source            text NOT NULL DEFAULT 'admin_ui',

  -- WHAT IT IS ABOUT
  quote_request_id  uuid,
  quote_id          uuid,
  invoice_id        uuid,
  customer_id       uuid REFERENCES profiles(id),
  customer_label    text,

  -- THE SHAPE THAT WAS PRICED
  material          text,
  gauge             text,
  blank_width_in    numeric,
  bend_count        integer,
  hem_count         integer,
  length_ft         numeric,
  quantity          integer,
  is_rush           boolean,

  -- THE PRICES USED, AND THE PRICE-BOOK VERSION THEY CAME FROM
  price_book_version_ids uuid[],
  prices_used       jsonb,
  amount_cents      bigint,
  revision          integer,

  -- THE OUTCOME
  outcome           text,              -- approved | declined | expired
  outcome_reason    text,
  time_to_decision_seconds integer,

  -- A CHANGE: OLD VALUE -> NEW VALUE
  old_value         jsonb,
  new_value         jsonb,

  -- A SUPPLIER PRICE-CHANGE NOTICE
  supplier_name     text,
  old_cost_cents    bigint,
  new_cost_cents    bigint,
  effective_date    date,
  attachment_path   text,              -- private `documents` bucket path; NEVER the bytes

  note              text,
  payload           jsonb,

  -- IMPORT / DEDUPLICATION
  import_batch_id   text,
  external_ref      text,

  test_tag          text,              -- NULL on every production row

  CONSTRAINT pricing_ledger_event_type_check CHECK (event_type IN (
    'estimate', 'quote_issued', 'quote_revised', 'quote_outcome',
    'invoice_issued', 'invoice_paid', 'price_book_change', 'supplier_price_change')),
  CONSTRAINT pricing_ledger_source_check CHECK (source IN (
    'admin_ui', 'customer_link', 'mail_parser', 'import', 'system')),
  CONSTRAINT pricing_ledger_outcome_check CHECK (
    outcome IS NULL OR outcome IN ('approved', 'declined', 'expired')),
  -- An outcome event must SAY what the outcome was. Nothing else may.
  CONSTRAINT pricing_ledger_outcome_belongs_to_outcome_event CHECK (
    (event_type = 'quote_outcome' AND outcome IS NOT NULL)
    OR (event_type <> 'quote_outcome' AND outcome IS NULL)),
  -- An imported row must name its batch, so a bad import is identifiable.
  CONSTRAINT pricing_ledger_import_needs_batch CHECK (
    source <> 'import' OR import_batch_id IS NOT NULL)
);

CREATE INDEX idx_pricing_ledger_occurred   ON pricing_ledger (occurred_at DESC);
CREATE INDEX idx_pricing_ledger_event_type ON pricing_ledger (event_type, occurred_at DESC);
CREATE INDEX idx_pricing_ledger_quote      ON pricing_ledger (quote_id)         WHERE quote_id IS NOT NULL;
CREATE INDEX idx_pricing_ledger_request    ON pricing_ledger (quote_request_id) WHERE quote_request_id IS NOT NULL;
CREATE INDEX idx_pricing_ledger_material   ON pricing_ledger (material, gauge)  WHERE material IS NOT NULL;
-- One inbound notice imports exactly once, however many times a parser runs.
CREATE UNIQUE INDEX uq_pricing_ledger_external_ref
  ON pricing_ledger (source, external_ref) WHERE external_ref IS NOT NULL;

CREATE TRIGGER pricing_ledger_append_only
  BEFORE UPDATE OR DELETE ON pricing_ledger
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

-- The analytics surface and the CSV export read THIS, never the table.
CREATE VIEW pricing_ledger_real AS SELECT * FROM pricing_ledger WHERE test_tag IS NULL;
```

**RLS — SELECT AND INSERT ONLY, DELIBERATELY:**

```sql
ALTER TABLE pricing_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_pricing_ledger   ON pricing_ledger FOR SELECT USING (is_admin());
CREATE POLICY admin_insert_pricing_ledger ON pricing_ledger FOR INSERT WITH CHECK (is_admin());
-- There is NO UPDATE policy and NO DELETE policy, on purpose: even an admin
-- session has no policy that would let one through if the trigger were ever
-- dropped. Two independent refusals, not one.
```

Verified live: `select cmd from pg_policies where tablename='pricing_ledger'`
returns exactly `INSERT` and `SELECT`.

---

### PRICING LEDGER IMPORT FORMAT
### (historical spreadsheets and QuickBooks exports)

The ledger is designed for **four** writers, and two of them do not exist yet.

| `source` | Who writes it | Status |
|---|---|---|
| `admin_ui` | Steve, through the Command Center and the Settings forms | LIVE |
| `customer_link` | the signed Approve button in the quote email | LIVE |
| `mail_parser` | **DEFERRED Phase 4** — the Outlook inbound parser | designed for, not built |
| `import` | historical spreadsheets and QuickBooks exports | format frozen here |

**(a) THE DEFERRED PHASE 4 MAIL PARSER.** When it lands it writes supplier
notices straight into this table with `source = 'mail_parser'` and
`external_ref` set to the Microsoft Graph `internetMessageId`. The unique index
`uq_pricing_ledger_external_ref` makes that import idempotent, so re-running the
parser over the same mailbox cannot double-count a price rise. **Nothing in the
table or in `lib/pricing/ledger.ts` has to change for it** — that is the point of
agreeing the shape now rather than when the parser is written. It uses exactly
the fields the Settings form already uses: `supplier_name`, `material`, `gauge`,
`old_cost_cents`, `new_cost_cents`, `effective_date`, `note`, `attachment_path`.

**(b) HISTORICAL SPREADSHEETS AND QUICKBOOKS EXPORTS.** `source = 'import'` plus
an `import_batch_id` naming the file — required by a CHECK constraint so a bad
import is always identifiable afterwards. An import **cannot be deleted**
(nothing here can); a wrong batch is superseded by a corrected one, and the
`import_batch_id` says which is which.

**The CSV column order below is exactly `LEDGER_CSV_COLUMNS` in
`lib/pricing/ledger.ts`, which is also what the export writes** — so an export
can be corrected in a spreadsheet and re-imported with no mapping step. Import
by that header row; unknown columns are ignored, missing ones are NULL.

| CSV header | Column | Type | Required? |
|---|---|---|---|
| When | `occurred_at` | timestamptz | yes — the date the thing happened, not the date it was imported |
| What happened | `event_type` | text | yes — one of the eight in the CHECK |
| Where it came from | `source` | text | set to `import` |
| Who | `actor_email` | text | no |
| Customer | `customer_label` | text | recommended — free text is fine for history |
| Material | `material` | text | recommended |
| Gauge | `gauge` | text | no |
| Blank width (in) | `blank_width_in` | numeric | no |
| Bends | `bend_count` | integer | no |
| Hems | `hem_count` | integer | no |
| Length (ft) | `length_ft` | numeric | no |
| Quantity | `quantity` | integer | no |
| Rush | `is_rush` | boolean (`yes`/`no`) | no |
| Revision | `revision` | integer | no |
| Amount (cents) | `amount_cents` | bigint — **CENTS, not dollars** | yes for a quote/invoice row |
| Outcome | `outcome` | `approved`/`declined`/`expired` | required iff `event_type = 'quote_outcome'`, forbidden otherwise |
| Reason | `outcome_reason` | text | no |
| Time to decision (s) | `time_to_decision_seconds` | integer | no |
| Supplier | `supplier_name` | text | yes for `supplier_price_change` |
| Old cost (cents) | `old_cost_cents` | bigint | no |
| New cost (cents) | `new_cost_cents` | bigint | yes for `supplier_price_change` |
| Effective date | `effective_date` | date | yes for `supplier_price_change` |
| Price book version(s) | `price_book_version_ids` | uuid[] | leave blank for history that predates the price book |
| Prices used | `prices_used` | jsonb | no |
| Old value | `old_value` | jsonb | yes for `price_book_change` |
| New value | `new_value` | jsonb | yes for `price_book_change` |
| Import batch | `import_batch_id` | text | **yes** — the CHECK constraint refuses an import without it |
| External reference | `external_ref` | text | recommended — the source row's own id, so a re-import is idempotent |
| Note | `note` | text | no |
| Job id / Quote id / Invoice id | `quote_request_id` / `quote_id` / `invoice_id` | uuid | only when the historical row really maps to an existing record |
| Ledger id | `id` | uuid | omit — the database assigns it |

**Money is CENTS in this table, everywhere.** A QuickBooks export in dollars must
be multiplied by 100 on the way in; a half-cent in the source is a data problem
to resolve before importing, not something to round silently.

---

### TABLE — invoices

**The table five already-built routes were missing** —
docs/COMMAND_CENTER_V2_SPEC.md §2.5's top risk.

**What the v2-03 audit actually found is narrower than the spec says, and the
difference matters.** `app/api/invoices/[id]/pdf`, `.../send`,
`app/api/invoices/statement`, `app/api/admin/invoices/[id]/mark-paid` and
`app/account/invoices` were **not broken**: they were built against `orders`,
with `lib/data/invoices.ts` deriving an invoice 1:1 from an order, and that
worked. What did not exist was **an invoice as a record in its own right** — one
a quote becomes on approval, for a job that never went through checkout.

Those routes now resolve an id to a real `invoices` row FIRST and fall back to
the order derivation, so both kinds work and an order that has a real invoice
never appears twice in a customer's list.

```sql
CREATE TABLE invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text NOT NULL UNIQUE,        -- AFS-INV-<year>-<00001>
  quote_id          uuid REFERENCES quotes(id),
  quote_request_id  uuid REFERENCES quote_requests(id),
  order_id          uuid REFERENCES orders(id),  -- NULL for an invoice raised from a quote

  user_id           uuid REFERENCES profiles(id), -- NULL for a guest
  customer_email    text,
  customer_name     text,
  customer_company  text,

  status            text NOT NULL DEFAULT 'issued',

  subtotal_cents    bigint NOT NULL,
  tax_cents         bigint NOT NULL DEFAULT 0,
  freight_cents     bigint NOT NULL DEFAULT 0,
  total_cents       bigint NOT NULL,

  -- FROZEN AT CREATION. Copied from the quote, never re-derived.
  line_items            jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_book_snapshot   jsonb,

  issued_at         timestamptz NOT NULL DEFAULT now(),
  due_date          date,
  net_terms         integer NOT NULL DEFAULT 0,
  paid_at           timestamptz,
  po_number         text,

  office_emailed_to text,          -- the automatic copy to the office (Tricia)
  office_emailed_at timestamptz,

  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoices_status_check CHECK (status IN ('issued','sent','paid','void')),
  CONSTRAINT invoices_totals_non_negative CHECK (
    subtotal_cents >= 0 AND tax_cents >= 0 AND freight_cents >= 0 AND total_cents >= 0),
  -- ONE INVOICE PER QUOTE. Clicking Approve twice cannot bill twice.
  CONSTRAINT invoices_quote_id_key UNIQUE (quote_id)
);

CREATE INDEX idx_invoices_user    ON invoices (user_id, issued_at DESC);
CREATE INDEX idx_invoices_request ON invoices (quote_request_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_invoices ON invoices FOR ALL USING (is_admin());
CREATE POLICY users_own_invoices ON invoices FOR SELECT
  USING (auth.uid() = user_id AND status <> 'void');
```

**THE QUOTE BECOMES THE INVOICE WITH NO RETYPING.** `line_items`,
`subtotal_cents`, `total_cents` and `price_book_snapshot` are COPIED from the
`quotes` row by `lib/invoices/create.ts`. Nothing is recomputed from the price
book, which may have moved since the quote was sent, and nothing is re-entered by
a human. That is the correctness property, not a convenience: a recomputed
invoice would silently bill a different number from the one the customer
approved.

---

### TABLE 16 — quotes (COLUMNS ADDED, migration 035)

The `quotes` table already existed. These are the columns a price-book quote has
that the old one did not.

```sql
ALTER TABLE quotes
  ADD COLUMN line_items          jsonb,    -- the PRICED lines, exactly as sent
  ADD COLUMN price_book_snapshot jsonb,    -- { pricedAt, versionIds[] }
  ADD COLUMN subtotal_cents      bigint,
  ADD COLUMN total_cents         bigint,
  ADD COLUMN revision            integer NOT NULL DEFAULT 1,
  ADD COLUMN supersedes_id       uuid REFERENCES quotes(id),
  ADD COLUMN customer_email      text,
  ADD COLUMN customer_name       text,
  ADD COLUMN declined_at         timestamptz,
  ADD COLUMN decline_reason      text,
  ADD COLUMN expires_at          timestamptz;

ALTER TABLE quotes ALTER COLUMN user_id DROP NOT NULL;  -- a guest still gets a quote
```

The legacy numeric `subtotal`/`total` columns stay populated so every screen
already built against `quotes` keeps working; **the `_cents` columns are the real
ones.** A REVISION IS A NEW ROW, not an edit: `revision` increments,
`supersedes_id` points at the one it replaces, the old row goes to
`status='expired'`, and its outstanding Approve links are expired with it so a
customer cannot approve a price that has been withdrawn.

---

### TABLE — quote_approval_tokens

The Approve button's link: **signed, single-use, expiring.**

```sql
CREATE TABLE quote_approval_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_request_id uuid REFERENCES quote_requests(id),
  token_hash       text NOT NULL UNIQUE,   -- ONLY the hash. Never the token.
  expires_at       timestamptz NOT NULL,
  used_at          timestamptz,            -- single use: spent by a conditional UPDATE
  used_from        text,
  issued_to        text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_approval_tokens_quote ON quote_approval_tokens (quote_id);
ALTER TABLE quote_approval_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_quote_approval_tokens ON quote_approval_tokens FOR ALL USING (is_admin());
```

**ONLY THE HASH IS STORED**, so a reader of this table — or of a stolen database
dump — can approve nothing. Single use is a conditional UPDATE
(`... WHERE id = ? AND used_at IS NULL`), so two simultaneous clicks, or a mail
client that prefetches links, cannot both win.

---

### TABLE — outbound_emails

Records the message itself, which is what makes "the invoice was emailed to
Tricia" a claim somebody can go and check. `notifications` records only that a
send was attempted and has nowhere to put what was in it.

```sql
CREATE TABLE outbound_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL,     -- quote | quote_revision | invoice_customer | invoice_office
  recipient        text NOT NULL,
  subject          text NOT NULL,
  body_html        text,
  status           text NOT NULL,
  provider_id      text,
  error            text,
  quote_id         uuid REFERENCES quotes(id)          ON DELETE SET NULL,
  quote_request_id uuid REFERENCES quote_requests(id)  ON DELETE SET NULL,
  invoice_id       uuid REFERENCES invoices(id)        ON DELETE SET NULL,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbound_emails_status_check CHECK (
    status IN ('sent','failed','captured_test_mode','not_configured'))
);
CREATE INDEX idx_outbound_emails_created ON outbound_emails (created_at DESC);
CREATE INDEX idx_outbound_emails_request ON outbound_emails (quote_request_id);
ALTER TABLE outbound_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_outbound_emails ON outbound_emails FOR ALL USING (is_admin());
```

The four statuses are four different true things:

| status | what happened |
|---|---|
| `sent` | a provider accepted it |
| `failed` | a provider refused it, and `error` says why |
| `captured_test_mode` | **no provider call was made.** The job's name carries the reserved `E2E-TEST-` prefix, or `AFS_EMAIL_TEST_MODE=1` is set locally |
| `not_configured` | `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are unset, so nothing could be sent. Recorded honestly rather than reported to the admin as success |

---

## DELIVERIES AND THE SHOP QUEUE (migration 037_deliveries_and_shop_queue.sql)

**Command Center V2 prompt v2-04 — Shop View and Deliveries.** Two additions,
both small on purpose: the shop queue already existed.

### shop_profile_library.started_at (COLUMN ADDED)

```sql
ALTER TABLE shop_profile_library ADD COLUMN IF NOT EXISTS started_at timestamptz;
```

`completed_at` already recorded the finish. Nothing recorded the START, so
"Bending now" could not say since when, and a job that had been on the machine
for ten minutes was indistinguishable from one that had been on it since
Tuesday. Written in the SAME UPDATE as the status by
`app/api/admin/shop-library/[id]/route.ts`'s PATCH, on the
`queued -> in_progress` move only — re-advancing a job that was already started
never resets its clock.

**There is no new queue table and no new status vocabulary.**
`shop_profile_library` (migration 016) is still the record of what has been sent
to the current Thalmann; `queue_position` (017) is still the order; and the
existing `queued -> in_progress -> complete` lifecycle
(`SHOP_PROFILE_LIBRARY_STATUSES`, `lib/data/shop-library.ts`) maps one-to-one
onto the approved prototype's **Queued / Bending now / Finished**.

### TABLE — deliveries

```sql
CREATE TABLE deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_job_id      uuid NOT NULL REFERENCES shop_profile_library(id) ON DELETE CASCADE,
  quote_request_id uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  scheduled_date   date NOT NULL,
  time_window      text NOT NULL,
  status           text NOT NULL DEFAULT 'scheduled',
  auto_scheduled   boolean NOT NULL DEFAULT false,
  scheduled_by     uuid REFERENCES profiles(id),
  scheduled_at     timestamptz NOT NULL DEFAULT now(),
  delivered_at     timestamptz,
  delivered_by     uuid REFERENCES profiles(id),
  notified_at      timestamptz,
  notify_note      text,
  test_tag         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_shop_job_id_key UNIQUE (shop_job_id),
  CONSTRAINT deliveries_time_window_check
    CHECK (time_window IN ('08-10','10-12','13-15','15-17')),
  CONSTRAINT deliveries_status_check CHECK (status IN ('scheduled','delivered')),
  CONSTRAINT deliveries_delivered_needs_time
    CHECK (status <> 'delivered' OR delivered_at IS NOT NULL)
);
CREATE INDEX idx_deliveries_scheduled_date     ON deliveries (scheduled_date);
CREATE INDEX idx_deliveries_quote_request_id   ON deliveries (quote_request_id);
CREATE INDEX idx_deliveries_status             ON deliveries (status);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_deliveries ON deliveries FOR ALL USING (is_admin());
```

**ONE DELIVERY PER SHOP JOB, ENFORCED BY POSTGRES.** `shop_job_id` is UNIQUE,
so a double click on Schedule delivery cannot book the same piece of work
twice — the same reason `invoices.quote_id` is unique (CLAUDE.md rule #21). A
reschedule is an UPDATE of that one row, not a second row; the E2E asserts the
count is still 1 after a change of day.

**THE WINDOW IS STORED AS A KEY, NEVER AS ITS LABEL.** `'08-10'` /
`'10-12'` / `'13-15'` / `'15-17'`; the English (`8–10 AM`, `10 AM–12 PM`,
`1–3 PM`, `3–5 PM`) lives in `lib/delivery/windows.ts` and nowhere else. A
label in a CHECK constraint would make a wording change a migration, and would
put an en dash inside a database constraint.

**`deliveries_delivered_needs_time` is not decoration.** A row claiming
delivery with nothing behind it is exactly the kind of half-written state a
screen then reports as fact. Delivered always carries the time it happened.

**`auto_scheduled` records WHY the row exists** — `true` when Mark finished
booked it for the next business day, `false` once a person picked the day. The
Deliveries screen prints "set by the shop" from it, so "nobody chose this"
stays visible rather than being inferred.

**RLS is admin-only, and that is the whole policy list.** A delivery is
back-office scheduling. The customer learns their day and window from the
notification the schedule sends, and follows the truck through the pre-existing
public tracker (`app/track/[orderId]`, backed by `orders.tracking_token` and
007's SECURITY DEFINER `get_tracking_data()`) — neither of which reads this
table. No customer-facing policy exists, deliberately: none is the correct
answer rather than a permissive one nobody needs.

**`test_tag` is the same reserved-prefix contract the pricing ledger uses.** It
is written from `ledgerTestTag(shop_profile_library.job_name)`
(`lib/pricing/ledger.ts`), which returns the first whitespace-delimited word of
a job name starting with `E2E-TEST-`. It is what makes an E2E row findable and
deletable. Unlike `pricing_ledger`, `deliveries` is mutable by design (a
reschedule is an UPDATE), so there is no append-only trigger here and no
`_real` view — a delivery feeds no analytics dataset.

### Where the next-business-day answer comes from

`lib/delivery/business-days.ts`, and only there. Two things it exists to get
right, both of which have their own test:

1. **The weekend.** Friday's next business day is MONDAY. So is Saturday's and
   Sunday's. A naive `+1 day` books a day nobody is driving.
2. **The time zone.** Vercel runs in UTC; the shop is in Burnet, Texas. A job
   finished at 7pm Central on a Tuesday is already 01:00 UTC Wednesday, so
   "tomorrow" from the raw server date would be Thursday. Every date is derived
   in `SHOP_TIME_ZONE` (`lib/utils/waiting-time.ts`).

Holidays are NOT modelled, on purpose — no holiday calendar has been supplied
(CLAUDE.md's DATA BLOCKERS), and inventing one would put a guess in the code.
Weekends are a fact; an auto-scheduled delivery is always reschedulable by hand.

## PROFILE SEARCH SHORTCUTS (migration 038_profile_search_shortcuts.sql)

Command Center V2 prompt v2-05. Two small per-admin tables, and one argument
added to an existing function. Nothing here is a new query path — the search
itself is still `admin_profile_search` from migration 029.

### TABLE — admin_recent_profiles

| Column | Type | Notes |
|---|---|---|
| `admin_id` | `uuid` NOT NULL | FK -> `profiles(id)` ON DELETE CASCADE |
| `profile_id` | `uuid` NOT NULL | FK -> `saved_configurations(id)` ON DELETE CASCADE |
| `opened_at` | `timestamptz` NOT NULL DEFAULT now() | |

PRIMARY KEY `(admin_id, profile_id)` — one row per admin per profile, so
re-opening something updates its time instead of stacking duplicates.
Index `idx_admin_recent_profiles_admin_opened (admin_id, opened_at DESC)`.

**Trimmed to the ten newest by the ROUTE, not by a trigger.** Ten is a
presentation decision (`RECENT_PROFILE_LIMIT` in `lib/data/profile-search.ts`),
and burying it in the database would make "why did my eleventh disappear" a
question only a DBA could answer.

### TABLE — admin_pinned_profiles

| Column | Type | Notes |
|---|---|---|
| `admin_id` | `uuid` NOT NULL | FK -> `profiles(id)` ON DELETE CASCADE |
| `profile_id` | `uuid` NOT NULL | FK -> `saved_configurations(id)` ON DELETE CASCADE |
| `pinned_at` | `timestamptz` NOT NULL DEFAULT now() | |

PRIMARY KEY `(admin_id, profile_id)`; index
`idx_admin_pinned_profiles_admin_pinned (admin_id, pinned_at DESC)`.

### RLS — per admin, both tables, verified live

Both have RLS enabled with exactly one `FOR ALL` policy each
(`admin_recent_profiles_own`, `admin_pinned_profiles_own`), whose USING and
WITH CHECK are identical:

```sql
admin_id = auth.uid()
AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
```

Two conditions, both required. `admin_id = auth.uid()` alone would let a
demoted account keep its lists; the role check alone would let one admin read
another's. The shortcuts route runs every statement on the CALLER's session —
never the service role — so a bug in that file cannot reach another admin's
rows; the database would refuse it.

**BOTH CASCADE FROM BOTH SIDES.** Deleting a profile must not leave a shortcut
pointing at nothing, and deleting an admin must not leave their history behind.
This also means an E2E that deletes its fixtures cleans these up for free — the
spec asserts the counts back to zero anyway rather than assuming the FK fired.

### FUNCTION CHANGE — admin_profile_search gains `p_ids uuid[]`

Full signature after 038:

```
admin_profile_search(
  p_q text, p_field text, p_material text, p_gauge text,
  p_date_from date, p_date_to date, p_status text,
  p_limit integer, p_offset integer, p_ids uuid[]
) RETURNS TABLE (... 17 columns ...)   SECURITY DEFINER
```

- `p_ids IS NULL` — no id filter, behaves exactly as before.
- `p_ids` given — `sc.id = ANY(p_ids)` REPLACES the text match entirely, and
  the rows come back **in the order given** via
  `array_position(p_ids, sc.id)`. An EMPTY array returns nothing, which is the
  honest answer for "these zero profiles" rather than a silent fallback to
  everything.

Recent and Pinned use this. A second function returning the same seventeen
columns would have been a copy of a sixty-line query that must never drift.

**DROP-then-CREATE, not CREATE OR REPLACE.** Adding an argument makes a new
signature; a replace would leave the nine-argument version in place as an
overload, and a call with all defaults would then be ambiguous. Because the
drop takes the grants with it, the migration re-applies them: REVOKE from
PUBLIC and from `anon`, GRANT EXECUTE to `authenticated`. Verified live in
`role_routine_grants` — `service_role`, `authenticated`, `postgres`; `anon` is
absent.

`thumbnail_image` is still NOT in the RETURNS TABLE, only `has_thumbnail`. The
egress rule is upheld by the function's own signature, not by every caller
remembering to omit a column.

## v2-06 (2026-09-30) — NO SCHEMA CHANGE, CHECKED RATHER THAN ASSUMED

Prompt v2-06 was hardening and consolidation: error boundaries, a 2D degrade
for a WebGL failure, a read timeout and a response parser on the
PathfinderEdge client, a Playwright baseURL fix, and an automated WCAG AA
contrast gate wired into `pnpm build`. **None of it touched the database.**

Stated as a measurement rather than as a claim: `supabase/migrations/` holds
38 files and the highest is `038_profile_search_shortcuts.sql`, which is v2-05's. No
table, view, policy, function, constraint or grant was added, altered or
dropped by v2-06, so every section above remains current. The next migration
to be written is 039.

The one adjacent thing worth recording here, because it is a schema-shaped
promise kept by code rather than by SQL: the PathfinderEdge read path now
parses vendor responses instead of casting them
(`lib/integrations/pathfinder-response.ts`). That changes nothing about what
this database stores — the profile number written to
`shop_profile_library.pathfinder_profile_id` is still either a real number
read back from the vendor or NULL — but it means a NULL there can no longer
be caused by a silently mis-parsed payload. A NULL now means what CLAUDE.md
rule #16 says it means: created, unconfirmed, do not retry.

---

## SALES TAX — `tax_nexus_states` AND `tax_calculations` (migration 039, overnight item 08-taxjar, 2026-10-03)

**MIGRATION FILE WRITTEN, NOT APPLIED.** `supabase/migrations/039_tax_nexus_and_calculations.sql`
exists and is additive; it has NOT been run against any Supabase project. The
overnight run that wrote it is forbidden from applying migrations. The highest
APPLIED migration is still `038_profile_search_shortcuts.sql`.

### TABLE — `tax_nexus_states`

Where AFS has sales tax nexus, and why. **It ships EMPTY and there is no seed
data in the migration at all.**

```sql
CREATE TABLE tax_nexus_states (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code      text NOT NULL,              -- CHECK two uppercase letters, UNIQUE
  collecting      boolean NOT NULL DEFAULT true,
  nexus_basis     text NOT NULL,              -- physical_presence | economic_threshold
                                              -- | employee_presence | voluntary
  registration_id text,                       -- NULL = not supplied
  effective_from  date NOT NULL,
  effective_to    date,                       -- NULL = still current
  note            text,
  created_by      uuid REFERENCES profiles(id),
  updated_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

**WHY IT IS EMPTY, and why that must stay true until AFS's accountant answers.**
The nexus state list is an open DATA BLOCKER (CLAUDE.md DATA BLOCKERS, checklist
#31). Nexus is established by physical presence, economic thresholds and employee
presence, none of which is derivable from this codebase. **An empty table means
"not configured" — `lib/tax/calculate.ts` answers `not_configured`, calculates
nothing and collects nothing. It does NOT mean "no tax is owed."** A seeded
starter list would make the app look configured, calculate confidently, and
collect the wrong tax in the wrong states. `lib/tax/migration-039.test.ts`
asserts the migration's INSERT count is zero.

**ONE ROW PER STATE** (`UNIQUE (state_code)`), so a double click on "Add state"
cannot create two — the same reasoning as `deliveries.shop_job_id` and
`invoices.quote_id`. A changed nexus is an UPDATE of the effective window plus an
`admin_audit_log` entry, not a second row, and **retiring never deletes**: the row
survives with `effective_to` set and `collecting = false`, so a calculation
recorded months ago still has a readable basis.

**NO VERSION TABLE, unlike the price book,** and the asymmetry is deliberate. A
price must be reproducible for a quote issued years ago, so `price_book_versions`
exists. A tax calculation is reproducible from its own snapshot in
`tax_calculations` below, so the nexus list does not need to be versioned.

**NO `company_id`, deliberately.** A tax nexus is a fact about AFS, the SELLER —
not about a customer's company. Adding one would model AFS as multi-tenant, which
it is not, and would invite a future reader to scope AFS's own legal registrations
per customer. The boundary that actually exists is RLS: admin-only, with no
`authenticated` or `anon` policy at all, exactly as migration 035 does for
`price_book_items` and `pricing_ledger`.

### TABLE — `tax_calculations`

The cache AND the record of every provider interaction, in one table. **Money is
CENTS.**

```sql
CREATE TABLE tax_calculations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key            text NOT NULL,         -- SHA-256 hex, lib/tax/cache-key.ts
  provider             text NOT NULL,
  outcome              text NOT NULL,         -- CHECK IN ('calculated','failed')
  amount_cents         bigint,                -- NULL for a failure. NEVER 0.
  rate                 numeric(8,6),
  taxable_amount_cents bigint,
  freight_taxable      boolean,
  jurisdictions        jsonb,
  to_state             text,
  to_zip               text,
  subtotal_cents       bigint NOT NULL,
  shipping_cents       bigint NOT NULL DEFAULT 0,
  customer_tax_exempt  boolean NOT NULL DEFAULT false,
  nexus_fingerprint    text,
  request_snapshot     jsonb NOT NULL,
  response_snapshot    jsonb,                 -- the vendor raw body; never the API key
  problems             jsonb,
  requires_review      boolean NOT NULL DEFAULT false,
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES profiles(id),
  review_note          text,
  quote_id             uuid REFERENCES quotes(id) ON DELETE SET NULL,
  quote_request_id     uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  expires_at           timestamptz,           -- NULL on a failure
  created_by           uuid REFERENCES profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

**THE LOAD-BEARING CONSTRAINT — the database half of "an uncalculated tax is not
a zero tax":**

```sql
CHECK ((outcome = 'calculated') = (amount_cents IS NOT NULL))
```

`lib/tax/types.ts` enforces the same rule in TypeScript by giving the two
non-answers (`not_configured`, `failed`) **no amount field at all** — not
`amountCents: null`, absent, because a nullable number is the shape a caller
writes `?? 0` against. TypeScript is erased at runtime, so Postgres holds the
same line. Two independent refusals, the same way CLAUDE.md rule #15 backs "rush
is never inferred" with a CHECK rather than trusting the writers.

**WRITTEN IN THE `IS NOT NULL` FORM ON PURPOSE.** Rule #15 records that the naive
rush CHECK was ACCEPTED for a NULL source, because `false OR UNKNOWN` is UNKNOWN
and a CHECK accepts UNKNOWN. `outcome` is NOT NULL and `amount_cents IS NOT NULL`
is always a real boolean, so this expression can never go UNKNOWN. Do not rewrite
it into a form that compares `amount_cents` with `=` or `<>`, which would.
`lib/tax/migration-039.test.ts` fails on that rewrite.

**A FAILURE IS NEVER CACHEABLE**, also by constraint —
`CHECK (outcome <> 'failed' OR expires_at IS NULL)`. Serving a cached failure
would turn one vendor blip into a day of refusals, so it is forbidden at the
database as well as in the reader.

**ONLY PROVIDER INTERACTIONS ARE STORED.** `not_configured`, `exempt` and
`no_nexus` are decided locally, cost nothing to recompute, and write no row. That
is what keeps this table meaningful: every row is a real conversation with a tax
service, so a row count is a vendor-call count and the review queue is not diluted
by local decisions.

**A CACHED FIGURE NEVER OUTLIVES THE NEXUS WINDOW BEHIND IT.** Two independent
guards, because the `nexus_fingerprint` alone cannot catch this — when a window
simply expires, the ROW has not changed, so the fingerprint and the cache key
still match. `lib/tax/service.ts` gates the lookup on the DESTINATION state's row
being in force and collecting, and `lib/tax/db.ts` caps a stored row's
`expires_at` at the window end regardless of the TTL.

Indexes: `(cache_key, expires_at)` for the cache read; `(created_at DESC) WHERE
requires_review` for the review queue; `(created_at DESC)`; `(quote_id) WHERE
quote_id IS NOT NULL`.

### RLS — both tables

```sql
ALTER TABLE tax_nexus_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_tax_nexus_states ON tax_nexus_states FOR ALL USING (is_admin());
CREATE POLICY admin_all_tax_calculations ON tax_calculations FOR ALL USING (is_admin());
```

Exactly two policies, both `is_admin()`. **No `authenticated` policy and no
`anon` policy exists**, so with RLS on, a non-admin role reads nothing.
`lib/tax/migration-039.test.ts` parses every `CREATE POLICY` in the file and fails
if one names `authenticated`, `anon` or `public`.

### Existing column reused, not duplicated

`profiles.tax_exempt` (TABLE 1, `001_initial_schema.sql:41`) already exists and is
already editable through `app/api/admin/customers/[id]`. The tax engine consumes
it and **no new exemption column was added.** An exempt customer produces the
`exempt` outcome — a justified zero, with the invoice note
`specs/SPEC_TAXJAR_INTEGRATION.md` section 4 asks for — and the provider is never
called.

### What tax does NOT touch

`quotes.tax`, `quotes.total` and `invoices.tax_cents` are **unchanged**. Nothing in
item 08-taxjar writes a tax figure to any customer-facing row;
`lib/invoices/create.ts` still writes `tax_cents: 0` as a known literal. The
quote-vs-checkout question is open (see STATE_OF_THE_BUILD.md's 08-taxjar entry),
and `lib/tax/tax-not-in-money-path.test.ts` fails if any money-path file imports
`lib/tax`.

---

*SCHEMA.md | AFS | Reid Whitesides | June 2026*
*Run 001_initial_schema.sql in Supabase before any feature build begins.*
