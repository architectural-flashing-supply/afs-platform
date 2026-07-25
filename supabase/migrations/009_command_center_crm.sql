-- ============================================================================
-- 009_command_center_crm.sql
-- Command Center CRM Expansion — Customers / Orders / Invoices / GBP Photos tabs
-- Source: SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §4 (d-005)
--
-- Two additive, nullable columns needed by the new Command Center CRM tabs
-- that don't already exist anywhere in 001-008:
--
--   1. profiles.internal_notes — the Customers tab's CustomerDetailPanel asks
--      for a single-field "internal notes textarea" that saves directly to
--      profiles.internal_notes (task's own words: "add column if needed").
--      This is DIFFERENT from the existing admin_audit_log-based
--      append-only note log (lib/data/customers.ts's getCustomerNotes,
--      rendered by CustomerNotesLog.tsx on the full /admin/customers/[id]
--      page) — that log is a timestamped history of discrete notes, this is
--      one freeform mutable field for a quick note from the Command Center
--      drawer. Both are kept; they serve different purposes and neither
--      replaces the other.
--
--   2. orders.invoice_paid_at — the Invoices tab's [Mark Paid] action needs
--      somewhere real to persist a manual paid confirmation. No `invoices`
--      table exists (invoices are derived 1:1 from `orders`, see
--      lib/data/invoices.ts's own header comment) and the existing
--      `deposit_paid` column tracks only the upfront deposit, not the full
--      invoice — so this is a new, distinct nullable timestamp. NULL means
--      "not manually marked paid"; the CRM invoice-status computation
--      (lib/data/command-center-crm.ts) treats a non-null value as an
--      unconditional 'paid' override regardless of payment method or net
--      terms due date.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_paid_at TIMESTAMPTZ;

-- No RLS changes needed — both tables already have admin_all_* / FOR ALL
-- policies (001_initial_schema.sql) that cover admin reads/writes of these
-- new columns identically to every existing column on the same tables.

-- ============================================================================
-- End 009_command_center_crm.sql
-- ============================================================================
