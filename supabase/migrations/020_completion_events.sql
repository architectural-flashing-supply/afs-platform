-- ============================================================================
-- 020_completion_events.sql
-- Adds `completion_events` — one row per shop-floor job completion
-- (afs-fl-003's "Mark Complete" tap at /field/shop), recording the event.
-- `status` defaults to 'pending_integration' and the three boolean flags all
-- default to false; afs-fl-014's delivery/invoice/email automation
-- (lib/utils/shop-job-completion.ts) does not currently flip them — it acts
-- directly on the matched `orders` row instead, since these flags predate
-- that automation's design and no code path updates them.
--
-- CONFIRMED APPLIED LIVE — verified directly against the live Supabase
-- project (information_schema + a live query against this table), 2026-08-24
-- and reconfirmed 2026-08-26. Per this project's standing migration-
-- verification standard (see SESSION_STATE.md), a migration's live-apply
-- status is never assumed from its presence on disk.
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
