-- 038_profile_search_shortcuts.sql
--
-- 2026-09-30, Command Center V2 prompt v2-05 (Search UI).
--
-- TWO SMALL TABLES AND ONE ADDED ARGUMENT. Nothing here is a second query
-- layer: the search itself is still `admin_profile_search` from migration 029
-- (commit 1646746), and this migration EXTENDS that same function rather than
-- adding a sibling that would have to be kept in step with it.
--
--   admin_recent_profiles   the last profiles THIS admin opened from Search.
--   admin_pinned_profiles   the ones THIS admin chose to keep to hand.
--
-- Both are per-admin scratch state, not shared catalog content, so both are
-- keyed on (admin_id, profile_id) and both cascade away with either side.
-- Deleting a profile must not leave a shortcut pointing at nothing, and
-- deleting an admin must not leave their history behind.
--
-- WHY `p_ids` GOES ON THE EXISTING FUNCTION. Recent and Pinned need exactly
-- the row shape search already returns -- name, company, person, type, spec,
-- "same shape xN", status, and `has_thumbnail` WITHOUT the base64 image. A
-- second function returning the same seventeen columns would be a copy of a
-- sixty-line query that must never drift from the original. One nullable
-- `uuid[]` argument reuses it instead, and when it is supplied the rows come
-- back IN THE ORDER GIVEN (array_position), so "most recently opened first"
-- is decided by the caller's ordering rather than re-derived here.
--
-- The function is DROPped and recreated rather than CREATE OR REPLACEd,
-- because adding an argument makes a NEW signature -- replace would leave the
-- nine-argument version in place as an overload, and a call with all
-- defaults would then be ambiguous. The grants are re-applied below for the
-- same reason: a drop takes them with it.
--
-- IDEMPOTENT: every statement is IF NOT EXISTS / DROP ... IF EXISTS. Safe to
-- run twice; it was.

BEGIN;

-- ============================================================ RECENT

CREATE TABLE IF NOT EXISTS admin_recent_profiles (
  admin_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id uuid        NOT NULL REFERENCES saved_configurations(id) ON DELETE CASCADE,
  opened_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, profile_id)
);

COMMENT ON TABLE admin_recent_profiles IS
  'Per-admin last-opened-from-Search list. Trimmed to the 10 newest by the route that writes it. Cascades away with the admin or the profile.';

CREATE INDEX IF NOT EXISTS idx_admin_recent_profiles_admin_opened
  ON admin_recent_profiles (admin_id, opened_at DESC);

ALTER TABLE admin_recent_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_recent_profiles_own ON admin_recent_profiles;
CREATE POLICY admin_recent_profiles_own ON admin_recent_profiles
  FOR ALL TO authenticated
  USING (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================ PINNED

CREATE TABLE IF NOT EXISTS admin_pinned_profiles (
  admin_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id uuid        NOT NULL REFERENCES saved_configurations(id) ON DELETE CASCADE,
  pinned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, profile_id)
);

COMMENT ON TABLE admin_pinned_profiles IS
  'Per-admin pinned profiles, shown under Search when the box is empty. Cascades away with the admin or the profile.';

CREATE INDEX IF NOT EXISTS idx_admin_pinned_profiles_admin_pinned
  ON admin_pinned_profiles (admin_id, pinned_at DESC);

ALTER TABLE admin_pinned_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_pinned_profiles_own ON admin_pinned_profiles;
CREATE POLICY admin_pinned_profiles_own ON admin_pinned_profiles
  FOR ALL TO authenticated
  USING (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================== admin_profile_search + p_ids

DROP FUNCTION IF EXISTS admin_profile_search(text, text, text, text, date, date, text, integer, integer);

CREATE OR REPLACE FUNCTION admin_profile_search(
  p_q          text    DEFAULT '',
  p_field      text    DEFAULT 'all',
  p_material   text    DEFAULT NULL,
  p_gauge      text    DEFAULT NULL,
  p_date_from  date    DEFAULT NULL,
  p_date_to    date    DEFAULT NULL,
  p_status     text    DEFAULT NULL,
  p_limit      integer DEFAULT 24,
  p_offset     integer DEFAULT 0,
  p_ids        uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  id                     uuid,
  name                   text,
  company                text,
  person                 text,
  profile_type           text,
  material               text,
  gauge                  text,
  length_ft              numeric,
  quantity               integer,
  created_at             timestamptz,
  geometry_fingerprint   text,
  same_shape_count       integer,
  bend_count             integer,
  hem_count              integer,
  status                 text,
  pathfinder_profile_id  text,
  has_thumbnail          boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_q      text := coalesce(btrim(p_q), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  -- Self-guard. SECURITY DEFINER bypasses RLS, so this function must never
  -- be callable by a non-admin, regardless of what the caller claims.
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_profile_search: caller is not an admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH shape_counts AS (
    SELECT sc2.geometry_fingerprint AS fp, count(*)::integer AS n
      FROM saved_configurations sc2
     WHERE sc2.geometry_fingerprint IS NOT NULL
     GROUP BY 1
  )
  SELECT
    sc.id,
    coalesce(sc.name, 'Untitled Profile')::text,
    (sc.job_info->>'clientBusinessName')::text,
    (sc.job_info->>'clientName')::text,
    sc.profile_type::text,
    (sc.dimensions->>'material')::text,
    (sc.dimensions->>'gauge')::text,
    sc.length_ft,
    sc.quantity,
    sc.created_at,
    sc.geometry_fingerprint::text,
    coalesce(shape_counts.n, 1)::integer,
    greatest(coalesce(jsonb_array_length(sc.dimensions->'points'), 0) - 2, 0)::integer,
    (
      (CASE WHEN sc.dimensions->'hemStart' IS NOT NULL AND sc.dimensions->>'hemStart' <> 'null' THEN 1 ELSE 0 END)
      + (CASE WHEN sc.dimensions->'hemEnd' IS NOT NULL AND sc.dimensions->>'hemEnd' <> 'null' THEN 1 ELSE 0 END)
    )::integer,
    coalesce(
      CASE WHEN spl.pathfinder_profile_id IS NOT NULL THEN 'sent_to_machine' END,
      qr.request_status
    )::text,
    spl.pathfinder_profile_id::text,
    (sc.thumbnail_image IS NOT NULL)
  FROM saved_configurations sc
  -- shop_profile_library is the ONLY place pathfinder_profile_id lives, so it
  -- is the source of "sent to machine". Matched on profile_name, which is how
  -- the approval path writes it.
  LEFT JOIN LATERAL (
    SELECT s.pathfinder_profile_id
      FROM shop_profile_library s
     WHERE s.profile_name = sc.name
       AND s.pathfinder_profile_id IS NOT NULL
     ORDER BY s.created_at DESC
     LIMIT 1
  ) spl ON true
  -- quote_requests.line_items carries a COPY of the geometry for submitted
  -- work; used only to derive 'quoted'/'ordered', never as a result row.
  LEFT JOIN LATERAL (
    SELECT r.status AS request_status
      FROM quote_requests r
     WHERE sc.name IS NOT NULL
       AND r.line_items::text LIKE '%' || sc.name || '%'
     ORDER BY r.submitted_at DESC
     LIMIT 1
  ) qr ON true
  LEFT JOIN shape_counts ON shape_counts.fp = sc.geometry_fingerprint
  WHERE sc.dimensions->>'kind' = 'flashdraft'
    -- v2-05: an explicit id list (Recent / Pinned) replaces the text match
    -- entirely. It is a filter, never a fallback -- an empty array returns
    -- nothing, which is the honest answer for "these zero profiles".
    AND (p_ids IS NULL OR sc.id = ANY (p_ids))
    AND (
      p_ids IS NOT NULL
      OR v_q = ''
      OR CASE p_field
           WHEN 'name'    THEN coalesce(sc.name, '') ILIKE '%' || v_q || '%'
                            OR similarity(coalesce(sc.name, ''), v_q) > 0.3
           WHEN 'company' THEN coalesce(sc.job_info->>'clientBusinessName', '') ILIKE '%' || v_q || '%'
                            OR similarity(coalesce(sc.job_info->>'clientBusinessName', ''), v_q) > 0.3
           WHEN 'person'  THEN coalesce(sc.job_info->>'clientName', '') ILIKE '%' || v_q || '%'
                            OR similarity(coalesce(sc.job_info->>'clientName', ''), v_q) > 0.3
           WHEN 'type'    THEN coalesce(sc.profile_type, '') ILIKE '%' || v_q || '%'
                            OR similarity(coalesce(sc.profile_type, ''), v_q) > 0.3
           ELSE
             -- 'all': full-text over every searchable field, plus trigram on
             -- the two people actually misspell.
             sc.search_vector @@ websearch_to_tsquery('english', v_q)
             OR coalesce(sc.name, '') ILIKE '%' || v_q || '%'
             OR similarity(coalesce(sc.name, ''), v_q) > 0.3
             OR similarity(coalesce(sc.job_info->>'clientBusinessName', ''), v_q) > 0.3
             OR similarity(coalesce(sc.job_info->>'clientName', ''), v_q) > 0.3
         END
    )
    AND (p_material IS NULL OR sc.dimensions->>'material' = p_material)
    AND (p_gauge    IS NULL OR sc.dimensions->>'gauge' = p_gauge)
    AND (p_date_from IS NULL OR sc.created_at >= p_date_from)
    -- Inclusive end-of-day: a date-only bound must cover that whole day.
    AND (p_date_to   IS NULL OR sc.created_at < (p_date_to + interval '1 day'))
    AND (
      p_status IS NULL
      OR (p_status = 'sent_to_machine' AND spl.pathfinder_profile_id IS NOT NULL)
      OR (p_status = 'quoted'          AND qr.request_status IS NOT NULL)
      OR (p_status = 'ordered'         AND qr.request_status IN ('sent_to_machine', 'ordered'))
    )
  -- An id list keeps the CALLER's order (most recently opened first, or the
  -- order they were pinned). Otherwise: newest arrival first (Part 4's
  -- ordering rule), with a relevance tiebreak so an exact hit outranks an
  -- older near-miss in the same second.
  ORDER BY
    CASE WHEN p_ids IS NULL THEN NULL ELSE array_position(p_ids, sc.id) END ASC NULLS LAST,
    CASE WHEN v_q = '' THEN 0 ELSE similarity(coalesce(sc.name, ''), v_q) END DESC,
    sc.created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$fn$;

-- Only logged-in users may even attempt the call; the body then requires
-- admin. anon is not granted. Re-applied here because the DROP FUNCTION above
-- takes the old signature's grants with it.
REVOKE ALL ON FUNCTION admin_profile_search(text, text, text, text, date, date, text, integer, integer, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_profile_search(text, text, text, text, date, date, text, integer, integer, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION admin_profile_search(text, text, text, text, date, date, text, integer, integer, uuid[]) TO authenticated;

COMMIT;
