import { createAdminClient } from '@/lib/supabase/admin';
import { matchKeywords, isDivision7Relevant, DEFAULT_DIVISION7_KEYWORDS } from '../keyword-matcher';
import type { BidProject } from '../types';

/**
 * SAM.gov Opportunities API v2 — federal contract opportunities.
 * https://open.gsa.gov/api/get-opportunities-public-api/
 *
 * If the "SAM.gov" row in bid_sources can't be found (migration not applied/
 * seeded yet), this throws rather than writing a fabricated source_id — the
 * caller (app/api/bid-monitor/fetch/route.ts) surfaces that as one entry in
 * its `errors` array instead of silently corrupting a foreign key.
 */

const SAM_GOV_SEARCH_URL = 'https://api.sam.gov/opportunities/v2/search';
const SAM_GOV_SOURCE_NAME = 'SAM.gov';

// Sheet metal / roofing / flashing-adjacent NAICS codes.
const RELEVANT_NAICS_CODES = ['238160', '238170', '332322', '238290'];

interface SamGovPlaceOfPerformance {
  city?: { name?: string };
  state?: { code?: string; name?: string };
}

interface SamGovOfficeAddress {
  city?: string;
  state?: string;
}

interface SamGovOpportunity {
  noticeId?: string;
  title?: string;
  description?: string;
  fullParentPathName?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  uiLink?: string;
  placeOfPerformance?: SamGovPlaceOfPerformance;
  officeAddress?: SamGovOfficeAddress;
  award?: { amount?: string | number };
  [key: string]: unknown;
}

interface SamGovSearchResponse {
  opportunitiesData?: SamGovOpportunity[];
  totalRecords?: number;
}

function formatSamGovDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function getActiveKeywords(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('bid_keywords').select('keyword').eq('is_active', true);
    if (error || !data || data.length === 0) return DEFAULT_DIVISION7_KEYWORDS;
    return data.map((row) => row.keyword as string).filter(Boolean);
  } catch {
    return DEFAULT_DIVISION7_KEYWORDS;
  }
}

async function getSamGovSourceId(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('bid_sources').select('id').eq('name', SAM_GOV_SOURCE_NAME).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function fetchSamGovOpportunities(): Promise<BidProject[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    console.warn(
      '[bid-monitor/sam-gov] SAM_GOV_API_KEY not set — falling back to DEMO_KEY, which is severely rate-limited (roughly 10 requests/hour). Get a free key at api.data.gov.'
    );
  }

  const [keywords, sourceId] = await Promise.all([getActiveKeywords(), getSamGovSourceId()]);

  if (!sourceId) {
    throw new Error(
      `bid_sources row for "${SAM_GOV_SOURCE_NAME}" not found — has supabase/migrations/010_bid_monitor.sql been applied and seeded?`
    );
  }

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const postedFrom = formatSamGovDate(sevenDaysAgo);
  const postedTo = formatSamGovDate(today);

  // SAM.gov's v2 search doesn't document a multi-value ncode syntax, so each
  // NAICS code is queried separately and results are deduped by noticeId.
  const opportunitiesById = new Map<string, SamGovOpportunity>();

  for (const naicsCode of RELEVANT_NAICS_CODES) {
    const params = new URLSearchParams({
      limit: '100',
      postedFrom,
      postedTo,
      ptype: 'o',
      ncode: naicsCode,
    });

    try {
      const response = await fetch(`${SAM_GOV_SEARCH_URL}?${params.toString()}`, {
        headers: { 'X-Api-Key': apiKey || 'DEMO_KEY' },
      });

      if (!response.ok) {
        console.warn(`[bid-monitor/sam-gov] NAICS ${naicsCode} request failed: HTTP ${response.status}`);
        continue;
      }

      const body = (await response.json()) as SamGovSearchResponse;
      for (const opp of body.opportunitiesData ?? []) {
        if (opp.noticeId) opportunitiesById.set(opp.noticeId, opp);
      }
    } catch (error) {
      console.warn(
        `[bid-monitor/sam-gov] NAICS ${naicsCode} request threw:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const projects: BidProject[] = [];

  for (const opp of opportunitiesById.values()) {
    if (!opp.noticeId || !opp.title) continue;

    // SAM.gov v2's own `description` field is a link to a separate text
    // endpoint, not inline body text, so keyword matching here runs against
    // title + agency path only — a documented limitation, not a silent gap.
    const searchText = [opp.title, opp.fullParentPathName].filter(Boolean).join(' ');
    const keywordsMatched = matchKeywords(searchText, keywords);
    if (keywordsMatched.length === 0) continue;

    const locationCity = opp.placeOfPerformance?.city?.name ?? opp.officeAddress?.city;
    const locationState = opp.placeOfPerformance?.state?.code ?? opp.officeAddress?.state;

    const rawAmount = opp.award?.amount;
    let estimatedValue: number | undefined;
    if (rawAmount !== undefined && rawAmount !== null) {
      const parsed = Number(rawAmount);
      estimatedValue = Number.isFinite(parsed) ? parsed : undefined;
    }

    projects.push({
      externalId: opp.noticeId,
      sourceId,
      title: opp.title,
      description: opp.description,
      agency: opp.fullParentPathName,
      locationCity,
      locationState,
      bidDueDate: opp.responseDeadLine ? new Date(opp.responseDeadLine) : undefined,
      estimatedValue,
      sourceUrl: opp.uiLink,
      keywordsMatched,
      division7Relevant: isDivision7Relevant(keywordsMatched),
      rawData: opp,
    });
  }

  // "weight Texas results" — don't exclude other states, just surface TX first.
  projects.sort((a, b) => {
    const aIsTx = a.locationState === 'TX' ? 0 : 1;
    const bIsTx = b.locationState === 'TX' ? 0 : 1;
    return aIsTx - bIsTx;
  });

  return projects;
}
