import { createAdminClient } from '@/lib/supabase/admin';
import { matchKeywords, isDivision7Relevant, DEFAULT_DIVISION7_KEYWORDS } from '../keyword-matcher';
import { extractLinks, stableExternalId, type ExtractedLink } from '../html-extract';
import type { BidProject } from '../types';

/**
 * TxDOT highway letting calendar —
 * https://www.txdot.gov/business/contractors/highway-letting.html.
 *
 * Like Texas ESBD (see texas-esbd.ts), TxDOT publishes no public letting API
 * — this is a best-effort regex scrape of the public calendar page's anchor
 * tags. Most TxDOT lettings are pure roadway/paving/bridge work with no
 * Division 7 scope at all, so a near-empty (or empty) result on any given run
 * is expected, not a sign the scraper is broken — only lettings whose title
 * text itself matches a Division 7/flashing keyword (rest areas, maintenance
 * buildings, district office structures, etc.) are returned. Never throws.
 */

const TXDOT_URL = 'https://www.txdot.gov/business/contractors/highway-letting.html';
const TXDOT_SOURCE_NAME = 'TxDOT Letting Calendar';

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

async function getTxDotSourceId(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('bid_sources').select('id').eq('name', TXDOT_SOURCE_NAME).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function fetchTxDOT(): Promise<BidProject[]> {
  const [keywords, sourceId] = await Promise.all([getActiveKeywords(), getTxDotSourceId()]);

  if (!sourceId) {
    console.warn(
      `[bid-monitor/txdot] bid_sources row for "${TXDOT_SOURCE_NAME}" not found — has supabase/migrations/010_bid_monitor.sql been applied and seeded? Returning [].`
    );
    return [];
  }

  let html: string;
  try {
    const response = await fetch(TXDOT_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AFS-BidMonitor/1.0)' },
    });

    if (!response.ok) {
      console.warn(`[bid-monitor/txdot] request failed: HTTP ${response.status} — returning [].`);
      return [];
    }

    html = await response.text();
  } catch (error) {
    console.warn(
      '[bid-monitor/txdot] request threw:',
      error instanceof Error ? error.message : error,
      '— returning [].'
    );
    return [];
  }

  let links: ExtractedLink[];
  try {
    links = extractLinks(html, TXDOT_URL);
  } catch (error) {
    console.warn(
      '[bid-monitor/txdot] HTML parse threw:',
      error instanceof Error ? error.message : error,
      '— returning [].'
    );
    return [];
  }

  if (links.length === 0) {
    console.warn('[bid-monitor/txdot] no parseable links found in the letting-calendar response — returning [].');
    return [];
  }

  const projects: BidProject[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const keywordsMatched = matchKeywords(link.text, keywords);
    if (keywordsMatched.length === 0) continue;

    const externalId = stableExternalId(link.href, link.text);
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    projects.push({
      externalId,
      sourceId,
      title: link.text,
      agency: 'Texas Department of Transportation',
      locationState: 'TX',
      sourceUrl: link.href,
      keywordsMatched,
      division7Relevant: isDivision7Relevant(keywordsMatched),
      rawData: { text: link.text, href: link.href },
    });
  }

  return projects;
}
