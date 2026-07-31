-- ============================================================================
-- 011_orders_quote_id_unique.sql
-- orders.quote_id — add a real UNIQUE constraint
-- Source: ORDER_LIFECYCLE_DECISION.md / qtoq-001b follow-up audit
--
-- createOrderFromQuote() (lib/data/orders.ts) is documented as "idempotent on
-- quote_id" and is now called from two independently-triggered paths for the
-- same card payment: the Stripe webhook (app/api/webhooks/stripe/route.ts)
-- and the client-side app/api/checkout/confirm-order fallback added in
-- qtoq-001b. Both can run concurrently for the same quote (the client fires
-- confirm-order in the same tick Stripe fires its webhook). The function's
-- only guard was a SELECT-for-existing-row followed by an INSERT — a
-- check-then-act race with no atomicity, and `orders` had no DB-level
-- constraint on quote_id (only a non-unique idx_orders_quote index from
-- 001_initial_schema.sql) to catch the race if the check lost. Two
-- concurrent calls could both pass the SELECT before either INSERT
-- committed, producing two `orders` rows (and two `order_line_items` sets)
-- for one quote.
--
-- This constraint makes the second concurrent INSERT fail with a real
-- Postgres unique-violation (23505) instead of silently succeeding.
-- lib/data/orders.ts's createOrderFromQuote() catches that specific error
-- and re-queries for the row the winning call created, so both callers
-- still return the same { orderId, orderNumber } — see that function's
-- comment for the code-side half of this fix.
-- ============================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'orders'
    AND nsp.nspname = 'public'
    AND con.contype = 'u'
    AND con.conkey = (
      SELECT ARRAY[attnum]
      FROM pg_attribute
      WHERE attrelid = rel.oid AND attname = 'quote_id'
    );

  IF v_constraint_name IS NULL THEN
    ALTER TABLE orders ADD CONSTRAINT orders_quote_id_unique UNIQUE (quote_id);
  END IF;
END $$;

-- ============================================================================
-- End 011_orders_quote_id_unique.sql
-- ============================================================================
