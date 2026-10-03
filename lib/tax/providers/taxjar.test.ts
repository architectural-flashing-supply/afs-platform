/**
 * EES-OVN.08 AC-23 … AC-26.
 *
 * NO NETWORK. Every test injects a `fetchImpl` double that returns a recorded
 * fixture body, which is both the item's rule ("Tests use recorded fixtures only;
 * no network") and what makes the no-retry and timeout guarantees assertable on a
 * call counter.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TaxJarProvider, centsToDollars, TAXJAR_TAXES_PATH, type FetchLike } from './taxjar';
import type { TaxCalculationRequest, TaxOrigin } from '../types';
import {
  TAXJAR_SUCCESS_WITH_NEXUS,
  TAXJAR_NO_NEXUS,
  TAXJAR_ERROR_ENVELOPE_WITH_200,
  TAXJAR_MISSING_AMOUNT,
} from '@/tests/fixtures/tax/taxjar-responses';

const API_KEY = 'tj_test_NEVER_LOGGED_0123456789';
const BASE_URL = 'https://api.taxjar.com';
const ORIGIN: TaxOrigin = { zip: '78611', state: 'TX' };
const REQUEST: TaxCalculationRequest = {
  toState: 'TX',
  toZip: '78701',
  subtotalCents: 100_000,
  shippingCents: 15_000,
};

interface FetchRecorder {
  fetchImpl: FetchLike;
  calls: { url: string; init: RequestInit }[];
}

/** A fetch double returning a JSON body with a chosen status. Records every call. */
function jsonFetch(body: unknown, status = 200): FetchRecorder {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetchImpl, calls };
}

/** A fetch double returning a non-JSON body, e.g. a proxy's HTML error page. */
function textFetch(text: string, status = 200): FetchRecorder {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(text, { status, headers: { 'Content-Type': 'text/html' } });
  };
  return { fetchImpl, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('centsToDollars — the outbound half of the money boundary', () => {
  it.each<[number, number]>([
    [100_000, 1000],
    [8250, 82.5],
    [1, 0.01],
    [0, 0],
  ])('centsToDollars(%o) === %o', (cents, dollars) => {
    expect(
      centsToDollars(cents),
      `Expected $${dollars} from ${cents} cents. TaxJar expects decimal dollars and this codebase ` +
        'holds integer cents; getting this backwards is a 100x error on a real invoice.'
    ).toBe(dollars);
  });
});

describe('TaxJarProvider — identity', () => {
  it('is authoritative, unlike the mock', () => {
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL });
    expect(provider.isAuthoritative, 'A real provider figure is a collectable tax.').toBe(true);
    expect(provider.name).toBe('taxjar');
  });
});

describe('TaxJarProvider — AC-23: the request it sends', () => {
  it('POSTs once to {base}/v2/taxes with the bearer header and the converted amounts', async () => {
    // ARRANGE
    const { fetchImpl, calls } = jsonFetch(TAXJAR_SUCCESS_WITH_NEXUS);
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(calls.length, 'Exactly one request — see the no-retry test below.').toBe(1);
    const call = calls[0];
    expect(call, 'A call must have been recorded.').toBeDefined();
    if (!call) throw new Error('unreachable');

    expect(call.url, `Expected the documented path; got "${call.url}".`).toBe(
      `${BASE_URL}${TAXJAR_TAXES_PATH}`
    );
    expect(call.init.method).toBe('POST');

    const headers = call.init.headers as Record<string, string>;
    expect(
      headers.Authorization,
      'TaxJar documents a bearer token. The exact form is EES-OVN.08 assumption A-1.'
    ).toBe(`Bearer ${API_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');

    const sent = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    expect(sent.from_zip, "The origin comes from configuration, never a guess.").toBe('78611');
    expect(sent.from_state, "SPEC §3 hardcodes 'TX'; this client does not.").toBe('TX');
    expect(sent.to_state).toBe('TX');
    expect(sent.to_zip).toBe('78701');
    expect(sent.amount, 'Expected cents converted to decimal dollars.').toBe(1000);
    expect(sent.shipping, 'Expected shipping converted too.').toBe(150);
    expect(sent.from_country).toBe('US');
    expect(sent.to_country).toBe('US');
  });

  it('AC-23: the API key never appears in a successful result', async () => {
    // ARRANGE
    const { fetchImpl } = jsonFetch(TAXJAR_SUCCESS_WITH_NEXUS);
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(
      JSON.stringify(result).includes(API_KEY),
      'The result is stored in tax_calculations and rendered on an admin screen. The key must never ' +
        'travel in it.'
    ).toBe(false);
  });

  it('AC-23: the API key never appears in a failure message or a log line', async () => {
    // ARRANGE
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl } = jsonFetch(TAXJAR_ERROR_ENVELOPE_WITH_200, 401);
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(result.ok).toBe(false);
    expect(
      JSON.stringify(result).includes(API_KEY),
      'A 401 is exactly when somebody is tempted to log the key to debug it. It must not be in the result.'
    ).toBe(false);
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(logged.includes(API_KEY), 'The key must not reach a log line either.').toBe(false);
  });

  it('passes cache: no-store, because a cached tax figure is a wrong figure', async () => {
    const { fetchImpl, calls } = jsonFetch(TAXJAR_SUCCESS_WITH_NEXUS);
    await new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl }).calculate(
      REQUEST,
      ORIGIN
    );
    expect(
      calls[0]?.init.cache,
      'Next.js patches global fetch and caches responses (CLAUDE.md rule #22). A tax figure served ' +
        'from the Data Cache for a changed basket is a wrong figure.'
    ).toBe('no-store');
  });
});

describe('TaxJarProvider — the success path', () => {
  it('returns parsed figures and the raw body for the audit snapshot', async () => {
    // ARRANGE
    const { fetchImpl } = jsonFetch(TAXJAR_SUCCESS_WITH_NEXUS);
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(result.ok, 'A valid 200 must succeed.').toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.figures.amountCents, 'Expected $82.50 as 8250 cents.').toBe(8250);
    expect(result.figures.rate).toBe(0.0825);
    expect(result.figures.hasNexus).toBe(true);
    expect(result.rawResponse, 'The raw body is snapshotted so a past calculation is reproducible.').toEqual(
      TAXJAR_SUCCESS_WITH_NEXUS
    );
  });

  it('a has_nexus: false body still succeeds here — the conflict is the engine\'s decision', async () => {
    const { fetchImpl } = jsonFetch(TAXJAR_NO_NEXUS);
    const result = await new TaxJarProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetchImpl,
    }).calculate(REQUEST, ORIGIN);
    expect(result.ok, 'The provider reports; the engine decides.').toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.figures.hasNexus).toBe(false);
  });
});

describe('TaxJarProvider — AC-24, AC-25: failure never throws and never zeroes', () => {
  it('AC-24: a non-2xx becomes a failure carrying the status', async () => {
    // ARRANGE
    const { fetchImpl } = jsonFetch({ error: 'Internal Server Error' }, 500);
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status, 'The status is what tells an admin whether this is theirs to fix.').toBe(500);
    expect(
      result.message,
      `Expected the message to state no tax was calculated; got "${result.message}".`
    ).toContain('no tax was calculated');
    expect(result.timedOut, 'A 500 is not a timeout.').toBe(false);
  });

  it('AC-24: a 401 says nothing was charged', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl } = jsonFetch(TAXJAR_ERROR_ENVELOPE_WITH_200, 401);
    const result = await new TaxJarProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetchImpl,
    }).calculate(REQUEST, ORIGIN);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(
      result.message,
      'CLAUDE.md rule #30: always say what did NOT happen. "You have not been charged" is the sentence.'
    ).toContain('Nothing was charged');
  });

  it('AC-25: a timeout is reported as a timeout, and says no tax was calculated', async () => {
    // ARRANGE — a fetch that never settles until aborted, so the real
    // AbortController path runs rather than a test-only flag.
    const calls: string[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push(url);
      return new Promise((_resolve, reject) => {
        const signal = init.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    };
    const provider = new TaxJarProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetchImpl,
      timeoutMs: 20,
    });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(result.ok, 'A hung vendor must not hang a Command Center screen forever.').toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(
      result.timedOut,
      'A timeout and a network error read differently to the person looking at the screen: one means ' +
        'the vendor is slow, the other usually means a configuration problem.'
    ).toBe(true);
    expect(result.message, `Expected "NO TAX WAS CALCULATED"; got "${result.message}".`).toContain(
      'NO TAX WAS CALCULATED'
    );
    expect(calls.length, 'A timeout must not trigger a second attempt.').toBe(1);
  });

  it('a DNS/network error is reported as reachability, not as a timeout', async () => {
    // ARRANGE
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.timedOut, 'A network failure is not a timeout.').toBe(false);
    expect(result.message).toContain('could not be reached');
    expect(result.problems.join(' '), 'The underlying error text is the diagnosis.').toContain('fetch failed');
  });

  it('a 200 with a malformed body is an ERROR, never a success, and is logged', async () => {
    // ARRANGE
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl } = jsonFetch(TAXJAR_MISSING_AMOUNT);
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(
      result.ok,
      'A 200 carrying the wrong shape must be reported as an error. `(await res.json()) as T` would ' +
        'have called this a success and produced NaN cents downstream.'
    ).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status, 'The HTTP exchange did succeed, so the status is 200.').toBe(200);
    expect(result.problems.join(' ')).toContain('amount_to_collect');
    expect(
      errorSpy,
      'A changed vendor shape must leave a searchable server-side record.'
    ).toHaveBeenCalledTimes(1);
  });

  it('a 200 whose body is not JSON at all is a failure, not a crash', async () => {
    // ARRANGE — a proxy's HTML error page with a 200, which happens.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl } = textFetch('<html>Gateway</html>');
    const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });

    // ACT
    const result = await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.problems.join(' ')).toContain('not JSON');
  });

  it('an empty non-2xx body is reported without pretending there was one', async () => {
    const { fetchImpl } = textFetch('', 502);
    const result = await new TaxJarProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetchImpl,
    }).calculate(REQUEST, ORIGIN);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.problems.join(' ')).toContain('(empty body)');
  });

  it('never throws for any failure mode', async () => {
    // ARRANGE
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const modes: FetchLike[] = [
      async () => {
        throw new Error('boom');
      },
      jsonFetch({ error: 'nope' }, 403).fetchImpl,
      textFetch('not json').fetchImpl,
      jsonFetch(null).fetchImpl,
    ];

    // ACT / ASSERT
    for (const fetchImpl of modes) {
      const provider = new TaxJarProvider({ apiKey: API_KEY, baseUrl: BASE_URL, fetchImpl });
      await expect(
        provider.calculate(REQUEST, ORIGIN),
        'A provider that throws reaches a caller deciding what to bill as an exception, which is the ' +
          'one shape that cannot be reasoned about there.'
      ).resolves.toBeDefined();
    }
  });
});

describe('TaxJarProvider — AC-26: no retry, ever', () => {
  it.each<[string, FetchRecorder | null]>([
    ['a 500', jsonFetch({ e: 1 }, 500)],
    ['a 401', jsonFetch({ e: 1 }, 401)],
    ['a malformed 200', jsonFetch(TAXJAR_MISSING_AMOUNT)],
  ])('makes exactly one request on %s', async (_label, recorder) => {
    // ARRANGE
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    if (!recorder) throw new Error('fixture missing');
    const provider = new TaxJarProvider({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetchImpl: recorder.fetchImpl,
    });

    // ACT
    await provider.calculate(REQUEST, ORIGIN);

    // ASSERT
    expect(
      recorder.calls.length,
      'CLAUDE.md rule #32: a retried lookup can return a different figure from the one already shown, ' +
        'and when a lookup fails the honest answer is that it failed. Persistence here would trade a ' +
        'visible problem for an invisible one.'
    ).toBe(1);
  });
});
