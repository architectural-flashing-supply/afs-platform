import type { SupabaseClient } from '@supabase/supabase-js';

export interface BidMonitorStats {
  newThisWeek: number;
  division7Matches: number;
  activeBids: number;
  sourcesMonitored: number;
}

export interface BidProjectListRow {
  id: string;
  title: string;
  sourceId: string | null;
  sourceName: string;
  sourceType: string;
  sourceState: string | null;
  locationCity: string | null;
  locationState: string | null;
  bidDueDate: string | null;
  estimatedValue: number | null;
  keywordsMatched: string[];
  division7Relevant: boolean;
  status: string;
  sourceUrl: string | null;
  discoveredAt: string;
}

export interface BidSourceRow {
  id: string;
  name: string;
  sourceType: string;
  state: string | null;
  url: string;
  apiUrl: string | null;
  apiKeyEnv: string | null;
  isActive: boolean;
  isFree: boolean;
  requiresMembership: boolean;
  notes: string | null;
  lastCheckedAt: string | null;
}

export interface BidKeywordRow {
  id: string;
  keyword: string;
  category: string | null;
  isActive: boolean;
  matchCount: number;
}

/**
 * bid_sources/bid_projects/bid_keywords/bid_alerts (010_bid_monitor.sql) are
 * all admin-only RLS (FOR ALL, role = 'admin') — every function here takes
 * the caller's own session-scoped client (same pattern as lib/data/
 * machine-jobs.ts), never the service-role client, so a non-admin session
 * gets RLS's empty result rather than this module silently widening access.
 */

export async function getBidMonitorStats(supabase: SupabaseClient): Promise<BidMonitorStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [newThisWeekRes, division7Res, activeBidsRes, sourcesRes] = await Promise.all([
    supabase.from('bid_projects').select('id', { count: 'exact', head: true }).gte('discovered_at', sevenDaysAgo),
    supabase.from('bid_projects').select('id', { count: 'exact', head: true }).eq('division7_relevant', true),
    supabase.from('bid_projects').select('id', { count: 'exact', head: true }).in('status', ['bidding', 'bid_submitted']),
    supabase.from('bid_sources').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  return {
    newThisWeek: newThisWeekRes.count ?? 0,
    division7Matches: division7Res.count ?? 0,
    activeBids: activeBidsRes.count ?? 0,
    sourcesMonitored: sourcesRes.count ?? 0,
  };
}

interface BidProjectSourceRow {
  id: string;
  title: string;
  source_id: string | null;
  location_city: string | null;
  location_state: string | null;
  bid_due_date: string | null;
  estimated_value: number | null;
  keywords_matched: string[] | null;
  division7_relevant: boolean;
  status: string;
  source_url: string | null;
  discovered_at: string;
  bid_sources: { name: string; source_type: string; state: string | null } | null;
}

export async function getBidProjects(supabase: SupabaseClient): Promise<BidProjectListRow[]> {
  const { data, error } = await supabase
    .from('bid_projects')
    .select(
      'id, title, source_id, location_city, location_state, bid_due_date, estimated_value, keywords_matched, division7_relevant, status, source_url, discovered_at, bid_sources(name, source_type, state)'
    )
    .order('discovered_at', { ascending: false });

  if (error || !data) return [];

  return (data as unknown as BidProjectSourceRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    sourceId: row.source_id,
    sourceName: row.bid_sources?.name ?? 'Unknown Source',
    sourceType: row.bid_sources?.source_type ?? 'other',
    sourceState: row.bid_sources?.state ?? null,
    locationCity: row.location_city,
    locationState: row.location_state,
    bidDueDate: row.bid_due_date,
    estimatedValue: row.estimated_value,
    keywordsMatched: row.keywords_matched ?? [],
    division7Relevant: row.division7_relevant,
    status: row.status,
    sourceUrl: row.source_url,
    discoveredAt: row.discovered_at,
  }));
}

interface BidSourceSourceRow {
  id: string;
  name: string;
  source_type: string;
  state: string | null;
  url: string;
  api_url: string | null;
  api_key_env: string | null;
  is_active: boolean;
  is_free: boolean;
  requires_membership: boolean;
  notes: string | null;
  last_checked_at: string | null;
}

export async function getBidSources(supabase: SupabaseClient): Promise<BidSourceRow[]> {
  const { data, error } = await supabase
    .from('bid_sources')
    .select('id, name, source_type, state, url, api_url, api_key_env, is_active, is_free, requires_membership, notes, last_checked_at')
    .order('source_type', { ascending: true })
    .order('state', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error || !data) return [];

  return (data as BidSourceSourceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    state: row.state,
    url: row.url,
    apiUrl: row.api_url,
    apiKeyEnv: row.api_key_env,
    isActive: row.is_active,
    isFree: row.is_free,
    requiresMembership: row.requires_membership,
    notes: row.notes,
    lastCheckedAt: row.last_checked_at,
  }));
}

interface BidKeywordSourceRow {
  id: string;
  keyword: string;
  category: string | null;
  is_active: boolean;
  match_count: number;
}

export async function getBidKeywords(supabase: SupabaseClient): Promise<BidKeywordRow[]> {
  const { data, error } = await supabase
    .from('bid_keywords')
    .select('id, keyword, category, is_active, match_count')
    .order('category', { ascending: true, nullsFirst: true })
    .order('keyword', { ascending: true });

  if (error || !data) return [];

  return (data as BidKeywordSourceRow[]).map((row) => ({
    id: row.id,
    keyword: row.keyword,
    category: row.category,
    isActive: row.is_active,
    matchCount: row.match_count,
  }));
}
