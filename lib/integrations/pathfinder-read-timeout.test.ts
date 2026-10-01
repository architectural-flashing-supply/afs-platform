import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * F-03 — proof that a slow or unreachable PathfinderEdge cannot hang a Command
 * Center screen.
 *
 * `global.fetch` is replaced with one that never resolves unless the abort
 * signal it was handed fires. That is exactly the failure being guarded against:
 * a host that accepts the connection and then says nothing. If the read did not
 * carry a timeout, these tests would sit until vitest's own timeout killed them,
 * which is the point — the assertion is not "a flag is set somewhere", it is
 * "this promise resolves at all".
 *
 * Fake timers advance the clock so the suite does not actually wait 8 seconds.
 */

const ORIGINAL_ENV = { ...process.env };

/** A fetch that only ever settles by rejecting when its AbortSignal fires. */
function hangingFetch(): typeof fetch {
  return vi.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return; // no signal => hangs forever, which is the pre-fix behaviour
      if (signal.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  process.env.PATHFINDER_EDGE_BASE_URL = 'https://afs.pathfinderedge.com';
  process.env.PATHFINDER_EDGE_API_KEY = 'test-key-not-real';
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('PathfinderEdge reads time out', () => {
  it('exposes the timeout as a real, documented constant', async () => {
    const { PATHFINDER_READ_TIMEOUT_MS } = await import('@/lib/integrations/pathfinder-edge');
    expect(PATHFINDER_READ_TIMEOUT_MS).toBe(8000);
  });

  it('discoverApiEndpoints resolves with a plain-English timeout instead of hanging', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const { discoverApiEndpoints, PATHFINDER_READ_TIMEOUT_MS } = await import('@/lib/integrations/pathfinder-edge');

    const pending = discoverApiEndpoints();
    await vi.advanceTimersByTimeAsync(PATHFINDER_READ_TIMEOUT_MS + 10);
    const result = await pending;

    expect(result.status).toBe('error');
    expect(result.message).toContain('did not answer GET /api/v1/catalogs within 8 seconds');
    expect(result.message).toContain('Nothing was sent and nothing was changed');
    expect(result.endpoints).toEqual({});
  });

  it('does NOT abort before the timeout — a slow-but-working vendor still succeeds', async () => {
    const slowFetch = vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          // 2.46s is the latency the 2026-09-24 audit actually measured.
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => [{ catalogId: 20115, catalogName: 'afs' }],
              }),
            2460
          );
        })
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', slowFetch);
    const { discoverApiEndpoints } = await import('@/lib/integrations/pathfinder-edge');

    const pending = discoverApiEndpoints();
    await vi.advanceTimersByTimeAsync(2500);
    const result = await pending;

    expect(result.status).toBe('connected');
    expect(result.message).toContain('1 catalog');
  });

  it('getPathfinderCatalogs degrades to an empty list and logs, rather than hanging', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', hangingFetch());
    const { getPathfinderCatalogs, PATHFINDER_READ_TIMEOUT_MS } = await import('@/lib/integrations/pathfinder-edge');

    const pending = getPathfinderCatalogs();
    await vi.advanceTimersByTimeAsync(PATHFINDER_READ_TIMEOUT_MS + 10);
    const result = await pending;

    expect(result).toEqual([]);
    expect(spy.mock.calls.some((c) => String(c[0]).includes('[PATHFINDER_READ]'))).toBe(true);
  });

  it('a 200 with a changed shape is reported as an error, not as "Connected"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        // The envelope change: still a 200, still valid JSON, no longer an array.
        json: async () => ({ data: [{ catalogId: 20115, catalogName: 'afs' }] }),
      })) as unknown as typeof fetch
    );
    const { discoverApiEndpoints } = await import('@/lib/integrations/pathfinder-edge');

    const result = await discoverApiEndpoints();
    expect(result.status).toBe('error');
    expect(result.message).toContain('does not match the documented shape');
  });
});
