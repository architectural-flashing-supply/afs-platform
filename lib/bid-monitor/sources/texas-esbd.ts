import { createAdminClient } from '@/lib/supabase/admin';
import { matchKeywords, isDivision7Relevant, DEFAULT_DIVISION7_KEYWORDS } from '../keyword-matcher';
import { extractLinks, stableExternalId, type ExtractedLink } from '../html-extract';
import type { BidProject } from '../types';

/**
 * Texas ESBD (Electronic State Business Daily) — https://www.txsmartbuy.gov/esbd.
 *
 * Unlike SAM.gov/USASpending (see sam-gov.ts / usaspending.ts), ESBD has no
 * public REST API. This does a plain GET of the public search page and
 * regex-parses its anchor tags for opportunity titles/links — a best-effort
 * scrape, not a documented integration. The real ESBD search results are
 * rendered by an ASP.NET postback UI, so a plain GET without the browser
 * session/viewstate a real visit would carry is likely to return few or no
 * parseable listing links; that is treated identically to a network failure
 * (log a warning, return []) — this function never throws.
 */

const ESBD_URL = 'https://www.txsmartbuy.gov/esbd';
const ESBD_SOURCE_NAME = 'Texas ESBD';

// Broad first-pass filter for "construction-related" before the stricter
// Division 7 / flashing keyword match below — ESBD listing titles are often
// terse ("HVAC REPAIR", "ROOF REPLACEMENT DISTRICT 4"), so this catches
// construction opportunities worth keyword-checking at all.
const CONSTRUCTION_HINTS = ['construction', 'roof', 'roofing', 'sheet metal', 'flashing', 'building', 'renovation', 'repair'];

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

async function getEsbdSourceId(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('bid_sources').select('id').eq('name', ESBD_SOURCE_NAME).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function fetchTexasESBD(): Promise<BidProject[]> {
  const [keywords, sourceId] = await Promise.all([getActiveKeywords(), getEsbdSourceId()]);

  if (!sourceId) {
    console.warn(
      `[bid-monitor/texas-esbd] bid_sources row for "${ESBD_SOURCE_NAME}" not found — has supabase/migrations/010_bid_monitor.sql been applied and seeded? Returning [].`
    );
    return [];
  }

  let html: string;
  try {
    const response = await fetch(ESBD_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AFS-BidMonitor/1.0)' },
    });

    if (!response.ok) {
      console.warn(`[bid-monitor/texas-esbd] request failed: HTTP ${response.status} — returning [].`);
      return [];
    }

    html = await response.text();
  } catch (error) {
    console.warn(
      '[bid-monitor/texas-esbd] request threw:',
      error instanceof Error ? error.message : error,
      '— returning [].'
    );
    return [];
  }

  let links: ExtractedLink[];
  try {
    links = extractLinks(html, ESBD_URL);
  } catch (error) {
    console.warn(
      '[bid-monitor/texas-esbd] HTML parse threw:',
      error instanceof Error ? error.message : error,
      '— returning [].'
    );
    return [];
  }

  if (links.length === 0) {
    console.warn(
      '[bid-monitor/texas-esbd] no parseable links found in the ESBD response — the search UI likely requires a browser session/postback this plain GET cannot supply. Returning [].'
    );
    return [];
  }

  const projects: BidProject[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const lowerText = link.text.toLowerCase();
    const looksConstruction = CONSTRUCTION_HINTS.some((hint) => lowerText.includes(hint));
    if (!looksConstruction) continue;

    const keywordsMatched = matchKeywords(link.text, keywords);
    if (keywordsMatched.length === 0) continue;

    const externalId = stableExternalId(link.href, link.text);
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    projects.push({
      externalId,
      sourceId,
      title: link.text,
      locationState: 'TX',
      sourceUrl: link.href,
      keywordsMatched,
      division7Relevant: isDivision7Relevant(keywordsMatched),
      rawData: { text: link.text, href: link.href },
    });
  }

  return projects;
}
