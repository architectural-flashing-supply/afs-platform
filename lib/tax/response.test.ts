/**
 * EES-OVN.08 AC-19 … AC-22.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseTaxForOrderResponse,
  dollarsToCents,
  logTaxShapeProblem,
  TAX_SHAPE_LOG_LIMITS,
} from './response';
import {
  TAXJAR_SUCCESS_WITH_NEXUS,
  TAXJAR_SUCCESS_ZERO_WITH_NEXUS,
  TAXJAR_NO_NEXUS,
  TAXJAR_SUCCESS_FREIGHT_TAXABLE,
  TAXJAR_SUCCESS_NO_HAS_NEXUS_FIELD,
  TAXJAR_SUCCESS_FRACTIONAL_CENT,
  TAXJAR_SUCCESS_HALF_CENT,
  TAXJAR_ERROR_ENVELOPE_WITH_200,
  TAXJAR_MISSING_TAX_OBJECT,
  TAXJAR_TAX_NOT_AN_OBJECT,
  TAXJAR_MISSING_AMOUNT,
  TAXJAR_AMOUNT_AS_STRING,
  TAXJAR_NEGATIVE_AMOUNT,
  TAXJAR_NULL_AMOUNT,
  TAXJAR_NEGATIVE_RATE,
  TAXJAR_RATE_AS_STRING,
  TAXJAR_ARRAY_BODY,
  TAXJAR_OVERSIZED_BODY,
} from '@/tests/fixtures/tax/taxjar-responses';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dollarsToCents — AC-21, the 100x risk', () => {
  it.each<[number, number, string]>([
    [12.34, 1234, 'the ordinary case'],
    [82.5, 8250, 'one decimal place'],
    [0, 0, 'zero'],
    [1000, 100_000, 'a whole-dollar amount'],
    [0.01, 1, 'one cent'],
    [0.005, 1, 'exactly half a cent rounds up, matching the rest of this codebase'],
    // $12.345 * 100 is exactly 1234.5 as a double, so half-up gives 1235.
    // NOTE, and it is a real caveat rather than a curiosity: the exact-half
    // boundary is only reachable when the float product lands precisely on .5,
    // which depends on the binary representation of the input. These rows pin
    // the OBSERVED behaviour of Math.round over the float product (verified by
    // executing `12.345 * 100 === 1234.5`), not an arithmetic ideal. A sub-cent
    // tax difference is not a billing risk; a 100x one is, which is what the
    // rest of this table guards.
    [12.345, 1235, 'an exact half cent rounds up'],
    [12.344, 1234, 'below half rounds down'],
    [12.346, 1235, 'above half rounds up'],
    [999_999.99, 99_999_999, 'a large amount stays an exact integer'],
  ])('dollarsToCents(%o) === %o — %s', (dollars, expected, why) => {
    expect(
      dollarsToCents(dollars),
      `Expected ${expected} cents from $${dollars} because ${why}. A conversion error here is a ` +
        '100x error on a customer invoice.'
    ).toBe(expected);
  });

  it('always returns an integer', () => {
    expect(Number.isInteger(dollarsToCents(12.345)), 'Cents must never be fractional.').toBe(true);
  });
});

describe('parseTaxForOrderResponse — the success paths', () => {
  it('AC-19: parses a nexus calculation to cents, rate and jurisdictions', () => {
    // ARRANGE / ACT
    const result = parseTaxForOrderResponse(TAXJAR_SUCCESS_WITH_NEXUS);

    // ASSERT
    expect(result.ok, 'The recorded success fixture must parse.').toBe(true);
    if (!result.ok) throw new Error('unreachable — guarded by the assertion above');
    expect(
      result.value.amountCents,
      'Expected 8250 cents from $82.50.'
    ).toBe(8250);
    expect(result.value.rate, 'Expected the 8.25% rate to survive unchanged.').toBe(0.0825);
    expect(result.value.taxableAmountCents, 'Expected $1000.00 taxable as 100000 cents.').toBe(100_000);
    expect(result.value.hasNexus, 'The fixture states has_nexus: true.').toBe(true);
    expect(result.value.freightTaxable).toBe(false);
    expect(result.value.jurisdictions).toEqual({
      country: 'US',
      state: 'TX',
      county: 'BURNET',
      city: 'BURNET',
    });
  });

  it('AC-11 (parser half): a zero amount WITH nexus parses as a valid figure', () => {
    // ARRANGE / ACT
    const result = parseTaxForOrderResponse(TAXJAR_SUCCESS_ZERO_WITH_NEXUS);

    // ASSERT
    expect(
      result.ok,
      'A zero tax in a nexus state is a real answer and must parse. If the parser refused it, the ' +
        'whole subsystem would be using zero as a failure signal — the bug this item exists to fix.'
    ).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.amountCents).toBe(0);
    expect(result.value.hasNexus).toBe(true);
  });

  it('a has_nexus: false body parses successfully — the CONFLICT is the engine\'s call, not the parser\'s', () => {
    // ARRANGE / ACT
    const result = parseTaxForOrderResponse(TAXJAR_NO_NEXUS);

    // ASSERT
    expect(
      result.ok,
      'The parser reports what arrived. Deciding that "vendor says no nexus" contradicts AFS\'s own ' +
        'record is the engine\'s job — keeping that out of here stops the same decision being made ' +
        'twice, differently.'
    ).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.hasNexus).toBe(false);
    expect(result.value.amountCents).toBe(0);
  });

  it('parses taxable freight', () => {
    const result = parseTaxForOrderResponse(TAXJAR_SUCCESS_FREIGHT_TAXABLE);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.freightTaxable, 'The fixture states freight_taxable: true.').toBe(true);
    expect(result.value.amountCents).toBe(9488);
  });

  it('AC-20: an absent has_nexus becomes null, NOT false', () => {
    // ARRANGE / ACT
    const result = parseTaxForOrderResponse(TAXJAR_SUCCESS_NO_HAS_NEXUS_FIELD);

    // ASSERT
    expect(result.ok, 'A missing has_nexus is not fatal — the amount is still usable.').toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(
      result.value.hasNexus,
      'Expected null for an absent has_nexus. Defaulting it to false would make every response ' +
        'without the field look like the vendor denying nexus, which the engine escalates as a ' +
        'conflict — turning a silent field rename into a flood of false alarms.'
    ).toBeNull();
    expect(result.value.amountCents).toBe(8250);
  });

  it('an absent rate becomes 0 rather than discarding a usable amount', () => {
    // ARRANGE
    const body = { tax: { amount_to_collect: 82.5, has_nexus: true } };

    // ACT
    const result = parseTaxForOrderResponse(body);

    // ASSERT
    expect(result.ok, 'A missing rate must not discard a good amount.').toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.rate).toBe(0);
    expect(result.value.amountCents).toBe(8250);
  });

  it('absent reporting detail becomes null rather than a guess', () => {
    const result = parseTaxForOrderResponse({ tax: { amount_to_collect: 1, rate: 0.01 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.taxableAmountCents).toBeNull();
    expect(result.value.freightTaxable).toBeNull();
    expect(result.value.jurisdictions).toBeNull();
  });

  it('rounds fractional and half cents as documented', () => {
    const third = parseTaxForOrderResponse(TAXJAR_SUCCESS_FRACTIONAL_CENT);
    expect(third.ok).toBe(true);
    if (!third.ok) throw new Error('unreachable');
    expect(third.value.amountCents, '$12.345 → 1235 cents, half-up.').toBe(1235);

    const half = parseTaxForOrderResponse(TAXJAR_SUCCESS_HALF_CENT);
    expect(half.ok).toBe(true);
    if (!half.ok) throw new Error('unreachable');
    expect(half.value.amountCents, '$0.005 → 1 cent, half-up.').toBe(1);
  });

  it('empty-string jurisdiction fields become null rather than empty strings', () => {
    const result = parseTaxForOrderResponse({
      tax: { amount_to_collect: 1, jurisdictions: { country: 'US', state: '  ', county: '', city: null } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.jurisdictions).toEqual({ country: 'US', state: null, county: null, city: null });
  });
});

describe('parseTaxForOrderResponse — AC-20, every malformed body is reported', () => {
  it('an error object returned with a 200 is reported, and names the error', () => {
    // ARRANGE / ACT — the case a cast cannot survive.
    const result = parseTaxForOrderResponse(TAXJAR_ERROR_ENVELOPE_WITH_200);

    // ASSERT
    expect(
      result.ok,
      'A 200 carrying an error object must be reported as a problem. `(await res.json()) as T` would ' +
        'have accepted this and produced NaN cents downstream.'
    ).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(
      result.problems[0],
      `Expected the problem to quote the vendor's own error text; got "${result.problems[0]}".`
    ).toContain('Unauthorized');
    expect(result.problems[0], 'Expected the detail too.').toContain('Invalid API token');
  });

  it.each<[string, unknown, string]>([
    ['a missing tax object', TAXJAR_MISSING_TAX_OBJECT, 'tax'],
    ['tax not an object', TAXJAR_TAX_NOT_AN_OBJECT, 'tax'],
    ['a missing amount', TAXJAR_MISSING_AMOUNT, 'amount_to_collect'],
    ['an amount as a string', TAXJAR_AMOUNT_AS_STRING, 'amount_to_collect'],
    ['a negative amount', TAXJAR_NEGATIVE_AMOUNT, 'negative'],
    ['a null amount', TAXJAR_NULL_AMOUNT, 'amount_to_collect'],
    ['a negative rate', TAXJAR_NEGATIVE_RATE, 'negative'],
    ['a rate as a string', TAXJAR_RATE_AS_STRING, 'rate'],
    ['an array body', TAXJAR_ARRAY_BODY, 'array'],
  ])('reports %s, naming the field', (_label, body, expectedFragment) => {
    // ACT
    const result = parseTaxForOrderResponse(body);

    // ASSERT
    expect(result.ok, 'Expected a reported shape problem, not a parsed value.').toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(
      result.problems.length,
      'A shape failure must carry at least one plain-English problem; an empty list tells the reader ' +
        'nothing.'
    ).toBeGreaterThan(0);
    expect(
      result.problems.join(' '),
      `Expected a problem mentioning "${expectedFragment}"; got ${JSON.stringify(result.problems)}.`
    ).toContain(expectedFragment);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not json'],
    ['a number', 42],
    ['a boolean', true],
    ['an empty object', {}],
    ['an empty array', []],
  ])('AC-20: never throws for %s', (_label, body) => {
    // ACT / ASSERT — the parser contract is "never throws".
    expect(
      () => parseTaxForOrderResponse(body),
      'A parser that throws turns a degraded read into a 500. Every input must return a result.'
    ).not.toThrow();
    const result = parseTaxForOrderResponse(body);
    expect(result.ok, 'None of these inputs is a valid tax response.').toBe(false);
  });

  it('caps the problem list so one line is not buried under fifty', () => {
    // ARRANGE — two independently-wrong fields.
    const result = parseTaxForOrderResponse({ tax: { amount_to_collect: 'x', rate: 'y' } });

    // ASSERT
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(
      result.problems.length,
      `Expected at most ${TAX_SHAPE_LOG_LIMITS.MAX_PROBLEMS} problems, got ${result.problems.length}.`
    ).toBeLessThanOrEqual(TAX_SHAPE_LOG_LIMITS.MAX_PROBLEMS);
    expect(result.problems.length, 'Both wrong fields should be reported.').toBe(2);
  });
});

describe('logTaxShapeProblem — AC-22', () => {
  it('writes one console.error line carrying the endpoint, the problems and the payload', () => {
    // ARRANGE
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // ACT
    const line = logTaxShapeProblem('POST /v2/taxes', ['tax.rate is not a number.'], { tax: 'bad' });

    // ASSERT
    expect(spy, 'Exactly one log line — a flood is as unhelpful as silence.').toHaveBeenCalledTimes(1);
    expect(line, 'Expected the tag so the line is greppable in Vercel logs.').toContain('[TAX_SHAPE]');
    expect(line, 'Expected the endpoint.').toContain('POST /v2/taxes');
    expect(line, 'Expected the problem text.').toContain('tax.rate is not a number.');
    expect(line, 'Expected the real payload, which is the diagnosis.').toContain('"tax":"bad"');
    expect(spy.mock.calls[0]?.[0], 'The returned line must be the line actually logged.').toBe(line);
  });

  it('truncates an oversized payload and says how long it really was', () => {
    // ARRANGE
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // ACT
    const line = logTaxShapeProblem('POST /v2/taxes', ['too long'], TAXJAR_OVERSIZED_BODY);

    // ASSERT
    expect(
      line.length,
      'A 2000-character payload must not reach the log in full; the truncation is what keeps the ' +
        'line readable.'
    ).toBeLessThan(TAX_SHAPE_LOG_LIMITS.MAX_LOGGED_PAYLOAD_CHARS + 300);
    expect(line, 'Expected the truncation marker.').toContain('…');
    expect(line, 'Expected the real total length so the reader knows what was cut.').toContain('chars total');
  });

  it('never throws, even when the payload cannot be serialised', () => {
    // ARRANGE — a circular structure JSON.stringify refuses.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    // ACT / ASSERT
    expect(
      () => logTaxShapeProblem('POST /v2/taxes', ['circular'], circular),
      'A logging failure must never be able to turn a degraded read into a broken one.'
    ).not.toThrow();
    expect(logTaxShapeProblem('POST /v2/taxes', ['circular'], circular)).toContain(
      'could not be serialised'
    );
  });

  it('never throws when console.error itself is broken', () => {
    // ARRANGE
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console is gone');
    });

    // ACT / ASSERT
    expect(
      () => logTaxShapeProblem('POST /v2/taxes', ['x'], {}),
      'A broken console must not break a read.'
    ).not.toThrow();
  });

  it('logs a string payload as-is rather than re-encoding it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const line = logTaxShapeProblem('POST /v2/taxes', ['x'], '<html>502 Bad Gateway</html>');
    expect(
      line,
      'An HTML error page from a proxy is the common non-JSON case; it must be readable in the log.'
    ).toContain('<html>502 Bad Gateway</html>');
  });
});
