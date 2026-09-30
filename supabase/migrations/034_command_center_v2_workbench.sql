-- 034_command_center_v2_workbench.sql
--
-- Command Center V2 prompt v2-02 — THE WORKBENCH and THE JOB SCREEN.
--
-- Migration 032 added the one thing that decides which lane a job sits in
-- (quote_requests.job_stage). This adds the facts the lane CARDS and the Job
-- screen have to state truthfully and cannot derive from anything that exists:
--
--   1. HOW LONG IT HAS BEEN WAITING, per stage. quote_requests has
--      submitted_at, reviewed_at and quoted_at and NO updated_at, so "customer
--      approved 20 minutes ago" and "sent to the machine an hour ago" had no
--      source at all. stage_changed_at/approved_at/sent_to_machine_at/done_at
--      give each lane its own honest clock.
--
--   2. THE PATHFINDEREDGE PROFILE NUMBER THAT WAS ACTUALLY RETURNED.
--      pushProfileToPathfinder returns { status, message, profileId } and
--      profileId CAN BE NULL on a 'connected' push (it is resolved by a
--      follow-up GET that may not find the row). The rule for this prompt is
--      "never report a send as successful without the returned profile number
--      to prove it", so the numbers are stored on the job itself rather than
--      re-derived from a log line.
--
--   3. A SEND THAT FAILED, as state rather than as a toast that vanishes.
--      send_status/send_error/send_attempted_at are what put a card in the
--      "Send failed — retry" state after a reload.
--
--   4. WHERE RUSH CAME FROM. is_rush already exists; what did not exist was
--      any way to prove it was set explicitly. rush_source is CHECK-
--      constrained to the only two things allowed to set it — an explicit
--      customer checkbox or an explicit admin toggle — and a second CHECK
--      makes is_rush = true IMPOSSIBLE without one of them. Inference from a
--      date or a keyword cannot satisfy this constraint, so the prohibition
--      is enforced by the database and not only by code review.
--
--   5. THE FOLLOW-UP DRAFT on a stale quote, so it survives a reload.
--
--   6. HOW AN APPROVAL WAS OBTAINED (approval_channel), which is what makes
--      "Customer approved by phone" an auditable record rather than an
--      unexplained stage jump. It is NOT a PathfinderEdge bypass: the send
--      still goes through the one verified door, which re-reads this row.
--
-- IDEMPOTENT: every ADD COLUMN is IF NOT EXISTS and every constraint is added
-- only when pg_constraint does not already have it. Safe to re-run.

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS stage_changed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at         timestamptz,
  ADD COLUMN IF NOT EXISTS approval_channel    text,
  ADD COLUMN IF NOT EXISTS approved_by         uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS sent_to_machine_at  timestamptz,
  ADD COLUMN IF NOT EXISTS done_at             timestamptz,
  ADD COLUMN IF NOT EXISTS pathfinder_profile_ids text[],
  ADD COLUMN IF NOT EXISTS send_status         text,
  ADD COLUMN IF NOT EXISTS send_error          text,
  ADD COLUMN IF NOT EXISTS send_attempted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS rush_source         text,
  ADD COLUMN IF NOT EXISTS rush_set_by         uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS rush_set_at         timestamptz,
  ADD COLUMN IF NOT EXISTS followup_draft      text,
  ADD COLUMN IF NOT EXISTS followup_drafted_at timestamptz;

-- send_status: NULL = nothing to report. 'failed' = nothing reached the
-- machine, retrying is safe and is what the card offers. 'unconfirmed' = the
-- profile WAS created but PathfinderEdge did not return its number, so the
-- send cannot be called successful AND must not be retried blindly (a retry
-- would duplicate a real profile in catalog 20115). Those are genuinely
-- different situations and the UI says different things about them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_send_status_check'
  ) THEN
    ALTER TABLE quote_requests
      ADD CONSTRAINT quote_requests_send_status_check
      CHECK (send_status IS NULL OR send_status IN ('failed', 'unconfirmed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_approval_channel_check'
  ) THEN
    ALTER TABLE quote_requests
      ADD CONSTRAINT quote_requests_approval_channel_check
      CHECK (approval_channel IS NULL OR approval_channel IN ('phone', 'email', 'admin'));
  END IF;
END $$;

-- RUSH, ENFORCED IN THE DATABASE.
-- Only these two values exist, and they name the only two things allowed to
-- set rush. There is deliberately no 'inferred', 'keyword', 'due_date' or
-- 'auto' value — adding one would need a migration and a review, which is the
-- point.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_rush_source_check'
  ) THEN
    ALTER TABLE quote_requests
      ADD CONSTRAINT quote_requests_rush_source_check
      CHECK (rush_source IS NULL OR rush_source IN ('customer_checkbox', 'admin_toggle'));
  END IF;
END $$;

-- The teeth: is_rush cannot be true unless one of the two explicit sources
-- claimed it. Any code that tried to infer rush from a date, a keyword or a
-- note would have to write a rush_source to get past this, and there is no
-- value it could write.
--
-- THE `IS NOT NULL` HALF IS LOAD-BEARING, and it is here because the obvious
-- spelling was WRITTEN FIRST AND PROVEN WRONG against the live database.
-- `CHECK (is_rush = false OR rush_source IN (...))` accepted
-- `is_rush = true, rush_source = NULL` — with a NULL the IN yields UNKNOWN,
-- `false OR UNKNOWN` is UNKNOWN, and a CHECK constraint accepts UNKNOWN. An
-- insert that should have been impossible succeeded (proof in
-- STATE_OF_THE_BUILD.md's v2-02 entry). The explicit IS NOT NULL makes the
-- right-hand side FALSE rather than UNKNOWN, so the row is refused. Do not
-- "simplify" this back.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_rush_needs_explicit_source'
  ) THEN
    ALTER TABLE quote_requests DROP CONSTRAINT quote_requests_rush_needs_explicit_source;
  END IF;
  ALTER TABLE quote_requests
    ADD CONSTRAINT quote_requests_rush_needs_explicit_source
    CHECK (
      NOT is_rush
      OR (rush_source IS NOT NULL AND rush_source IN ('customer_checkbox', 'admin_toggle'))
    );
END $$;

COMMENT ON COLUMN quote_requests.rush_source IS
  'How is_rush was set. ONLY customer_checkbox (the customer ticked it at intake) or admin_toggle (an admin turned it on in the Command Center). Never inferred from dates, keywords or anything else -- see the quote_requests_rush_needs_explicit_source CHECK.';
COMMENT ON COLUMN quote_requests.pathfinder_profile_ids IS
  'The profile numbers PathfinderEdge actually returned for this job, one per line item, in line-item order. Empty/NULL means no send has been confirmed -- a send is never reported as successful without these.';
COMMENT ON COLUMN quote_requests.send_status IS
  'NULL = nothing to report. failed = nothing reached the machine; retry is safe. unconfirmed = the profile was created but its number was not returned; do NOT retry blindly.';
COMMENT ON COLUMN quote_requests.approval_channel IS
  'How the customer approval was obtained: phone (an admin recorded it), email (the customer clicked Approve -- Phase 4), admin. Recorded so a phone approval is an auditable record rather than an unexplained stage jump.';
COMMENT ON COLUMN quote_requests.done_at IS
  'When the job was delivered. The Done lane auto-archives after 14 days measured from here; Search still finds the row.';

-- Backfill the stage clock for rows that already have a stage, so no existing
-- card has to invent an age. Only touches NULLs, so a re-run is a no-op.
UPDATE quote_requests
SET stage_changed_at = COALESCE(reviewed_at, quoted_at, submitted_at)
WHERE stage_changed_at IS NULL;

-- The Done lane's archive filter and the Workbench's newest-first ordering are
-- the two queries that run on every page load.
CREATE INDEX IF NOT EXISTS idx_quote_requests_done_at
  ON quote_requests (done_at DESC) WHERE job_stage = 'done';
CREATE INDEX IF NOT EXISTS idx_quote_requests_send_status
  ON quote_requests (send_status) WHERE send_status IS NOT NULL;
