-- 027_profile_modify_lineage.sql
--
-- 2026-09-30. "Modify in FlashDraft" (Part 1): opening a saved profile for
-- modification always creates a NEW, UNLOCKED saved_configurations row linked
-- to the one it came from. This adds the link.
--
-- source_profile_id is the "modified from" pointer. ON DELETE SET NULL, not
-- CASCADE: deleting an original must never delete the revisions drawn from it
-- — the child is real work in its own right and only loses its provenance.
--
-- The revision number itself already lives in dimensions->>'revision' (see
-- app/studio/draft/page.tsx's save payload) and stays there; this migration
-- does not move it.
--
-- IDEMPOTENT: every statement is IF NOT EXISTS / guarded, so re-running is a
-- no-op. RLS: saved_configurations already has row-level policies keyed on
-- user_id/company_id (024_profile_passport_company_scope.sql's
-- profile_passport_select and friends). A new COLUMN is covered by those
-- existing row policies automatically — there is no column-level grant to
-- add, and no new table, so no new policy is required. Verified after apply
-- by re-reading pg_policies for the table.

BEGIN;

ALTER TABLE saved_configurations
  ADD COLUMN IF NOT EXISTS source_profile_id uuid;

-- Separate guarded block for the FK so re-running cannot raise
-- "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'saved_configurations_source_profile_id_fkey'
  ) THEN
    ALTER TABLE saved_configurations
      ADD CONSTRAINT saved_configurations_source_profile_id_fkey
      FOREIGN KEY (source_profile_id)
      REFERENCES saved_configurations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Lineage lookups are "show me everything derived from this profile", so the
-- index is on the pointer, not the id.
CREATE INDEX IF NOT EXISTS saved_configurations_source_profile_id_idx
  ON saved_configurations(source_profile_id)
  WHERE source_profile_id IS NOT NULL;

COMMENT ON COLUMN saved_configurations.source_profile_id IS
  'The profile this one was created from via "Modify in FlashDraft" (Part 1, 2026-09-30). NULL for originals. ON DELETE SET NULL so deleting an original never deletes its revisions.';

COMMIT;
