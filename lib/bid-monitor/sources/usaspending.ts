import { createAdminClient } from '@/lib/supabase/admin';
import { matchKeywords, isDivision7Relevant, DEFAULT_DIVISION7_KEYWORDS } from '../keyword-matcher';
import type { BidProject } from '../types';

/**
 * USASpending.gov Award Search API — no API key required.
 * https://api.usaspending.gov/docs/endpoints
 *
 * Note: this is *awarded* federal spending, not open solicitations (that's
 * SAM.gov's job — see sam-gov.ts) — useful here as a signal for which
 * agencies/recipients are actively buying Division 7-adjacent work, so
 * bidDueDate is intentionally left unset on every result.
 */

const USASPENDING_SEARCH_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const USASPENDING_SOURCE_NAME = 'USASpending.gov';

const RELEVANT_NAICS_CODES = ['238160', '238170', '332322'];

interface USASpendingResult {
  'Award ID'?: string;
  'Recipient Name'?: string;
  'Award Amount'?: number | string;
  Description?: string;
  'Place of Performance State Code'?: string;
  internal_id?: number | string;
  [key: string]: unknown;
}

interface USASpendingResponse {
  results?: USASpendingResult[];
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

async function getUSASpendingSourceId(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('bid_sources')
      .select('id')
      .eq('name', USASPENDING_SOURCE_NAME)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function fetchUSASpendingOpportunities(): Promise<BidProject[]> {
  const [keywords, sourceId] = await Promise.all([getActiveKeywords(), getUSASpendingSourceId()]);

  if (!sourceId) {
    throw new Error(
      `bid_sources row for "${USASPENDING_SOURCE_NAME}" not found — has supabase/migrations/010_bid_monitor.sql been applied and seeded?`
    );
  }

  const requestBody = {
    filters: {
      award_type_codes: ['A', 'B', 'C', 'D'],
      naics_codes: RELEVANT_NAICS_CODES,
      time_period: [{ start_date: '2026-01-01', end_date: formatIsoDate(new Date()) }],
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Place of Performance State Code'],
    limit: 100,
  };

  let body: USASpendingResponse;
  try {
    const response = await fetch(USASPENDING_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`[bid-monitor/usaspending] request failed: HTTP ${response.status}`);
      return [];
    }

    body = (await response.json()) as USASpendingResponse;
  } catch (error) {
    console.warn('[bid-monitor/usaspending] request threw:', error instanceof Error ? error.message : error);
    return [];
  }

  const projects: BidProject[] = [];

  for (const result of body.results ?? []) {
    const externalId = result['Award ID'] ?? (result.internal_id != null ? String(result.internal_id) : undefined);
    if (!externalId) continue;

    const title = result.Description || result['Recipient Name'] || externalId;
    const searchText = [title, result.Description, result['Recipient Name']].filter(Boolean).join(' ');
    const keywordsMatched = matchKeywords(searchText, keywords);
    if (keywordsMatched.length === 0) continue;

    const rawAmount = result['Award Amount'];
    const estimatedValue =
      typeof rawAmount === 'number' ? rawAmount : rawAmount !== undefined ? Number(rawAmount) : undefined;

    projects.push({
      externalId,
      sourceId,
      title,
      description: result.Description,
      locationState: result['Place of Performance State Code'],
      estimatedValue: estimatedValue !== undefined && Number.isFinite(estimatedValue) ? estimatedValue : undefined,
      sourceUrl: result.internal_id != null ? `https://www.usaspending.gov/award/${result.internal_id}` : undefined,
      keywordsMatched,
      division7Relevant: isDivision7Relevant(keywordsMatched),
      rawData: result,
    });
  }

  return projects;
}
