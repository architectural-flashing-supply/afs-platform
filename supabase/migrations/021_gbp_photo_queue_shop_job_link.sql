-- ============================================================================
-- 021_gbp_photo_queue_shop_job_link.sql
-- Adds `shop_profile_library_id` to the EXISTING gbp_photo_queue table
-- (007_delivery_tracking.sql) so a delivery photo captured from a shop-floor
-- job at /field/shop (afs-fl-004) can be tied back to the shop_profile_library
-- row it belongs to. This is additive and backward-compatible: every existing
-- Employee PWA row (components/employee/EmployeePhotoUploader.tsx ->
-- app/api/gbp/queue/route.ts) simply leaves this column NULL, unaffected.
--
-- Deliberately NOT a new `delivery_photos` table — gbp_photo_queue is already
-- a fully wired queue-review-post pipeline in production use by the Employee
-- PWA (camera upload -> 'gbp-photos' Storage bucket -> POST /api/gbp/queue ->
-- pending_review -> review flips to approved/rejected -> POST /api/gbp/post/
-- [id] calls postPhotoToGbp(), gated on isGbpConfigured() and the manually-
-- provisioned GOOGLE_BUSINESS_ACCESS_TOKEN, neither set per CLAUDE.md's DATA
-- BLOCKERS). afs-fl-004 adds a second way to QUEUE a photo into this same
-- pipeline — it does not add a second way to POST one.
--
-- FILE ONLY — this migration is written and committed but has NOT been
-- applied to the live Supabase project. Per this project's standing
-- migration-verification standard (see SESSION_STATE.md), a migration's
-- live-apply status is never assumed from its presence on disk — it must
-- be verified directly against the live database (via information_schema
-- in the Supabase Dashboard SQL Editor) before anything depends on it.
-- ============================================================================

ALTER TABLE gbp_photo_queue
  ADD COLUMN shop_profile_library_id UUID REFERENCES shop_profile_library(id);

CREATE INDEX idx_gbp_photo_queue_shop_profile_library_id ON gbp_photo_queue(shop_profile_library_id);

-- No RLS change — gbp_photo_queue's existing policies (operator/admin INSERT
-- own row via queued_by = auth.uid(); operator/admin SELECT/UPDATE all rows,
-- 007_delivery_tracking.sql) already cover inserts from /field/shop, since
-- shop staff hold the existing 'admin' role (afs-fl-001's precedent — no new
-- role introduced here either).

-- ============================================================================
-- End 021_gbp_photo_queue_shop_job_link.sql
-- ============================================================================
