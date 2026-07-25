# SCHEMA.md
## AFS — Supabase Database Schema
**45 tables across 7 migration files. RLS on every table. Indexes on every
foreign key and filter column.** (This document's "TABLE N" numbering below
covers the original 25 sections designed in migration 001 — several of
those sections define more than one physical table, e.g. TABLE 8 =
`accessories` + `product_accessories`. The MACHINE INTEGRATION and MACHINE
BRIDGE sections near the end of this document add 5 more tables via
migrations 004 and 005, the CANONICAL PROFILE LIBRARY section adds 1
more via migration 006, and the DELIVERY TRACKING + EMPLOYEE PWA section
adds 3 more via migration 007. 45 is the count `supabase/README.md` should
verify against the live database once all 7 migrations are applied.)

---

## MIGRATION FILE LOCATION

```
supabase/migrations/
  001_initial_schema.sql              All tables through TABLE 25 below + ADDITIONAL/SPEC TEMPLATES sections
  002_seed_afs_data.sql                Materials, gauges, product_profiles reference data
  003_pricing_rules_cost_notes.sql     Adds pricing_rules.cost_notes (see TABLE 9)
  004_machine_profiles.sql             Design Studio machine profile library (see MACHINE INTEGRATION TABLES)
  005_machine_jobs.sql                 Machine Bridge job queue (see MACHINE BRIDGE TABLES)
  006_canonical_profiles.sql           Canonical profile library (see CANONICAL PROFILE LIBRARY TABLE)
  007_delivery_tracking.sql            Delivery tracking + Employee PWA + GBP photo queue (see DELIVERY TRACKING + EMPLOYEE PWA TABLES)
```

Run in numeric order — see `supabase/README.md` for the exact procedure.
As of 2026-07-22, all 6 migrations (001–006) are confirmed applied to the
live Supabase project — verified directly via the service-role client
across two sessions (STATE_OF_THE_BUILD.md's afs-041 correction for
001–005, and this session's direct pre/post query for 006), not carried
forward from this line's long-stale "001–003 and 005 NOT yet applied"
claim.

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
);

CREATE INDEX idx_quote_requests_user ON quote_requests(user_id);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_submitted ON quote_requests(submitted_at DESC);

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

```sql
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT UNIQUE NOT NULL,  -- AFS-2026-XXXXX
  quote_id            UUID NOT NULL REFERENCES quotes(id),
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
  status           TEXT NOT NULL DEFAULT 'uploaded'
                   CHECK (status IN ('uploaded','processing','complete','partial','failed')),
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

## MACHINE INTEGRATION TABLES (migration 004_machine_profiles.sql)

Backs the Design Studio / FlashDraft profile-matching feature. Populated
from the Thalmann DS2801 bending machine's own database
(`machine-data/ds2801db.bdb`) via `pnpm run import:machine-profiles` — see
`supabase/README.md`. Live as of this writing: 46 categories, 911
profiles, 4537 bend steps; 70 profiles public, 841 private (the source
data is the shop's real job history — most profile names are real
customer/project names, so only two generic-template category ranges are
public; see the migration file's own header comment for the full privacy
rationale).

```sql
CREATE TABLE machine_profile_categories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_category_id INTEGER NOT NULL UNIQUE,   -- source Access table's own PK (kKategorie)
  name_en            TEXT NOT NULL,
  name_original      TEXT NOT NULL,              -- original German name
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_public          BOOLEAN NOT NULL DEFAULT false,
  is_active          BOOLEAN NOT NULL DEFAULT true
);
-- RLS: authenticated read where is_public AND is_active; admin read/write all

CREATE TABLE machine_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_profile_id   INTEGER NOT NULL UNIQUE,   -- source Access PK (kBiegeprogramm)
  category_id         UUID NOT NULL REFERENCES machine_profile_categories(id),
  profile_number      TEXT NOT NULL,
  name_en             TEXT NOT NULL,
  name_original       TEXT NOT NULL,
  blank_width_mm      DECIMAL(10,4),
  blank_width_in      DECIMAL(10,4),
  is_public           BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  match_tolerance_pct DECIMAL(5,2) NOT NULL DEFAULT 5,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: authenticated read where is_public AND is_active; admin read/write all

CREATE TABLE machine_profile_bends (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NOT NULL REFERENCES machine_profiles(id) ON DELETE CASCADE,
  step_number        INTEGER NOT NULL,
  left_leg_mm        DECIMAL(10,4),
  left_leg_in        DECIMAL(10,4),
  right_leg_mm       DECIMAL(10,4),
  right_leg_in       DECIMAL(10,4),
  bend_angle_degrees DECIMAL(6,2),
  radius_mm          DECIMAL(8,4),
  radius_in          DECIMAL(8,4),
  UNIQUE (profile_id, step_number)
);
-- RLS: authenticated read where parent machine_profiles row is public+active;
--      admin read/write all
```

---

## MACHINE BRIDGE TABLES (migration 005_machine_jobs.sql)

Links a customer order/quote request to a Thalmann bend sequence and
tracks its approval → generation → delivery lifecycle, separate from
`orders.status` (which only tracks physical fabrication stage and has no
machine-delivery states). See ARCHITECTURE.md §11 for the full lifecycle
and the Machine Bridge service that consumes `approved_for_machine` jobs.
Admin-only — internal production-queue tool, not customer-facing.

```sql
CREATE TABLE machine_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID REFERENCES orders(id),
  quote_request_id   UUID REFERENCES quote_requests(id),
  machine_profile_id UUID REFERENCES machine_profiles(id),  -- library match, if any
  custom_bends       JSONB,                                 -- FlashDraft-drawn sequence, if no library match
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

A second, independent profile source alongside `machine_profiles` — 25
hand-crafted, mathematically correct flashing profiles stored as
pre-computed XY point sequences, populated via
`scripts/seed-canonical-profiles.ts` (`pnpm tsx
scripts/seed-canonical-profiles.ts`). Unlike `machine_profiles`, these do
NOT go through the bend-angle turtle-graphics reconstruction in
`lib/flashdraft/geometry.ts` at read time — `points` is the exact, final
polyline, computed once at seed time from an explicit turtle-graphics move
list and stored as-is. Public resource, not shop job history — no private-
row concept, unlike `machine_profiles`.

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
- `category` — matches the AFS product category vocabulary used in
  `app/studio/library/page.tsx`'s `AFS_PRODUCT_CATEGORIES` (e.g. "Coping
  Caps & Cleats", "Valley Flashing"), not `machine_profile_categories` rows.
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

*SCHEMA.md | AFS | Reid Whitesides | June 2026*
*Run 001_initial_schema.sql in Supabase before any feature build begins.*
