/**
 * Command Center profile search — parameter normalization (Part 2, 2026-09-30).
 *
 * The QUERY itself lives in Postgres as the parameterized function
 * `admin_profile_search` (029_admin_profile_search_fn.sql). This module holds
 * only the typed vocabulary and the normalization of untrusted query-string
 * input into those typed arguments — deliberately NOT a SQL-string builder,
 * so no part of the request can ever become SQL text. See 029's header for
 * why that approach was rejected.
 *
 * WHERE THE DATA LIVES — the three sources, and what each actually holds:
 *
 *   saved_configurations   The Profile Passport. PRIMARY source and the only
 *                          one with real FlashDraft geometry the canvas can
 *                          reload directly (dimensions.points/hemStart/
 *                          hemEnd), plus job_info (company/person/PO/job),
 *                          length_ft, quantity, and — since 028 —
 *                          profile_type and geometry_fingerprint. Search
 *                          results are rows of THIS table.
 *   quote_requests         line_items[] carry a COPY of FlashDraft geometry
 *                          for submitted work. Used only to derive status
 *                          ('quoted'/'ordered'), never as a result row: the
 *                          same drawing already exists in
 *                          saved_configurations and returning both would
 *                          duplicate every result.
 *   shop_profile_library   One row per profile that reached the shop, and the
 *   + machine_jobs          only place pathfinder_profile_id lives. Source of
 *                          'sent_to_machine' status and the machine profile
 *                          number shown in the enlarged preview.
 *
 * EGRESS: thumbnail_image is never part of a search payload. Rows carry a
 * `hasThumbnail` boolean and the client lazy-loads each visible thumbnail
 * from its own endpoint. This is the CLAUDE.md egress rule.
 */

export type SearchField = 'all' | 'name' | 'company' | 'person' | 'type';
export type SearchStatus = 'quoted' | 'ordered' | 'sent_to_machine';

export const SEARCH_FIELDS: SearchField[] = ['all', 'name', 'company', 'person', 'type'];
export const SEARCH_STATUSES: SearchStatus[] = ['quoted', 'ordered', 'sent_to_machine'];

export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT = 50;

/**
 * How many profiles the Recent list keeps (v2-05, the approved spec's
 * "Recent (last 10)"). Enforced by the shortcuts route when it records an
 * open, not by a database trigger — see that route for why.
 */
export const RECENT_PROFILE_LIMIT = 10;

/**
 * Human labels for the field selector dropdown — the approved prototype's
 * own wording (`searchView`'s `fields` array). "Everything" rather than
 * "All", "Profile type" rather than "Type": the primary user is not
 * technical, and "All" beside a search box reads as a state, not a scope.
 */
export const SEARCH_FIELD_LABELS: Record<SearchField, string> = {
  all: 'Everything',
  name: 'Profile name',
  company: 'Company',
  person: 'Person',
  type: 'Profile type',
};

export const SEARCH_STATUS_LABELS: Record<SearchStatus, string> = {
  quoted: 'Quoted',
  ordered: 'Ordered',
  sent_to_machine: 'Sent to machine',
};

/** The typed argument set `admin_profile_search` accepts. */
export interface ProfileSearchArgs {
  p_q: string;
  p_field: SearchField;
  p_material: string | null;
  p_gauge: string | null;
  p_date_from: string | null;
  p_date_to: string | null;
  p_status: SearchStatus | null;
  p_limit: number;
  p_offset: number;
  /**
   * v2-05. An explicit id list — how Recent and Pinned reuse this one query
   * instead of getting a near-identical second one (migration 038). `null`
   * means "no id filter"; an EMPTY ARRAY means "these zero profiles" and
   * correctly returns nothing. Rows come back in the order given.
   */
  p_ids: string[] | null;
}

/** A lightweight result row as returned to the client. */
export interface ProfileSearchResult {
  id: string;
  name: string;
  company: string | null;
  person: string | null;
  profileType: string | null;
  material: string | null;
  gauge: string | null;
  lengthFt: number | null;
  quantity: number | null;
  createdAt: string;
  fingerprint: string | null;
  sameShapeCount: number;
  bendCount: number;
  hemCount: number;
  status: string | null;
  pathfinderProfileId: string | null;
  hasThumbnail: boolean;
}

export function parseField(raw: string | null | undefined): SearchField {
  return SEARCH_FIELDS.includes(raw as SearchField) ? (raw as SearchField) : 'all';
}

export function parseStatus(raw: string | null | undefined): SearchStatus | null {
  return SEARCH_STATUSES.includes(raw as SearchStatus) ? (raw as SearchStatus) : null;
}

/**
 * ISO calendar date only. Anything else is DROPPED rather than passed on —
 * a malformed date should narrow nothing, not error the whole search.
 */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  // Reject calendar-invalid dates that still match the shape (2026-02-31).
  const [y, m, d] = raw.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return raw;
}

/**
 * Clamps to [1, MAX_LIMIT]; absent or non-numeric falls back to the default.
 *
 * The ABSENT check is separate and comes first on purpose: Number('') and
 * Number(null) are both 0 — finite — so a missing limit would otherwise clamp
 * to 1 and silently return a single result instead of a page. (Caught by
 * profile-search.test.ts, not by review.)
 */
export function parseLimit(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === '') return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(n)), MAX_LIMIT);
}

/** Clamps to >= 0; absent or non-numeric falls back to 0. */
export function parseOffset(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/** Empty/whitespace-only filter values mean "no filter", not "match ''". */
function nonEmpty(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  return v === '' ? null : v;
}

/**
 * Normalizes a URLSearchParams-like bag into the function's typed arguments.
 * Total: every input shape produces a valid argument set.
 */
export function buildSearchArgs(get: (key: string) => string | null): ProfileSearchArgs {
  return {
    p_q: (get('q') ?? '').trim(),
    p_field: parseField(get('field')),
    p_material: nonEmpty(get('material')),
    p_gauge: nonEmpty(get('gauge')),
    p_date_from: parseDate(get('dateFrom')),
    p_date_to: parseDate(get('dateTo')),
    p_status: parseStatus(get('status')),
    p_limit: parseLimit(get('limit')),
    p_offset: parseOffset(get('offset')),
    // Never taken from the query string. The id list is a server-side
    // concern — it comes from the caller's OWN shortcut rows, not from
    // anything a browser can ask for. See buildIdSearchArgs.
    p_ids: null,
  };
}

/**
 * The same typed arguments, for a fixed list of ids in a fixed order — the
 * Recent and Pinned lists (v2-05). Deliberately a separate constructor rather
 * than an extra query-string key, so a request can never hand this function
 * an id list of its own choosing.
 */
export function buildIdSearchArgs(ids: string[]): ProfileSearchArgs {
  return {
    p_q: '',
    p_field: 'all',
    p_material: null,
    p_gauge: null,
    p_date_from: null,
    p_date_to: null,
    p_status: null,
    p_limit: MAX_LIMIT,
    p_offset: 0,
    p_ids: ids,
  };
}

/**
 * The `admin_profile_search` row shape, mapped to the client-facing camelCase
 * result. Lives here because THREE callers need the identical mapping — the
 * search route, the shortcuts route (Recent/Pinned) and the server-rendered
 * page — and three hand-written copies of a seventeen-field map is exactly how
 * one of them quietly starts returning something different.
 *
 * `thumbnail_image` is not in the function's return type at all, so there is
 * nothing here to accidentally forward: the egress rule is upheld by the
 * database's own signature, not by this mapping remembering to omit a field.
 */
export interface ProfileSearchFnRow {
  id: string;
  name: string;
  company: string | null;
  person: string | null;
  profile_type: string | null;
  material: string | null;
  gauge: string | null;
  length_ft: number | null;
  quantity: number | null;
  created_at: string;
  geometry_fingerprint: string | null;
  same_shape_count: number;
  bend_count: number;
  hem_count: number;
  status: string | null;
  pathfinder_profile_id: string | null;
  has_thumbnail: boolean;
}

export function mapSearchRow(r: ProfileSearchFnRow): ProfileSearchResult {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    person: r.person,
    profileType: r.profile_type,
    material: r.material,
    gauge: r.gauge,
    lengthFt: r.length_ft,
    quantity: r.quantity,
    createdAt: r.created_at,
    fingerprint: r.geometry_fingerprint,
    sameShapeCount: r.same_shape_count,
    bendCount: r.bend_count,
    hemCount: r.hem_count,
    status: r.status,
    pathfinderProfileId: r.pathfinder_profile_id,
    hasThumbnail: r.has_thumbnail,
  };
}

/**
 * The keys a search result may carry, as data. The egress unit test asserts
 * this list contains nothing image-shaped and that `mapSearchRow` produces
 * exactly these keys — so "the list response carries no base64" is an
 * assertion rather than a promise in a comment.
 */
export const PROFILE_SEARCH_RESULT_KEYS: (keyof ProfileSearchResult)[] = [
  'id',
  'name',
  'company',
  'person',
  'profileType',
  'material',
  'gauge',
  'lengthFt',
  'quantity',
  'createdAt',
  'fingerprint',
  'sameShapeCount',
  'bendCount',
  'hemCount',
  'status',
  'pathfinderProfileId',
  'hasThumbnail',
];

/** Plain-English status text for a result card. */
export function statusLabel(status: string | null): string | null {
  if (!status) return null;
  if (status === 'sent_to_machine') return 'Sent to the machine';
  if (status === 'submitted') return 'Quoted';
  if (status === 'reviewing') return 'Quoted';
  if (status === 'ordered') return 'Ordered';
  if (status === 'cancelled') return 'Cancelled';
  return status.replace(/_/g, ' ');
}
