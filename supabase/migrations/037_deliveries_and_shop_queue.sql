-- 037_deliveries_and_shop_queue.sql
--
-- Command Center V2 prompt v2-04 — SHOP VIEW AND DELIVERIES.
--
-- Two small additions, deliberately small: the shop queue itself already
-- exists. `shop_profile_library` (migration 016) is the real record of what
-- has been sent to the current Thalmann, it already carries `queue_position`
-- (017), the `queued -> in_progress -> complete` status lifecycle and
-- `completed_at`. Shop View reads that; it does not get a second queue table.
--
-- ===========================================================================
-- 1. shop_profile_library.started_at — WHEN BENDING ACTUALLY STARTED
-- ===========================================================================
--
-- `completed_at` records the finish. Nothing recorded the start, so
-- "Bending now" could not say since when, and there was no way to tell a job
-- that has been on the machine for ten minutes from one that has been on it
-- since Tuesday. Set on the queued -> in_progress transition, in the same
-- UPDATE as the status, by app/api/admin/shop-library/[id]/route.ts.

ALTER TABLE shop_profile_library ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- ===========================================================================
-- 2. deliveries — ONE ROW PER SHOP JOB, DAY + WINDOW + STATUS
-- ===========================================================================
--
-- WHY A TABLE AND NOT COLUMNS. docs/COMMAND_CENTER_V2_SPEC.md §Phase 5 offers
-- either. A table wins on one fact: a delivery is scheduled, rescheduled and
-- then delivered by a person, and each of those is an event somebody will ask
-- about later ("who moved the Wimberley drop, and when?"). Columns on
-- shop_profile_library would carry the current value and lose the actor.
--
-- ONE DELIVERY PER SHOP JOB, ENFORCED. `shop_job_id` is UNIQUE, so a double
-- click on Schedule delivery cannot book the same piece of work twice — the
-- same reason `invoices.quote_id` is unique (CLAUDE.md rule #21). A
-- reschedule is an UPDATE of that one row, not a second row.
--
-- THE WINDOW IS STORED AS A KEY, NOT AS ITS LABEL. The four windows the
-- approved prototype offers are 8-10 AM, 10 AM-12 PM, 1-3 PM and 3-5 PM. What
-- goes in the column is '08-10' / '10-12' / '13-15' / '15-17'; the English is
-- in lib/delivery/windows.ts and nowhere else. A label in a CHECK constraint
-- would mean a wording change needs a migration, and would put an en dash
-- inside a database constraint.
--
-- `auto_scheduled` records WHY this delivery exists: true when Mark finished
-- created it for the next business day, false when a person picked the day.
-- It is not cosmetic — it is how "the shop scheduled this, nobody chose it"
-- stays visible on the Deliveries screen.

CREATE TABLE IF NOT EXISTS deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_job_id      uuid NOT NULL REFERENCES shop_profile_library(id) ON DELETE CASCADE,
  -- The Job this delivery belongs to (a quote_requests row — see
  -- lib/data/job-stage.ts). NULL for a shop row that was never linked to a
  -- job, e.g. a direct FlashDraft send; those are still deliverable.
  quote_request_id uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  scheduled_date   date NOT NULL,
  time_window      text NOT NULL,
  status           text NOT NULL DEFAULT 'scheduled',
  auto_scheduled   boolean NOT NULL DEFAULT false,
  scheduled_by     uuid REFERENCES profiles(id),
  scheduled_at     timestamptz NOT NULL DEFAULT now(),
  delivered_at     timestamptz,
  delivered_by     uuid REFERENCES profiles(id),
  -- What the customer was actually told, and through which channel. Written
  -- from the result the notification service returned, never assumed.
  notified_at      timestamptz,
  notify_note      text,
  -- E2E rows only. Same reserved `E2E-TEST-` contract as
  -- lib/pricing/ledger.ts's test_tag: a tagged row is the only kind a test
  -- may delete, and it is excluded from nothing else because deliveries feed
  -- no analytics dataset.
  test_tag         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_shop_job_id_key') THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_shop_job_id_key UNIQUE (shop_job_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_time_window_check') THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_time_window_check
      CHECK (time_window IN ('08-10', '10-12', '13-15', '15-17'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_status_check') THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
      CHECK (status IN ('scheduled', 'delivered'));
  END IF;
END $$;

-- A delivered delivery ALWAYS has the time it was delivered. The pairing is
-- what lets the Deliveries screen say "delivered at 9:42" rather than just
-- "delivered", and it stops a row claiming delivery with nothing behind it.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_delivered_needs_time') THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivered_needs_time
      CHECK (status <> 'delivered' OR delivered_at IS NOT NULL);
  END IF;
END $$;

-- The week view reads a date range; the "not scheduled yet" panel reads the
-- absence of a row. Both want this index.
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON deliveries (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_quote_request_id ON deliveries (quote_request_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (status);

-- ===========================================================================
-- 3. RLS — ADMIN ONLY
-- ===========================================================================
--
-- A delivery is back-office scheduling. The customer learns their day and
-- window from the notification the schedule sends, and follows the truck
-- through the existing public tracking page (app/track/[orderId], backed by
-- `orders.tracking_token` and the SECURITY DEFINER get_tracking_data()) —
-- neither of which reads this table. So there is no customer-facing policy
-- here, deliberately: no policy at all is the correct answer rather than a
-- permissive one nobody needs.
--
-- is_admin() is this codebase's existing helper (SCHEMA.md).

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_deliveries ON deliveries;
CREATE POLICY admin_all_deliveries ON deliveries FOR ALL USING (is_admin());
