-- 005_machine_jobs.sql
-- AFS — Machine Bridge: job approval queue linking customer orders/quote
-- requests to a Thalmann DS2801 bend sequence (either an existing
-- machine_profiles library entry, or a custom FlashDraft-drawn sequence
-- with no library match).
--
-- Deliberately a NEW table rather than overloading orders.status: orders.status
-- already tracks physical fabrication stage (submitted/cutting/bending/qc/...)
-- per 001_initial_schema.sql's CHECK constraint, which has no machine-delivery
-- states and shouldn't be extended to mean two different things. machine_jobs
-- tracks "has this job's bend program been approved, generated, and delivered
-- to the machine" as its own lifecycle, referencing the order/quote_request it
-- came from.
--
-- Status lifecycle (extended beyond the task's originally-sketched 5 values —
-- see machine-bridge/README.md's mandatory human-review-gate decision):
--   pending_approval      → an admin has not yet reviewed this job
--   approved_for_machine  → admin approved; the bridge will pick it up
--   staged_for_review     → bridge generated a .ds1 file into its review/
--                           folder; NOT yet confirmed delivered to the
--                           machine — the .ds1 binary format is only
--                           partially verified (see afs-machine-bridge repo),
--                           so a human must check the file before it's
--                           manually copied to the machine's real folder
--   sent_to_machine       → a human confirmed the file is in the machine's
--                           live folder (set via the Command Center's
--                           "Mark as Sent to Machine" action)
--   machine_error         → the bridge failed to generate/stage the file
--   completed             → fabrication finished
--   rejected              → admin rejected the job (see rejection_reason)
--   changes_requested     → admin asked the customer to revise something
--                           (Command Center's "Request Changes" action);
--                           job stays out of the machine queue until it's
--                           re-approved
--
-- NOTE: nothing currently auto-creates machine_jobs rows from quote_requests
-- or orders — that population step is out of scope for this build. The
-- schema, Command Center UI, and bridge are ready for it; a future feature
-- (or a manual admin/DB action) needs to actually insert pending_approval
-- rows from real customer submissions.

CREATE TABLE machine_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID REFERENCES orders(id),
  quote_request_id   UUID REFERENCES quote_requests(id),
  machine_profile_id UUID REFERENCES machine_profiles(id),
  custom_bends       JSONB,
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

CREATE INDEX idx_machine_jobs_status ON machine_jobs(status);
CREATE INDEX idx_machine_jobs_order ON machine_jobs(order_id);
CREATE INDEX idx_machine_jobs_quote_request ON machine_jobs(quote_request_id);
CREATE INDEX idx_machine_jobs_machine_profile ON machine_jobs(machine_profile_id);

ALTER TABLE machine_jobs ENABLE ROW LEVEL SECURITY;
-- Admin only — this is an internal production-queue tool, not customer-facing.
CREATE POLICY "admin_all_machine_jobs" ON machine_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Singleton row tracking the last time the Machine Bridge polled
-- pending-jobs, so the Command Center can show a connection-status dot.
CREATE TABLE machine_bridge_status (
  id           BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  last_ping_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO machine_bridge_status (id, last_ping_at) VALUES (true, NULL);

ALTER TABLE machine_bridge_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_machine_bridge_status" ON machine_bridge_status
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- job-delivered (app/api/machine-bridge/job-delivered/route.ts) is called by
-- the automated Machine Bridge service authenticating with a shared secret,
-- not a logged-in admin user, but is still expected to log to
-- admin_audit_log per this build's own instructions. admin_audit_log.admin_id
-- is NOT NULL in 001_initial_schema.sql (every existing caller is a real
-- admin session) — relaxed here so automated/system entries can record
-- admin_id = NULL rather than inventing a fake "system" profile row.
ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;

-- ============================================================================
-- END 005_machine_jobs.sql
-- ============================================================================
