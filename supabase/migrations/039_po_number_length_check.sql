-- 039_po_number_length_check.sql
-- AFS — Architectural Flashing Supply
-- Purchase Order Integration (ovn item 07-purchase-order)
--
-- NOT APPLIED. Authored as a file only; apply from the Supabase SQL editor
-- after reading the NOT VALID note below.
--
-- ============================================================================
-- WHAT THIS DOES NOT DO: IT DOES NOT ADD `companies.require_po`
-- ============================================================================
-- That column ALREADY EXISTS and has since the initial schema —
-- `001_initial_schema.sql:71`:
--
--     require_po      BOOLEAN NOT NULL DEFAULT false,
--
-- It is documented in SCHEMA.md TABLE 2, and `credit_limit` beside it is
-- already written by app/api/admin/credit-applications/[id]/route.ts. Item
-- 07-purchase-order was briefed to "add a company setting for require_po";
-- a live read of the schema showed there was nothing to add, so adding a
-- second column would have duplicated applied schema. The item wired a READER
-- to the existing column instead (checkout + the create-intent guard) and a
-- general admin WRITER (app/api/admin/companies/[id]/route.ts), and this
-- migration contributes the one schema fact the feature was actually missing.
--
-- ============================================================================
-- WHAT THIS DOES: MAKES THE 50-CHARACTER LIMIT A DATABASE FACT
-- ============================================================================
-- SPEC_PURCHASE_ORDER_INTEGRATION.md §2 says "Max: 50 characters". Until now
-- that limit existed nowhere at all — not in the schema, not in the API, not
-- even as a `maxLength` on the input. `lib/checkout/po-number.ts` now enforces
-- it in application code (`PO_NUMBER_MAX_LENGTH`), and this puts the same
-- number in Postgres, which is the posture CLAUDE.md rules #15, #19 and #20
-- already take for rush sourcing, the price book and the pricing ledger: the
-- database refuses what the application should never have sent.
--
-- It is not belt-and-braces for its own sake. `orders.po_number` is written by
-- three separate code paths — the net-terms branch of
-- app/api/checkout/create-intent, the Stripe webhook, and the confirm-order
-- fallback — all of which route through `createOrderFromQuote`. A fourth
-- writer added later without going through `validatePoNumber` would reintroduce
-- the defect silently. With this constraint it fails loudly instead.
--
-- The 500-character ceiling it keeps us under is real: Stripe caps a
-- PaymentIntent metadata VALUE at 500 characters, and checkout's card path
-- puts the PO number into metadata. Before the limit existed, a long paste made
-- `paymentIntents.create` throw and the customer saw only a generic "Could not
-- start checkout".
--
-- ============================================================================
-- WHY `NOT VALID` — THIS IS LOAD-BEARING, DO NOT "TIDY" IT AWAY
-- ============================================================================
-- `NOT VALID` tells Postgres to enforce the constraint on every future INSERT
-- and UPDATE while NOT scanning or rejecting rows that already exist. That
-- matters because this file is authored without access to the live data: if any
-- historical row already holds a PO longer than 50 characters, a validating
-- constraint would make the migration itself fail, and a failed migration on
-- `orders` is a far worse outcome than one legacy row that is too long.
--
-- It also takes only a SHARE ROW EXCLUSIVE lock and no full table scan, so it
-- is safe to apply to a live table.
--
-- Promoting it is a SEPARATE, DELIBERATE STEP for a human who can first see
-- what is actually in the column:
--
--     SELECT id, char_length(po_number) AS len, po_number
--     FROM orders
--     WHERE po_number IS NOT NULL AND char_length(po_number) > 50;
--     -- repeat for quote_requests and invoices
--
--     -- only once those queries return no rows:
--     ALTER TABLE orders         VALIDATE CONSTRAINT orders_po_number_length;
--     ALTER TABLE quote_requests VALIDATE CONSTRAINT quote_requests_po_number_length;
--     ALTER TABLE invoices       VALIDATE CONSTRAINT invoices_po_number_length;
--
-- ============================================================================
-- WHY ALL THREE TABLES
-- ============================================================================
-- `po_number` exists on three tables, each written by a different flow, and all
-- three are the same customer reference:
--   orders.po_number          001_initial_schema.sql:442 — checkout
--   quote_requests.po_number  001_initial_schema.sql:565 — /quote, /upload,
--                                                          FlashDraft, field app
--   invoices.po_number        035_price_book_ledger_quotes_invoices.sql:318
--                                                        — copied from the quote
-- Constraining only `orders` would leave the quote-request intake free to store
-- a 2,000-character value that then flows into an invoice via
-- lib/invoices/create.ts.
--
-- NULL is explicitly allowed on all three: NULL means "no PO", which is the
-- normal case for a customer whose company does not require one.
--
-- `char_length` not `length`: on text they agree, but char_length is the
-- explicit character-count spelling and is what the application's
-- `String.prototype.length` check approximates.
--
-- ADDITIVE AND REVERSIBLE. No column is added, renamed, dropped or retyped; no
-- data is modified. The down SQL is at the bottom of this file.
-- ============================================================================

ALTER TABLE orders
  ADD CONSTRAINT orders_po_number_length
  CHECK (po_number IS NULL OR char_length(po_number) <= 50)
  NOT VALID;

ALTER TABLE quote_requests
  ADD CONSTRAINT quote_requests_po_number_length
  CHECK (po_number IS NULL OR char_length(po_number) <= 50)
  NOT VALID;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_po_number_length
  CHECK (po_number IS NULL OR char_length(po_number) <= 50)
  NOT VALID;

COMMENT ON CONSTRAINT orders_po_number_length ON orders IS
  'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 "Max: 50 characters". Mirrors PO_NUMBER_MAX_LENGTH in lib/checkout/po-number.ts. NOT VALID: enforced on new writes only, see migration 039.';
COMMENT ON CONSTRAINT quote_requests_po_number_length ON quote_requests IS
  'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 "Max: 50 characters". Mirrors PO_NUMBER_MAX_LENGTH in lib/checkout/po-number.ts. NOT VALID: enforced on new writes only, see migration 039.';
COMMENT ON CONSTRAINT invoices_po_number_length ON invoices IS
  'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 "Max: 50 characters". Mirrors PO_NUMBER_MAX_LENGTH in lib/checkout/po-number.ts. NOT VALID: enforced on new writes only, see migration 039.';

-- ============================================================================
-- DOWN
-- ============================================================================
-- Fully reversible; drops three constraints and nothing else. No data loss is
-- possible, because no data was changed.
--
--   ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_po_number_length;
--   ALTER TABLE quote_requests DROP CONSTRAINT IF EXISTS quote_requests_po_number_length;
--   ALTER TABLE invoices       DROP CONSTRAINT IF EXISTS invoices_po_number_length;
--
-- (Dropping a constraint drops its COMMENT with it.)
-- ============================================================================
