-- 015_machine_jobs_delivery_method.sql
-- Adds machine_jobs.delivery_method — which real delivery path a job is
-- actually routed through, orthogonal to `status` (which stays purely an
-- approval-state field, not overloaded to also carry this).
--
-- Two independent systems both key off status = 'approved_for_machine':
-- the Machine Bridge's own poll (app/api/machine-bridge/pending-jobs/
-- route.ts) and, as of tonight, PathfinderEdge's push
-- (app/api/admin/command-center/approve/route.ts). Without this column
-- there was no way to say which ONE of those two a given job should
-- actually go through — a job could reach the physical Thalmann via both
-- independently, with no human decision made about which path to use.
--
-- Default 'machine_bridge': confirmed directly with Reid (2026-08-18) —
-- app/api/admin/command-center/approve-quote-request/route.ts is
-- currently the ONLY place that ever creates a machine_jobs row, and it
-- always sets status = 'approved_for_machine' at insert time, so every
-- quote-request-originated job today already goes straight to the
-- Machine Bridge's .ds1/human-review path. 'machine_bridge' as the
-- default preserves that exact existing behavior — it is not a new
-- default invented for this migration, it is what already happens.
-- 'pathfinder_edge' is only reached by a job that goes through
-- 'pending_approval' first and gets approved via the Command Center's
-- "Approve & Send to Machine" button.
--
-- Additive and nullable-safe — does not change any other machine_jobs
-- column, same pattern as migration 012.

ALTER TABLE machine_jobs
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'machine_bridge'
  CHECK (delivery_method IN ('pathfinder_edge', 'machine_bridge'));
