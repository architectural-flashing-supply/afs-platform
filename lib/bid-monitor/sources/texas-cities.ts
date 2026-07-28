import { createAdminClient } from '@/lib/supabase/admin';
import type { BidProject } from '../types';

/**
 * Texas cities do not expose a procurement API — unified or otherwise. Each
 * runs its own portal, most behind a vendor-registration login or a search
 * form with no stable public feed to poll. Rather than a fragile, effectively
 * unsupportable live fetch/parse per city, this is a static reference
 * registry: one BidProject "check this portal" stub per city, refreshed on
 * every /api/bid-monitor/fetch run, carrying a direct link into that city's
 * construction/purchasing section for a human to check manually. Never
 * throws — a missing bid_sources row for a given city just skips that city.
 */

interface TexasCityPortal {
  city: string;
  sourceName: string;
  url: string;
}

const TEXAS_CITY_PORTALS: TexasCityPortal[] = [
  { city: 'Austin', sourceName: 'City of Austin Purchasing', url: 'https://www.austintexas.gov/department/purchasing' },
  {
    city: 'San Antonio',
    sourceName: 'City of San Antonio Purchasing',
    url: 'https://www.sanantonio.gov/Finance/Purchasing',
  },
  { city: 'Houston', sourceName: 'City of Houston Purchasing', url: 'https://purchasing.houstontx.gov' },
  { city: 'Dallas', sourceName: 'City of Dallas Purchasing', url: 'https://dallascityhall.com/departments/procurement' },
  {
    city: 'Fort Worth',
    sourceName: 'City of Fort Worth Purchasing',
    url: 'https://www.fortworthtexas.gov/departments/finance/purchasing',
  },
  {
    city: 'Arlington',
    sourceName: 'City of Arlington Purchasing',
    url: 'https://www.arlingtontx.gov/city_hall/departments/purchasing',
  },
  { city: 'Lubbock', sourceName: 'City of Lubbock Purchasing', url: 'https://ci.lubbock.tx.us/departments/purchasing' },
  {
    city: 'Amarillo',
    sourceName: 'City of Amarillo Purchasing',
    url: 'https://www.amarillo.gov/departments/city-manager-s-office/purchasing',
  },
  { city: 'Waco', sourceName: 'City of Waco Purchasing', url: 'https://www.waco-texas.com/cms/departments/purchasing' },
  {
    city: 'Midland',
    sourceName: 'City of Midland Purchasing',
    url: 'https://www.midlandtexas.gov/government/departments/purchasing',
  },
  {
    city: 'Odessa',
    sourceName: 'City of Odessa Purchasing',
    url: 'https://www.odessa-tx.gov/government/departments/purchasing',
  },
];

export async function fetchTexasCityPortals(): Promise<BidProject[]> {
  let sourceIdByName: Map<string, string>;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('bid_sources')
      .select('id, name')
      .in(
        'name',
        TEXAS_CITY_PORTALS.map((c) => c.sourceName)
      );

    if (error) {
      console.warn('[bid-monitor/texas-cities] could not read bid_sources:', error.message, '— returning [].');
      return [];
    }

    sourceIdByName = new Map((data ?? []).map((row) => [row.name as string, row.id as string]));
  } catch (error) {
    console.warn(
      '[bid-monitor/texas-cities] request threw:',
      error instanceof Error ? error.message : error,
      '— returning [].'
    );
    return [];
  }

  const checkedAt = new Date().toISOString();
  const projects: BidProject[] = [];

  for (const portal of TEXAS_CITY_PORTALS) {
    const sourceId = sourceIdByName.get(portal.sourceName);
    if (!sourceId) {
      console.warn(
        `[bid-monitor/texas-cities] bid_sources row for "${portal.sourceName}" not found — has supabase/migrations/010_bid_monitor.sql been applied and seeded? Skipping ${portal.city}.`
      );
      continue;
    }

    projects.push({
      externalId: 'portal-check',
      sourceId,
      title: `${portal.city}, TX — Manual Portal Check Required`,
      description:
        "Texas cities don't publish a unified procurement API. Visit the link below and search this city's " +
        'open solicitations for construction, roofing, and sheet-metal/flashing scope.',
      locationCity: portal.city,
      locationState: 'TX',
      sourceUrl: portal.url,
      keywordsMatched: [],
      division7Relevant: false,
      rawData: {
        instructions: 'No public API — manual monitoring required. Search the portal directly for open solicitations.',
        lastCheckedAt: checkedAt,
      },
    });
  }

  return projects;
}
