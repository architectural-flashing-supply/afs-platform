import { describe, expect, it } from 'vitest';
import {
  MAX_ITEMS_PER_VALIDATION,
  emptyValidationResponse,
  toValidationMessage,
} from './api-shape';
import type { ValidationFinding } from './types';

const DETERMINISTIC_FINDING: ValidationFinding = {
  code: 'OV_DIMENSION_BELOW_MIN',
  severity: 'error',
  field: 'width',
  message: 'The smallest width AFS fabricates for a Coping Cap is 6".',
  itemIndex: 2,
  audience: 'customer',
  source: 'deterministic',
};

describe('toValidationMessage', () => {
  it('keeps what a customer surface needs to render the message', () => {
    expect(
      toValidationMessage(DETERMINISTIC_FINDING),
      'Expected the field, severity, message and item index — enough to decorate the right input on the right row.'
    ).toEqual({
      field: 'width',
      severity: 'error',
      message: 'The smallest width AFS fabricates for a Coping Cap is 6".',
      itemIndex: 2,
      fromAi: false,
    });
  });

  it('drops the rule code, which is for an estimator and not for a browser', () => {
    expect(
      'code' in toValidationMessage(DETERMINISTIC_FINDING),
      'Expected no `code` on the wire. It is shown on the admin panel so an estimator can quote it; sending it to the browser would put it one view-source away from a customer-facing banner.'
    ).toBe(false);
  });

  it('drops the audience, which has already been spent by the time this is called', () => {
    expect(
      'audience' in toValidationMessage(DETERMINISTIC_FINDING),
      'Expected no `audience`. The route filters to customer scope BEFORE serialising, so a field naming the scope is either redundant or a bug waiting to be trusted by a client that forgets to filter.'
    ).toBe(false);
  });

  it('flags an advisory finding as coming from the model', () => {
    expect(
      toValidationMessage({ ...DETERMINISTIC_FINDING, code: 'OV_AI_ADVISORY', source: 'ai' }).fromAi,
      'Expected true. The warning banner prints "some of these are suggestions from an automated review" off this flag — a customer is entitled to know which of the two they are reading.'
    ).toBe(true);
  });

  it('flags a deterministic finding as not coming from the model', () => {
    expect(
      toValidationMessage(DETERMINISTIC_FINDING).fromAi,
      'Expected false, so an AFS rule is never labelled as an AI suggestion.'
    ).toBe(false);
  });
});

describe('emptyValidationResponse', () => {
  it('is valid, unblocked and says nothing', () => {
    expect(
      emptyValidationResponse(),
      'This is the answer when the validator itself fails. SPEC section 6 says to "fall through to valid if API slow", and a safeguard in front of a quote request must not take the quote request down with it — so every field has to read as "nothing to report", not as "nothing checked, assume the worst".'
    ).toEqual({
      valid: true,
      blocked: false,
      errors: [],
      warnings: [],
      infos: [],
      counts: { error: 0, warn: 0, info: 0 },
      hasAssumedLimits: false,
    });
  });

  it('returns a fresh object each time, so one caller cannot poison another', () => {
    const first = emptyValidationResponse();
    first.errors.push({ field: 'width', severity: 'error', message: 'x', itemIndex: 0, fromAi: false });
    expect(
      emptyValidationResponse().errors,
      'Expected []. A shared module-level constant would let one request mutate the fallback every later request receives.'
    ).toEqual([]);
  });
});

describe('MAX_ITEMS_PER_VALIDATION', () => {
  it('is a positive whole number well above any real request', () => {
    expect(
      Number.isInteger(MAX_ITEMS_PER_VALIDATION) && MAX_ITEMS_PER_VALIDATION >= 20,
      `Expected a whole number of at least 20; got ${MAX_ITEMS_PER_VALIDATION}. A Blueprint Takeoff extraction can produce a dozen or more line items from one drawing set, so a cap in single figures would refuse real work.`
    ).toBe(true);
  });
});
