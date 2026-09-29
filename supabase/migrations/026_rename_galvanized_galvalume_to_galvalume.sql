-- 026_rename_galvanized_galvalume_to_galvalume.sql
--
-- 2026-09-29. Renames the material "Galvanized Galvalume" to "Galvalume"
-- everywhere it is STORED. Galvalume is itself an aluminum-zinc coating on
-- steel, so "Galvanized Galvalume" named the coating twice.
--
-- The standalone "Galvanized Steel" material (G90 zinc coating, slug
-- 'galvanized-steel') is a DIFFERENT material and is deliberately NOT touched
-- by anything in this file. Every predicate below matches the two-word
-- "Galvanized Galvalume" spelling or the 'galvanized-galvalume' slug only.
--
-- IDEMPOTENT. Every statement is a no-op on a second run: the WHERE clauses
-- only match rows that still hold the old value, and the replace() calls
-- cannot match once the value is already 'Galvalume'.
--
-- Row counts measured live immediately before this ran (2026-09-29):
--   materials              1 of 9   (name + slug)
--   machine_jobs           5 of 30  (material text column)
--   quote_requests         5 of 59  (line_items jsonb)
--   saved_configurations   0 of 25
--   shop_profile_library   0 of 16
--   orders                 0 of 0   (table empty)
-- Ten literal "Galvanized Galvalume" occurrences across machine_jobs and
-- quote_requests, plus the single materials lookup row.
--
-- Application code additionally carries a READ-TIME alias
-- (normalizeMaterialLabel in lib/data/catalog.ts), so any row written by a
-- stale client after this migration still resolves and displays as
-- "Galvalume". This migration and that alias are belt and braces, not
-- alternatives.

BEGIN;

-- 1. The materials lookup table: display name and slug.
UPDATE materials
   SET name = 'Galvalume',
       slug = 'galvalume'
 WHERE name = 'Galvanized Galvalume'
    OR slug = 'galvanized-galvalume';

-- 2. machine_jobs.material — plain text column.
UPDATE machine_jobs
   SET material = 'Galvalume'
 WHERE material = 'Galvanized Galvalume';

-- 3. quote_requests.line_items — jsonb; the label can sit at any depth inside
--    the item array, so rewrite the serialized document. Guarded by the same
--    LIKE predicate so untouched rows are never rewritten (no pointless
--    jsonb churn, and the statement stays a no-op on re-run).
UPDATE quote_requests
   SET line_items = replace(line_items::text, 'Galvanized Galvalume', 'Galvalume')::jsonb
 WHERE line_items::text LIKE '%Galvanized Galvalume%';

-- 4. saved_configurations and shop_profile_library — zero matching rows at the
--    time of writing, but both store the material label inside jsonb and a row
--    could be written between the count and this migration. Same guarded
--    rewrite, over every jsonb column that can carry a material label.
UPDATE saved_configurations
   SET dimensions = replace(dimensions::text, 'Galvanized Galvalume', 'Galvalume')::jsonb
 WHERE dimensions::text LIKE '%Galvanized Galvalume%';

UPDATE saved_configurations
   SET job_info = replace(job_info::text, 'Galvanized Galvalume', 'Galvalume')::jsonb
 WHERE job_info::text LIKE '%Galvanized Galvalume%';

UPDATE shop_profile_library
   SET material = 'Galvalume'
 WHERE material = 'Galvanized Galvalume';

-- 5. orders has no material column at all (verified against
--    information_schema on 2026-09-29: every text column is an order-number,
--    status, delivery, payment or notes field, and its only jsonb column is
--    delivery_address). The material reaches an order through its linked
--    quote_request/machine_job rows, which statements 2 and 3 above already
--    cover, so there is deliberately no UPDATE against orders here.

COMMIT;
