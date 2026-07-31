-- 012_machine_jobs_fallback_geometry.sql
-- Adds machine_jobs.used_fallback_geometry — a visible, queryable flag for
-- when app/api/admin/command-center/approve-quote-request/route.ts had to
-- substitute the hardcoded 12"/2"/2" placeholder dimensions because a line
-- item's real width/legA/legB (and no real FlashDraft-drawn points) were
-- captured on the source quote_requests row. Before this migration, that
-- substitution was silent — nothing on the Pending Approval or Command
-- Center cards told an admin the geometry they were about to send to
-- fabrication was fabricated data, not a real measurement. See
-- STATE_OF_THE_BUILD.md's afs-mj-001/afs-mj-002 audit entries for the full
-- history of this gap. Additive and nullable-safe — does not change any
-- other machine_jobs column.

ALTER TABLE machine_jobs ADD COLUMN IF NOT EXISTS used_fallback_geometry BOOLEAN NOT NULL DEFAULT false;
