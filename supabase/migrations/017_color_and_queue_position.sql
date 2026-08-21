-- ============================================================================
-- 017_color_and_queue_position.sql
-- Adds a `color` field to both `quote_requests` and `shop_profile_library`
-- (metal/finish color called out at intake, e.g. off a Metal Color Chart),
-- plus `shop_profile_library.queue_position` (manual shop-floor ordering
-- within the queue) and `shop_profile_library.completed_at` (timestamp of
-- the queued -> completed status transition, distinct from `created_at`).
--
-- FILE ONLY — this migration is written and committed but has NOT been
-- applied to the live Supabase project. Per this project's standing
-- migration-verification standard (see SESSION_STATE.md), a migration's
-- live-apply status is never assumed from its presence on disk — it must
-- be verified directly against the live database (via information_schema
-- in the Supabase Dashboard SQL Editor) before anything depends on it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. quote_requests.color
-- ----------------------------------------------------------------------------
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS color TEXT;

-- ----------------------------------------------------------------------------
-- 2. shop_profile_library.color / queue_position / completed_at
-- ----------------------------------------------------------------------------
ALTER TABLE shop_profile_library
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS queue_position INTEGER,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================================================
-- End 017_color_and_queue_position.sql
-- ============================================================================
