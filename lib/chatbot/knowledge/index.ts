import type { KnowledgeChunk } from './types';
import { division7Knowledge } from './division7';
import { materialsKnowledge } from './materials';
import { afsProfilesKnowledge } from './afs-profiles';
import { afsCompanyKnowledge } from './afs-company';
import { resourcesKnowledge } from './resources';
import { specFilesKnowledge } from './spec-files';

export type { KnowledgeChunk };

// Combined AFS chatbot RAG knowledge base — Division 7 reference
// content, material data, AFS-specific profiles, company/operational
// info, industry resources, and customer-facing platform feature
// descriptions extracted from specs/. Consumed by app/api/chat/route.ts
// to ground responses without relying purely on the system prompt or an
// external vector DB.
export const allKnowledge: KnowledgeChunk[] = [
  ...division7Knowledge,
  ...materialsKnowledge,
  ...afsProfilesKnowledge,
  ...afsCompanyKnowledge,
  ...resourcesKnowledge,
  ...specFilesKnowledge,
];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'with',
  'what', 'when', 'where', 'why', 'how', 'do', 'does', 'did', 'can',
  'could', 'should', 'would', 'i', 'my', 'we', 'our', 'you', 'your',
  'it', 'its', 'this', 'that', 'these', 'those', 'me', 'about', 'need',
  'want', 'have', 'has', 'if', 'so', 'as', 'not', 'use', 'used', 'using',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Simple keyword-overlap scoring — no external vector DB required.
 * Each chunk is scored against the tokenized query with weighted hits:
 * exact keyword match > topic-text match > content-text match, plus a
 * small bonus for category/subcategory hits. Chunks with a zero score
 * are excluded. Returns the top 5 highest-scoring chunks.
 */
export function searchKnowledge(query: string): KnowledgeChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = allKnowledge.map((chunk) => {
    const keywordSet = new Set(chunk.keywords.map((k) => k.toLowerCase()));
    const topicText = chunk.topic.toLowerCase();
    const contentText = chunk.content.toLowerCase();
    const categoryText = `${chunk.category} ${chunk.subcategory}`.toLowerCase();

    let score = 0;

    for (const token of queryTokens) {
      // Exact keyword token match (highest weight)
      if (keywordSet.has(token)) score += 5;

      // Keyword phrase contains the token (e.g. "coping" inside "coping cap")
      for (const keyword of keywordSet) {
        if (keyword.includes(token) || token.includes(keyword)) {
          score += 3;
          break;
        }
      }

      if (topicText.includes(token)) score += 3;
      if (categoryText.includes(token)) score += 1;
      if (contentText.includes(token)) score += 1;
    }

    // Bonus for matching multi-word phrases from the query verbatim in
    // the topic or keywords (rewards precise matches like "coping cap").
    const queryLower = query.toLowerCase();
    if (topicText.includes(queryLower) && queryLower.length > 3) score += 4;
    for (const keyword of keywordSet) {
      if (queryLower.includes(keyword) && keyword.length > 3) score += 2;
    }

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.chunk);
}
