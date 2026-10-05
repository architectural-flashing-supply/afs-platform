-- 040_product_profiles_public_read.sql
-- Overnight item 02-trim-optimizer ΓÇö the Trim Length Optimizer never renders
-- for a signed-out visitor, and this is why.
--
-- WHAT IS BROKEN TODAY. 001_initial_schema.sql:195 is the only SELECT policy
-- product_profiles has ever had:
--
--   CREATE POLICY "authenticated_read_profiles" ON product_profiles
--     FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
--
-- app/quote/page.tsx is deliberately PUBLIC ΓÇö a guest submits a quote request
-- without ever logging in, which is the whole point of the email-capture panel
-- on step 4 (see tests/e2e/quote-request.spec.ts's own header). A guest has no
-- auth.uid(), so that policy filters every row out. PostgREST then returns an
-- EMPTY RESULT AND NO ERROR, which the app cannot tell apart from "this
-- profile has no standard stock length" ΓÇö so the cut list simply never
-- appears, silently, for every visitor who is not signed in.
--
-- Proven, not reasoned about: the same Playwright flow renders
-- "You need 47 LF. We stock this profile in 10 ft lengths." with a session and
-- renders nothing at all without one. tests/e2e/trim-optimizer-quote-states.spec.ts
-- therefore runs authenticated, and says in its header that it does so because
-- of this.
--
-- WHAT THIS TABLE HOLDS, AND WHY ANONYMOUS READ IS CORRECT. Profile name, slug,
-- category, description, the dimensional ranges AFS will fabricate between, and
-- the standard and maximum stock lengths. It is public catalog content: the
-- same rows are already served to anonymous visitors through the public product
-- catalog and /architects/cad-library. There is NO customer data in it, NO
-- pricing, and nothing internal ΓÇö CLAUDE.md rule #1 is untouched, because a
-- stock length is a quantity, not a price.
--
-- Follows the pattern 033_building_codes_public_read.sql established for
-- exactly this situation, including its reasoning: a public read surface needs
-- a policy a visitor with no auth.uid() can satisfy.
--
-- is_active = true IS KEPT. A retired profile stays invisible, exactly as it is
-- to a signed-in user today. This widens WHO can read an active row; it does
-- not widen WHICH rows are readable.
--
-- WRITES ARE UNCHANGED. 001's admin_write_profiles FOR ALL policy is left
-- exactly as it is and this migration only ADDS a SELECT policy, so nothing
-- anonymous can modify a row.
--
-- NOT APPLIED BY THE RUN THAT WROTE IT. The overnight brief forbids applying a
-- migration to Supabase, so this is a file only. Until it is applied, the
-- customer-facing cut list remains invisible to signed-out visitors ΓÇö recorded
-- as an open gap in STATE_OF_THE_BUILD.md rather than quietly left as a
-- mystery.
--
-- IDEMPOTENT: guarded policy create.
--
-- DOWN (reverses this file exactly, restoring authenticated-only read):
--   DROP POLICY IF EXISTS product_profiles_public_read ON product_profiles;

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_profiles'
      AND policyname = 'product_profiles_public_read'
  ) THEN
    CREATE POLICY product_profiles_public_read
      ON product_profiles
      FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

COMMIT;

