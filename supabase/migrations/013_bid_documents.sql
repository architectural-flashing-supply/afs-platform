-- ============================================================================
-- 013_bid_documents.sql
-- Bid Documents — project-level GC bid pricing (BID_DOCUMENT_SCOPE.md)
--
-- Four tables, new and independent from `bid_projects`/`bid_sources`
-- (010_bid_monitor.sql — a different feature, "Bid Monitor", that scrapes
-- public procurement portals) and from `quote_requests`/`quotes`/
-- `quote_line_items` (BID_DOCUMENT_SCOPE.md §1 — the flashing-configurator
-- shape genuinely does not fit a hand-priced GC bid document). See that
-- document in full for the reasoning; this migration implements its §2
-- exactly, nothing else.
--
-- RLS on all four tables is the operator/admin pattern
-- (`role IN ('operator','admin')`, matching `is_operator()` from
-- 007_delivery_tracking.sql), not the admin-only pattern `quotes`/
-- `pricing_rules` use — deliberate, per BID_DOCUMENT_SCOPE.md §0.2: Steve,
-- one of exactly two named pricing staff, is scoped as `operator`, not
-- `admin`, and must not be locked out of a feature he is named as one of
-- the two real users of.
--
-- The claim on `bid_documents` (claimed_by/claimed_at/last_activity_at) is
-- a soft, advisory UI-coordination lock, not a security boundary — every
-- eligible user already has full RLS read/write access to every row via
-- the single `FOR ALL` policy below. See BID_DOCUMENT_SCOPE.md §3.1.
-- ============================================================================

CREATE TABLE bid_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_number         TEXT UNIQUE NOT NULL,       -- AFS-BID-2026-XXXXX
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','awarded','lost','expired','withdrawn')),
  project_name       TEXT NOT NULL,
  gc_name            TEXT NOT NULL,               -- free text, e.g. "Omega Waterproofing"
  gc_contact_name    TEXT,
  gc_contact_email   TEXT,
  gc_contact_phone   TEXT,
  project_location   TEXT,
  bid_project_id     UUID REFERENCES bid_projects(id),  -- optional link to a Bid Monitor opportunity
  price_valid_until  DATE,
  delivery_terms     TEXT,
  tax_note           TEXT NOT NULL DEFAULT 'Price excludes applicable sales tax.',
  customer_note      TEXT,                        -- free-text note to the GC, printed on the document
  subtotal           DECIMAL(10,2),                -- NULL until first line item exists; sum of line extended_price
  claimed_by         UUID REFERENCES profiles(id),
  claimed_at         TIMESTAMPTZ,
  last_activity_at   TIMESTAMPTZ,                  -- heartbeat; drives auto-release (§3)
  created_by         UUID NOT NULL REFERENCES profiles(id),
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_documents_status ON bid_documents(status);
CREATE INDEX idx_bid_documents_claimed_by ON bid_documents(claimed_by);

ALTER TABLE bid_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_documents" ON bid_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

CREATE TABLE bid_document_sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id            UUID NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
  work_description  TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_bid_document_sections_bid ON bid_document_sections(bid_id);

ALTER TABLE bid_document_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_document_sections" ON bid_document_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

CREATE TABLE bid_document_line_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id     UUID NOT NULL REFERENCES bid_document_sections(id) ON DELETE CASCADE,
  quantity       DECIMAL(10,2) NOT NULL,
  spec_text      TEXT NOT NULL,       -- free-text dimension/spec, e.g. `24 GA GALV, 12" girth`
  unit           TEXT NOT NULL DEFAULT 'LF',
  unit_price     DECIMAL(10,4) NOT NULL,
  extended_price DECIMAL(10,2) NOT NULL,   -- server-computed = round2(quantity * unit_price), never client-trusted
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_bid_document_line_items_section ON bid_document_line_items(section_id);

ALTER TABLE bid_document_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_document_line_items" ON bid_document_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

-- Presence table — see BID_DOCUMENT_SCOPE.md §3.7. Ephemeral by design: rows
-- are upserted on a heartbeat and deleted on unmount, exactly like
-- driver_locations rows are append-only pings, not a durable record.
CREATE TABLE bid_document_viewers (
  bid_id        UUID NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bid_id, user_id)
);

CREATE INDEX idx_bid_document_viewers_bid ON bid_document_viewers(bid_id);

ALTER TABLE bid_document_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_document_viewers" ON bid_document_viewers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

-- ============================================================================
-- End 013_bid_documents.sql
-- ============================================================================
