-- ============================================================================
-- 024_profile_passport_company_scope.sql
-- Profile Passport (Phase 3, afs-pp-001) — company-wide profile sharing +
-- structured columns on saved_configurations.
--
-- NAMING COLLISION NOTE: 023_profile_passport.sql already exists under this
-- same feature name, for a DIFFERENT and unrelated table (custom_profiles —
-- an admin-tracked, AFS-fabricated custom-profile catalog with afs_number/
-- drawing_url/model_3d_url/bend_schedule/is_approved, per
-- SPEC_CUSTOM_PROFILE_LIBRARY.md). That migration is itself file-only,
-- never applied to the live database (see STATE_OF_THE_BUILD.md's PROFILE
-- PASSPORT entry). This migration does not touch custom_profiles at all —
-- "Profile Passport" is this app's marketing name (see
-- ProfilePassportExplainer.tsx) for the FlashDraft-drawn-and-locked
-- saved_configurations feature, which is what this migration extends.
--
-- **NOT YET APPLIED TO THE LIVE DATABASE.** This session has no Supabase
-- access to the real afs-website project (only unrelated projects are
-- visible via the connected Supabase MCP tools), so this file could only be
-- authored and reviewed here, never run or verified against live data.
-- Someone with real project access must apply it (Supabase SQL editor or
-- `supabase db push`) before the Profile Passport feature works AT ALL —
-- the app code shipped alongside this migration (app/studio/draft/page.tsx's
-- performSave, every app/api/profile-passport/* route) writes/reads these
-- columns unconditionally. Until this migration runs, FlashDraft's Save/
-- Lock Profile & Save/Duplicate will fail outright (Postgres rejects an
-- insert/update referencing a column that doesn't exist yet) and every
-- Profile Passport route will error. Apply this FIRST.
--
-- WHAT THIS CHANGES, AND WHY IT'S A REAL BEHAVIOR CHANGE, NOT JUST AN
-- ADDITIVE ONE: saved_configurations today is scoped per-user
-- (`auth.uid() = user_id`) — a user's saved FlashDraft profiles are private
-- to them, even from teammates on the same company account. The Phase 3
-- spec explicitly wants "account-wide ownership" instead: every team
-- member on a company sees every profile saved by anyone on that company.
-- The backfill below sets company_id on every EXISTING row from the saving
-- user's own profiles.company_id — meaning existing rows become visible to
-- that user's whole team the moment this runs, not just new rows going
-- forward. Confirm that's actually wanted for existing data before running
-- this in production, not just for new saves. A user with no company_id
-- (not on a team — the common case today) is unaffected either way: their
-- rows get company_id = NULL and keep exactly today's private-to-them
-- behavior via each policy's own `company_id IS NULL` fallback clause.
--
-- ROLE MAPPING: the Phase 3 spec asks for an Admin/Editor/Viewer role
-- system. profiles.company_role already exists (SCHEMA.md TABLE 1) with a
-- DIFFERENT enum — owner/admin/estimator/pm/accounting/viewer — used by the
-- real, already-shipped Team Accounts feature (app/account/team,
-- /api/team/invite). Per explicit direction, this migration maps onto that
-- existing enum instead of adding a new role column: owner/admin/
-- estimator/pm/accounting => "Editor"-or-above (can view + edit);
-- owner/admin specifically => "Admin" (can also delete); viewer => "Viewer"
-- (read-only). See lib/data/profile-passport.ts for the same mapping
-- expressed in application code.
-- ============================================================================

-- category/subcategory are deliberately plain TEXT here, separate from
-- dimensions->>'categoryId' (a real FK-shaped reference into
-- machine_profile_categories.id, see components/studio/ProfileDetailsModal.tsx)
-- — writing the spec's literal "General"/"Custom" defaults into that FK
-- field would mean a category value pointing at a machine_profile_categories
-- row that doesn't exist. These two columns are just the display-only
-- label the spec actually wants; the real FK is untouched.
ALTER TABLE saved_configurations
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS job_info JSONB,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE INDEX IF NOT EXISTS idx_saved_configurations_company ON saved_configurations(company_id);

-- Backfill company_id for existing rows from the saving user's own profile.
UPDATE saved_configurations sc
SET company_id = p.company_id
FROM profiles p
WHERE sc.user_id = p.id AND sc.company_id IS NULL;

-- Backfill is_locked from the existing dimensions JSONB flag (afs-fl-027)
-- so rows saved before this migration don't silently read back as
-- unlocked.
UPDATE saved_configurations
SET is_locked = COALESCE((dimensions->>'isLocked')::boolean, false)
WHERE dimensions ? 'isLocked';

-- Backfill category/subcategory display labels from dimensions' own
-- categoryId/subcategory (afs-fl-027/afs-jf-006) where present, defaulting
-- to the spec's literal "General"/"Custom" otherwise — matches exactly
-- what a NEW row written by the zero-friction lock-and-save flow gets
-- going forward (see app/studio/draft/page.tsx's lockAndSaveProfile).
UPDATE saved_configurations
SET category = COALESCE(NULLIF(dimensions->>'categoryId', ''), 'General')
WHERE category IS NULL;

UPDATE saved_configurations
SET subcategory = COALESCE(NULLIF(dimensions->>'subcategory', ''), 'Custom')
WHERE subcategory IS NULL;

-- Replace the old per-user-only policy set with company-aware ones. Mirrors
-- companies' own "company_members" policy shape (SCHEMA.md TABLE 2) for the
-- membership check, falling back to the original auth.uid() = user_id match
-- whenever company_id is null (no team involved) so a solo user keeps
-- exactly today's behavior.
DROP POLICY IF EXISTS "users_own_configs" ON saved_configurations;

-- SELECT: any teammate on the same company can see the row, regardless of
-- role (Viewer includes read access, per spec).
CREATE POLICY "profile_passport_select" ON saved_configurations
  FOR SELECT USING (
    (company_id IS NULL AND auth.uid() = user_id)
    OR (
      company_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND profiles.company_id = saved_configurations.company_id)
    )
  );

-- INSERT: company_id must be null or the inserting user's own company —
-- enforced here as a second layer behind the API route's own
-- "never trust company_id from the request body, always set it from the
-- session" rule (app/api/profile-passport/profiles/route.ts). No role
-- restriction — spec doesn't gate who may create a profile, only who may
-- edit/delete an existing one.
CREATE POLICY "profile_passport_insert" ON saved_configurations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      company_id IS NULL
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND profiles.company_id = saved_configurations.company_id)
    )
  );

-- UPDATE: the row's own creator can always edit their own solo (no-company)
-- row, unchanged from today. Once a row is company-scoped, only
-- Editor-or-above company_role values may edit it — Viewer cannot, even if
-- they're the one who originally saved it, per spec's own "Editor:
-- view/edit own profiles, cannot delete... Viewer: read-only" split
-- applying uniformly on a company account.
CREATE POLICY "profile_passport_update" ON saved_configurations
  FOR UPDATE USING (
    (company_id IS NULL AND auth.uid() = user_id)
    OR (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND profiles.company_id = saved_configurations.company_id
          AND profiles.company_role IN ('owner', 'admin', 'estimator', 'pm', 'accounting')
      )
    )
  );

-- DELETE: same solo-row fallback as UPDATE; on a company account, only
-- owner/admin (mapped to the spec's "Admin") may delete — matches
-- "DELETE: ... only Admin role" literally, including for the row's own
-- creator if they're an Editor-tier role.
CREATE POLICY "profile_passport_delete" ON saved_configurations
  FOR DELETE USING (
    (company_id IS NULL AND auth.uid() = user_id)
    OR (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND profiles.company_id = saved_configurations.company_id
          AND profiles.company_role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- End 024_profile_passport_company_scope.sql
-- ============================================================================
