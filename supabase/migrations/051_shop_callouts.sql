-- ============================================================================
-- 051_shop_callouts.sql
-- SHOP CALLOUTS — Steve's arrow-and-note annotations on a FlashDraft profile,
-- authored in the admin Command Center and read on the shop floor.
--
-- ADDITIVE ONLY. One new table, its own indexes, its own RLS. No existing
-- table, column, constraint, policy or function is altered — the shop's own
-- record (`shop_profile_library`) and the customer's request
-- (`quote_requests`) are referenced and never written by anything here.
--
-- Next free number: 050_email_intake.sql is the highest on disk. (039 is the
-- known collision point in this project's history — it is long past.)
--
-- ============ FILE ONLY — NOT APPLIED TO PRODUCTION ============
--
-- Per this project's standing migration-verification standard (SESSION_STATE.md)
-- a migration's live-apply status is never assumed from its presence on disk.
-- This file has been applied and exercised against a LOCAL PostgreSQL 18
-- cluster only (the CHECK constraints below were each proved to refuse the row
-- they are meant to refuse, and every RLS policy was proved against a
-- non-superuser role for all four audiences). The transcript is committed at
-- docs/verification/shop-callouts-051-local-verify.txt. Application to the live
-- Supabase project is PENDING REID.
--
-- ============ WHY THE ANCHOR IS NOT A `segment_id` ============
--
-- A FlashDraft profile is an ARRAY OF POINTS. Segment i is points[i] ->
-- points[i+1]; segments have no identity of their own, are never persisted
-- individually, and CLAUDE.md rule #13 is explicit that a prepend renumbers
-- every index-keyed piece of state in lockstep. A column called `segment_id`
-- would therefore be a fiction: there is no id to put in it.
--
-- So the anchor is stored FOUR ways, and the resolver
-- (lib/shop-callouts/geometry.ts) uses them in order:
--
--   1. `segment_index` + `t`         exact, while the drawing is unchanged
--   2. `seg_ax/ay/bx/by`             the authored segment's own endpoints, so
--                                    "is this still the same segment?" is a
--                                    geometric question, not a trust in an index
--   3. `anchor_x`/`anchor_y`         the authored tip in profile units, re-snapped
--                                    to the nearest point on the edited polyline
--   4. `orphaned`                    nothing within tolerance — the NOTE IS KEPT
--                                    and shown, the arrow is not drawn
--
-- A callout is NEVER deleted because the drawing changed. Losing a shop note
-- silently is the one outcome this design refuses: the shop note is the thing
-- standing between a correct part and a scrapped one.
--
-- EVERY DISTANCE IN THIS TABLE IS IN PROFILE UNITS (INCHES), NEVER SCREEN
-- PIXELS. Zoom, pan, resize and fit-to-view therefore cannot move an arrow.
--
-- ============ NUMBERING IS DERIVED, NOT STORED ============
--
-- "Callout 1..n by creation order" is computed by `numberCallouts()` from
-- `created_at`, in one function both surfaces call. A stored number would go
-- stale the first time Steve deleted callout 2 and leave the shop reading a
-- list that counts 1, 3, 4 while the arrows say 1, 2, 3.
-- ============================================================================

CREATE TABLE shop_callouts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Per existing convention (profiles.company_id -> companies.id, migration
  -- 001). Set SERVER-SIDE from the authoring admin's own profile and never
  -- from a request body. Nullable because an admin with no company_id is a
  -- real row in this database (see 024_profile_passport_company_scope.sql).
  company_id         UUID REFERENCES companies(id),

  -- WHAT THIS CALLOUT IS ON. At least one of the two is required.
  --
  -- `quote_request_id` + `line_item_index` is the authoring key: FlashDraft is
  -- opened from the Command Center as
  -- /studio/draft?admin=1&loadRequest=<id>&item=<n> (flashDraftJobHref), so
  -- that pair identifies the drawing Steve is looking at.
  --
  -- `shop_job_id` is the display key: Shop View's rows ARE
  -- shop_profile_library rows. A row gets one when the callout is authored
  -- against a job already sent to the machine; the resolver in
  -- lib/data/shop-callouts.ts matches the rest by quote request.
  quote_request_id   UUID REFERENCES quote_requests(id) ON DELETE CASCADE,
  line_item_index    INTEGER NOT NULL DEFAULT 0 CHECK (line_item_index >= 0),
  shop_job_id        UUID REFERENCES shop_profile_library(id) ON DELETE CASCADE,
  CONSTRAINT shop_callouts_needs_a_subject
    CHECK (quote_request_id IS NOT NULL OR shop_job_id IS NOT NULL),

  -- Provenance when the open drawing came from a saved profile. The passport's
  -- revision is lineage depth (migration 027, lib/flashdraft/revision.ts), so
  -- this records WHICH drawing was on screen, not a version of this callout.
  drawing_id         UUID,
  drawing_revision   INTEGER,

  -- THE ANCHOR. See the header for why there is no `segment_id`.
  segment_index      INTEGER NOT NULL CHECK (segment_index >= 0),
  segment_count      INTEGER NOT NULL CHECK (segment_count > 0),
  t                  NUMERIC NOT NULL CHECK (t >= 0 AND t <= 1),
  seg_ax             NUMERIC NOT NULL,
  seg_ay             NUMERIC NOT NULL,
  seg_bx             NUMERIC NOT NULL,
  seg_by             NUMERIC NOT NULL,
  anchor_x           NUMERIC NOT NULL,
  anchor_y           NUMERIC NOT NULL,

  -- THE TAIL, as an offset from the tip in INCHES. Draggable; re-saved here.
  tail_dx            NUMERIC NOT NULL,
  tail_dy            NUMERIC NOT NULL,

  -- WHAT STEVE TYPED. Never generated, never inferred, never defaulted.
  -- The trim is inside the CHECK so a body of spaces is refused by Postgres
  -- and not merely by the route that happened to be used.
  note               TEXT NOT NULL
    CONSTRAINT shop_callouts_note_length
    CHECK (char_length(btrim(note)) >= 1 AND char_length(btrim(note)) <= 280),

  orphaned           BOOLEAN NOT NULL DEFAULT false,

  created_by         UUID NOT NULL REFERENCES profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete. A deleted shop note stays on the row: what the shop was told
  -- and when is part of the record of how a part got bent.
  deleted_at         TIMESTAMPTZ
);

-- The two read paths. Shop View reads by shop job and by quote request; the
-- admin authoring panel reads by quote request + line item.
CREATE INDEX idx_shop_callouts_shop_job ON shop_callouts(shop_job_id);
CREATE INDEX idx_shop_callouts_quote_request ON shop_callouts(quote_request_id, line_item_index);
CREATE INDEX idx_shop_callouts_created_at ON shop_callouts(created_at);

-- ----------------------------------------------------------------------------
-- RLS
--
-- THREE AUDIENCES, THREE DIFFERENT ANSWERS, AND THE CUSTOMER'S IS "NOTHING".
--
--   admin     — full access. The only role that may write.
--   operator  — SELECT only. The shop floor reads notes; it never writes them,
--               and it can never silence one. This is the `role IN
--               ('operator','admin')` pattern 013_bid_documents.sql already
--               established for shop-side reads.
--   everyone  — no policy, therefore no rows. contractor, architect, customer
--               and anonymous callers get an empty result from PostgREST and a
--               403 from every route. There is deliberately no "own company"
--               customer policy: a shop callout is an internal instruction to
--               the machine operator and is not part of the customer's record
--               of their order.
--
-- A soft-deleted row is still visible to these policies; `deleted_at IS NULL`
-- is applied by lib/data/shop-callouts.ts, in exactly one place, the same way
-- lib/data/shop-library.ts does it for shop_profile_library.
-- ----------------------------------------------------------------------------
ALTER TABLE shop_callouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_shop_callouts" ON shop_callouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "operator_select_shop_callouts" ON shop_callouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

-- `updated_at` is maintained by the writer (lib/data/shop-callouts.ts) rather
-- than by a trigger, matching every other table in this schema. No trigger is
-- added here: this table has no append-only guarantee to enforce (contrast
-- pricing_ledger, migration 035, where the trigger IS the rule).

-- ============================================================================
-- End 051_shop_callouts.sql
-- ============================================================================
