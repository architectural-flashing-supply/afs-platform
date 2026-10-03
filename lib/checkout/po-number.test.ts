import { describe, it, expect } from 'vitest';
import {
  PO_NUMBER_MAX_LENGTH,
  PO_NUMBER_PLACEHOLDER,
  PO_REQUIRED_ERROR,
  PO_REQUIRED_HINT,
  PO_TOO_LONG_ERROR,
  isPoNumberSatisfied,
  normalizePoNumber,
  validatePoNumber,
} from './po-number';

/**
 * Fixtures are explicit and literal — no generated or random values, so a
 * failure names the exact input that broke.
 */
const FIXTURES = {
  typical: 'PO-2026-04521',
  padded: '   PO-2026-04521   ',
  whitespaceOnly: '   ',
  tabsAndNewlines: '\t\n  \n',
  empty: '',
  singleChar: 'X',
  /** Exactly PO_NUMBER_MAX_LENGTH (50) characters. */
  exactlyMax: 'A'.repeat(PO_NUMBER_MAX_LENGTH),
  /** One over the limit (51). */
  oneOverMax: 'A'.repeat(PO_NUMBER_MAX_LENGTH + 1),
  /** 50 real characters wrapped in whitespace — must pass, trimming first. */
  exactlyMaxPadded: `  ${'A'.repeat(PO_NUMBER_MAX_LENGTH)}  `,
  /** Non-ASCII: PO references from international GCs really do contain these. */
  unicode: 'PO-Ñ-2026-④521',
  /** The 500-char Stripe metadata limit this module exists to stay under. */
  stripeMetadataBreaker: 'A'.repeat(501),
} as const;

describe('normalizePoNumber', () => {
  it('returns the trimmed string for a typical PO number', () => {
    // ARRANGE / ACT
    const result = normalizePoNumber(FIXTURES.typical);
    // ASSERT
    expect(
      result,
      `A typical PO number must survive normalisation unchanged. Expected "${FIXTURES.typical}", got "${String(result)}".`
    ).toBe('PO-2026-04521');
  });

  it('strips surrounding whitespace so a padded entry stores the same value as a clean one', () => {
    const result = normalizePoNumber(FIXTURES.padded);
    expect(
      result,
      `Padded input must normalise to the same stored value as unpadded input, or the same PO appears twice in reporting. Expected "PO-2026-04521", got "${String(result)}".`
    ).toBe('PO-2026-04521');
  });

  it('returns null for the empty string rather than storing an empty PO', () => {
    const result = normalizePoNumber(FIXTURES.empty);
    expect(
      result,
      `An empty field means "no PO" and must store NULL, not ''. Got ${JSON.stringify(result)}.`
    ).toBe(null);
  });

  it('returns null for a whitespace-only entry', () => {
    const result = normalizePoNumber(FIXTURES.whitespaceOnly);
    expect(
      result,
      `Three spaces is not a purchase order number; it must store NULL so '', '   ' and missing are one state. Got ${JSON.stringify(result)}.`
    ).toBe(null);
  });

  it('returns null for tabs and newlines only', () => {
    const result = normalizePoNumber(FIXTURES.tabsAndNewlines);
    expect(
      result,
      `Tabs/newlines-only input must normalise to NULL like any other blank. Got ${JSON.stringify(result)}.`
    ).toBe(null);
  });

  it('returns null for null', () => {
    const result = normalizePoNumber(null);
    expect(result, `null input must yield NULL, not throw. Got ${JSON.stringify(result)}.`).toBe(null);
  });

  it('returns null for undefined', () => {
    const result = normalizePoNumber(undefined);
    expect(result, `undefined input must yield NULL, not throw. Got ${JSON.stringify(result)}.`).toBe(null);
  });

  it('returns null for a number, because an API body field can be any JSON type', () => {
    const result = normalizePoNumber(42);
    expect(
      result,
      `A non-string JSON body field must be rejected as "no PO" rather than coerced. Got ${JSON.stringify(result)}.`
    ).toBe(null);
  });

  it('returns null for an object, because an API body field can be any JSON type', () => {
    const result = normalizePoNumber({ poNumber: 'PO-1' });
    expect(
      result,
      `An object body field must be rejected as "no PO" rather than stringified to "[object Object]". Got ${JSON.stringify(result)}.`
    ).toBe(null);
  });

  it('preserves non-ASCII characters instead of stripping them', () => {
    const result = normalizePoNumber(FIXTURES.unicode);
    expect(
      result,
      `A customer's PO reference may contain non-ASCII characters and must not be altered. Expected "${FIXTURES.unicode}", got "${String(result)}".`
    ).toBe(FIXTURES.unicode);
  });

  it('never truncates an over-long value — refusal is the caller’s job, not silent shortening', () => {
    const result = normalizePoNumber(FIXTURES.oneOverMax);
    expect(
      result?.length,
      `normalizePoNumber must not truncate: storing the first ${PO_NUMBER_MAX_LENGTH} characters of a real accounting reference would put a wrong PO on an invoice. Expected length ${FIXTURES.oneOverMax.length}, got ${String(result?.length)}.`
    ).toBe(FIXTURES.oneOverMax.length);
  });
});

describe('validatePoNumber — not required (companies.require_po = false)', () => {
  it('accepts an empty PO number, which is the pre-existing behaviour for every customer', () => {
    const result = validatePoNumber(FIXTURES.empty, false);
    expect(
      result,
      'A company without a PO requirement must be able to check out with no PO, exactly as before this feature existed.'
    ).toEqual({ ok: true, value: null });
  });

  it('accepts a whitespace-only PO number and stores it as null', () => {
    const result = validatePoNumber(FIXTURES.whitespaceOnly, false);
    expect(
      result,
      'Whitespace-only input must be accepted (no requirement) and normalised to NULL (not stored as spaces).'
    ).toEqual({ ok: true, value: null });
  });

  it('accepts a missing PO number', () => {
    const result = validatePoNumber(undefined, false);
    expect(result, 'An absent poNumber field must be accepted when no requirement applies.').toEqual({
      ok: true,
      value: null,
    });
  });

  it('accepts and normalises a padded PO number', () => {
    const result = validatePoNumber(FIXTURES.padded, false);
    expect(result, 'A padded PO must be accepted and stored trimmed.').toEqual({
      ok: true,
      value: 'PO-2026-04521',
    });
  });

  it('rejects an over-long PO number even with no requirement, because the limit is about storage not policy', () => {
    const result = validatePoNumber(FIXTURES.oneOverMax, false);
    expect(
      result,
      `${PO_NUMBER_MAX_LENGTH + 1} characters must be refused in both states: the card path puts this value into Stripe metadata, which is capped at 500 characters, and the Postgres CHECK in migration 039 enforces the same ${PO_NUMBER_MAX_LENGTH}.`
    ).toEqual({ ok: false, error: PO_TOO_LONG_ERROR });
  });
});

describe('validatePoNumber — required (companies.require_po = true)', () => {
  it('rejects an empty PO number with the exact sentence SPEC §3 specifies', () => {
    const result = validatePoNumber(FIXTURES.empty, true);
    expect(result.ok, 'A required PO that is empty must be refused.').toBe(false);
    expect(
      result.ok === false ? result.error : null,
      'The blocking message is quoted verbatim in SPEC_PURCHASE_ORDER_INTEGRATION.md §3 and must not be reworded.'
    ).toBe('Purchase Order Number is required for your account');
  });

  it('rejects a whitespace-only PO number — spaces do not satisfy a requirement', () => {
    const result = validatePoNumber(FIXTURES.whitespaceOnly, true);
    expect(
      result,
      'Typing spaces must not satisfy a company PO requirement; the order would carry no usable reference.'
    ).toEqual({ ok: false, error: PO_REQUIRED_ERROR });
  });

  it('rejects a missing PO number', () => {
    const result = validatePoNumber(undefined, true);
    expect(result, 'An absent poNumber field must be refused when the company requires one.').toEqual({
      ok: false,
      error: PO_REQUIRED_ERROR,
    });
  });

  it('rejects a non-string PO number, so a crafted body cannot bypass the requirement', () => {
    const result = validatePoNumber({ toString: () => 'PO-1' }, true);
    expect(
      result,
      'A non-string body field must be refused rather than coerced — otherwise a crafted JSON body satisfies the requirement with no real PO.'
    ).toEqual({ ok: false, error: PO_REQUIRED_ERROR });
  });

  it('accepts a typical PO number', () => {
    const result = validatePoNumber(FIXTURES.typical, true);
    expect(result, 'A real PO number must satisfy the requirement.').toEqual({
      ok: true,
      value: 'PO-2026-04521',
    });
  });

  it('accepts and trims a padded PO number', () => {
    const result = validatePoNumber(FIXTURES.padded, true);
    expect(result, 'A padded PO must satisfy the requirement and be stored trimmed.').toEqual({
      ok: true,
      value: 'PO-2026-04521',
    });
  });

  it('accepts a single character, since AFS has supplied no PO format to validate against', () => {
    const result = validatePoNumber(FIXTURES.singleChar, true);
    expect(
      result,
      'No PO format rule exists in the spec or in supplied data, so any non-blank value satisfies the requirement — inventing a format would reject real customer references.'
    ).toEqual({ ok: true, value: 'X' });
  });
});

describe('validatePoNumber — length boundary', () => {
  it(`accepts exactly ${PO_NUMBER_MAX_LENGTH} characters`, () => {
    const result = validatePoNumber(FIXTURES.exactlyMax, true);
    expect(
      result,
      `${PO_NUMBER_MAX_LENGTH} is the documented maximum and must be inclusive. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, value: FIXTURES.exactlyMax });
  });

  it(`accepts ${PO_NUMBER_MAX_LENGTH} characters wrapped in whitespace, measuring length after trimming`, () => {
    const result = validatePoNumber(FIXTURES.exactlyMaxPadded, true);
    expect(
      result,
      `Length must be measured on the trimmed value — otherwise a stray trailing space rejects a valid ${PO_NUMBER_MAX_LENGTH}-character reference. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, value: FIXTURES.exactlyMax });
  });

  it(`rejects ${PO_NUMBER_MAX_LENGTH + 1} characters`, () => {
    const result = validatePoNumber(FIXTURES.oneOverMax, true);
    expect(
      result,
      `One character over the maximum must be refused, not truncated. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: false, error: PO_TOO_LONG_ERROR });
  });

  it('rejects a value long enough to break Stripe PaymentIntent metadata', () => {
    const result = validatePoNumber(FIXTURES.stripeMetadataBreaker, true);
    expect(
      result,
      'Stripe caps a metadata value at 500 characters; a 501-character PO previously made paymentIntents.create throw and surfaced only a generic error. It must be refused here, in plain English, before any Stripe call.'
    ).toEqual({ ok: false, error: PO_TOO_LONG_ERROR });
  });

  it('reports the real limit inside the too-long message', () => {
    expect(
      PO_TOO_LONG_ERROR,
      'The message must name the actual limit so the constant and the copy can never contradict each other.'
    ).toBe('Purchase Order Number must be 50 characters or fewer.');
  });
});

describe('isPoNumberSatisfied — the client submit gate', () => {
  it('is true for an empty field when no requirement applies, leaving canSubmit unchanged', () => {
    expect(
      isPoNumberSatisfied('', false),
      'With require_po false this term must be constantly true, so checkout gating is arithmetically identical to before this feature existed.'
    ).toBe(true);
  });

  it('is true for a whitespace-only field when no requirement applies', () => {
    expect(isPoNumberSatisfied('   ', false), 'No requirement means nothing about the PO can block submit.').toBe(
      true
    );
  });

  it(`is true for an over-long field when no requirement applies, because length is the server’s decision`, () => {
    expect(
      isPoNumberSatisfied('A'.repeat(PO_NUMBER_MAX_LENGTH + 1), false),
      'The rendered input carries maxLength, so the client gate deliberately ignores length; the server still refuses it.'
    ).toBe(true);
  });

  it('is false for an empty field when the company requires a PO', () => {
    expect(
      isPoNumberSatisfied('', true),
      'A required-PO customer must not be able to press Place Order with the field empty.'
    ).toBe(false);
  });

  it('is false for a whitespace-only field when the company requires a PO', () => {
    expect(
      isPoNumberSatisfied('   ', true),
      'Spaces must not unlock the Place Order button for a required-PO customer.'
    ).toBe(false);
  });

  it('is true for a real PO number when the company requires one', () => {
    expect(isPoNumberSatisfied('PO-2026-04521', true), 'A real PO must unlock submit.').toBe(true);
  });
});

describe('spec-fixed copy', () => {
  it('matches SPEC §2’s required hint character-for-character', () => {
    expect(
      PO_REQUIRED_HINT,
      'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 quotes this sentence; a reword must be a deliberate spec change, not a drift.'
    ).toBe('Your account requires a PO number for all orders');
  });

  it('matches SPEC §3’s blocking error character-for-character', () => {
    expect(
      PO_REQUIRED_ERROR,
      'SPEC_PURCHASE_ORDER_INTEGRATION.md §3 quotes this sentence; a reword must be a deliberate spec change, not a drift.'
    ).toBe('Purchase Order Number is required for your account');
  });

  it('matches SPEC §2’s placeholder character-for-character', () => {
    expect(PO_NUMBER_PLACEHOLDER, 'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 quotes this placeholder.').toBe(
      'e.g. PO-2026-04521'
    );
  });

  it('matches SPEC §2’s stated maximum of 50 characters', () => {
    expect(
      PO_NUMBER_MAX_LENGTH,
      'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 says "Max: 50 characters"; migration 039 enforces the same number in Postgres.'
    ).toBe(50);
  });
});
