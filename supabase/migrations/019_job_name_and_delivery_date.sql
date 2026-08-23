-- ============================================================================
-- 019_job_name_and_delivery_date.sql
-- Adds `job_name` (the project/job name, e.g. "Smith Residence Reroof" —
-- distinct from `client_name`, the contact person, and
-- `client_business_name`, the company, both added by migration 018) to
-- both `quote_requests` and `shop_profile_library`, and
-- `requested_delivery_date` to `shop_profile_library` only.
--
-- REQUESTED_DELIVERY REUSE DECISION: `quote_requests` does NOT get a new
-- `requested_delivery_date` column here. `quote_requests.requested_delivery
-- DATE` already exists (001_initial_schema.sql) and is reused for that
-- purpose instead — it is currently unpopulated by every submission
-- surface (FlashDraft, Configurator, Quote Builder, Blueprint Takeoff AI
-- upload) despite being read at
-- app/api/admin/command-center/approve-quote-request/route.ts (the
-- `qr.requested_delivery` select feeding `machine_jobs.due_date` on every
-- approval), so every approved job's due_date is silently seeded NULL
-- today. `shop_profile_library` has no equivalent pre-existing column (its
-- only date column is `due_date` from migration 016, a distinct concept —
-- the shop's own committed date, not what the customer asked for at
-- intake), so `requested_delivery_date` genuinely is new there. This
-- produces an intentional naming asymmetry between the two tables for the
-- same real-world concept — see SCHEMA.md for the full write-up.
--
-- RETIRED, NOT REMOVED: `quote_requests.requested_by` and
-- `shop_profile_library.requested_by` (both added by migration 018) were a
-- naming mistake on both tables — meant to capture a delivery date, not a
-- person's name — and are now dead. Both columns are left in place,
-- untouched, and must be treated as always-null going forward; no UI or
-- logic should be built against either. See SESSION_STATE.md for the
-- known, deliberately out-of-scope consequence that three submission
-- surfaces still write to `quote_requests.requested_by` as of this
-- migration. Not to be confused with `machine_jobs.requested_by UUID
-- REFERENCES profiles(id)` (an earlier, unrelated migration) — that column
-- is actively used and is not touched here.
--
-- FILE ONLY — this migration is written and committed but has NOT been
-- applied to the live Supabase project. Per this project's standing
-- migration-verification standard (see SESSION_STATE.md), a migration's
-- live-apply status is never assumed from its presence on disk — it must
-- be verified directly against the live database (via information_schema
-- in the Supabase Dashboard SQL Editor) before anything depends on it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. quote_requests — job_name only (no date column; requested_delivery is
--    reused for that purpose, see the header note above)
-- ----------------------------------------------------------------------------
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS job_name TEXT;

-- ----------------------------------------------------------------------------
-- 2. shop_profile_library — job_name + requested_delivery_date (both new)
-- ----------------------------------------------------------------------------
ALTER TABLE shop_profile_library
  ADD COLUMN IF NOT EXISTS job_name TEXT,
  ADD COLUMN IF NOT EXISTS requested_delivery_date DATE;

-- ============================================================================
-- End 019_job_name_and_delivery_date.sql
-- ============================================================================
