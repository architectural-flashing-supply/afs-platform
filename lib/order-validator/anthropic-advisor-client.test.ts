/**
 * The one piece of real glue between the advisory layer and the Anthropic SDK.
 *
 * It is deliberately thin — no parsing, no retry, no fence stripping, all of
 * which belong to the advisor where they are tested — but "thin" is not
 * "trivial": it picks one block out of a content array, and it has a fallback
 * for a response with no text in it at all. Both are worth a test, because a
 * mistake in either reaches the advisor as a shape problem it would report as
 * the MODEL's fault.
 *
 * `@/lib/anthropic/client` is mocked rather than imported, so this test makes no
 * network request and needs no API key — the real module constructs an
 * `Anthropic` from `process.env.ANTHROPIC_API_KEY` at import time.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('@/lib/anthropic/client', () => ({
  anthropic: { messages: { create: (...args: unknown[]) => create(...args) } },
}));

const { createAnthropicAdvisoryClient } = await import('./anthropic-advisor-client');

beforeEach(() => {
  create.mockReset();
});

describe('createAnthropicAdvisoryClient', () => {
  it('passes the model, token limit, system prompt and user message straight through', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '{"advisories":[]}' }] });
    const client = createAnthropicAdvisoryClient();

    await client.complete({
      model: 'claude-sonnet-4-6',
      maxTokens: 900,
      system: 'SYSTEM',
      user: 'USER',
    });

    expect(
      create.mock.calls[0][0],
      'Expected the Messages API called with exactly what the advisor asked for. The adapter must not substitute a model or a token limit of its own — the advisor owns those, and it is where they are asserted.'
    ).toEqual({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: 'SYSTEM',
      messages: [{ role: 'user', content: 'USER' }],
    });
  });

  it('returns the text of the response', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '{"advisories":[]}' }] });
    expect(
      await createAnthropicAdvisoryClient().complete({ model: 'm', maxTokens: 1, system: 's', user: 'u' }),
      'Expected the raw text, unparsed. Parsing here would be a second parser for the advisor\'s one tested parser to disagree with.'
    ).toBe('{"advisories":[]}');
  });

  it('finds the text block when it is not the first block', async () => {
    create.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: 'internal' },
        { type: 'text', text: '{"advisories":[]}' },
      ],
    });
    expect(
      await createAnthropicAdvisoryClient().complete({ model: 'm', maxTokens: 1, system: 's', user: 'u' }),
      'Expected the text block found by type rather than by position. A response can carry other block kinds ahead of it, and indexing [0] would hand the advisor an object it would report as a bad shape.'
    ).toBe('{"advisories":[]}');
  });

  it('returns an empty JSON object when the response carries no text at all', async () => {
    create.mockResolvedValue({ content: [] });
    expect(
      await createAnthropicAdvisoryClient().complete({ model: 'm', maxTokens: 1, system: 's', user: 'u' }),
      'Expected "{}", which the advisor reads as "nothing to say". Throwing here would turn an empty response into a logged transport failure, and returning an empty string would be reported as an empty response — both describing the wrong thing.'
    ).toBe('{}');
  });

  it('lets a transport failure propagate, because the advisor is what handles it', async () => {
    create.mockRejectedValue(new Error('503 upstream unavailable'));
    await expect(
      createAnthropicAdvisoryClient().complete({ model: 'm', maxTokens: 1, system: 's', user: 'u' }),
      'Expected the rejection to pass through. requestAdvisories catches it, reports one server line and returns no advisories — catching it here as well would mean two places deciding what a failure means.'
    ).rejects.toThrow('503 upstream unavailable');
  });
});
