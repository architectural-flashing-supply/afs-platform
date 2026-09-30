-- 033_building_codes_public_read.sql
-- Command Center V2, prompt v2-01 step 5 — Building Codes MOVES to the public
-- site's Resources menu.
--
-- 022 created building_code_jurisdictions with an admin-only FOR ALL policy,
-- because at the time the only read surface was an admin page and its own
-- comment said to "widen with a SELECT policy ... when [the public read
-- surface] is built". It is built now: /resources/building-codes.
--
-- What is in this table is public reference content — which government body
-- has adopted a building code in a given Texas county or city, and the URL
-- proving it. No customer data, no pricing, nothing internal. Anonymous read
-- is correct and is what a public Resources page needs, since a visitor has
-- no auth.uid() for RLS to match.
--
-- Writes stay admin-only. The existing FOR ALL admin policy is left exactly
-- as it is; this only ADDS a SELECT policy, so admin write access is
-- unchanged and nothing anonymous can modify a row.
--
-- NOTE: 022 itself had never been applied to the live database before this
-- run — the table did not exist, so the admin page was reading a missing
-- relation. 022 was applied first (480 rows: 254 Texas counties + 226 cities),
-- then this.
--
-- IDEMPOTENT: guarded policy create.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'building_code_jurisdictions'
      AND policyname = 'building_code_jurisdictions_public_read'
  ) THEN
    CREATE POLICY building_code_jurisdictions_public_read
      ON building_code_jurisdictions
      FOR SELECT
      USING (true);
  END IF;
END $$;

COMMIT;
