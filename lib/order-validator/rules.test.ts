import { describe, expect, it } from 'vitest';
import { ALL_RULES, type RuleContext } from './rules';
import { DEFAULT_ORDER_VALIDATOR_LIMITS, resolveLimits, type OrderValidatorLimits } from './limits';
import { validateOrder } from './validate';
import {
  ALL_CONSTRAINTS,
  COPING_CAP_CONSTRAINTS,
  COUNTER_FLASHING_CONSTRAINTS,
  EXPANSION_JOINT_CONSTRAINTS,
  FASCIA_CONSTRAINTS,
  SCUPPER_CONSTRAINTS,
  SELF_CROSSING_POINTS,
  VALID_COPING_CAP_ITEM,
  VALID_DRAWN_ITEM,
  Z_PROFILE_POINTS,
  staircasePoints,
} from './fixtures';
import type {
  OrderValidatorItem,
  ProfileConstraints,
  ValidationCode,
  ValidationFinding,
} from './types';

/**
 * Runs one item through the whole rule set with explicit constraints, and
 * returns the findings. Goes through `validateOrder` rather than poking
 * individual rules, so each assertion also proves the engine wires the rule up —
 * a rule that works but was never added to ALL_RULES is a rule that does
 * nothing.
 */
function findingsFor(
  item: OrderValidatorItem,
  constraints: readonly ProfileConstraints[] = ALL_CONSTRAINTS,
  limits?: Partial<OrderValidatorLimits>
): ValidationFinding[] {
  return validateOrder({ items: [item], constraints, limits }).findings;
}

function codesFor(
  item: OrderValidatorItem,
  constraints: readonly ProfileConstraints[] = ALL_CONSTRAINTS,
  limits?: Partial<OrderValidatorLimits>
): ValidationCode[] {
  return findingsFor(item, constraints, limits).map((f) => f.code);
}

function only(findings: ValidationFinding[], code: ValidationCode): ValidationFinding[] {
  return findings.filter((f) => f.code === code);
}

/** Asserts one finding with the given code exists, and returns it. */
function expectOne(findings: ValidationFinding[], code: ValidationCode): ValidationFinding {
  const matching = only(findings, code);
  expect(
    matching.length,
    `Expected exactly one ${code} finding; got ${matching.length}. All codes present: ${JSON.stringify(findings.map((f) => f.code))}.`
  ).toBe(1);
  return matching[0];
}

// ---------------------------------------------------------------------------
// The rule set as a whole
// ---------------------------------------------------------------------------

describe('the rule set', () => {
  it('has a rule behind every code it declares, and no duplicate codes', () => {
    const codes = ALL_RULES.map((rule) => rule.code);
    expect(
      new Set(codes).size,
      `Two rules share a code: ${JSON.stringify(codes)}. The code is how a finding is referred to, so a duplicate makes two different problems indistinguishable.`
    ).toBe(codes.length);
  });

  it('declares no rule for OV_AI_ADVISORY, which is not one of AFS rules', () => {
    expect(
      ALL_RULES.some((rule) => rule.code === 'OV_AI_ADVISORY'),
      'Expected no deterministic rule to claim OV_AI_ADVISORY. That code exists so a model-authored finding is never dressed up as an AFS rule.'
    ).toBe(false);
  });

  it('returns findings only for the item it was given, with that item index', () => {
    const context: RuleContext = {
      item: { profileType: '' },
      itemIndex: 7,
      constraints: null,
      limits: DEFAULT_ORDER_VALIDATOR_LIMITS,
    };
    for (const rule of ALL_RULES) {
      for (const found of rule.run(context)) {
        expect(
          found.itemIndex,
          `Rule ${rule.code} returned itemIndex ${found.itemIndex} for the item at index 7. A UI points at a row using this number, so a wrong one decorates the wrong line.`
        ).toBe(7);
        expect(
          found.source,
          `Rule ${rule.code} returned source "${found.source}". Every deterministic rule must say so, because the blocked flag is computed from deterministic errors only.`
        ).toBe('deterministic');
      }
    }
  });

  it('finds nothing wrong with a valid coping cap', () => {
    expect(
      codesFor(VALID_COPING_CAP_ITEM),
      'Expected [] for a 12 x 6 coping cap with 3 in legs in 20 ga at 10 ft. Every dimension is inside its real seeded range, the legs fit inside the cap, and the gauge is heavier than the span limit. A validator that flags this refuses ordinary work.'
    ).toEqual([]);
  });

  it('finds nothing wrong with a valid drawn FlashDraft profile', () => {
    expect(
      codesFor(VALID_DRAWN_ITEM, []),
      'Expected [] for a clean 6 in + 4 in L. With no constraints supplied the range rules do not run, and the geometry, sheet-fit and bend-count rules all pass — except that an unknown profile is reported to the admin, which this case has by passing no constraints.'
    ).toEqual(['OV_PROFILE_CONSTRAINTS_UNKNOWN']);
  });
});

// ---------------------------------------------------------------------------
// Structural rules
// ---------------------------------------------------------------------------

describe('OV_PROFILE_TYPE_MISSING', () => {
  it('does not fire when a profile type is given (happy)', () => {
    expect(codesFor(VALID_COPING_CAP_ITEM)).not.toContain('OV_PROFILE_TYPE_MISSING');
  });

  it('fires as a customer error when the profile type is absent (trigger)', () => {
    const found = expectOne(findingsFor({ ...VALID_COPING_CAP_ITEM, profileType: null }), 'OV_PROFILE_TYPE_MISSING');
    expect(found.severity, 'A line item nobody can identify cannot be fabricated, so this blocks.').toBe('error');
    expect(found.field, 'Expected the finding to point at the profileType input.').toBe('profileType');
    expect(found.audience, 'The customer is the only one who can fix this, so they must see it.').toBe('customer');
  });

  it('fires when the profile type is whitespace only (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, profileType: '   ' }),
      'Expected a missing-profile error for "   ": a whitespace label is not a profile type, and trimming is what stops it passing as one.'
    ).toContain('OV_PROFILE_TYPE_MISSING');
  });
});

describe('OV_QUANTITY_NOT_POSITIVE', () => {
  it('does not fire for a quantity of 1 (happy and boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, quantity: 1 }),
      'Expected no quantity error at exactly 1 — the smallest real order.'
    ).not.toContain('OV_QUANTITY_NOT_POSITIVE');
  });

  it('does not fire for a fractional quantity, because a quantity may be linear feet', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, quantity: 2.5 }),
      'Expected no error for 2.5. The Quote Builder sends `unit: "LF"` alongside the quantity, so a fraction is a legitimate 2.5 linear feet, not half a piece.'
    ).not.toContain('OV_QUANTITY_NOT_POSITIVE');
  });

  it('fires as a customer error at zero (trigger and boundary)', () => {
    const found = expectOne(findingsFor({ ...VALID_COPING_CAP_ITEM, quantity: 0 }), 'OV_QUANTITY_NOT_POSITIVE');
    expect(found.severity, 'Nothing to make means nothing to quote.').toBe('error');
    expect(found.field).toBe('quantity');
  });

  it('fires for a negative, a NaN and an absent quantity', () => {
    for (const quantity of [-1, Number.NaN, null, undefined]) {
      expect(
        codesFor({ ...VALID_COPING_CAP_ITEM, quantity }),
        `Expected a quantity error for ${String(quantity)}.`
      ).toContain('OV_QUANTITY_NOT_POSITIVE');
    }
  });
});

describe('OV_LENGTH_NOT_POSITIVE', () => {
  it('does not fire for a real length (happy)', () => {
    expect(codesFor(VALID_COPING_CAP_ITEM)).not.toContain('OV_LENGTH_NOT_POSITIVE');
  });

  it('fires as a customer error at zero (trigger and boundary)', () => {
    const found = expectOne(findingsFor({ ...VALID_COPING_CAP_ITEM, lengthFt: 0 }), 'OV_LENGTH_NOT_POSITIVE');
    expect(found.severity).toBe('error');
    expect(found.field).toBe('lengthFt');
  });

  it('fires for an absent length', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, lengthFt: null }),
      'Expected a length error: a piece with no length has no girth, no weight and no price.'
    ).toContain('OV_LENGTH_NOT_POSITIVE');
  });
});

describe('OV_DIMENSION_NOT_POSITIVE', () => {
  it('does not fire for a blank optional dimension (happy — absent is not zero)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, legA: null, legB: null }),
      'Expected no error for blank legs. The Quote Builder tells the customer to "leave leg measurements blank if this profile is flat"; treating a blank as 0 would report every optional dimension as impossible.'
    ).not.toContain('OV_DIMENSION_NOT_POSITIVE');
  });

  it('fires once per offending field, naming each one (trigger)', () => {
    const found = only(findingsFor({ ...VALID_COPING_CAP_ITEM, width: 0, height: -2 }), 'OV_DIMENSION_NOT_POSITIVE');
    expect(
      found.map((f) => f.field).sort(),
      'Expected one finding for width and one for height, so each input gets its own message under it rather than one banner naming both.'
    ).toEqual(['height', 'width']);
    for (const finding of found) {
      expect(finding.severity).toBe('error');
      expect(finding.audience).toBe('customer');
    }
  });

  it('fires at exactly zero and not just below it (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, legA: 0 }),
      'Expected an error at exactly 0: zero is not a measurement, and the comparison is > 0 rather than >= 0.'
    ).toContain('OV_DIMENSION_NOT_POSITIVE');
  });

  it('fires for a value that is supplied but not a number at all', () => {
    const item = { ...VALID_COPING_CAP_ITEM, width: '12' } as unknown as OrderValidatorItem;
    expect(
      codesFor(item),
      'Expected an error for the string "12". A hand-rolled client sending a string must be reported, not silently skipped — skipping would mean no range check ran and nobody said so.'
    ).toContain('OV_DIMENSION_NOT_POSITIVE');
  });

  it('does not also report a range violation for the same bad value', () => {
    const codes = codesFor({ ...VALID_COPING_CAP_ITEM, width: 0 });
    expect(
      codes.filter((c) => c === 'OV_DIMENSION_BELOW_MIN'),
      'Expected no below-minimum finding for a width of 0. Telling the customer "the smallest width is 6 inches" on top of "that is not a measurement" is two messages for one mistake.'
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Range rules, against the real seeded ranges
// ---------------------------------------------------------------------------

describe('OV_DIMENSION_BELOW_MIN', () => {
  it('does not fire at exactly the minimum (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, width: 6 }),
      'Expected no error at exactly 6 in, the seeded Coping Cap min_width. The bound is inclusive — AFS does fabricate at its own stated minimum.'
    ).not.toContain('OV_DIMENSION_BELOW_MIN');
  });

  it('fires below the minimum, naming the real seeded limit (trigger)', () => {
    const found = expectOne(findingsFor({ ...VALID_COPING_CAP_ITEM, width: 4 }), 'OV_DIMENSION_BELOW_MIN');
    expect(found.severity).toBe('error');
    expect(found.field).toBe('width');
    expect(
      found.message,
      `Expected the message to state the real limit (6") and what was entered (4"); got "${found.message}". A range error the customer cannot act on is just a refusal.`
    ).toContain('6"');
    expect(found.message).toContain('4"');
    expect(found.message, 'Expected the catalog profile name in the message.').toContain('Coping Cap');
  });

  it('checks each of the four bounds independently', () => {
    const cases: { field: string; item: OrderValidatorItem }[] = [
      { field: 'width', item: { ...VALID_COPING_CAP_ITEM, width: 5 } },
      { field: 'height', item: { ...VALID_COPING_CAP_ITEM, height: 3 } },
      { field: 'legA', item: { ...VALID_COPING_CAP_ITEM, legA: 1.5 } },
      { field: 'legB', item: { ...VALID_COPING_CAP_ITEM, legB: 1.5 } },
    ];
    for (const { field, item } of cases) {
      const found = only(findingsFor(item), 'OV_DIMENSION_BELOW_MIN');
      expect(
        found.map((f) => f.field),
        `Expected exactly one below-minimum finding, for ${field}. SPEC section 2's own snippet dereferences maxWidth whenever minWidth is set, which does not hold against real seeded rows where the bounds are independently nullable.`
      ).toEqual([field]);
    }
  });

  it('imposes no constraint where the seeded bound is NULL (boundary)', () => {
    const narrowLegFascia: OrderValidatorItem = {
      profileType: 'Fascia',
      material: 'Copper',
      gauge: '20 oz',
      width: 12,
      height: 6,
      legA: 0.75,
      legB: 0.75,
      lengthFt: 10,
      quantity: 1,
    };
    expect(
      codesFor(narrowLegFascia, [FASCIA_CONSTRAINTS]),
      'Expected no range error: the seeded Fascia row has NULL leg bounds, and NULL means NO CONSTRAINT — never zero, and never the neighbouring profile\'s range.'
    ).not.toContain('OV_DIMENSION_BELOW_MIN');
  });

  it('imposes no Leg B constraint on a Counter Flashing, whose max_leg_b is NULL', () => {
    const counterFlashing: OrderValidatorItem = {
      profileType: 'Counter Flashing',
      material: 'Galvanized Steel',
      gauge: '24 ga',
      width: 6,
      height: 4,
      legA: 2,
      legB: 40,
      lengthFt: 10,
      quantity: 1,
    };
    const codes = codesFor(counterFlashing, [COUNTER_FLASHING_CONSTRAINTS]);
    expect(
      codes.filter((c) => c === 'OV_DIMENSION_ABOVE_MAX'),
      'Expected no above-maximum finding for a 40 in Leg B: the seeded Counter Flashing row genuinely has NULL leg_b bounds. An engine that fell back to Leg A\'s range would refuse this.'
    ).toEqual([]);
  });
});

describe('OV_DIMENSION_ABOVE_MAX', () => {
  it('does not fire at exactly the maximum (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, width: 36 }),
      'Expected no error at exactly 36 in, the seeded Coping Cap max_width.'
    ).not.toContain('OV_DIMENSION_ABOVE_MAX');
  });

  it('fires above the maximum, naming the real seeded limit (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_COPING_CAP_ITEM, width: 40, legA: 2, legB: 2 }),
      'OV_DIMENSION_ABOVE_MAX'
    );
    expect(found.severity).toBe('error');
    expect(found.message, `Expected the message to state 36"; got "${found.message}".`).toContain('36"');
  });
});

describe('OV_PROFILE_CONSTRAINTS_UNKNOWN', () => {
  it('does not fire when the profile has a row (happy)', () => {
    expect(codesFor(VALID_COPING_CAP_ITEM)).not.toContain('OV_PROFILE_CONSTRAINTS_UNKNOWN');
  });

  it('fires as an ADMIN info for a profile with no product_profiles row (trigger)', () => {
    const stepFlashing: OrderValidatorItem = {
      profileType: 'Step Flashing',
      material: 'Galvanized Steel',
      gauge: '26 ga',
      width: 6,
      lengthFt: 1,
      quantity: 50,
    };
    const found = expectOne(findingsFor(stepFlashing), 'OV_PROFILE_CONSTRAINTS_UNKNOWN');
    expect(
      found.audience,
      'Expected admin. "AFS holds no dimension data for this profile" is AFS\'s business, not a defect in the customer\'s drawing, and telling them would be alarming and unactionable.'
    ).toBe('admin');
    expect(found.severity, 'Expected info: nothing is wrong, the check simply did not happen.').toBe('info');
    expect(
      found.message,
      `Expected the message to name the profile and say the range check did not run; got "${found.message}". A silent pass would be indistinguishable from a pass that checked something.`
    ).toContain('Step Flashing');
  });

  it('fires for a row that EXISTS but has every dimension bound NULL (trigger)', () => {
    // NOT HYPOTHETICAL, and the reason this case exists. Measured against the
    // live database on 2026-10-03: all twelve product_profiles rows have NULL
    // for all eight bounds — migration 002's ranges are not in that database.
    // Before this, a Coping Cap at 4 in wide (the migration says 6 in minimum)
    // produced no range finding AND no note saying why, because a row existed.
    const emptyCopingCap: ProfileConstraints = {
      ...COPING_CAP_CONSTRAINTS,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
      minLegA: null,
      maxLegA: null,
      minLegB: null,
      maxLegB: null,
    };
    const found = expectOne(
      findingsFor({ ...VALID_COPING_CAP_ITEM, width: 4 }, [emptyCopingCap]),
      'OV_PROFILE_CONSTRAINTS_UNKNOWN'
    );
    expect(
      found.message,
      `Expected the message to say the profile is in the catalog but has no ranges filled in; got "${found.message}". "No row" and "an empty row" need different wording because the fix is different — one is a missing profile, the other is missing data on a profile that is there.`
    ).toContain('no width, height or leg ranges filled in');
    expect(found.audience, 'Expected admin: this is AFS data to go and fill in, not a defect in the drawing.').toBe(
      'admin'
    );
  });

  it('does not fire for a row that has only SOME bounds, because those were checked', () => {
    // The seeded Fascia row has NULL legs but real width and height ranges, so a
    // range check genuinely did happen on that line. Reporting it as unchecked
    // would make the note meaningless by firing on most of the catalog.
    expect(
      codesFor(
        { profileType: 'Fascia', material: 'Copper', gauge: '20 oz', width: 12, height: 6, lengthFt: 10, quantity: 1 },
        [FASCIA_CONSTRAINTS]
      ),
      'Expected nothing: width and height were both checked against real bounds.'
    ).not.toContain('OV_PROFILE_CONSTRAINTS_UNKNOWN');
  });

  it('does not fire when there is no profile type either, because that is already reported', () => {
    const codes = codesFor({ ...VALID_COPING_CAP_ITEM, profileType: '' }, []);
    expect(
      codes.filter((c) => c === 'OV_PROFILE_CONSTRAINTS_UNKNOWN'),
      'Expected no unknown-profile note when the profile type is blank: OV_PROFILE_TYPE_MISSING already says so, and two findings for one cause is noise on the estimator\'s screen.'
    ).toEqual([]);
  });
});

describe('OV_PROFILE_MIN_WIDTH (the spec-stated Step Flashing minimum)', () => {
  const stepFlashing: OrderValidatorItem = {
    profileType: 'Step Flashing',
    material: 'Galvanized Steel',
    gauge: '26 ga',
    lengthFt: 1,
    quantity: 50,
  };

  it('does not fire at exactly 4 inches (boundary)', () => {
    expect(
      codesFor({ ...stepFlashing, width: 4 }),
      'Expected no warning at exactly 4 in — SPEC section 3 says "at least 4 inches", so 4 satisfies it.'
    ).not.toContain('OV_PROFILE_MIN_WIDTH');
  });

  it('fires as a customer WARNING below 4 inches (trigger)', () => {
    const found = expectOne(findingsFor({ ...stepFlashing, width: 3 }), 'OV_PROFILE_MIN_WIDTH');
    expect(
      found.severity,
      'Expected warn, not error. SPEC section 3 says a step flashing "should" be 4 in for standard shingle coverage — a narrower one is fabricable, it just will not cover the course.'
    ).toBe('warn');
    expect(found.field).toBe('width');
    expect(found.audience).toBe('customer');
  });

  it('does not fire for a different profile at the same width', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, width: 7, height: 5, legA: 2, legB: 2 }),
      'Expected no step-flashing warning on a coping cap: the minimum is stated for one profile and must not leak onto others.'
    ).not.toContain('OV_PROFILE_MIN_WIDTH');
  });
});

describe('OV_FLANGE_TOO_SHORT', () => {
  it('does not fire at exactly the minimum flange (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, legA: 0.5 }, [], { minFlangeLengthIn: 0.5 }),
      'Expected no error at exactly the minimum: the comparison is >=, so AFS forms at its own stated minimum.'
    ).not.toContain('OV_FLANGE_TOO_SHORT');
  });

  it('fires as a customer error below the minimum flange (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_COPING_CAP_ITEM, legA: 0.25 }, [], { minFlangeLengthIn: 0.5 }),
      'OV_FLANGE_TOO_SHORT'
    );
    expect(found.severity).toBe('error');
    expect(found.field).toBe('legA');
    expect(
      found.message,
      `Expected the message to say what the minimum is; got "${found.message}".`
    ).toContain('1/2"');
  });

  it('respects an overridden minimum, so the threshold is config and not code', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, legA: 1.5 }, [], { minFlangeLengthIn: 2 }),
      'Expected an error at 1.5 in once the minimum is raised to 2 in. The threshold is an ASSUMPTION pending Steve, so it has to be changeable without touching a rule.'
    ).toContain('OV_FLANGE_TOO_SHORT');
  });

  it('checks Leg A and Leg B but not width or height', () => {
    const found = only(
      findingsFor({ ...VALID_COPING_CAP_ITEM, legA: 0.25, legB: 0.25 }, [], { minFlangeLengthIn: 0.5 }),
      'OV_FLANGE_TOO_SHORT'
    );
    expect(
      found.map((f) => f.field).sort(),
      'Expected findings for legA and legB only. Width and height are the overall size of the piece, not folded flanges, and a 1/4 in overall width is already reported by the range rule.'
    ).toEqual(['legA', 'legB']);
  });
});

// ---------------------------------------------------------------------------
// Length and sheet-fit rules
// ---------------------------------------------------------------------------

describe('OV_LENGTH_ABOVE_PROFILE_MAX', () => {
  it('does not fire at exactly the profile maximum (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, lengthFt: 12 }),
      'Expected no error at exactly 12 ft, the seeded Coping Cap max_length_ft.'
    ).not.toContain('OV_LENGTH_ABOVE_PROFILE_MAX');
  });

  it('fires as a customer error above the profile maximum (trigger)', () => {
    const found = expectOne(findingsFor({ ...VALID_COPING_CAP_ITEM, lengthFt: 14 }), 'OV_LENGTH_ABOVE_PROFILE_MAX');
    expect(found.severity).toBe('error');
    expect(found.field).toBe('lengthFt');
    expect(found.message, `Expected the message to state 12 ft; got "${found.message}".`).toContain('12 ft');
  });

  it('imposes no length limit where max_length_ft is NULL', () => {
    const scupper: OrderValidatorItem = {
      profileType: 'Scupper',
      material: 'Copper',
      gauge: '20 oz',
      width: 12,
      height: 12,
      legA: 4,
      legB: 4,
      lengthFt: 30,
      quantity: 1,
    };
    expect(
      codesFor(scupper, [SCUPPER_CONSTRAINTS]),
      'Expected no length error: the seeded Scupper row has NULL standard_length_ft AND NULL max_length_ft — a scupper is a box, not a run, so it has no stock-length concept at all.'
    ).not.toContain('OV_LENGTH_ABOVE_PROFILE_MAX');
  });
});

describe('OV_PIECE_NEEDS_SPLICING', () => {
  it('does not fire at exactly one sheet length (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, lengthFt: 10 }),
      'Expected nothing at exactly 10 ft: that is one strip off one sheet, which needs no splice.'
    ).not.toContain('OV_PIECE_NEEDS_SPLICING');
  });

  it('fires as an ADMIN info between the sheet length and the profile maximum (trigger)', () => {
    const expansionJoint: OrderValidatorItem = {
      profileType: 'Expansion Joint',
      material: 'Galvanized Steel',
      gauge: '20 ga',
      width: 10,
      height: 4,
      lengthFt: 15,
      quantity: 1,
    };
    const found = expectOne(findingsFor(expansionJoint, [EXPANSION_JOINT_CONSTRAINTS]), 'OV_PIECE_NEEDS_SPLICING');
    expect(
      found.audience,
      'Expected admin. Which pieces need splicing is production detail, and production detail here is cost-adjacent — the RFQ model keeps that away from customers (CLAUDE.md BUSINESS MODEL).'
    ).toBe('admin');
    expect(found.severity).toBe('info');
    expect(
      found.message,
      `Expected the message to say 15 ft and name the 10 ft sheet; got "${found.message}".`
    ).toContain('15 ft');
  });

  it('does not also fire when the length is already refused as over the profile maximum', () => {
    const codes = codesFor({ ...VALID_COPING_CAP_ITEM, lengthFt: 20 });
    expect(
      codes.filter((c) => c === 'OV_PIECE_NEEDS_SPLICING'),
      'Expected no splicing note on a 20 ft coping cap: OV_LENGTH_ABOVE_PROFILE_MAX has already refused it at 12 ft, and noting that the refused piece would need splicing is noise.'
    ).toEqual([]);
  });

  it('still fires when the profile has no maximum length at all', () => {
    const scupper: OrderValidatorItem = {
      profileType: 'Scupper',
      material: 'Copper',
      gauge: '20 oz',
      width: 12,
      height: 12,
      legA: 4,
      legB: 4,
      lengthFt: 18,
      quantity: 1,
    };
    expect(
      codesFor(scupper, [SCUPPER_CONSTRAINTS]),
      'Expected a splicing note: a NULL max_length_ft means no stated limit, not "no sheet constraint" — the shop still only has 10 ft sheets.'
    ).toContain('OV_PIECE_NEEDS_SPLICING');
  });
});

describe('OV_COPING_LEGS_EXCEED_WIDTH (SPEC section 3)', () => {
  it('does not fire when the legs fit inside the cap (happy)', () => {
    expect(
      codesFor(VALID_COPING_CAP_ITEM),
      'Expected nothing: 3 + 3 = 6 in of legs inside a 12 in cap leaves 6 in of cap between them.'
    ).not.toContain('OV_COPING_LEGS_EXCEED_WIDTH');
  });

  it('fires as a customer error when the legs sum to more than the width (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_COPING_CAP_ITEM, width: 6, legA: 4, legB: 4 }),
      'OV_COPING_LEGS_EXCEED_WIDTH'
    );
    expect(found.severity, 'There is no cap left between the legs, so it cannot be fabricated as specified.').toBe(
      'error'
    );
    expect(found.field, 'Expected the finding to point at Leg A, the first of the two the customer can reduce.').toBe(
      'legA'
    );
    expect(found.message, `Expected both numbers in the message; got "${found.message}".`).toContain('8"');
    expect(found.message).toContain('6"');
  });

  it('fires when the legs sum to exactly the width (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, width: 8, legA: 4, legB: 4 }),
      'Expected an error at exactly equal. SPEC section 3 says the legs "must be less than Width", so equal is already impossible — there is zero cap between them.'
    ).toContain('OV_COPING_LEGS_EXCEED_WIDTH');
  });

  it('does not fire when one leg is blank, because nothing has been specified to be wrong', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, width: 6, legA: 4, legB: null }),
      'Expected nothing: a coping cap submitted without Leg B has not stated a two-leg geometry, and assuming the blank leg equals the other would invent a dimension.'
    ).not.toContain('OV_COPING_LEGS_EXCEED_WIDTH');
  });

  it('does not fire on a different profile with the same numbers', () => {
    expect(
      codesFor(
        { profileType: 'Scupper', material: 'Copper', gauge: '20 oz', width: 6, height: 6, legA: 4, legB: 4, lengthFt: 2, quantity: 1 },
        [SCUPPER_CONSTRAINTS]
      ),
      'Expected nothing: the legs of a scupper box are not drip legs folded down out of the cap, so SPEC section 3\'s coping rule does not apply to it.'
    ).not.toContain('OV_COPING_LEGS_EXCEED_WIDTH');
  });
});

describe('OV_GAUGE_SPAN_LIGHT (SPEC section 3)', () => {
  const wideGalvanized: OrderValidatorItem = {
    profileType: 'Coping Cap',
    material: 'Galvanized Steel',
    gauge: '26 ga',
    width: 30,
    height: 6,
    legA: 3,
    legB: 3,
    lengthFt: 10,
    quantity: 1,
  };

  it('does not fire for a heavier gauge over the same span (happy)', () => {
    expect(
      codesFor({ ...wideGalvanized, gauge: '20 ga' }),
      'Expected nothing for 20 ga: gauge numbers run backwards, so 20 is HEAVIER than the 22 ga threshold.'
    ).not.toContain('OV_GAUGE_SPAN_LIGHT');
  });

  it('fires as a customer warning for a light gauge over a wide span (trigger)', () => {
    const found = expectOne(findingsFor(wideGalvanized), 'OV_GAUGE_SPAN_LIGHT');
    expect(
      found.severity,
      'Expected warn, not error: SPEC section 3 calls this "unusual but possible", and the customer acknowledges rather than being refused.'
    ).toBe('warn');
    expect(found.field).toBe('gauge');
    expect(found.audience).toBe('customer');
    expect(found.message, `Expected the chosen gauge named in the message; got "${found.message}".`).toContain('26 ga');
  });

  it('does not fire at exactly 22 ga over a wide span (boundary)', () => {
    expect(
      codesFor({ ...wideGalvanized, gauge: '22 ga' }),
      'Expected nothing at exactly 22 ga. SPEC section 3 says "gauge is > 22ga", so 22 itself is acceptable.'
    ).not.toContain('OV_GAUGE_SPAN_LIGHT');
  });

  it('fires at exactly the width threshold (boundary)', () => {
    expect(
      codesFor({ ...wideGalvanized, width: 24 }),
      'Expected a warning at exactly 24 in with 26 ga. The limit is configured as "at or above 24 in", which is the conservative reading of the spec\'s "Width > 24"" for a warning nobody is blocked by.'
    ).toContain('OV_GAUGE_SPAN_LIGHT');
  });

  it('does not fire for a narrow span in the same light gauge', () => {
    expect(
      codesFor({ ...wideGalvanized, width: 12 }),
      'Expected nothing at 12 in: 26 ga is ordinary for a narrow coping cap, and the limit is about SPAN, not gauge alone.'
    ).not.toContain('OV_GAUGE_SPAN_LIGHT');
  });

  it('does not fire for a different material at the same gauge and span', () => {
    expect(
      codesFor({ ...wideGalvanized, material: 'Stainless Steel' }),
      'Expected nothing for stainless. SPEC section 3 states the limit for galvanized only; extrapolating it to stainless, copper or zinc would be inventing shop capability nobody has stated.'
    ).not.toContain('OV_GAUGE_SPAN_LIGHT');
  });

  it('does not fire for a gauge expressed by weight or thickness rather than a gauge number', () => {
    for (const gauge of ['16 oz', '0.032"', '0.7mm']) {
      expect(
        codesFor({ ...wideGalvanized, material: 'Copper', gauge }),
        `Expected nothing for "${gauge}": it carries no gauge number, and SPEC section 3's limit is stated in gauge numbers. Guessing an equivalent would be inventing a limit.`
      ).not.toContain('OV_GAUGE_SPAN_LIGHT');
    }
  });

  it('tolerates a legacy material spelling', () => {
    expect(
      codesFor({ ...wideGalvanized, material: 'galvanized steel' }),
      'Expected the warning for a lower-case material label. Line items store material as free text written by three different surfaces, so the category lookup goes through lib/data/catalog.ts\'s normalisation.'
    ).toContain('OV_GAUGE_SPAN_LIGHT');
  });
});

describe('OV_MATERIAL_GAUGE_INCOMPATIBLE', () => {
  it('cannot fire with the shipped defaults, because the data is blocked (happy)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, gauge: '26 ga' }),
      'Expected nothing: DEFAULT_ORDER_VALIDATOR_LIMITS.incompatibleCombinations is empty until checklist #38 arrives (SPEC section 4: "no incompatibility rules enforced").'
    ).not.toContain('OV_MATERIAL_GAUGE_INCOMPATIBLE');
  });

  it('fires as a customer error for a configured incompatible pair (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_COPING_CAP_ITEM, material: 'Galvanized Steel', gauge: '26 ga' }, ALL_CONSTRAINTS, {
        incompatibleCombinations: [
          {
            materialCategory: 'galvanized',
            gaugeNumber: 26,
            reason: 'AFS does not fabricate a coping cap in 26 ga galvanized.',
          },
        ],
      }),
      'OV_MATERIAL_GAUGE_INCOMPATIBLE'
    );
    expect(found.severity).toBe('error');
    expect(found.field).toBe('gauge');
    expect(
      found.message,
      'Expected the configured reason verbatim, because whoever supplies the constraint writes the sentence the customer reads.'
    ).toBe('AFS does not fabricate a coping cap in 26 ga galvanized.');
  });

  it('does not fire for a different gauge in the same material (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, gauge: '24 ga' }, ALL_CONSTRAINTS, {
        incompatibleCombinations: [
          { materialCategory: 'galvanized', gaugeNumber: 26, reason: 'Not fabricated.' },
        ],
      }),
      'Expected nothing for 24 ga when only 26 ga is listed: the pair is exact, not a range.'
    ).not.toContain('OV_MATERIAL_GAUGE_INCOMPATIBLE');
  });
});

// ---------------------------------------------------------------------------
// Drawn-geometry rules
// ---------------------------------------------------------------------------

describe('OV_SEGMENT_ZERO_LENGTH', () => {
  it('does not fire for a clean drawing (happy)', () => {
    expect(codesFor(VALID_DRAWN_ITEM, [])).not.toContain('OV_SEGMENT_ZERO_LENGTH');
  });

  it('fires as a customer error for a duplicated point (trigger)', () => {
    const found = expectOne(
      findingsFor(
        {
          ...VALID_DRAWN_ITEM,
          points: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 4 },
          ],
        },
        []
      ),
      'OV_SEGMENT_ZERO_LENGTH'
    );
    expect(found.severity).toBe('error');
    expect(found.field, 'Expected the geometry itself to be named: no typed input is to blame.').toBe('points');
    expect(found.audience).toBe('customer');
  });

  it('reports one finding naming the count when several points are duplicated', () => {
    const found = expectOne(
      findingsFor(
        {
          ...VALID_DRAWN_ITEM,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 0 },
          ],
        },
        []
      ),
      'OV_SEGMENT_ZERO_LENGTH'
    );
    expect(
      found.message,
      `Expected one finding saying "2 legs"; got "${found.message}". Two banners about the same drawing problem is noise, but hiding the count would understate it.`
    ).toContain('2 legs');
  });

  it('does not fire for an item with no drawing at all', () => {
    expect(
      codesFor(VALID_COPING_CAP_ITEM),
      'Expected nothing: a Quote Builder submission has named dimensions and no points, and there is no geometry to be wrong.'
    ).not.toContain('OV_SEGMENT_ZERO_LENGTH');
  });
});

describe('OV_SEGMENT_TOO_SHORT', () => {
  it('does not fire at exactly the minimum flange (boundary)', () => {
    expect(
      codesFor(
        { ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 4 }] },
        [],
        { minFlangeLengthIn: 0.5 }
      ),
      'Expected nothing at exactly 1/2 in: the comparison is >=, so AFS forms at its own stated minimum.'
    ).not.toContain('OV_SEGMENT_TOO_SHORT');
  });

  it('fires as a customer error for a drawn leg below the minimum (trigger)', () => {
    const found = expectOne(
      findingsFor(
        { ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 0.25, y: 0 }, { x: 0.25, y: 4 }] },
        [],
        { minFlangeLengthIn: 0.5 }
      ),
      'OV_SEGMENT_TOO_SHORT'
    );
    expect(found.severity).toBe('error');
    expect(found.field).toBe('points');
    expect(found.message, `Expected the shortest leg named; got "${found.message}".`).toContain('1/4"');
  });

  it('does not double-report a duplicated point as a short leg (boundary)', () => {
    const codes = codesFor(
      { ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 6, y: 0 }] },
      []
    );
    expect(
      codes.filter((c) => c === 'OV_SEGMENT_TOO_SHORT'),
      'Expected no short-leg finding for a coincident pair: the zero-length rule already names it, and the two thresholds are deliberately separated so each mistake gets one message.'
    ).toEqual([]);
    expect(codes, 'Expected the zero-length rule to be the one that fired.').toContain('OV_SEGMENT_ZERO_LENGTH');
  });
});

describe('OV_SELF_INTERSECTION', () => {
  it('does not fire for a Z profile (happy)', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: Z_PROFILE_POINTS }, []),
      'Expected nothing: every pair of adjacent legs touches at its shared bend, and a check that called that an intersection would refuse every profile with more than one bend.'
    ).not.toContain('OV_SELF_INTERSECTION');
  });

  it('fires as a customer error for a profile that crosses itself (trigger)', () => {
    const found = expectOne(findingsFor({ ...VALID_DRAWN_ITEM, points: SELF_CROSSING_POINTS }, []), 'OV_SELF_INTERSECTION');
    expect(found.severity, 'The metal would have to pass through itself, so it cannot be fabricated.').toBe('error');
    expect(found.field).toBe('points');
    expect(found.audience).toBe('customer');
  });

  it('reports one finding however many crossings there are', () => {
    const found = only(
      findingsFor(
        {
          ...VALID_DRAWN_ITEM,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 5, y: -5 },
            { x: 1, y: 6 },
            { x: -2, y: -2 },
          ],
        },
        []
      ),
      'OV_SELF_INTERSECTION'
    );
    expect(
      found.length,
      `Expected exactly one finding; got ${found.length}. The fix for a self-crossing profile is to redraw it, so listing each crossing pair would be the same instruction repeated.`
    ).toBe(1);
  });
});

describe('OV_BEND_COUNT_HIGH and OV_BEND_COUNT_EXCEEDED', () => {
  const limits: Partial<OrderValidatorLimits> = { maxBendCountWarn: 4, maxBendCountError: 6 };

  it('does not fire at exactly the warn threshold (boundary)', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: staircasePoints(4) }, [], limits),
      'Expected nothing at exactly 4 bends when the warn threshold is 4: the comparison is >, so the stated limit itself is fine.'
    ).not.toContain('OV_BEND_COUNT_HIGH');
  });

  it('warns one bend above the warn threshold (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_DRAWN_ITEM, points: staircasePoints(5) }, [], limits),
      'OV_BEND_COUNT_HIGH'
    );
    expect(found.severity).toBe('warn');
    expect(found.field).toBe('bendCount');
    expect(found.message, `Expected the real bend count in the message; got "${found.message}".`).toContain('5 bends');
  });

  it('does not fire at exactly the error threshold (boundary)', () => {
    const codes = codesFor({ ...VALID_DRAWN_ITEM, points: staircasePoints(6) }, [], limits);
    expect(
      codes,
      'Expected no refusal at exactly 6 bends when the error threshold is 6 — but a warning, because 6 is above the warn threshold of 4.'
    ).not.toContain('OV_BEND_COUNT_EXCEEDED');
    expect(codes).toContain('OV_BEND_COUNT_HIGH');
  });

  it('refuses above the error threshold, and warns only once (trigger)', () => {
    const codes = codesFor({ ...VALID_DRAWN_ITEM, points: staircasePoints(7) }, [], limits);
    expect(codes, 'Expected a refusal at 7 bends when the error threshold is 6.').toContain(
      'OV_BEND_COUNT_EXCEEDED'
    );
    expect(
      codes.filter((c) => c === 'OV_BEND_COUNT_HIGH'),
      'Expected NO "needs checking" warning alongside the refusal: "this can probably be made" and "this cannot be made" are contradictory messages about the same profile.'
    ).toEqual([]);
  });

  it('counts bends as interior vertices, so a two-leg L is one bend', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: staircasePoints(1) }, [], { maxBendCountWarn: 1, maxBendCountError: 2 }),
      'Expected nothing: a 3-point profile is one bend, matching lib/pricing/quote-inputs.ts\'s bendCountFromPoints — the endpoints are free ends, not folds.'
    ).not.toContain('OV_BEND_COUNT_HIGH');
  });
});

describe('OV_BLANK_WIDTH_EXCEEDS_SHEET', () => {
  it('does not fire at exactly the sheet width (boundary)', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 24 }] }, []),
      'Expected nothing at exactly 48 in of girth: a blank the full width of a 4 ft sheet is one strip, which lib/pricing/quote-math.ts prices and does not refuse.'
    ).not.toContain('OV_BLANK_WIDTH_EXCEEDS_SHEET');
  });

  it('fires as a customer error above the sheet width (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 25 }] }, []),
      'OV_BLANK_WIDTH_EXCEEDS_SHEET'
    );
    expect(found.severity, 'A 55 in blank cannot be cut across a 48 in sheet at all.').toBe('error');
    expect(found.field).toBe('blankWidth');
    expect(found.audience).toBe('customer');
    expect(found.message, `Expected the sheet width named; got "${found.message}".`).toContain('48"');
  });

  it('measures girth the same way the price book and the machine hand-off do', () => {
    const codes = codesFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] }, []);
    expect(
      codes,
      'Expected nothing for a single 5 in diagonal leg. Girth comes from lib/pricing/quote-inputs.ts\'s blankWidthInFromPoints — the same measurement that becomes machine_jobs.blank_width_mm — so the number the validator refuses on cannot disagree with the number sent to the Thalmann.'
    ).not.toContain('OV_BLANK_WIDTH_EXCEEDS_SHEET');
  });
});

describe('OV_BLANK_WIDTH_ONE_STRIP', () => {
  it('does not fire when two or more strips come off a sheet (happy)', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }] }, []),
      'Expected nothing at 20 in of girth: floor(48 / 20) = 2 strips.'
    ).not.toContain('OV_BLANK_WIDTH_ONE_STRIP');
  });

  it('fires as an ADMIN info when only one strip comes off a sheet (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }] }, []),
      'OV_BLANK_WIDTH_ONE_STRIP'
    );
    expect(
      found.audience,
      'Expected admin. How many strips come off a sheet is the sheet cost divided by a number, which makes it cost-adjacent — and a customer sees no money before a formal AFS quote.'
    ).toBe('admin');
    expect(found.severity).toBe('info');
  });

  it('does not fire for a blank already refused as wider than the sheet (boundary)', () => {
    const codes = codesFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 60, y: 0 }] }, []);
    expect(
      codes.filter((c) => c === 'OV_BLANK_WIDTH_ONE_STRIP'),
      'Expected no strip note for a 60 in blank. stripsPerSheet() THROWS above the sheet width by design (a silent 0 becomes a division by zero in the quote maths), so the rule must not reach it.'
    ).toEqual([]);
    expect(codes).toContain('OV_BLANK_WIDTH_EXCEEDS_SHEET');
  });

  it('fires at exactly the sheet width, which yields exactly one strip (boundary)', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 48, y: 0 }] }, []),
      'Expected the strip note at exactly 48 in: floor(48 / 48) = 1.'
    ).toContain('OV_BLANK_WIDTH_ONE_STRIP');
  });
});

// ---------------------------------------------------------------------------
// Hem rules
// ---------------------------------------------------------------------------

describe('OV_HEM_FOLD_TOO_SHORT and OV_HEM_FOLD_NOT_POSITIVE', () => {
  it('does not fire for a hem at exactly the minimum fold (boundary)', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, hemStart: { lengthIn: 0.25 } }, [], { minHemFoldLengthIn: 0.25 }),
      'Expected nothing at exactly 1/4 in: the comparison is >=.'
    ).not.toContain('OV_HEM_FOLD_TOO_SHORT');
  });

  it('fires as a customer error for a hem below the minimum fold (trigger)', () => {
    const found = expectOne(
      findingsFor({ ...VALID_DRAWN_ITEM, hemEnd: { lengthIn: 0.0625 } }, [], { minHemFoldLengthIn: 0.25 }),
      'OV_HEM_FOLD_TOO_SHORT'
    );
    expect(found.severity).toBe('error');
    expect(found.field).toBe('hem');
    expect(
      found.message,
      `Expected the message to say which end of the profile; got "${found.message}". A profile can carry a hem at each free end, so "the hem" alone would be ambiguous.`
    ).toContain('end');
  });

  it('reports each hem separately when both are too short', () => {
    const found = only(
      findingsFor(
        { ...VALID_DRAWN_ITEM, hemStart: { lengthIn: 0.1 }, hemEnd: { lengthIn: 0.1 } },
        [],
        { minHemFoldLengthIn: 0.25 }
      ),
      'OV_HEM_FOLD_TOO_SHORT'
    );
    expect(found.length, `Expected two findings, one per hemmed end; got ${found.length}.`).toBe(2);
  });

  it('fires the not-positive rule for a hem whose fold length is zero (boundary)', () => {
    const codes = codesFor({ ...VALID_DRAWN_ITEM, hemStart: { lengthIn: 0 } }, []);
    expect(
      codes,
      'Expected the not-positive rule: a hem with a 0 in fold is not a short hem, it is a hem with no fold at all, and the message has to say that rather than quote a minimum.'
    ).toContain('OV_HEM_FOLD_NOT_POSITIVE');
    expect(
      codes.filter((c) => c === 'OV_HEM_FOLD_TOO_SHORT'),
      'Expected no too-short finding as well: one mistake, one message.'
    ).toEqual([]);
  });

  it('does not fire for a hem whose fold length was never recorded', () => {
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, hemStart: {} }, []),
      'Expected nothing. A hem read back out of JSONB may have lost its lengthIn, and absent is not zero — inventing a fold length to validate would be worse than not checking.'
    ).toEqual(['OV_PROFILE_CONSTRAINTS_UNKNOWN']);
  });

  it('does not fire for a profile with no hems at all (happy)', () => {
    const codes = codesFor(VALID_DRAWN_ITEM, []);
    expect(codes).not.toContain('OV_HEM_FOLD_TOO_SHORT');
    expect(codes).not.toContain('OV_HEM_FOLD_NOT_POSITIVE');
  });
});

describe('OV_REQUIRES_CONSULTATION', () => {
  it('does not fire for a profile that needs no review (happy)', () => {
    expect(
      codesFor(VALID_COPING_CAP_ITEM),
      'Expected nothing: the seeded Coping Cap row has requires_consultation = false.'
    ).not.toContain('OV_REQUIRES_CONSULTATION');
  });

  it('fires as a customer info for a profile flagged in the seed data (trigger)', () => {
    const scupper: OrderValidatorItem = {
      profileType: 'Scupper',
      material: 'Copper',
      gauge: '20 oz',
      width: 12,
      height: 12,
      legA: 4,
      legB: 4,
      lengthFt: 2,
      quantity: 1,
    };
    const found = expectOne(findingsFor(scupper, [SCUPPER_CONSTRAINTS]), 'OV_REQUIRES_CONSULTATION');
    expect(
      found.severity,
      'Expected info: there is nothing for the customer to fix, so it must not block and must not need acknowledging.'
    ).toBe('info');
    expect(
      found.audience,
      'Expected customer. "An engineer will look at this before it is quoted" sets an expectation about how long the quote takes, which the customer is entitled to.'
    ).toBe('customer');
    expect(found.field).toBe('profileType');
  });

  it('does not fire when no constraints row was resolved (boundary)', () => {
    expect(
      codesFor({ ...VALID_COPING_CAP_ITEM, profileType: 'Reglet' }),
      'Expected nothing: with no row, requires_consultation is unknown, and claiming a profile needs engineering review on no evidence would delay a quote for no reason.'
    ).not.toContain('OV_REQUIRES_CONSULTATION');
  });
});

describe('every declared limit really changes behaviour', () => {
  it('uses resolveLimits so an override reaches the rules', () => {
    const strict = resolveLimits({ maxBlankWidthIn: 10 });
    expect(strict.maxBlankWidthIn, 'Expected the override to resolve to 10.').toBe(10);
    expect(
      codesFor({ ...VALID_DRAWN_ITEM, points: [{ x: 0, y: 0 }, { x: 12, y: 0 }] }, [], { maxBlankWidthIn: 10 }),
      'Expected a 12 in blank to be refused once the sheet width is overridden to 10 in — proving the rules read the resolved limits rather than a module-level constant.'
    ).toContain('OV_BLANK_WIDTH_EXCEEDS_SHEET');
  });
});
