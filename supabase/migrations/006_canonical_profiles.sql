-- ============================================================================
-- 006_canonical_profiles.sql
-- Canonical profile library: hand-crafted, mathematically correct flashing
-- profiles stored as pre-computed XY point sequences (inches). Unlike
-- machine_profiles (004_machine_profiles.sql), these do NOT go through the
-- bend-angle turtle-graphics reconstruction in lib/flashdraft/geometry.ts —
-- `points` is the exact, final polyline, computed once at seed time by
-- scripts/seed-canonical-profiles.ts and stored as-is. See that script's own
-- header comment for the turtle-graphics algorithm used to compute it.
-- ============================================================================

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
