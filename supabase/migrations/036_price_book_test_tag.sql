-- 036_price_book_test_tag.sql
--
-- Command Center V2 prompt v2-03, second pass.
--
-- THE PROBLEM THIS SOLVES. `price_book_versions` is append-only (migration
-- 035's `afs_append_only` trigger), which is exactly right: it is what makes
-- "an already-issued quote keeps the prices it was built on, forever" a fact
-- about the database rather than a promise about the code.
--
-- But the end-to-end test has to PRICE something to prove a quote can be
-- issued, an approval can create an invoice, and both land in the pricing
-- history — and then it has to leave the database exactly as it found it. With
-- no escape at all, every test run would permanently add a made-up price to
-- Steve's real price book.
--
-- THE ESCAPE, AND WHY IT IS NOT A HOLE. `afs_append_only` already allows a
-- DELETE when `to_jsonb(OLD) ->> 'test_tag'` is not null; it was written
-- column-agnostically for this. Adding the column here extends the SAME rule to
-- the price book:
--
--   * `test_tag` is NULL on every row any production path writes. The price
--     book editor route (app/api/admin/price-book/route.ts) never sets it — it
--     does not know the column exists.
--   * The only writer is the E2E harness, against its OWN price book row
--     (material and gauge both prefixed `E2E-TEST-`), so a tagged version can
--     never be a version of a real material.
--   * UPDATE is still refused on every row, tagged or not. Nothing about the
--     immutability of a real price changes.
--
-- The alternative was a test that either left fake prices in the shop's price
-- book forever, or never proved the quote path at all. Neither is acceptable.

ALTER TABLE price_book_versions ADD COLUMN IF NOT EXISTS test_tag text;
ALTER TABLE price_book_items    ADD COLUMN IF NOT EXISTS test_tag text;

COMMENT ON COLUMN price_book_versions.test_tag IS
  'NULL on every row any production path writes. Non-null marks an E2E fixture, which is the only kind of row the afs_append_only trigger will allow to be DELETED. UPDATE is refused on every row regardless.';
COMMENT ON COLUMN price_book_items.test_tag IS
  'NULL on every row any production path writes. Non-null marks an E2E fixture, cleaned up at the end of a run.';

-- The editor and the quote calculator both read every row, tagged or not, on
-- purpose: a test fixture that were invisible to the code under test would
-- prove nothing. It is visible for the seconds a run takes, and then it is
-- gone. This index keeps the cleanup sweep exact.
CREATE INDEX IF NOT EXISTS idx_price_book_versions_test_tag
  ON price_book_versions (test_tag) WHERE test_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_book_items_test_tag
  ON price_book_items (test_tag) WHERE test_tag IS NOT NULL;
