import { createHash } from 'crypto';

/**
 * Minimal, dependency-free anchor-tag extractor used by the two best-effort
 * HTML-scrape sources (texas-esbd.ts, txdot.ts) — this project has no
 * cheerio/DOM-parser dependency, and neither portal exposes a real API (see
 * each file's own header comment). Deliberately tolerant: a portal that
 * renders its listing entirely client-side (a JS-driven SPA, or an ASP.NET
 * postback UI that needs a browser session) will yield zero or few links
 * from a plain GET's initial HTML — callers treat that the same as a network
 * failure (log a warning, return []), not a parser bug to fix here.
 */
export interface ExtractedLink {
  text: string;
  href: string;
}

export function extractLinks(html: string, baseUrl: string): ExtractedLink[] {
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results: ExtractedLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const text = stripHtmlTags(match[2]);
    if (!text) continue;

    let resolvedHref: string;
    try {
      resolvedHref = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }

    results.push({ text, href: resolvedHref });
  }

  return results;
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable, collision-resistant id for a scraped row that has no native id — derived from its link + text. */
export function stableExternalId(...parts: string[]): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}
