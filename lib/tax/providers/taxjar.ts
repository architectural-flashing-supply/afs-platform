/**
 * THE REAL TAXJAR CLIENT.
 *
 * A typed `fetch` with an `AbortController` timeout and a hand-written response
 * parser — the pattern lib/integrations/pathfinder-edge.ts already establishes
 * for a vendor REST API in this codebase. The `taxjar` npm SDK is deliberately
 * NOT added: specs/SPEC_TAXJAR_INTEGRATION.md §3 imports it, but this repo has a
 * working house pattern for exactly this job, and a dependency whose only purpose
 * is to wrap one POST is more surface than the thing it wraps.
 *
 * ================== WHAT IS UNVERIFIED, SAID PLAINLY ==================
 *
 * NO LIVE TAXJAR CALL HAS EVER BEEN MADE FROM THIS CODEBASE. There is no API key
 * (app/admin/settings/page.tsx has reported TaxJar as unconfigured since it was
 * written) and the build that produced this file made no network requests by
 * rule. So the endpoint path, the auth header form and the response shape are
 * taken from specs/SPEC_TAXJAR_INTEGRATION.md §3, which was written against the
 * real SDK and reads `response.tax.amount_to_collect` / `response.tax.rate`.
 * That is corroboration, not verification — EES-OVN.08 assumption A-1,
 * UNRESOLVED-01.
 *
 * THAT IS SAFE TO SHIP BECAUSE NOTHING HERE CASTS. Every response goes through
 * `parseTaxForOrderResponse`, so a different real shape produces a reported
 * problem and a logged truncated payload — which the engine turns into a
 * `failed` outcome flagged for a human — and never a wrong tax figure. When a key
 * does arrive, the first real call will either work or say exactly what differed.
 * The base URL is env-overridable (`TAXJAR_API_BASE_URL`) so the sandbox can be
 * pointed at without a code change.
 *
 * ================== THE TIMEOUT, AND WHY IT IS NOT A RULE #32 BREACH ==================
 *
 * CLAUDE.md rule #32 forbids a timeout on the PathfinderEdge POST, because
 * aborting a WRITE tells you nothing about whether the server committed it, and
 * an abandoned-but-committed profile in catalog 20115 is work the physical
 * Thalmann will collect that this app has no record of.
 *
 * A TAX CALCULATION IS A READ THAT HAPPENS TO USE POST. It creates no order and
 * commits nothing — TaxJar's separate `/v2/transactions` endpoint is what records
 * an order, and this file does not call it. Aborting therefore loses nothing, and
 * the alternative is a Command Center screen rendering forever, which is the
 * exact failure rule #32's read timeout exists to prevent. Same principle,
 * opposite conclusion, because the operation is a different kind.
 *
 * ================== AND NO RETRY ==================
 *
 * Also rule #32's other half. A retried tax lookup can return a different figure
 * from the one already shown or stored; and when a lookup fails, the honest
 * answer is "it failed", which is what a `failed` outcome plus an admin review
 * row says. Persistence here would trade a visible problem for an invisible one.
 */

import { TAX_READ_TIMEOUT_MS } from '../config';
import { logTaxShapeProblem, parseTaxForOrderResponse } from '../response';
import type {
  ProviderResult,
  TaxCalculationRequest,
  TaxOrigin,
  TaxProvider,
} from '../types';

/** The documented tax-for-order path, relative to the configured base URL. */
export const TAXJAR_TAXES_PATH = '/v2/taxes';

/** How much of a non-2xx body is carried into a message. Enough to recognise. */
const MAX_ERROR_BODY_CHARS = 300;

/**
 * Cents to the decimal dollars TaxJar expects. The mirror of
 * `dollarsToCents` in response.ts, and the only outbound half of the
 * cents/dollars boundary (EES-OVN.08 assumption A-2).
 *
 * Division by exactly 100 of an integer is exact for every amount this
 * application can hold, so no rounding is applied or needed.
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * The `fetch` this client uses. Injectable so every test runs against a recorded
 * fixture body with no network — the item's "recorded fixtures only" rule — and
 * so the timeout and the no-retry guarantee can be asserted on a call counter.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface TaxJarClientOptions {
  apiKey: string;
  baseUrl: string;
  /** Defaults to global `fetch`. */
  fetchImpl?: FetchLike;
  /** Defaults to TAX_READ_TIMEOUT_MS. */
  timeoutMs?: number;
}

export class TaxJarProvider implements TaxProvider {
  readonly name = 'taxjar' as const;

  /** A real provider's figure is a collectable tax. */
  readonly isAuthoritative = true;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: TaxJarClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.fetchImpl =
      options.fetchImpl ??
      ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? TAX_READ_TIMEOUT_MS;
  }

  /**
   * NEVER THROWS. Every failure mode — a timeout, a DNS error, a 500, a 200
   * carrying the wrong shape — comes back as a `ProviderFailure` with a message
   * written for the admin who will read it on screen.
   *
   * The returned messages NEVER contain the API key. It appears in exactly one
   * expression in this method, the Authorization header.
   */
  async calculate(request: TaxCalculationRequest, origin: TaxOrigin): Promise<ProviderResult> {
    const url = `${this.baseUrl}${TAXJAR_TAXES_PATH}`;
    const body = {
      from_country: 'US',
      from_zip: origin.zip,
      from_state: origin.state,
      to_country: 'US',
      to_zip: request.toZip,
      to_state: request.toState,
      amount: centsToDollars(request.subtotalCents),
      shipping: centsToDollars(request.shippingCents),
    };

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          // The ONE place the key is used. Never logged, never returned.
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        // The service-role client's reasoning applies here too (CLAUDE.md rule
        // #22): Next.js patches global fetch and caches responses, and a cached
        // tax figure for a changed basket is a wrong figure.
        cache: 'no-store',
      });
    } catch (err) {
      if (timedOut) {
        return {
          ok: false,
          message:
            `TaxJar did not answer within ${this.timeoutMs / 1000} seconds, so NO TAX WAS CALCULATED. ` +
            'Nothing was charged and nothing was saved as a tax figure. Try again in a moment.',
          problems: ['The request to TaxJar timed out.'],
          timedOut: true,
          status: null,
        };
      }
      return {
        ok: false,
        message:
          'TaxJar could not be reached, so no tax was calculated. This usually means a network or ' +
          'configuration problem rather than a problem with the order.',
        problems: [err instanceof Error ? err.message : 'Unknown network error calling TaxJar.'],
        timedOut: false,
        status: null,
      };
    } finally {
      clearTimeout(timer);
    }

    // ---- Read the body ONCE. A Response body is a stream and cannot be read
    // twice, so the text is taken first and parsed from the string; calling
    // .json() then .text() on a failure would throw on the second read.
    let rawText: string;
    try {
      rawText = await response.text();
    } catch {
      return {
        ok: false,
        message:
          `TaxJar answered with ${response.status} but its response could not be read, so no tax was calculated.`,
        problems: ['The response body could not be read.'],
        timedOut: false,
        status: response.status,
      };
    }

    if (!response.ok) {
      const snippet =
        rawText.length > MAX_ERROR_BODY_CHARS
          ? `${rawText.slice(0, MAX_ERROR_BODY_CHARS)}…`
          : rawText;
      return {
        ok: false,
        message:
          `TaxJar refused the request with HTTP ${response.status}, so no tax was calculated. ` +
          'Nothing was charged.',
        problems: [`HTTP ${response.status} from TaxJar.`, snippet === '' ? '(empty body)' : snippet],
        timedOut: false,
        status: response.status,
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      const problems = ['TaxJar returned a 200 whose body is not JSON.'];
      logTaxShapeProblem(`POST ${TAXJAR_TAXES_PATH}`, problems, rawText);
      return {
        ok: false,
        message:
          'TaxJar answered successfully but its response was not readable, so no tax was calculated. ' +
          'Nothing was charged. This has been recorded for review.',
        problems,
        timedOut: false,
        status: response.status,
      };
    }

    const shape = parseTaxForOrderResponse(parsedJson);
    if (!shape.ok) {
      // A 200 WITH A WRONG BODY IS AN ERROR, NEVER A SUCCESS. Rule #32's other
      // half, and the reason this file has a parser at all.
      logTaxShapeProblem(`POST ${TAXJAR_TAXES_PATH}`, shape.problems, parsedJson);
      return {
        ok: false,
        message:
          'TaxJar answered, but the response did not contain a tax figure this app recognises, so no ' +
          'tax was calculated. Nothing was charged. This has been recorded for review.',
        problems: shape.problems,
        timedOut: false,
        status: response.status,
      };
    }

    return { ok: true, figures: shape.value, rawResponse: parsedJson };
  }
}
