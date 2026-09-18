-- ============================================================================
-- 025_profile_passport_thumbnail.sql
-- Profile Passport — real canvas screenshot thumbnails, replacing the
-- generic vector-shape preview (CanonicalProfileDiagram) with an actual
-- capture of what the user drew.
--
-- **NOT YET APPLIED TO THE LIVE DATABASE** — same reason as
-- 024_profile_passport_company_scope.sql: this session has no Supabase
-- access to the real afs-website project. Apply after (or together with)
-- migration 024, which this depends on only in the sense that it targets
-- the same table — there is no ordering dependency between their actual
-- column changes.
--
-- Stored as TEXT (a full `data:image/png;base64,...` data URI, written
-- directly by the client as-is, so the frontend can drop it straight into
-- an <img src> with no server-side decode step) rather than BYTEA — this
-- table's client writer is the Supabase browser client (RLS-enforced, not
-- a service-role/admin route), and the JS `HTMLCanvasElement.toDataURL()`
-- API this feature uses (app/studio/draft/page.tsx) already returns a data
-- URI string, not a raw byte buffer; storing it as TEXT avoids a
-- base64<->bytea round-trip for no benefit, since nothing ever queries or
-- indexes into the image bytes themselves.
--
-- No index — this column is never filtered, searched, or joined on, only
-- fetched alongside its own row by primary key (same access pattern as
-- `dimensions`/`job_info`, neither of which are indexed either).
-- ============================================================================

ALTER TABLE saved_configurations
  ADD COLUMN IF NOT EXISTS thumbnail_image TEXT;

-- ============================================================================
-- End 025_profile_passport_thumbnail.sql
-- ============================================================================
