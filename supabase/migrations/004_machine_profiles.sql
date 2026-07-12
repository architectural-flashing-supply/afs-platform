-- 004_machine_profiles.sql
-- AFS — Design Studio: Thalmann DS2801 machine profile library
-- Populated by scripts/import-machine-profiles.ts from machine-data/ds2801db.bdb
-- (Biegeprogramme, BiegeprogrammSaetze, Kategorien tables).
--
-- PRIVACY NOTE: the source machine database is a live shop job-history file, not
-- a clean generic catalog. Individual profile names embed real customer/project
-- names even inside generic-sounding categories (confirmed during import script
-- design — see SESSION_STATE.md). Only categories 23 (Rheinzink-Profile / Zinc
-- Profiles) and 42-61 (the numbered "00"-"19" series / Standard Series 0-19) are
-- reusable generic templates; every other category is customer job history and
-- is imported with is_public = false on both the category and its profiles.
--
-- is_public is added to machine_profile_categories (beyond the columns literally
-- listed in the build instructions) because without it, a private category's
-- name — often a contractor or client name — would still be joinable/readable
-- by any authenticated user even with its profiles hidden, defeating the point.
--
-- source_category_id / source_profile_id are also additions beyond the literal
-- column list: the source Access tables' own integer primary keys (kKategorie,
-- kBiegeprogramm), kept unique so the import script can upsert idempotently on
-- re-run instead of duplicating rows every time. machine_profile_bends uses
-- UNIQUE(profile_id, step_number) for the same reason instead of a separate
-- source-id column, since nSatznummer is already a meaningful per-profile step
-- sequence, not an opaque Access autonumber.

CREATE TABLE machine_profile_categories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_category_id INTEGER NOT NULL UNIQUE,
  name_en            TEXT NOT NULL,
  name_original      TEXT NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_public          BOOLEAN NOT NULL DEFAULT false,
  is_active          BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_machine_profile_categories_sort ON machine_profile_categories(sort_order);

ALTER TABLE machine_profile_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_public_categories" ON machine_profile_categories
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_public = true AND is_active = true);
CREATE POLICY "admin_all_categories" ON machine_profile_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TABLE machine_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_profile_id   INTEGER NOT NULL UNIQUE,
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

CREATE INDEX idx_machine_profiles_category ON machine_profiles(category_id);
CREATE INDEX idx_machine_profiles_public ON machine_profiles(is_public) WHERE is_public = true;

ALTER TABLE machine_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_public_profiles" ON machine_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_public = true AND is_active = true);
CREATE POLICY "admin_all_profiles" ON machine_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

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

CREATE INDEX idx_machine_profile_bends_profile ON machine_profile_bends(profile_id);

ALTER TABLE machine_profile_bends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_public_profile_bends" ON machine_profile_bends
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM machine_profiles
      WHERE id = profile_id AND is_public = true AND is_active = true
    )
  );
CREATE POLICY "admin_all_profile_bends" ON machine_profile_bends
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- END 004_machine_profiles.sql
-- ============================================================================
