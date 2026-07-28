/**
 * Mirrors the 30-row bid_keywords seed in supabase/migrations/010_bid_monitor.sql.
 * Used as a fallback by the source fetchers (lib/bid-monitor/sources/*) when the
 * live bid_keywords table can't be read (migration not yet applied, or a transient
 * DB error) — keyword matching keeps working even without a database round-trip.
 */
export const DEFAULT_DIVISION7_KEYWORDS: string[] = [
  'flashing',
  'sheet metal',
  'architectural metal',
  'coping cap',
  'gravel stop',
  'drip edge',
  'gutter',
  'downspout',
  'fascia',
  'counter flashing',
  'base flashing',
  'step flashing',
  'valley flashing',
  'reglet',
  'scupper',
  'expansion joint',
  'conductor head',
  'Z-bar',
  'standing seam',
  'metal roofing',
  'roof specialties',
  'Division 07',
  '07 62 00',
  '07 71 00',
  'SMACNA',
  'thermal and moisture',
  'copper flashing',
  'aluminum flashing',
  'galvanized',
  'stainless flashing',
];

/**
 * Case-insensitive substring match of each keyword against text (title +
 * description combined by the caller). Returns the subset of `keywords` that
 * appear in `text`, preserving `keywords`' own order.
 */
export function matchKeywords(text: string, keywords: string[]): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (keyword && normalized.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    }
  }
  return matched;
}

/**
 * bid_keywords is itself the Division 7 (Thermal and Moisture Protection) /
 * flashing keyword list (see 010_bid_monitor.sql's header comment) — matching
 * any one of them means the project touches Division 7 scope, so relevance is
 * just "matched at least one keyword."
 */
export function isDivision7Relevant(matchedKeywords: string[]): boolean {
  return matchedKeywords.length > 0;
}
