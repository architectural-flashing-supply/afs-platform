-- ============================================================================
-- 007_delivery_tracking.sql
-- Delivery Tracking + Employee PWA + GBP Photo Queue
-- Source: SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md ??6 ("Migration 007")
--
-- What this migration does, in order:
--
--   1. CREATE TABLE driver_locations — GPS pings posted by the Employee PWA
--      (POST /api/driver/location) while an order is out_for_delivery. RLS:
--      an operator/admin can INSERT a row for themselves only
--      (auth.uid() = driver_id); there is deliberately NO direct SELECT
--      policy on this table for anon/public. Per the spec's own instruction
--      ("no direct token exposure"), public tracking reads go through a new
--      SECURITY DEFINER function, get_tracking_data(p_tracking_token text),
--      instead of an RLS policy that would need the token compared inside
--      USING() — a function keeps the token match server-side and never
--      requires granting anon a standing SELECT grant on the table itself.
--
--   2. CREATE TABLE delivery_notifications — one row per order, flags so the
--      10-mile SMS / dispatch SMS+email / invoice-sent notifications each
--      fire exactly once. Admin-only RLS (FOR ALL), matching the existing
--      `notifications` table's precedent in 001_initial_schema.sql — every
--      write happens from server routes using the service-role client, the
--      same pattern already used by every other notification-adjacent table
--      in this schema.
--
--   3. CREATE TABLE gbp_photo_queue — photos an operator queues from the PWA
--      for Google Business Profile posting. RLS: operator/admin can INSERT
--      their own row (queued_by = auth.uid()); operator/admin can SELECT and
--      UPDATE all rows (review/approve/reject/post is a shared queue, not
--      per-uploader-owned, since Steve and Christian both need to see and
--      act on each other's queued photos).
--
--   4. ALTER TABLE orders — adds packaged_at/dispatched_at/delivered_at
--      timestamps, assigned_driver_id, and a unique tracking_token
--      (DEFAULT gen_random_uuid()::text, backfills every existing row with
--      a distinct token on apply since the default is volatile, not a
--      constant — verified Postgres behavior, not a gap).
--
--      NOT done here, flagged rather than silently expanded: orders.status's
--      existing CHECK constraint (submitted/received/in_queue/cutting/
--      bending/qc/ready/shipped/delivered/cancelled) does not include the
--      spec's employee-PWA-driven values 'packaged'/'out_for_delivery'/
--      'in_production' (??3 of the spec references these as status values,
--      not just timestamp columns). Only the 5 columns explicitly listed in
--      the task were added — widening the status CHECK is a real follow-up
--      task, not done in this migration since it wasn't in the requested
--      column list and changing a live CHECK constraint's allowed values is
--      a bigger decision than adding nullable timestamp columns.
--
--   5. profiles.role — adds 'operator' as a permitted role value.
--      DEVIATION FROM THE SPEC, confirmed against the real schema before
--      writing this: SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md ??6 says
--      `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operator'` — but per
--      SCHEMA.md TABLE 1 and the real 001_initial_schema.sql (verified on
--      disk, not from memory), profiles.role is a plain TEXT column with an
--      inline, unnamed CHECK constraint
--      (CHECK (role IN ('admin','contractor','architect','customer'))) —
--      there is no `user_role` enum type anywhere in this schema, so the
--      spec's literal ALTER TYPE statement would fail outright. Implemented
--      instead as a DO block that looks up the real (Postgres-auto-named)
--      CHECK constraint on profiles.role via pg_constraint, drops it, and
--      re-adds it with 'operator' included — safer than hardcoding a
--      guessed constraint name (e.g. profiles_role_check), which would
--      silently no-op via DROP CONSTRAINT IF EXISTS if the guess were wrong
--      and leave the old, narrower constraint still blocking 'operator'.
--
--   6. (Added for d-002, the customer tracking map build) — two gaps found
--      while wiring /track/[orderId] + /api/track/[token] against this
--      migration's own already-committed design, neither in the original
--      task list above but both required for the feature to actually work
--      rather than silently do nothing:
--
--      a) orders.status's CHECK constraint (widened here the same
--         drop/re-add way as profiles.role just above, for the same
--         reason — no guessed constraint name) still only allowed the
--         original 10 values. The tracking page's entire live-driver-dot
--         branch is keyed on status = 'out_for_delivery', a value this
--         constraint didn't permit at all — no order could ever actually
--         reach that status. Section 4 above's own comment already flagged
--         this exact gap as "a real follow-up task" and deliberately left
--         it undone; this is that follow-up. Added 'packaged',
--         'out_for_delivery', 'in_production' — the three PWA/CRM-facing
--         values SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md ??3/??4
--         reference — without removing or renaming any existing value, so
--         every current admin production-queue stage (in_queue/cutting/
--         bending/qc/etc.) is untouched. Note 'in_production' overlaps
--         conceptually with those existing granular stages; reconciling
--         that is out of scope for this build (tracking-map only) and is
--         flagged, not resolved, here.
--
--      b) get_tracking_data(text) originally returned only order_id/
--         order_status/delivery_address/driver_lat/lng/recorded_at — no
--         order_number or delivery_method. The tracking page needs
--         order_number to display ("Order #AFS-2026-00001") and
--         delivery_method to correctly treat pickup orders as "not
--         trackable on a map" (there's no jobsite delivery to show a pin
--         for). Widened the function's RETURNS TABLE and SELECT list to
--         include both — same SECURITY DEFINER function, no new grants
--         needed since GRANT EXECUTE already covers any signature change
--         to the same function name/arg list.
--
--      c) driver_locations had (deliberately, per point 1 above) no
--         anon-reachable SELECT policy at all — correct for the
--         token-exchange HTTP read via get_tracking_data(), but it means a
--         genuinely anonymous browser session subscribing directly via
--         Supabase Realtime (`supabase.channel(...).on('postgres_changes',
--         { table: 'driver_locations', filter: 'order_id=eq...' })`, the
--         mechanism the task explicitly asked for on the live blue dot)
--         would receive nothing — Realtime enforces the same RLS as a
--         direct SELECT for the subscribing role, and anon had no policy
--         granting one. Fixed with a narrow, scoped addition: a new
--         is_order_out_for_delivery(uuid) SECURITY DEFINER helper
--         (mirrors is_admin()/is_operator()'s existing pattern in this
--         same file, so the check itself isn't blocked by orders' own RLS
--         when evaluated inside another table's policy) plus a
--         public_select_active_delivery_locations policy that opens
--         SELECT (anon + authenticated) on a driver_locations row only
--         while its parent order.status = 'out_for_delivery'. This does
--         NOT expose the tracking_token itself and does not grant access
--         to any other order state — the moment an order leaves
--         out_for_delivery, rows for it stop matching. The credential this
--         relies on is knowledge of the order's UUID `order_id` (returned
--         by get_tracking_data only to a caller who already presented the
--         correct tracking_token), not the token itself — an accepted,
--         narrower echo of the same "unguessable opaque id" trust model
--         the tracking_token itself already uses, not a new one.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. driver_locations
-- ----------------------------------------------------------------------------
CREATE TABLE driver_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    UUID REFERENCES profiles(id),
  order_id     UUID REFERENCES orders(id),
  lat          DECIMAL(10,7) NOT NULL,
  lng          DECIMAL(10,7) NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_order ON driver_locations(order_id);
CREATE INDEX idx_driver_locations_recorded ON driver_locations(recorded_at DESC);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operator_insert_own_locations" ON driver_locations
  FOR INSERT
  WITH CHECK (auth.uid() = driver_id AND is_operator());

CREATE POLICY "admin_all_driver_locations" ON driver_locations
  FOR ALL USING (is_admin());

-- SECURITY DEFINER: the public tracking page (/track/[orderId]) is
-- unauthenticated by design (no login required, per the spec) — it cannot
-- satisfy any auth.uid()-based RLS policy. This function runs as its owner,
-- bypassing RLS on both orders and driver_locations, and does the token
-- match itself so no anon-facing SELECT policy needs to exist on either
-- table. Returns at most one row (the order + its latest ping), joined via
-- a LATERAL subquery rather than exposing the full location history.
-- Widened for d-002 (see point 6b at the top of this file): added
-- order_number + delivery_method so the tracking page can display the
-- order number and correctly skip pickup orders (no jobsite to map).
CREATE OR REPLACE FUNCTION get_tracking_data(p_tracking_token TEXT)
RETURNS TABLE (
  order_id          UUID,
  order_number      TEXT,
  order_status      TEXT,
  delivery_method   TEXT,
  delivery_address  JSONB,
  driver_lat        DECIMAL(10,7),
  driver_lng        DECIMAL(10,7),
  driver_recorded_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    o.id,
    o.order_number,
    o.status,
    o.delivery_method,
    o.delivery_address,
    dl.lat,
    dl.lng,
    dl.recorded_at
  FROM orders o
  LEFT JOIN LATERAL (
    SELECT lat, lng, recorded_at
    FROM driver_locations
    WHERE driver_locations.order_id = o.id
    ORDER BY recorded_at DESC
    LIMIT 1
  ) dl ON true
  WHERE o.tracking_token = p_tracking_token;
$$;

GRANT EXECUTE ON FUNCTION get_tracking_data(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. delivery_notifications
-- ----------------------------------------------------------------------------
CREATE TABLE delivery_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) UNIQUE,
  ten_mile_sent       BOOLEAN NOT NULL DEFAULT false,
  ten_mile_sent_at    TIMESTAMPTZ,
  dispatch_sms_sent   BOOLEAN NOT NULL DEFAULT false,
  dispatch_email_sent BOOLEAN NOT NULL DEFAULT false,
  invoice_sent        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_delivery_notifications_order ON delivery_notifications(order_id);

ALTER TABLE delivery_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_delivery_notifications" ON delivery_notifications
  FOR ALL USING (is_admin());

-- ----------------------------------------------------------------------------
-- 3. gbp_photo_queue
-- ----------------------------------------------------------------------------
CREATE TABLE gbp_photo_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queued_by    UUID REFERENCES profiles(id),
  storage_key  TEXT NOT NULL,
  caption      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending_review'
               CHECK (status IN ('pending_review','approved','rejected','posted')),
  queued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES profiles(id),
  posted_at    TIMESTAMPTZ
);

CREATE INDEX idx_gbp_photo_queue_queued_by ON gbp_photo_queue(queued_by);
CREATE INDEX idx_gbp_photo_queue_status ON gbp_photo_queue(status);

ALTER TABLE gbp_photo_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operator_insert_own_photos" ON gbp_photo_queue
  FOR INSERT
  WITH CHECK (auth.uid() = queued_by AND is_operator());

CREATE POLICY "operator_admin_select_photos" ON gbp_photo_queue
  FOR SELECT USING (is_operator());

CREATE POLICY "operator_admin_update_photos" ON gbp_photo_queue
  FOR UPDATE USING (is_operator());

-- ----------------------------------------------------------------------------
-- 4. orders — new delivery-lifecycle columns
-- ----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS packaged_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS tracking_token     TEXT UNIQUE DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token);

-- ----------------------------------------------------------------------------
-- 5. profiles.role — add 'operator'
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER helper, matching is_admin()'s existing pattern in
-- 001_initial_schema.sql (avoids re-triggering RLS on profiles and gives
-- every new policy above a single shared definition of "operator or admin").
CREATE OR REPLACE FUNCTION is_operator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator', 'admin')
  );
$$;

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'profiles'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%IN%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin','contractor','architect','customer','operator'));
END $$;

-- ----------------------------------------------------------------------------
-- 6a. orders.status — widen to include the Employee PWA / tracking-map
--     statuses (see point 6a at the top of this file). Same drop/re-add
--     technique as profiles.role just above, for the same reason.
-- ----------------------------------------------------------------------------
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
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%IN%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'submitted','received','in_queue','cutting','bending','qc','ready',
      'shipped','delivered','cancelled',
      'packaged','out_for_delivery','in_production'
    ));
END $$;

-- ----------------------------------------------------------------------------
-- 6b. driver_locations — public Realtime read while an order is actively
--     out for delivery (see point 6c at the top of this file).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_order_out_for_delivery(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders WHERE id = p_order_id AND status = 'out_for_delivery'
  );
$$;

CREATE POLICY "public_select_active_delivery_locations" ON driver_locations
  FOR SELECT USING (is_order_out_for_delivery(order_id));

-- ============================================================================
-- End 007_delivery_tracking.sql
-- ============================================================================
