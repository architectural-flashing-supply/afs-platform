-- ============================================================================
-- 008_order_geocoding.sql
-- Adds a geocode cache to orders — source: d-003 task (driver GPS API /
-- 10-mile SMS trigger), lib/utils/geocode.ts.
--
-- POST /api/driver/location needs a lat/lng for the order's jobsite to run
-- the Haversine distance check against the driver's live GPS ping. Orders
-- only ever store the jobsite as a JSONB street address (orders.delivery_
-- address — see SCHEMA.md TABLE 18 and 007_delivery_tracking.sql), which
-- has to be geocoded through the Google Maps Geocoding API before any
-- distance math is possible. Geocoding the same address on every 30-second
-- GPS ping for the whole delivery run would be both slow and wasteful, so
-- the result is cached on the order the first time it's needed and reused
-- on every later ping for that order.
--
-- DECIMAL(10,7) matches driver_locations.lat/lng's existing precision
-- (007_delivery_tracking.sql) rather than inventing a different one.
-- Nullable + no default: most orders will never need this (pickup orders
-- have no jobsite to geocode at all), and it's only populated lazily by the
-- API route, not backfilled here.
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS geocoded_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS geocoded_lng DECIMAL(10,7);

-- ============================================================================
-- End 008_order_geocoding.sql
-- ============================================================================
