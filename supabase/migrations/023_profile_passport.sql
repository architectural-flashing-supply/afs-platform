-- ============================================================================
-- 023_profile_passport.sql
-- Profile Passport — customer-scoped custom flashing profile records with
-- versioned revision history (SPEC_CUSTOM_PROFILE_LIBRARY.md, hp-015).
--
-- Named 023_profile_passport.sql, not a timestamp-prefixed file, to match
-- this project's existing sequential migration numbering (001-022) — see
-- the naming note under migration 010 in SCHEMA.md for the same precedent
-- (a requested number was swapped for the next real sequential one rather
-- than colliding with / deviating from the established convention).
--
-- FK target for `customer_id`: there is no `customers` table in this schema
-- and `orders` has no column literally named `customer_id` — orders (TABLE
-- 18) identifies its owning customer via `user_id UUID NOT NULL REFERENCES
-- profiles(id)`. `companies` (TABLE 2) is a separate, optional grouping
-- reached only through `profiles.company_id`; orders does not reference
-- companies directly. So "the same FK target as orders.customer_id" is
-- profiles(id) — matching every other user-scoped table in this schema
-- (projects, quote_requests, takeoff_uploads, vault_documents all key off
-- profiles(id) directly, never companies(id)).
--
-- RLS mirrors orders' actual policy shape: "users_own_orders" is a direct
-- `auth.uid() = user_id` match, not a companies-membership EXISTS join —
-- orders itself does not use a company-membership pattern, so this
-- migration doesn't invent one either.
-- ============================================================================

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

-- No updated_at trigger function exists anywhere in this schema yet (every
-- other updated_at column is set manually by application code) — this one
-- is scoped to custom_profiles only, matching the task's explicit ask for
-- an updated_at trigger on this table.
CREATE OR REPLACE FUNCTION set_custom_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_custom_profiles_updated_at
  BEFORE UPDATE ON custom_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_custom_profiles_updated_at();

ALTER TABLE custom_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_custom_profiles" ON custom_profiles
  FOR ALL USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "admin_all_custom_profiles" ON custom_profiles
  FOR ALL USING (is_admin());

-- ----------------------------------------------------------------------------

CREATE TABLE profile_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL REFERENCES custom_profiles(id) ON DELETE CASCADE,
  revision_number     INTEGER NOT NULL,
  changes             JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id  UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE (profile_id, revision_number)
);

-- UNIQUE (profile_id, revision_number) above already creates a covering
-- btree index for that pair; no separate CREATE INDEX needed for it.

ALTER TABLE profile_revisions ENABLE ROW LEVEL SECURITY;

-- Child table has no customer_id of its own — scope through the parent
-- custom_profiles row, same join-through-parent shape as this schema's
-- other line-item/child tables (e.g. "quote_owner_line_items" on
-- quote_line_items, "order_owner_line_items" on order_line_items).
CREATE POLICY "users_own_profile_revisions" ON profile_revisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM custom_profiles
      WHERE id = profile_revisions.profile_id AND customer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_profiles
      WHERE id = profile_revisions.profile_id AND customer_id = auth.uid()
    )
  );

CREATE POLICY "admin_all_profile_revisions" ON profile_revisions
  FOR ALL USING (is_admin());

-- ----------------------------------------------------------------------------

ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_profile_id UUID REFERENCES custom_profiles(id);
CREATE INDEX IF NOT EXISTS idx_orders_custom_profile ON orders(custom_profile_id);

-- ============================================================================
-- End 023_profile_passport.sql
-- ============================================================================
