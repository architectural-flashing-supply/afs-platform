-- 028_profile_search.sql
--
-- 2026-09-30. Command Center profile search (Part 2).
--
-- Adds the two grouping/typing columns, enables pg_trgm for typo tolerance,
-- and builds the full-text + trigram indexes the admin search route needs.
--
-- IDEMPOTENT throughout: IF NOT EXISTS on every object, so re-running changes
-- nothing.
--
-- RLS: no new table. saved_configurations keeps its existing four
-- profile_passport_* policies (024), which govern these new columns
-- automatically — customers still see only their own/their company's rows.
-- Cross-customer search is an ADMIN-ONLY server route that uses the service
-- role and performs its own role check; it does not relax RLS for anyone.
-- Verified after apply by re-reading pg_policies and pg_class.relrowsecurity.

BEGIN;

-- Typo tolerance. pg_trgm gives similarity() and GIN/GiST trigram indexes;
-- Postgres FTS alone cannot match a misspelling.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- profile_type: the TEMPLATE KEY the profile started from, set automatically
-- on new saves from the chosen template. NULL means "we do not know" and is
-- displayed as "Untyped" with a one-click admin tag action. It is never
-- inferred from geometry or from the name — guessing a fabrication type is
-- worse than admitting ignorance.
ALTER TABLE saved_configurations
  ADD COLUMN IF NOT EXISTS profile_type text;

-- geometry_fingerprint: stable, orientation-independent hash of the
-- normalized shape. Definition and the exact normalization live in
-- lib/flashdraft/geometry-fingerprint.ts (leg lengths to 1/64", signed
-- angles to 0.5 deg, hem type+gap; min over the four rotation/mirror/
-- reversal variants; FNV-1a 64-bit hex). NOT computed in SQL on purpose:
-- one implementation, in TypeScript, used by both the client at save time
-- and the server-side backfill, so the two can never drift.
ALTER TABLE saved_configurations
  ADD COLUMN IF NOT EXISTS geometry_fingerprint text;

COMMENT ON COLUMN saved_configurations.profile_type IS
  'Template key the profile started from (Part 2, 2026-09-30). NULL = unknown, shown as "Untyped". Never inferred.';
COMMENT ON COLUMN saved_configurations.geometry_fingerprint IS
  'Orientation-independent shape hash for "same shape xN" grouping. Produced ONLY by lib/flashdraft/geometry-fingerprint.ts. NULL = not groupable.';

-- "Same shape" grouping is an equality lookup on the fingerprint.
CREATE INDEX IF NOT EXISTS saved_configurations_geometry_fingerprint_idx
  ON saved_configurations(geometry_fingerprint)
  WHERE geometry_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS saved_configurations_profile_type_idx
  ON saved_configurations(profile_type)
  WHERE profile_type IS NOT NULL;

-- Newest-arrival-first ordering (Part 4's rule) over the search result set.
CREATE INDEX IF NOT EXISTS saved_configurations_created_at_desc_idx
  ON saved_configurations(created_at DESC);

-- ---------------------------------------------------------------
-- Full-text search
-- ---------------------------------------------------------------
-- One generated tsvector over the four searchable fields the UI's field
-- selector offers: profile name, company, person, type. Stored (not
-- expression-indexed) so the weighting is declared once here rather than
-- re-specified identically in every query.
--
-- Weights: name is what people actually search (A); company and person are
-- strong secondary keys (B); type is a coarse filter (C).
ALTER TABLE saved_configurations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(job_info->>'clientBusinessName', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(job_info->>'clientName', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(job_info->>'jobName', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(profile_type, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS saved_configurations_search_vector_idx
  ON saved_configurations USING GIN (search_vector);

-- Trigram indexes for typo tolerance on the two free-text fields people
-- misspell most: the profile name and the company.
CREATE INDEX IF NOT EXISTS saved_configurations_name_trgm_idx
  ON saved_configurations USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS saved_configurations_company_trgm_idx
  ON saved_configurations USING GIN ((job_info->>'clientBusinessName') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS saved_configurations_person_trgm_idx
  ON saved_configurations USING GIN ((job_info->>'clientName') gin_trgm_ops);

COMMIT;
