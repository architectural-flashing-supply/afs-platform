-- 032_quote_requests_job_stage.sql
-- Command Center V2, prompt v2-01 step 4 — THE ONE JOB STAGE MODEL.
--
-- A quote_requests row IS the Job (docs/COMMAND_CENTER_V2_SPEC.md §2.2). Every
-- source already creates one. This adds the single column that says which
-- Workbench lane it sits in, so the five lanes have one source of truth
-- instead of being derived by joining quote_requests.status to
-- machine_jobs.status at read time.
--
-- Ladder order: new -> quoted -> approved -> shop -> done.
-- job_stage IS NULL means archived (today: cancelled) — off the Workbench and
-- not a rung on the ladder. The CHECK permits NULL for exactly that reason.
--
-- Transition rules are enforced SERVER-SIDE in lib/data/job-stage.ts
-- (planStageTransition), which every route that moves a job must go through.
-- A CHECK constraint can police the set of values but cannot police
-- from -> to, which is the part that actually matters here.
--
-- This also fixes the defect diagnosed 2026-09-30: a successful approval set
-- status='reviewing', which then failed approve-quote-request's own
-- `status === 'submitted'` entry check, so a second click returned
-- 409 "Quote request is not pending approval." and read as a failure. With an
-- explicit stage, "already sent" is detectable and answerable in plain
-- English. The PathfinderEdge single-door guard is deliberately unchanged:
-- it still requires status='submitted', because a re-push is not a fresh
-- approval.
--
-- IDEMPOTENT: IF NOT EXISTS on the column, a guarded constraint add, and a
-- backfill that only touches rows where job_stage IS NULL.

BEGIN;

-- DEFAULT 'new': a newly-arrived request must land in the New lane without
-- every insert path having to remember to say so.
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS job_stage text DEFAULT 'new';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_job_stage_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE quote_requests
      ADD CONSTRAINT quote_requests_job_stage_check
      CHECK (job_stage IS NULL OR job_stage IN ('new','quoted','approved','shop','done'));
  END IF;
END $$;

COMMENT ON COLUMN quote_requests.job_stage IS
  'Command Center V2 Workbench lane: new|quoted|approved|shop|done. NULL = archived (cancelled), off the Workbench. Transitions are enforced in lib/data/job-stage.ts, not here.';

-- Backfill, per the spec's mapping table. Most specific first, so a row with
-- several machine jobs lands in the furthest stage it has actually reached.
--
-- One case the spec's table does not name: status='reviewing' with NO
-- machine_jobs row at all (7 of the 64 rows that existed when this was
-- written). Those are requests an admin opened but never sent anywhere, so
-- they are still waiting for a quote -> 'new'. Recorded here rather than left
-- to a reader to guess.
--
-- WHERE job_stage IS NULL keeps a re-run from overwriting a stage a route has
-- since advanced. NOTE: after prompt v2-01's step 2 clean slate, quote_requests
-- is empty, so this backfill legitimately touches 0 rows on the live database.
-- It is kept correct and complete anyway, because it is what runs on any
-- restore from the 2026-10-01 backup.
UPDATE quote_requests qr
SET job_stage = CASE
  WHEN qr.status = 'cancelled' THEN NULL
  WHEN EXISTS (SELECT 1 FROM machine_jobs mj
               WHERE mj.quote_request_id = qr.id AND mj.status = 'completed') THEN 'done'
  WHEN EXISTS (SELECT 1 FROM machine_jobs mj
               WHERE mj.quote_request_id = qr.id
                 AND mj.status IN ('staged_for_review','sent_to_machine')) THEN 'shop'
  WHEN EXISTS (SELECT 1 FROM machine_jobs mj
               WHERE mj.quote_request_id = qr.id
                 AND mj.status = 'approved_for_machine') THEN 'approved'
  ELSE 'new'
END
WHERE qr.job_stage IS NULL AND qr.status IS DISTINCT FROM 'cancelled';

-- Cancelled rows are archived: explicitly NULL, and explicitly not 'new'.
UPDATE quote_requests SET job_stage = NULL WHERE status = 'cancelled';

-- The Workbench reads one lane at a time, newest arrival first.
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_stage
  ON quote_requests (job_stage, submitted_at DESC);

COMMIT;
