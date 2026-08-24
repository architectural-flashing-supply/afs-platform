-- ============================================================================
-- 020_completion_events.sql
-- Adds `completion_events` — one row per shop-floor job completion
-- (afs-fl-003's "Mark Complete" tap at /field/shop), recording the event for
-- a future delivery-scheduling / invoice / customer-email automation chain
-- to consume later. This migration does NOT build that automation — no
-- Resend, Twilio, or other external API call is wired to this table by this
-- migration or by afs-fl-003's app code. `status` defaults to
-- 'pending_integration' and the three boolean flags all default to false
-- until that future automation actually runs and flips them.
--
-- FILE ONLY — this migration is written and committed but has NOT been
-- applied to the live Supabase project. Per this project's standing
-- migration-verification standard (see SESSION_STATE.md), a migration's
-- live-apply status is never assumed from its presence on disk — it must
-- be verified directly against the live database (via information_schema
-- in the Supabase Dashboard SQL Editor) before anything depends on it.
-- ============================================================================

CREATE TABLE completion_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_profile_library_id UUID NOT NULL REFERENCES shop_profile_library(id),
  order_number            TEXT,
  completed_at            TIMESTAMPTZ NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending_integration',
  delivery_scheduled      BOOLEAN NOT NULL DEFAULT false,
  invoice_generated       BOOLEAN NOT NULL DEFAULT false,
  email_sent              BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_completion_events_shop_profile_library_id ON completion_events(shop_profile_library_id);
CREATE INDEX idx_completion_events_status ON completion_events(status);

ALTER TABLE completion_events ENABLE ROW LEVEL SECURITY;

-- Admin only, single FOR ALL policy — same shape as shop_profile_library's
-- own "admin_all_shop_profile_library" (016_source_tool_and_shop_profile_
-- library.sql), the table this one is written from. Shop staff use the
-- existing 'admin' role, so no new role or profiles.role CHECK constraint
-- change is introduced here, matching afs-fl-001's decision for
-- shop_profile_library itself.
CREATE POLICY "admin_all_completion_events" ON completion_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- End 020_completion_events.sql
-- ============================================================================
