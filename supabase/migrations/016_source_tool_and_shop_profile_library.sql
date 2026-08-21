-- ============================================================================
-- 016_source_tool_and_shop_profile_library.sql
-- Adds quote_requests.source_tool and a new shop_profile_library table —
-- an admin-only, internal shop record of a profile job's full intake
-- context (customer/account info, geometry, hem/paint instructions,
-- machine routing), separate from both `quote_requests` (a customer-
-- facing RFQ submission, one row per online request) and `machine_jobs`
-- (the approval → generation → delivery lifecycle for a single bend
-- program). shop_profile_library rows can optionally reference either or
-- both via nullable FKs, but stand on their own — a shop-floor record can
-- exist with no matching quote_request/machine_job (e.g. a job phoned in
-- or walked in and entered directly by staff).
--
-- FILE ONLY — this migration is written and committed but has NOT been
-- applied to the live Supabase project. Per this project's standing
-- migration-verification standard (see SESSION_STATE.md), a migration's
-- live-apply status is never assumed from its presence on disk — it must
-- be verified directly against the live database (via information_schema
-- in the Supabase Dashboard SQL Editor) before anything depends on it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. quote_requests.source_tool
-- ----------------------------------------------------------------------------
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS source_tool TEXT NOT NULL DEFAULT 'unknown';

-- ----------------------------------------------------------------------------
-- 2. shop_profile_library
-- ----------------------------------------------------------------------------
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
  geometry_points       JSONB,
  geometry_svg          TEXT,
  source_tool           TEXT,
  pathfinder_profile_id TEXT,
  status                TEXT DEFAULT 'queued',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_shop_profile_library_customer_name ON shop_profile_library(customer_name);
CREATE INDEX idx_shop_profile_library_profile_name ON shop_profile_library(profile_name);
CREATE INDEX idx_shop_profile_library_status ON shop_profile_library(status);
CREATE INDEX idx_shop_profile_library_due_date ON shop_profile_library(due_date);
CREATE INDEX idx_shop_profile_library_created_at ON shop_profile_library(created_at);

ALTER TABLE shop_profile_library ENABLE ROW LEVEL SECURITY;
-- Admin only — matches machine_jobs' (005_machine_jobs.sql) admin-only
-- pattern exactly, not the operator-inclusive pattern bid_documents
-- (013_bid_documents.sql) uses — this is an internal shop record, not a
-- feature Steve (operator role) is named as a user of.
CREATE POLICY "admin_all_shop_profile_library" ON shop_profile_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- End 016_source_tool_and_shop_profile_library.sql
-- ============================================================================
