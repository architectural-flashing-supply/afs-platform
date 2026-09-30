-- 030_command_center_v2_clean_slate.sql
-- Command Center V2, prompt v2-01 step 2 — CLEAN SLATE.
--
-- Reid confirmed none of the existing jobs are real work. This resolves the
-- "OPEN DECISION — PENDING REID" in docs/COMMAND_CENTER_V2_SPEC.md §2.9, which
-- said a wipe could not be specified until he said which of Steve's rows were
-- real. He has: none of them are.
--
-- A FULL VERIFIED BACKUP OF EVERY APPLICATION TABLE WAS TAKEN FIRST to
-- C:\Users\manag\Documents\afs-backups\2026-10-01\ (outside the repo) via
-- scripts/backup-app-tables.mjs, and each dump was proven to rehydrate into
-- typed rows before this file was run. Do not run this migration without that
-- backup in hand.
--
-- DELETES (job/transaction data created before this run):
--   quote_requests, machine_jobs, orders, quotes, takeoff_uploads,
--   saved_configurations, notifications, and every dependent row.
--
-- KEEPS:
--   profiles (all user accounts, including the E2E test account),
--   materials / gauges / product_profiles / canonical_profiles (reference data),
--   shop_profile_library (real send history to the current Thalmann),
--   admin_audit_log (permanent by design), bid_* reference data,
--   chat_conversations, projects.
--
-- IDEMPOTENT: the cutoff is a fixed literal, so a second run deletes nothing.

BEGIN;

-- The cutoff is after every row that existed when this was authored
-- (max submitted_at / created_at / sent_at across the affected tables was
-- 2026-09-30 01:00:13+00) and before this run's own writes.
CREATE TEMP TABLE _v2_cutoff AS SELECT '2026-09-30 07:00:00+00'::timestamptz AS ts;

-- shop_profile_library rows are real send history and MUST SURVIVE, but 12 of
-- the 20 point at quote_requests / machine_jobs rows being deleted here, and
-- both FKs are ON DELETE NO ACTION. Null the links, keep the history (profile
-- name, customer, geometry, pathfinder_profile_id, status all stay intact).
UPDATE shop_profile_library spl
SET quote_request_id = NULL
WHERE spl.quote_request_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM quote_requests qr, _v2_cutoff c
    WHERE qr.id = spl.quote_request_id AND qr.submitted_at < c.ts
  );

UPDATE shop_profile_library spl
SET machine_job_id = NULL
WHERE spl.machine_job_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM machine_jobs mj, _v2_cutoff c
    WHERE mj.id = spl.machine_job_id AND mj.created_at < c.ts
  );

-- takeoff_uploads.request_id -> quote_requests (NO ACTION): uploads are in the
-- delete set themselves, so they go before their parent.
DELETE FROM takeoff_uploads tu
USING _v2_cutoff c
WHERE tu.created_at < c.ts;

-- notifications reference both orders and profiles; profiles stay.
DELETE FROM notifications n
USING _v2_cutoff c
WHERE n.sent_at < c.ts;

-- Order-scoped children with NO ACTION FKs (the CASCADE ones follow the parent
-- automatically, these do not).
DELETE FROM delivery_notifications dn
WHERE dn.order_id IN (SELECT o.id FROM orders o, _v2_cutoff c WHERE o.created_at < c.ts);

DELETE FROM driver_locations dl
WHERE dl.order_id IN (SELECT o.id FROM orders o, _v2_cutoff c WHERE o.created_at < c.ts);

DELETE FROM vault_documents vd
WHERE vd.order_id IN (SELECT o.id FROM orders o, _v2_cutoff c WHERE o.created_at < c.ts);

-- machine_jobs before quote_requests and orders (it references both).
DELETE FROM machine_jobs mj
USING _v2_cutoff c
WHERE mj.created_at < c.ts;

-- orders before quotes (orders.quote_id -> quotes, NO ACTION).
-- order_line_items / order_status_history / order_attachments are ON DELETE
-- CASCADE and go with the parent.
DELETE FROM orders o
USING _v2_cutoff c
WHERE o.created_at < c.ts;

-- quotes before quote_requests (quotes.request_id -> quote_requests).
-- quote_line_items is ON DELETE CASCADE.
DELETE FROM quotes q
USING _v2_cutoff c
WHERE q.created_at < c.ts;

DELETE FROM quote_requests qr
USING _v2_cutoff c
WHERE qr.submitted_at < c.ts;

-- Saved FlashDraft profiles. The self-referencing source_profile_id FK is
-- ON DELETE SET NULL, so order within the table does not matter.
DELETE FROM saved_configurations sc
USING _v2_cutoff c
WHERE sc.created_at < c.ts;

DROP TABLE _v2_cutoff;

COMMIT;
