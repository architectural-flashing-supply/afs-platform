/**
 * THE ONE PLACE THE ADVISORY LAYER MEETS THE ANTHROPIC SDK.
 *
 * It is a separate file from lib/order-validator/ai-advisor.ts for two reasons,
 * and both of them are the file's whole job:
 *
 *   1. CLAUDE.md RULE #5 — no client-side AI calls, the API key never touches
 *      the client bundle. `lib/anthropic/client.ts` constructs an `Anthropic`
 *      with `process.env.ANTHROPIC_API_KEY`, so any module that imports it is
 *      server-only. The advisory layer itself is imported by a client component
 *      (the Quote Builder runs the deterministic engine live as the customer
 *      types), so it must not reach the SDK — and it does not: it takes an
 *      `AdvisoryClient` and this is the only implementation of it.
 *
 *   2. A unit test of the advisory layer needs no network, no key and no module
 *      mock. Importing this file is what would have made one necessary.
 *
 * Only `app/api/quote-requests/validate/route.ts` imports this.
 */

import { anthropic } from '@/lib/anthropic/client';
import type { AdvisoryClient } from './ai-advisor';

/**
 * Wraps the Messages API in the one-method interface the advisor wants.
 *
 * Deliberately thin: it does not strip fences, parse JSON, retry, or interpret
 * anything. Every one of those is the advisor's job, where it is tested — a
 * second parser here would be a second place for a response shape to be
 * misread. An empty text block resolves to `'{}'` rather than throwing, which
 * the advisor reads as "nothing to say".
 */
export function createAnthropicAdvisoryClient(): AdvisoryClient {
  return {
    async complete({ model, maxTokens, system, user }) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = response.content.find((block) => block.type === 'text');
      return text && text.type === 'text' ? text.text : '{}';
    },
  };
}
