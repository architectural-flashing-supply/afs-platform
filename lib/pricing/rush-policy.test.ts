import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  MAX_RUSH_LEAD_TIME_DAYS,
  MAX_RUSH_PERCENT_BP,
  RUSH_SURCHARGE_CUSTOMER_LABEL,
  evaluateRushLeadTime,
  evaluateRushSurcharge,
  formatPercentBp,
  formatRushPolicySentence,
  formatShortDate,
  isRushSurchargeType,
  parseLeadDays,
  parsePercentToBasisPoints,
  parseRushPolicyInput,
  rushPolicyInForce,
  type RushPolicy,
} from './rush-policy';
import { getRushPolicyBook } from './db';
import { addBusinessDays } from '@/lib/delivery/business-days';

/**
 * THE RUSH POLICY — the mechanism, tested exhaustively, with none of the
 * numbers asserted as business truth.
 *
 * Every figure below is a FIXTURE invented for the test. None of it is a claim
 * about what AFS charges for rush: the surcharge percentage (checklist #36) and
 * the rush timing (#32) are Steve's decisions and are not in the data, which is
 * why `rush_policies` ships empty. What is asserted here is that the mechanism
 * is right — including, especially, that an empty table changes no total.
 *
 * FIXTURES ARE EXPLICIT AND FROZEN. No `Date.now()`, no random data: TODAY is a
 * named Monday, and every policy is a named constant, so a failure names a case
 * rather than a lucky draw.
 */

/** 2026-10-05 is a Monday. Asserted in lib/delivery/business-days.test.ts. */
const TODAY = '2026-10-05';
/** 2026-10-09 is the Friday of that week; 10-12 the Monday after. */
const FRIDAY = '2026-10-09';
const NEXT_MONDAY = '2026-10-12';

function policy(over: Partial<RushPolicy>): RushPolicy {
  return {
    id: 'p-base',
    name: 'Fixture policy',
    surchargeType: 'none',
    surchargePercentBp: null,
    surchargeCents: null,
    minimumLeadTimeDays: null,
    effectiveFrom: '2026-01-01',
    note: null,
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/** 2.50% of the job. */
const PERCENT_250BP = policy({ id: 'p-pct', name: '2.5% rush', surchargeType: 'percent', surchargePercentBp: 250 });
/** $150.00 once per job. */
const FLAT_15000 = policy({ id: 'p-flat', name: 'Flat rush', surchargeType: 'flat', surchargeCents: 15000 });
/** $25.00 for every piece. */
const PER_PIECE_2500 = policy({
  id: 'p-piece',
  name: 'Per-piece rush',
  surchargeType: 'per_piece',
  surchargeCents: 2500,
});
/** Rush is free, but it still needs five working days. An explicit DECISION. */
const NONE_5DAY = policy({ id: 'p-none', name: 'Free rush', surchargeType: 'none', minimumLeadTimeDays: 5 });

/**
 * Shapes migration 039's CHECK refuses and the API route refuses — kept as
 * fixtures anyway, because the migration is NOT APPLIED yet, so the evaluator's
 * own refusal is the only one currently standing.
 */
const PERCENT_BLANK = policy({ id: 'p-pct-blank', name: 'Half-set percent', surchargeType: 'percent' });
const FLAT_BLANK = policy({ id: 'p-flat-blank', name: 'Half-set flat', surchargeType: 'flat' });

const ONE_LINE = { isRush: true, subtotalCents: 100_000, pieceCount: 8 };

// ===========================================================================
// THE SURCHARGE — the happy path
// ===========================================================================

describe('evaluateRushSurcharge works out each kind of charge', () => {
  it('a percentage is that share of the SUBTOTAL, rounded once at the end', () => {
    const result = evaluateRushSurcharge({ isRush: true, subtotalCents: 100_000, pieceCount: 8 }, PERCENT_250BP);
    expect(result.kind, 'a filled-in percent policy must produce an applied charge').toBe('applied');
    expect(
      result.surchargeCents,
      '2.50% of $1,000.00 is $25.00 = 2500 cents. Anything else means the basis-point divisor is wrong.'
    ).toBe(2500);
  });

  it('a flat fee ignores the subtotal and the piece count entirely', () => {
    const small = evaluateRushSurcharge({ isRush: true, subtotalCents: 1, pieceCount: 1 }, FLAT_15000);
    const large = evaluateRushSurcharge({ isRush: true, subtotalCents: 9_999_999, pieceCount: 400 }, FLAT_15000);
    expect(small.surchargeCents, 'a flat fee on a tiny job is still the flat fee').toBe(15000);
    expect(large.surchargeCents, 'a flat fee on a huge job is still the flat fee').toBe(15000);
  });

  it('a per-piece fee multiplies by the quoted pieces', () => {
    const result = evaluateRushSurcharge({ isRush: true, subtotalCents: 100_000, pieceCount: 8 }, PER_PIECE_2500);
    expect(result.surchargeCents, '$25.00 x 8 pieces is $200.00 = 20000 cents').toBe(20000);
  });

  it('a per-piece fee on nought pieces is nought, not the fee', () => {
    const result = evaluateRushSurcharge({ isRush: true, subtotalCents: 0, pieceCount: 0 }, PER_PIECE_2500);
    expect(result.kind, 'nought pieces is a priced answer, not an unpriced one').toBe('applied');
    expect(result.surchargeCents, 'a fee per piece with no pieces is 0').toBe(0);
  });

  it('type "none" is APPLIED with nought — a decision, not a blank', () => {
    const result = evaluateRushSurcharge(ONE_LINE, NONE_5DAY);
    expect(
      result.kind,
      'an explicit "no extra charge for rush" is a decision Steve made. Reporting it as unpriced would send somebody to go and fill in a figure he has already decided is nothing.'
    ).toBe('applied');
    expect(result.surchargeCents).toBe(0);
    expect(result.adminBasis, 'the admin still needs to see WHICH policy decided that').toContain('Free rush');
  });

  it('every applied charge carries the spec wording for the customer, and nothing else', () => {
    for (const p of [PERCENT_250BP, FLAT_15000, PER_PIECE_2500, NONE_5DAY]) {
      const result = evaluateRushSurcharge(ONE_LINE, p);
      expect(
        result.customerLabel,
        `${p.name}: the customer-facing line must be SPEC_RUSH_ORDER.md's own wording, so no rate or formula reaches a customer`
      ).toBe(RUSH_SURCHARGE_CUSTOMER_LABEL);
      expect(
        result.customerLabel,
        'the customer label must not leak the rate the surcharge was worked out from'
      ).not.toMatch(/%|\d/);
    }
  });
});

// ===========================================================================
// THE SURCHARGE — not rush, no policy, blank policy
// ===========================================================================

describe('a job that is not rush gets no surcharge and nothing to read', () => {
  it('returns not-rush even when a full policy is in force', () => {
    const result = evaluateRushSurcharge({ isRush: false, subtotalCents: 100_000, pieceCount: 8 }, PERCENT_250BP);
    expect(result.kind, 'a standard job is not unpriced — there is simply nothing to price').toBe('not-rush');
    expect(result.surchargeCents).toBe(0);
    expect(result.customerLabel, 'a standard quote must carry no rush line at all').toBeNull();
  });
});

describe('AN EMPTY POLICY TABLE IS UNPRICED, NEVER NOUGHT POUNDS CHOSEN', () => {
  it('reports no-policy, adds nothing, and says so in a sentence an admin can act on', () => {
    const result = evaluateRushSurcharge(ONE_LINE, null);
    expect(result.kind, 'no policy in force must be unpriced').toBe('unpriced');
    expect(result.kind === 'unpriced' ? result.reason : null).toBe('no-policy');
    expect(result.surchargeCents, 'nothing is ADDED, which is not the same as a price of nothing').toBe(0);
    expect(result.customerLabel, 'an unpriced rush must put no line on a customer quote').toBeNull();
    const message = result.kind === 'unpriced' ? result.message : '';
    expect(message, 'the sentence must name where to go and set one').toContain('Rush policy');
  });

  it('CHANGES NO TOTAL, for any subtotal and any piece count', () => {
    // THE INVARIANT THIS WHOLE ITEM RESTS ON. `rush_policies` ships empty, so
    // shipping it must not move a single figure on a single quote. If this ever
    // fails, every quote in the system has silently changed value.
    const subtotals = [0, 1, 20, 999, 100_000, 9_999_999];
    const pieceCounts = [0, 1, 3, 400];
    for (const subtotalCents of subtotals) {
      for (const pieceCount of pieceCounts) {
        const result = evaluateRushSurcharge({ isRush: true, subtotalCents, pieceCount }, null);
        expect(
          result.surchargeCents,
          `subtotal ${subtotalCents}, ${pieceCount} pieces: an empty rush policy table must add exactly 0 cents, or shipping migration 039 would change the value of every rush quote`
        ).toBe(0);
      }
    }
  });
});

describe('a HALF-SET policy is unpriced for a different reason, and says which', () => {
  it('a percent policy with no percentage refuses rather than charging nothing', () => {
    const result = evaluateRushSurcharge(ONE_LINE, PERCENT_BLANK);
    expect(result.kind).toBe('unpriced');
    expect(
      result.kind === 'unpriced' ? result.reason : null,
      'a policy that exists but is not filled in is a DIFFERENT thing to fix than no policy at all'
    ).toBe('blank-value');
    expect(result.surchargeCents, 'a blank is never treated as zero (CLAUDE.md rule #19)').toBe(0);
    expect(result.kind === 'unpriced' ? result.message : '').toContain('no percentage filled in');
  });

  it('a flat policy with no amount refuses the same way', () => {
    const result = evaluateRushSurcharge(ONE_LINE, FLAT_BLANK);
    expect(result.kind === 'unpriced' ? result.reason : null).toBe('blank-value');
    expect(result.kind === 'unpriced' ? result.message : '').toContain('no amount filled in');
  });

  it('a per-piece policy with no amount refuses the same way', () => {
    const half = policy({ id: 'p-piece-blank', name: 'Half-set per piece', surchargeType: 'per_piece' });
    expect(evaluateRushSurcharge(ONE_LINE, half).kind).toBe('unpriced');
  });

  it('a NEGATIVE value is refused rather than quietly turned into a discount', () => {
    const negPercent = policy({ surchargeType: 'percent', surchargePercentBp: -250 });
    const negFlat = policy({ surchargeType: 'flat', surchargeCents: -15000 });
    expect(evaluateRushSurcharge(ONE_LINE, negPercent).surchargeCents, 'a negative rate must not reduce a quote').toBe(0);
    expect(evaluateRushSurcharge(ONE_LINE, negPercent).kind).toBe('unpriced');
    expect(evaluateRushSurcharge(ONE_LINE, negFlat).kind).toBe('unpriced');
  });

  it('an unusable subtotal or piece count is refused, never rendered as NaN on a quote', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const bySubtotal = evaluateRushSurcharge({ isRush: true, subtotalCents: bad, pieceCount: 8 }, PERCENT_250BP);
      expect(
        bySubtotal.kind,
        `subtotal ${bad}: a surcharge computed from this would print as "$NaN" on a customer document`
      ).toBe('unpriced');
      expect(Number.isFinite(bySubtotal.surchargeCents)).toBe(true);

      const byPieces = evaluateRushSurcharge({ isRush: true, subtotalCents: 100_000, pieceCount: bad }, PER_PIECE_2500);
      expect(byPieces.kind, `piece count ${bad} must be refused`).toBe('unpriced');
    }
  });
});

// ===========================================================================
// THE SURCHARGE — boundaries
// ===========================================================================

describe('percentage boundaries and rounding', () => {
  it('nought basis points is nought cents, and it is APPLIED (an explicit 0%)', () => {
    const zero = policy({ surchargeType: 'percent', surchargePercentBp: 0 });
    const result = evaluateRushSurcharge(ONE_LINE, zero);
    expect(result.kind, '0% is a figure somebody typed, not a blank').toBe('applied');
    expect(result.surchargeCents).toBe(0);
  });

  it('100% doubles nothing — it adds the subtotal again, exactly', () => {
    const hundred = policy({ surchargeType: 'percent', surchargePercentBp: 10_000 });
    expect(
      evaluateRushSurcharge({ isRush: true, subtotalCents: 123_457, pieceCount: 1 }, hundred).surchargeCents,
      '10000 bp is 100%, so the surcharge equals the subtotal with no rounding drift'
    ).toBe(123_457);
  });

  it('the maximum the database will hold is still computed exactly', () => {
    const max = policy({ surchargeType: 'percent', surchargePercentBp: MAX_RUSH_PERCENT_BP });
    expect(
      evaluateRushSurcharge({ isRush: true, subtotalCents: 100, pieceCount: 1 }, max).surchargeCents,
      `${MAX_RUSH_PERCENT_BP} bp is 1000%, so $1.00 becomes $10.00`
    ).toBe(1000);
  });

  it('rounds to the nearest cent, half up, ONCE', () => {
    // 2.50% of 1 cent is 0.025 of a cent -> 0.
    expect(
      evaluateRushSurcharge({ isRush: true, subtotalCents: 1, pieceCount: 1 }, PERCENT_250BP).surchargeCents,
      '2.5% of 1 cent is 0.025 cents, which rounds to 0 — never to a whole cent'
    ).toBe(0);
    // 2.50% of 20 cents is exactly 0.5 of a cent -> 1 (half up).
    expect(
      evaluateRushSurcharge({ isRush: true, subtotalCents: 20, pieceCount: 1 }, PERCENT_250BP).surchargeCents,
      '2.5% of 20 cents is exactly half a cent; Math.round is half-UP, so 1'
    ).toBe(1);
    // 2.50% of 19 cents is 0.475 -> 0.
    expect(
      evaluateRushSurcharge({ isRush: true, subtotalCents: 19, pieceCount: 1 }, PERCENT_250BP).surchargeCents,
      '2.5% of 19 cents is 0.475 cents, which rounds down'
    ).toBe(0);
  });

  it('a nought subtotal yields a nought percentage charge', () => {
    expect(evaluateRushSurcharge({ isRush: true, subtotalCents: 0, pieceCount: 1 }, PERCENT_250BP).surchargeCents).toBe(0);
  });

  it('the admin basis names the rate AND what it was taken from', () => {
    const result = evaluateRushSurcharge({ isRush: true, subtotalCents: 100_000, pieceCount: 8 }, PERCENT_250BP);
    expect(result.adminBasis, 'an estimator has to be able to check the figure by eye').toBe('2.5% of $1,000.00');
  });
});

describe('formatPercentBp writes a rate the way a person would', () => {
  it('trims a trailing zero but keeps a real second decimal', () => {
    expect(formatPercentBp(250), '250 bp is 2.5%, not 2.50%').toBe('2.5%');
    expect(formatPercentBp(1000), '1000 bp is a whole 10%').toBe('10%');
    expect(formatPercentBp(0)).toBe('0%');
    expect(formatPercentBp(25), '25 bp is a quarter of one percent').toBe('0.25%');
    expect(formatPercentBp(105)).toBe('1.05%');
    expect(formatPercentBp(MAX_RUSH_PERCENT_BP)).toBe('1000%');
  });
});

// ===========================================================================
// WHICH POLICY IS IN FORCE
// ===========================================================================

describe('rushPolicyInForce resolves by date, exactly as the price book does', () => {
  const old = policy({ id: 'old', effectiveFrom: '2026-01-01', createdAt: '2026-01-01T09:00:00.000Z' });
  const current = policy({ id: 'current', effectiveFrom: '2026-09-01', createdAt: '2026-08-20T09:00:00.000Z' });
  const future = policy({ id: 'future', effectiveFrom: '2026-12-01', createdAt: '2026-09-02T09:00:00.000Z' });

  it('an empty table has nothing in force', () => {
    expect(rushPolicyInForce([], TODAY), 'an empty table resolves to null, which is what "unpriced" is built on').toBeNull();
  });

  it('picks the latest start date that is not in the future', () => {
    expect(rushPolicyInForce([old, current, future], TODAY)?.id).toBe('current');
  });

  it('A POLICY DATED IN THE FUTURE IS NOT IN FORCE TODAY', () => {
    expect(
      rushPolicyInForce([future], TODAY),
      'entering next month’s rush fee in advance must not change the quote going out this afternoon'
    ).toBeNull();
  });

  it('a policy starting exactly today IS in force today', () => {
    const startsToday = policy({ id: 'today', effectiveFrom: TODAY });
    expect(rushPolicyInForce([startsToday], TODAY)?.id).toBe('today');
  });

  it('a SAME-DAY CORRECTION wins on createdAt', () => {
    // `rush_policies` deliberately has no UNIQUE on effective_from, because the
    // table is append-only: correcting a figure entered wrongly this morning
    // has no other route. This branch is unreachable on price_book_versions,
    // where the UNIQUE refuses the second row — so it is only really exercised
    // here.
    const mistake = policy({ id: 'mistake', effectiveFrom: '2026-09-01', createdAt: '2026-09-01T09:00:00.000Z' });
    const fix = policy({ id: 'fix', effectiveFrom: '2026-09-01', createdAt: '2026-09-01T16:30:00.000Z' });
    expect(
      rushPolicyInForce([mistake, fix], TODAY)?.id,
      'the later-written row on the same start date is the correction and must win'
    ).toBe('fix');
    expect(rushPolicyInForce([fix, mistake], TODAY)?.id, 'and the answer must not depend on list order').toBe('fix');
  });

  it('resolving as of an older date returns the policy that was in force then', () => {
    expect(
      rushPolicyInForce([old, current, future], '2026-03-15')?.id,
      'this is what lets a past quote be reconciled against the policy it was built on'
    ).toBe('old');
  });
});

// ===========================================================================
// THE LEAD TIME
// ===========================================================================

describe('evaluateRushLeadTime checks the notice the customer gave', () => {
  const FIVE_DAY = policy({ id: 'p-5', name: '5-day rush', surchargeType: 'percent', surchargePercentBp: 250, minimumLeadTimeDays: 5 });

  it('says nothing about a job that is not rush', () => {
    expect(
      evaluateRushLeadTime({ isRush: false, requestedDelivery: NEXT_MONDAY, today: TODAY }, FIVE_DAY).status
    ).toBe('not-rush');
  });

  it('reports no-policy when nothing is in force', () => {
    expect(evaluateRushLeadTime({ isRush: true, requestedDelivery: NEXT_MONDAY, today: TODAY }, null).status).toBe(
      'no-policy'
    );
  });

  it('reports not-set when a policy exists but names no minimum', () => {
    const noMinimum = policy({ id: 'p-nomin', surchargeType: 'flat', surchargeCents: 15000 });
    const result = evaluateRushLeadTime({ isRush: true, requestedDelivery: NEXT_MONDAY, today: TODAY }, noMinimum);
    expect(
      result.status,
      'a blank minimum is not nought days of notice — it means nobody has said'
    ).toBe('not-set');
  });

  it('reports no-date when the customer gave none', () => {
    const result = evaluateRushLeadTime({ isRush: true, requestedDelivery: null, today: TODAY }, FIVE_DAY);
    expect(result.status).toBe('no-date');
    expect(result.status === 'no-date' ? result.minimumDays : null, 'the minimum is still worth telling an admin').toBe(5);
  });

  it('A MALFORMED DATE IS no-date, AND THROWS NOTHING', () => {
    for (const bad of ['', 'soon', '2026-13-45', 'ASAP', '05/10/2026']) {
      expect(
        () => evaluateRushLeadTime({ isRush: true, requestedDelivery: bad, today: TODAY }, FIVE_DAY),
        `"${bad}" must not throw — a throw here takes out the whole Job screen over a typo`
      ).not.toThrow();
      expect(
        evaluateRushLeadTime({ isRush: true, requestedDelivery: bad, today: TODAY }, FIVE_DAY).status,
        `"${bad}" is not a usable date, so there is no usable one`
      ).toBe('no-date');
    }
  });

  it('meets the minimum when the notice is exactly enough', () => {
    const exactly = addBusinessDays(TODAY, 5);
    const result = evaluateRushLeadTime({ isRush: true, requestedDelivery: exactly, today: TODAY }, FIVE_DAY);
    expect(result.status, 'exactly the minimum MEETS it — the comparison is >=, not >').toBe('meets');
    expect(result.status === 'meets' ? result.businessDays : null).toBe(5);
  });

  it('is too soon one working day inside the minimum, and names the earliest date', () => {
    const tooSoon = addBusinessDays(TODAY, 4);
    const result = evaluateRushLeadTime({ isRush: true, requestedDelivery: tooSoon, today: TODAY }, FIVE_DAY);
    expect(result.status).toBe('too-soon');
    if (result.status !== 'too-soon') throw new Error('unreachable: status asserted above');
    expect(result.businessDays, 'four working days is one short of five').toBe(4);
    expect(
      result.earliest,
      'the earliest date must be the policy minimum counted in working days from today, so an estimator can quote it straight back'
    ).toBe(addBusinessDays(TODAY, 5));
    expect(result.message).toContain('the earliest is');
  });

  it('THE WEEKEND IS NOT NOTICE — a Friday request against a 3-day minimum is too soon', () => {
    const THREE_DAY = policy({ id: 'p-3', surchargeType: 'none', minimumLeadTimeDays: 3 });
    // From Monday, the following Friday is 4 working days, so that meets 3.
    expect(
      evaluateRushLeadTime({ isRush: true, requestedDelivery: FRIDAY, today: TODAY }, THREE_DAY).status
    ).toBe('meets');
    // But from that Friday, the Monday after is ONE working day, not three
    // calendar days' worth. This is the case a naive calendar subtraction gets
    // wrong every single week.
    const result = evaluateRushLeadTime({ isRush: true, requestedDelivery: NEXT_MONDAY, today: FRIDAY }, THREE_DAY);
    expect(
      result.status,
      'Fri -> Mon is 1 working day. Counting the weekend would accept a rush the shop cannot make.'
    ).toBe('too-soon');
    expect(result.status === 'too-soon' ? result.businessDays : null).toBe(1);
  });

  it('a date already past reads as too soon, with negative notice, in plain English', () => {
    const result = evaluateRushLeadTime({ isRush: true, requestedDelivery: '2026-10-01', today: TODAY }, FIVE_DAY);
    expect(result.status).toBe('too-soon');
    if (result.status !== 'too-soon') throw new Error('unreachable: status asserted above');
    expect(result.businessDays, 'Thu 1 Oct is 2 working days before Mon 5 Oct').toBe(-2);
    expect(result.message, 'an admin must never read "-2 working days"').toContain('in the past');
  });

  it('a nought-day minimum is met by any date from today onwards', () => {
    const sameDay = policy({ id: 'p-0', surchargeType: 'none', minimumLeadTimeDays: 0 });
    expect(evaluateRushLeadTime({ isRush: true, requestedDelivery: TODAY, today: TODAY }, sameDay).status).toBe('meets');
  });

  it('accepts a timestamp in the date field by reading only its date part', () => {
    // `requested_delivery` is a `date` column, but the same value travels
    // through JSON on other paths, and a 25-character ISO string must not be
    // read as "no date".
    const result = evaluateRushLeadTime(
      { isRush: true, requestedDelivery: '2026-10-12T00:00:00.000Z', today: TODAY },
      FIVE_DAY
    );
    expect(result.status, 'a full ISO instant still carries a usable date').toBe('meets');
  });
});

describe('formatShortDate renders a date-only value without a zone shifting it', () => {
  it('prints the day that is in the string', () => {
    expect(formatShortDate('2026-10-12')).toBe('Oct 12');
    expect(formatShortDate('2026-01-01'), 'the 1st of January must not render as 31 Dec').toBe('Jan 1');
  });
  it('hands back anything that is not a date rather than inventing one', () => {
    expect(formatShortDate('soon')).toBe('soon');
  });
});

// ===========================================================================
// SAYING IT IN WORDS
// ===========================================================================

describe('formatRushPolicySentence tells the three states apart', () => {
  it('a missing table wins over everything and names the migration', () => {
    const sentence = formatRushPolicySentence(PERCENT_250BP, 'The rush policy table is not in the database yet.');
    expect(
      sentence,
      'when the table cannot be read, describing a policy as though it were in force would be a lie'
    ).toBe('The rush policy table is not in the database yet.');
  });

  it('an empty table says nobody has decided AND that nothing is being added', () => {
    const sentence = formatRushPolicySentence(null, null);
    expect(sentence).toContain('No rush policy has been set');
    expect(sentence, 'the consequence matters more than the state').toContain('no rush surcharge is added');
  });

  it('a policy in force reads as a charge and a notice period', () => {
    expect(formatRushPolicySentence(PERCENT_250BP, null)).toBe(
      '2.5% rush: 2.5% of the job. No minimum notice has been set.'
    );
    expect(formatRushPolicySentence(NONE_5DAY, null)).toBe(
      'Free rush: no extra charge. A rush job needs 5 working days of notice.'
    );
    expect(formatRushPolicySentence(FLAT_15000, null)).toBe(
      'Flat rush: $150.00 per job. No minimum notice has been set.'
    );
    expect(formatRushPolicySentence(PER_PIECE_2500, null)).toBe(
      'Per-piece rush: $25.00 per piece. No minimum notice has been set.'
    );
  });

  it('a half-set policy says so rather than printing a figure it does not have', () => {
    expect(formatRushPolicySentence(PERCENT_BLANK, null)).toContain('has not been filled in yet');
  });
});

// ===========================================================================
// VALIDATING WHAT AN ADMIN TYPED
// ===========================================================================

describe('parseRushPolicyInput refuses a half-made decision', () => {
  const base = { name: 'Rush', surchargeType: 'flat', surchargeCents: 15000 };

  it('accepts a complete flat policy and defaults the start date to today', () => {
    const parsed = parseRushPolicyInput({ ...base }, TODAY);
    expect(parsed.ok, 'a complete policy must be accepted').toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.draft.effectiveFrom, 'an omitted start date means "from today"').toBe(TODAY);
    expect(parsed.draft.surchargePercentBp, 'a flat policy must not carry a percentage as well').toBeNull();
    expect(parsed.draft.minimumLeadTimeDays, 'an omitted minimum stays null, never 0').toBeNull();
  });

  it('refuses a missing or blank name', () => {
    for (const name of [undefined, '', '   ', 42]) {
      const parsed = parseRushPolicyInput({ ...base, name }, TODAY);
      expect(parsed.ok, `name ${JSON.stringify(name)} must be refused`).toBe(false);
      expect(parsed.ok === false ? parsed.error : '').toContain('name');
    }
  });

  it('refuses a name long enough to wreck every list it appears in', () => {
    const parsed = parseRushPolicyInput({ ...base, name: 'x'.repeat(121) }, TODAY);
    expect(parsed.ok).toBe(false);
  });

  it('refuses an unknown or missing surcharge type', () => {
    for (const surchargeType of [undefined, 'inferred', 'auto', 'PERCENT', 5]) {
      const parsed = parseRushPolicyInput({ ...base, surchargeType }, TODAY);
      expect(
        parsed.ok,
        `type ${JSON.stringify(surchargeType)} must be refused — there is deliberately no "inferred" and no "auto"`
      ).toBe(false);
    }
  });

  it('REFUSES A PERCENT TYPE WITH NO PERCENTAGE rather than storing a blank', () => {
    const parsed = parseRushPolicyInput({ name: 'Rush', surchargeType: 'percent' }, TODAY);
    expect(
      parsed.ok,
      'storing this would create a policy that looks set on the Settings screen and is unpriced forever on every quote'
    ).toBe(false);
    expect(parsed.ok === false ? parsed.error : '').toContain('never treated as zero');
  });

  it('refuses a flat or per-piece type with no amount', () => {
    for (const surchargeType of ['flat', 'per_piece']) {
      const parsed = parseRushPolicyInput({ name: 'Rush', surchargeType }, TODAY);
      expect(parsed.ok, `${surchargeType} with no amount must be refused`).toBe(false);
    }
  });

  it('accepts type "none" with no value at all', () => {
    const parsed = parseRushPolicyInput({ name: 'Free rush', surchargeType: 'none', minimumLeadTimeDays: 5 }, TODAY);
    expect(parsed.ok, '"no extra charge" is a complete decision with no figure in it').toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.draft.surchargeCents).toBeNull();
    expect(parsed.draft.surchargePercentBp).toBeNull();
    expect(parsed.draft.minimumLeadTimeDays).toBe(5);
  });

  it('DROPS the value the chosen type does not use, rather than failing on it', () => {
    // Switching the dropdown from percent to flat must not fail because the
    // percent box still had a number in it.
    const parsed = parseRushPolicyInput(
      { name: 'Rush', surchargeType: 'flat', surchargeCents: 15000, surchargePercentBp: 250 },
      TODAY
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.draft.surchargePercentBp, 'a stored row carrying both values would have two answers in it').toBeNull();
    expect(parsed.draft.surchargeCents).toBe(15000);
  });

  it('refuses a negative, fractional or non-numeric value', () => {
    expect(parseRushPolicyInput({ name: 'R', surchargeType: 'percent', surchargePercentBp: -1 }, TODAY).ok).toBe(false);
    expect(parseRushPolicyInput({ name: 'R', surchargeType: 'percent', surchargePercentBp: 2.5 }, TODAY).ok).toBe(false);
    expect(parseRushPolicyInput({ name: 'R', surchargeType: 'percent', surchargePercentBp: '250' }, TODAY).ok).toBe(false);
    expect(parseRushPolicyInput({ name: 'R', surchargeType: 'flat', surchargeCents: -1 }, TODAY).ok).toBe(false);
  });

  it('refuses a percentage above the database bound', () => {
    const parsed = parseRushPolicyInput(
      { name: 'R', surchargeType: 'percent', surchargePercentBp: MAX_RUSH_PERCENT_BP + 1 },
      TODAY
    );
    expect(
      parsed.ok,
      'the route and migration 039 read the same bound, so a value the route accepts can never be refused by the database'
    ).toBe(false);
  });

  it('accepts exactly the database bound', () => {
    expect(
      parseRushPolicyInput({ name: 'R', surchargeType: 'percent', surchargePercentBp: MAX_RUSH_PERCENT_BP }, TODAY).ok
    ).toBe(true);
  });

  it('refuses a minimum notice above a year, and accepts exactly a year', () => {
    expect(
      parseRushPolicyInput({ ...base, minimumLeadTimeDays: MAX_RUSH_LEAD_TIME_DAYS + 1 }, TODAY).ok
    ).toBe(false);
    expect(parseRushPolicyInput({ ...base, minimumLeadTimeDays: MAX_RUSH_LEAD_TIME_DAYS }, TODAY).ok).toBe(true);
  });

  it('accepts a nought-day minimum, which is a real answer', () => {
    const parsed = parseRushPolicyInput({ ...base, minimumLeadTimeDays: 0 }, TODAY);
    expect(parsed.ok, 'same-day rush is a legitimate policy').toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.draft.minimumLeadTimeDays, '0 must survive as 0 and not collapse to null').toBe(0);
  });

  it('refuses a start date that is not a date', () => {
    expect(parseRushPolicyInput({ ...base, effectiveFrom: 'next month' }, TODAY).ok).toBe(false);
  });

  it('accepts a start date in the future, which is the whole point of the date', () => {
    const parsed = parseRushPolicyInput({ ...base, effectiveFrom: '2026-12-01' }, TODAY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.draft.effectiveFrom).toBe('2026-12-01');
  });

  it('trims a note and turns an empty one into null', () => {
    const withNote = parseRushPolicyInput({ ...base, note: '  agreed with Steve  ' }, TODAY);
    expect(withNote.ok && withNote.draft.note).toBe('agreed with Steve');
    const blankNote = parseRushPolicyInput({ ...base, note: '   ' }, TODAY);
    expect(blankNote.ok && blankNote.draft.note).toBeNull();
  });
});

describe('parsePercentToBasisPoints turns what a person typed into an integer', () => {
  it('reads a rate with one or two decimal places exactly', () => {
    expect(parsePercentToBasisPoints('2.5'), 'two and a half percent is 250 basis points').toBe(250);
    expect(parsePercentToBasisPoints('10')).toBe(1000);
    expect(parsePercentToBasisPoints('0.25')).toBe(25);
    expect(parsePercentToBasisPoints('0')).toBe(0);
    expect(parsePercentToBasisPoints('1.05')).toBe(105);
  });

  it('tolerates whitespace and a typed percent sign', () => {
    expect(parsePercentToBasisPoints('  2.5 % ')).toBe(250);
    expect(parsePercentToBasisPoints('2.5%')).toBe(250);
  });

  it('AN EMPTY BOX IS null, NOT NOUGHT', () => {
    expect(
      parsePercentToBasisPoints(''),
      'an empty box has to stay distinguishable from a typed 0, or a blank becomes a price of nothing'
    ).toBeNull();
    expect(parsePercentToBasisPoints('   ')).toBeNull();
  });

  it('refuses junk, a negative rate and more precision than a basis point', () => {
    for (const bad of ['abc', '2.5.5', '-1', '1e3', '2.555', '.5', '2,5']) {
      expect(parsePercentToBasisPoints(bad), `"${bad}" is not a rate`).toBe('invalid');
    }
  });

  it('refuses a rate above the database bound rather than letting the insert fail', () => {
    expect(parsePercentToBasisPoints('1001'), '1001% is above the 1000% bound').toBe('invalid');
    expect(parsePercentToBasisPoints('1000'), 'exactly the bound is accepted').toBe(MAX_RUSH_PERCENT_BP);
  });
});

describe('parseLeadDays turns what a person typed into whole working days', () => {
  it('reads a whole number of days', () => {
    expect(parseLeadDays('5')).toBe(5);
    expect(parseLeadDays(' 10 ')).toBe(10);
  });

  it('A NOUGHT IS A REAL ANSWER and an empty box is not', () => {
    expect(parseLeadDays('0'), 'same-day rush is a legitimate policy').toBe(0);
    expect(
      parseLeadDays(''),
      'an empty box means "I would rather judge each one", which is not the same as "no notice needed"'
    ).toBeNull();
  });

  it('refuses a fraction, a negative and junk', () => {
    for (const bad of ['2.5', '-1', 'five', '1 day']) {
      expect(parseLeadDays(bad), `"${bad}" is not a whole number of days`).toBe('invalid');
    }
  });

  it('refuses more than the database bound, and accepts exactly it', () => {
    expect(parseLeadDays(String(MAX_RUSH_LEAD_TIME_DAYS + 1))).toBe('invalid');
    expect(parseLeadDays(String(MAX_RUSH_LEAD_TIME_DAYS))).toBe(MAX_RUSH_LEAD_TIME_DAYS);
  });
});

describe('isRushSurchargeType is the one gate on the four values', () => {
  it('accepts the four and nothing else', () => {
    for (const good of ['percent', 'flat', 'per_piece', 'none']) {
      expect(isRushSurchargeType(good), `${good} is one of migration 039's four`).toBe(true);
    }
    for (const bad of ['inferred', 'auto', 'due_date', '', null, undefined, 0, {}]) {
      expect(isRushSurchargeType(bad), `${JSON.stringify(bad)} must be refused`).toBe(false);
    }
  });
});

// ===========================================================================
// READING IT OUT OF THE DATABASE — never throwing
// ===========================================================================

/**
 * A hand-written stand-in for the one PostgREST call `getRushPolicyBook` makes.
 * No network, no Supabase: the builder chain is four methods deep and all of
 * them return `this`, so this is the whole surface.
 */
function fakeSupabase(outcome: { data?: unknown[]; error?: { code: string; message: string } }) {
  const builder = {
    select: () => builder,
    order: () => builder,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: outcome.data ?? null, error: outcome.error ?? null }).then(resolve),
  };
  return { from: () => builder } as never;
}

describe('getRushPolicyBook never throws, and says why it could not read', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('REPORTS A MISSING TABLE BY NAMING THE MIGRATION, and returns no policies', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const code of ['42P01', 'PGRST205']) {
      const book = await getRushPolicyBook(fakeSupabase({ error: { code, message: 'relation does not exist' } }));
      expect(book.policies, `${code}: a table that is not there has no policies in it`).toEqual([]);
      expect(
        book.unavailable,
        `${code}: the sentence must name the migration file, because applying it is the fix`
      ).toContain('039_rush_policy.sql');
      expect(book.unavailable, 'and must state the consequence for quoting').toContain('No rush surcharge');
    }
  });

  it('reports any other failure with the real message rather than swallowing it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const book = await getRushPolicyBook(
      fakeSupabase({ error: { code: '42501', message: 'permission denied for table rush_policies' } })
    );
    expect(book.unavailable).toContain('permission denied for table rush_policies');
    expect(book.unavailable, 'a fault is not a missing migration and must not claim to be').not.toContain('039_');
  });

  it('logs the failure exactly once, so it is reported and not silent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await getRushPolicyBook(fakeSupabase({ error: { code: '42P01', message: 'nope' } }));
    expect(warn, 'a swallowed failure here would silently mean "no rush surcharge, forever"').toHaveBeenCalledTimes(1);
  });

  it('AN EMPTY TABLE IS A SUCCESSFUL READ, not an unavailable one', async () => {
    const book = await getRushPolicyBook(fakeSupabase({ data: [] }));
    expect(book.policies).toEqual([]);
    expect(
      book.unavailable,
      'an empty table is a fact — nobody has decided yet — and the admin screen says something different about it than about a missing table'
    ).toBeNull();
  });

  it('maps a real row into camelCase without changing a figure', async () => {
    const book = await getRushPolicyBook(
      fakeSupabase({
        data: [
          {
            id: 'row-1',
            name: '2.5% rush',
            surcharge_type: 'percent',
            surcharge_percent_bp: 250,
            surcharge_cents: null,
            minimum_lead_time_days: 5,
            effective_from: '2026-09-01',
            note: null,
            created_by: null,
            created_at: '2026-08-20T09:00:00.000Z',
          },
        ],
      })
    );
    expect(book.unavailable).toBeNull();
    expect(book.policies).toHaveLength(1);
    expect(book.policies[0].surchargeType).toBe('percent');
    expect(book.policies[0].surchargePercentBp, 'the figure must survive the mapping untouched').toBe(250);
    expect(book.policies[0].minimumLeadTimeDays).toBe(5);
    expect(book.policies[0].effectiveFrom, 'a date column must arrive as YYYY-MM-DD').toBe('2026-09-01');
  });

  it('a surcharge type the database should not be able to hold reads as "none", never as a charge', async () => {
    const book = await getRushPolicyBook(
      fakeSupabase({
        data: [
          {
            id: 'row-bad',
            name: 'Impossible',
            surcharge_type: 'inferred',
            surcharge_percent_bp: 9999,
            surcharge_cents: null,
            minimum_lead_time_days: null,
            effective_from: '2026-09-01',
            note: null,
            created_by: null,
            created_at: '2026-08-20T09:00:00.000Z',
          },
        ],
      })
    );
    expect(
      book.policies[0].surchargeType,
      'an impossible row must degrade towards charging nothing, never towards charging 99.99%'
    ).toBe('none');
    expect(evaluateRushSurcharge(ONE_LINE, book.policies[0]).surchargeCents).toBe(0);
  });
});
