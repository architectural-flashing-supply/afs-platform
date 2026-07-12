-- 003_pricing_rules_cost_notes.sql
-- Adds the manual "Cost Notes" reference field used by /admin/pricing while the
-- commodity-indexed engine is deferred (see specs/SPEC_PRICING_ADMIN.md manual-mode
-- revision and PRICING_ENGINE.md §9 activation checklist). Additive and nullable —
-- does not change SCHEMA.md's documented pricing_rules columns.

ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS cost_notes TEXT;
