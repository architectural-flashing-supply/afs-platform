-- 031_drop_machine_profile_library.sql
-- Command Center V2, prompt v2-01 step 3 — remove the 911-entry AI-read
-- machine profile library.
--
-- WHY: the geometry in these tables was AI-read out of the OLD Thalmann's own
-- job-history database (ds2801db.bdb) and was never geometrically validated,
-- and most profile names are real customer/hospital/project names. It is the
-- wrong thing to match a customer's drawing against and the wrong thing to
-- hand anyone as a starting point. See docs/COMMAND_CENTER_V2_SPEC.md §2.8.
--
-- BEFORE THIS RAN:
--   * machine-data/ (the only copies of the old machine's raw .bdb/.ds1
--     files) was copied to C:\Users\manag\Documents\afs-assets\old-machine-files\
--     — OUTSIDE the repo — and verified byte-for-byte by size and sha256.
--   * All three tables were dumped to
--     C:\Users\manag\Documents\afs-backups\2026-10-01\ and each dump was
--     proven to rehydrate into typed rows.
--   Row counts removed: machine_profile_bends 4537, machine_profiles 911,
--   machine_profile_categories 46.
--
-- NOT TOUCHED, and must never be confused with these:
--   * shop_profile_library — real send history to the CURRENT Thalmann,
--     including pathfinder_profile_id.
--   * canonical_profiles   — the hand-authored starter library.
--
-- Drop order is child-to-parent: bends -> profiles -> categories.
-- IF EXISTS everywhere, so a re-run is a no-op.

BEGIN;

-- machine_jobs.machine_profile_id pointed at machine_profiles. It was NULL on
-- every one of the 34 rows that existed (verified in spec §2.8), so nothing
-- lost a bend sequence; custom_bends, the FlashDraft-drawn geometry every real
-- job actually used, is now the only bend source. Dropping the whole column
-- rather than only its FK: a uuid column whose referent table no longer exists
-- can never be populated again, and leaving it invites a future reader to try.
ALTER TABLE machine_jobs DROP COLUMN IF EXISTS machine_profile_id;

DROP TABLE IF EXISTS machine_profile_bends;
DROP TABLE IF EXISTS machine_profiles;
DROP TABLE IF EXISTS machine_profile_categories;

COMMIT;
