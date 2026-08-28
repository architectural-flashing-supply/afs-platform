import type { SupabaseClient } from '@supabase/supabase-js';

export type BuildingCodeStatus = 'verified_link' | 'no_code_adopted' | 'unresolved';
export type BuildingCodeJurisdictionType = 'county' | 'city';

export interface BuildingCodeJurisdictionRow {
  id: string;
  state: string;
  jurisdictionType: BuildingCodeJurisdictionType;
  name: string;
  countyName: string | null;
  population: number | null;
  populationBasis: string | null;
  status: BuildingCodeStatus;
  url: string | null;
  urlVerifiedAt: string | null;
  urlHttpVerified: boolean;
  notes: string | null;
  unresolvedReason: string | null;
}

export interface BuildingCodeStats {
  total: number;
  counties: number;
  cities: number;
  verifiedLink: number;
  noCodeAdopted: number;
  unresolved: number;
}

interface BuildingCodeJurisdictionDbRow {
  id: string;
  state: string;
  jurisdiction_type: BuildingCodeJurisdictionType;
  name: string;
  county_name: string | null;
  population: number | null;
  population_basis: string | null;
  status: BuildingCodeStatus;
  url: string | null;
  url_verified_at: string | null;
  url_http_verified: boolean;
  notes: string | null;
  unresolved_reason: string | null;
}

/**
 * building_code_jurisdictions (022_building_code_jurisdictions.sql) is
 * admin-only RLS (FOR ALL, role = 'admin') — takes the caller's own
 * session-scoped client, same pattern as lib/data/bid-monitor.ts.
 */
export async function getBuildingCodeJurisdictions(supabase: SupabaseClient): Promise<BuildingCodeJurisdictionRow[]> {
  const { data, error } = await supabase
    .from('building_code_jurisdictions')
    .select(
      'id, state, jurisdiction_type, name, county_name, population, population_basis, status, url, url_verified_at, url_http_verified, notes, unresolved_reason'
    )
    .order('state', { ascending: true })
    .order('jurisdiction_type', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) return [];

  return (data as BuildingCodeJurisdictionDbRow[]).map((row) => ({
    id: row.id,
    state: row.state,
    jurisdictionType: row.jurisdiction_type,
    name: row.name,
    countyName: row.county_name,
    population: row.population,
    populationBasis: row.population_basis,
    status: row.status,
    url: row.url,
    urlVerifiedAt: row.url_verified_at,
    urlHttpVerified: row.url_http_verified,
    notes: row.notes,
    unresolvedReason: row.unresolved_reason,
  }));
}

export function getBuildingCodeStats(rows: BuildingCodeJurisdictionRow[]): BuildingCodeStats {
  return {
    total: rows.length,
    counties: rows.filter((r) => r.jurisdictionType === 'county').length,
    cities: rows.filter((r) => r.jurisdictionType === 'city').length,
    verifiedLink: rows.filter((r) => r.status === 'verified_link').length,
    noCodeAdopted: rows.filter((r) => r.status === 'no_code_adopted').length,
    unresolved: rows.filter((r) => r.status === 'unresolved').length,
  };
}
