-- 029_admin_profile_search_fn.sql
--
-- 2026-09-30. The admin profile-search query, as a PARAMETERIZED function.
--
-- WHY A FUNCTION AND NOT SQL BUILT IN THE ROUTE. The search needs three
-- things PostgREST's query builder cannot express — similarity() for typo
-- tolerance, websearch_to_tsquery against the stored search_vector, and the
-- "same shape xN" grouping join — and it needs cross-customer reach, which
-- RLS on saved_configurations correctly denies even to an admin's own
-- session. The alternative considered and REJECTED was having the route build
-- a SQL string and hand it to a SECURITY DEFINER function to execute: that is
-- an arbitrary-SQL-execution endpoint wearing a search costume, and one
-- mistake in escaping turns an admin search box into a database console.
--
-- Every input here is a TYPED ARGUMENT. There is no dynamic SQL anywhere in
-- this function, so there is no injection surface to get wrong.
--
-- SECURITY DEFINER is required to see across customers, so the function
-- guards itself: it re-checks that the CALLER is an admin from profiles.role
-- via auth.uid(), and raises otherwise. That check does not depend on the
-- route remembering to check (the route checks too — defence in depth).
--
-- EGRESS: thumbnail_image is NOT in the return type. Only a has_thumbnail
-- boolean, so the client can lazy-load each visible one by id.
--
-- IDEMPOTENT: CREATE OR REPLACE.

BEGIN;

CREATE OR REPLACE FUNCTION admin_profile_search(
  p_q          text    DEFAULT '',
  p_field      text    DEFAULT 'all',
  p_material   text    DEFAULT NULL,
  p_gauge      text    DEFAULT NULL,
  p_date_from  date    DEFAULT NULL,
  p_date_to    date    DEFAULT NULL,
  p_status     text    DEFAULT NULL,
  p_limit      integer DEFAULT 24,
  p_offset     integer DEFAULT 0
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
AS $$
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
    AND (
      v_q = ''
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
  -- Newest arrival first (Part 4's ordering rule), with a relevance
  -- tiebreak so an exact hit outranks an older near-miss in the same second.
  ORDER BY
    CASE WHEN v_q = '' THEN 0 ELSE similarity(coalesce(sc.name, ''), v_q) END DESC,
    sc.created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

-- Only logged-in users may even attempt the call; the body then requires
-- admin. anon is not granted.
REVOKE ALL ON FUNCTION admin_profile_search(text, text, text, text, date, date, text, integer, integer) FROM PUBLIC;
-- Supabase grants EXECUTE to anon explicitly (not via PUBLIC), so revoking
-- PUBLIC alone leaves anon able to call it. The body's admin guard already
-- rejects an unauthenticated caller, but an anonymous role should not even
-- hold the privilege.
REVOKE ALL ON FUNCTION admin_profile_search(text, text, text, text, date, date, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION admin_profile_search(text, text, text, text, date, date, text, integer, integer) TO authenticated;

COMMIT;
