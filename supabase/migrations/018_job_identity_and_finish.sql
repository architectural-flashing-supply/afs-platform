-- ============================================================================
-- 018_job_identity_and_finish.sql
-- Adds job-identity intake fields (client business name, client contact
-- name, PO number, who requested the job) and a `finish` field to both
-- `quote_requests` and `shop_profile_library`, so a job's business/contact
-- identity and finish spec are captured consistently at both the customer
-- RFQ level and the internal shop-floor record level.
--
-- PRE-EXISTING COLUMN NOTE: `quote_requests.po_number TEXT` already exists
-- — added in 001_initial_schema.sql, NOT new here. It is included below
-- only via `ADD COLUMN IF NOT EXISTS` for idempotent-migration-style
-- safety (a harmless no-op against the live column), matching this
-- project's existing pattern (e.g. 016/017's own `IF NOT EXISTS` usage).
-- Verified directly against 001_initial_schema.sql before writing this
-- file — do not treat `quote_requests.po_number` as newly introduced here.
-- `shop_profile_library.po_number` (and the other four columns on that
-- table) genuinely are new — verified none of the five existed on
-- `shop_profile_library` after migrations 016/017.
--
-- FILE ONLY — this migration is written and committed but has NOT been
-- applied to the live Supabase project. Per this project's standing
-- migration-verification standard (see SESSION_STATE.md), a migration's
-- live-apply status is never assumed from its presence on disk — it must
-- be verified directly against the live database (via information_schema
-- in the Supabase Dashboard SQL Editor) before anything depends on it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. quote_requests — job-identity fields + finish
--    (po_number pre-existing; included here only for idempotent safety)
-- ----------------------------------------------------------------------------
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS client_business_name TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS finish TEXT;

-- ----------------------------------------------------------------------------
-- 2. shop_profile_library — job-identity fields + finish (all five new)
-- ----------------------------------------------------------------------------
ALTER TABLE shop_profile_library
  ADD COLUMN IF NOT EXISTS client_business_name TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS finish TEXT;

-- ============================================================================
-- End 018_job_identity_and_finish.sql
-- ============================================================================
