import { describe, expect, it } from 'vitest';
import { SHEET_LENGTH_FT, SHEET_WIDTH_IN } from '@/lib/pricing/quote-math';
import {
  DEFAULT_ORDER_VALIDATOR_LIMITS,
  LIMIT_PROVENANCE,
  assumedLimitKeys,
  gaugeNumberOf,
  profileLabelKey,
  resolveLimits,
  type OrderValidatorLimits,
} from './limits';

const NUMERIC_LIMIT_KEYS: (keyof OrderValidatorLimits)[] = [
  'maxBlankWidthIn',
  'maxPieceLengthFt',
  'minFlangeLengthIn',
  'minHemFoldLengthIn',
  'zeroLengthEpsilonIn',
  'maxBendCountWarn',
  'maxBendCountError',
];

describe('limits table: every limit declares who confirmed it', () => {
  it('has a provenance entry for every key of OrderValidatorLimits', () => {
    const limitKeys = Object.keys(DEFAULT_ORDER_VALIDATOR_LIMITS).sort();
    const provenanceKeys = Object.keys(LIMIT_PROVENANCE).sort();
    expect(
      provenanceKeys,
      `Every limit must record whether anybody confirmed it. Expected provenance keys ${JSON.stringify(limitKeys)}, got ${JSON.stringify(provenanceKeys)} — a limit with no provenance would be presented to an estimator as though it were confirmed shop capability.`
    ).toEqual(limitKeys);
  });

  it('has no provenance entry naming a limit that no longer exists', () => {
    const dead = (Object.keys(LIMIT_PROVENANCE) as string[]).filter(
      (key) => !(key in DEFAULT_ORDER_VALIDATOR_LIMITS)
    );
    expect(
      dead,
      `LIMIT_PROVENANCE names ${JSON.stringify(dead)}, which is not a limit. Expected []: a stale provenance entry makes the admin panel list a threshold nothing uses.`
    ).toEqual([]);
  });

  it('gives every provenance entry a non-empty basis and label', () => {
    for (const [key, entry] of Object.entries(LIMIT_PROVENANCE)) {
      expect(
        entry.basis.trim().length,
        `Limit "${key}" has an empty basis. Expected a sentence naming the authority (or saying plainly there is none); got "${entry.basis}".`
      ).toBeGreaterThan(0);
      expect(
        entry.label.trim().length,
        `Limit "${key}" has an empty label, so the admin panel would render a blank row. Expected a short title; got "${entry.label}".`
      ).toBeGreaterThan(0);
    }
  });

  it('reports exactly the five assumed limits and the one data-blocked one', () => {
    expect(
      assumedLimitKeys().sort(),
      'assumedLimitKeys() is what the admin panel lists as "not yet confirmed by Steve". Expected the five placeholder numbers plus the data-blocked incompatibility list, and nothing that is traceable to code or to the spec.'
    ).toEqual(
      [
        'incompatibleCombinations',
        'maxBendCountError',
        'maxBendCountWarn',
        'minFlangeLengthIn',
        'minHemFoldLengthIn',
        'zeroLengthEpsilonIn',
      ].sort()
    );
  });

  it('marks the two sheet limits as repo-verified against lib/pricing/quote-math.ts', () => {
    expect(
      LIMIT_PROVENANCE.maxBlankWidthIn.provenance,
      'The sheet width is real code, not a guess, and must not be listed to Steve as an assumption.'
    ).toBe('repo-verified');
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.maxBlankWidthIn,
      `The validator must refuse at the same width the price book cuts at. Expected SHEET_WIDTH_IN (${SHEET_WIDTH_IN}), got ${DEFAULT_ORDER_VALIDATOR_LIMITS.maxBlankWidthIn} — a second copy of 48 is exactly what CLAUDE.md rule #19 forbids.`
    ).toBe(SHEET_WIDTH_IN);
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.maxPieceLengthFt,
      `Expected SHEET_LENGTH_FT (${SHEET_LENGTH_FT}), got ${DEFAULT_ORDER_VALIDATOR_LIMITS.maxPieceLengthFt}.`
    ).toBe(SHEET_LENGTH_FT);
  });
});

describe('limits table: the defaults are usable numbers', () => {
  it('gives every numeric limit a finite, positive default', () => {
    for (const key of NUMERIC_LIMIT_KEYS) {
      const value = DEFAULT_ORDER_VALIDATOR_LIMITS[key];
      expect(
        typeof value === 'number' && Number.isFinite(value) && value > 0,
        `Limit "${key}" is ${String(value)}. Expected a finite positive number — a NaN or zero threshold silently turns its rule into either "always fires" or "never fires".`
      ).toBe(true);
    }
  });

  it('keeps the bend warn threshold below the bend error threshold', () => {
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.maxBendCountWarn,
      `Expected maxBendCountWarn (${DEFAULT_ORDER_VALIDATOR_LIMITS.maxBendCountWarn}) < maxBendCountError (${DEFAULT_ORDER_VALIDATOR_LIMITS.maxBendCountError}); otherwise the warn band is empty and a high bend count is either silently fine or outright refused, with nothing in between.`
    ).toBeLessThan(DEFAULT_ORDER_VALIDATOR_LIMITS.maxBendCountError);
  });

  it('keeps the zero-length tolerance well below the minimum flange', () => {
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.zeroLengthEpsilonIn,
      `Expected zeroLengthEpsilonIn (${DEFAULT_ORDER_VALIDATOR_LIMITS.zeroLengthEpsilonIn}) < minFlangeLengthIn (${DEFAULT_ORDER_VALIDATOR_LIMITS.minFlangeLengthIn}); if the tolerance reached the flange minimum, "duplicated point" and "leg too short" would overlap and one of the two messages could never be produced.`
    ).toBeLessThan(DEFAULT_ORDER_VALIDATOR_LIMITS.minFlangeLengthIn);
  });

  it('ships the incompatible-combination list empty, because the data is blocked', () => {
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.incompatibleCombinations,
      'SPEC_AI_ORDER_VALIDATOR.md section 4: "Currently: table is empty, no incompatibility rules enforced." Expected [] — a seeded rule here would be an invented fabrication constraint.'
    ).toEqual([]);
  });

  it('ships the one gauge-span limit the spec states, and no others', () => {
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.gaugeSpanLimits,
      'SPEC_AI_ORDER_VALIDATOR.md section 3 states one gauge-span limit: galvanized, over 24 in, lighter than 22 ga. Expected exactly that and nothing extrapolated to copper, zinc or aluminium.'
    ).toEqual([{ materialCategory: 'galvanized', minWidthIn: 24, lighterThanGaugeNumber: 22 }]);
  });

  it('ships the one per-profile minimum the spec states', () => {
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.profileMinimums,
      'SPEC_AI_ORDER_VALIDATOR.md section 3 states one: Step Flashing width at least 4 inches.'
    ).toEqual([{ profileLabel: 'Step Flashing', dimension: 'width', minIn: 4 }]);
  });
});

describe('resolveLimits', () => {
  it('returns the documented defaults when given nothing', () => {
    expect(
      resolveLimits(),
      'A caller that passes no overrides must get the full documented table, not a partial one.'
    ).toEqual(DEFAULT_ORDER_VALIDATOR_LIMITS);
  });

  it('returns the documented defaults when given undefined', () => {
    expect(resolveLimits(undefined), 'An explicit undefined must behave as "no overrides".').toEqual(
      DEFAULT_ORDER_VALIDATOR_LIMITS
    );
  });

  it('replaces only the overridden key and keeps every other default', () => {
    const resolved = resolveLimits({ minFlangeLengthIn: 1.25 });
    expect(resolved.minFlangeLengthIn, 'Expected the override to win: 1.25.').toBe(1.25);
    expect(
      resolved.maxBlankWidthIn,
      `Expected the untouched sheet width to survive the override: ${SHEET_WIDTH_IN}. A spread that lost the other keys would leave rules reading undefined thresholds.`
    ).toBe(SHEET_WIDTH_IN);
    expect(resolved.gaugeSpanLimits, 'Expected the untouched gauge-span list to survive.').toEqual(
      DEFAULT_ORDER_VALIDATOR_LIMITS.gaugeSpanLimits
    );
  });

  it('does not mutate the shared default table', () => {
    resolveLimits({ maxBendCountWarn: 99 });
    expect(
      DEFAULT_ORDER_VALIDATOR_LIMITS.maxBendCountWarn,
      'Expected the module-level defaults to be untouched (12) after an override; a mutated shared table would leak one caller\'s limits into every other caller in the same process.'
    ).toBe(12);
  });
});

describe('gaugeNumberOf', () => {
  it('reads the number out of a numbered gauge label', () => {
    expect(gaugeNumberOf('26 ga'), 'Expected 26 from "26 ga".').toBe(26);
    expect(gaugeNumberOf('24GA'), 'Expected 24 from "24GA" — the seeded labels use "24 GA".').toBe(24);
    expect(gaugeNumberOf('18 gauge'), 'Expected 18 from "18 gauge".').toBe(18);
  });

  it('returns null for a gauge expressed by thickness, weight or millimetres', () => {
    for (const label of ['0.032"', '.040"', '16 oz', '20 oz LCC', '0.7mm', '1.0mm']) {
      expect(
        gaugeNumberOf(label),
        `Expected null for "${label}": it is a real seeded gauge label, but it carries no gauge NUMBER, and SPEC section 3's limit is stated in gauge numbers. Guessing an equivalent would be inventing shop capability.`
      ).toBeNull();
    }
  });

  it('returns null for a bare number, because a bare number could be anything', () => {
    expect(
      gaugeNumberOf('26'),
      'Expected null for "26": with no unit, treating it as a gauge number would let a mislabelled row trip the span rule.'
    ).toBeNull();
  });

  it('returns null for empty, null and undefined input', () => {
    expect(gaugeNumberOf(''), 'Expected null for an empty label.').toBeNull();
    expect(gaugeNumberOf(null), 'Expected null for a null label.').toBeNull();
    expect(gaugeNumberOf(undefined), 'Expected null for an absent label.').toBeNull();
  });
});

describe('profileLabelKey', () => {
  it('normalises case, spacing and punctuation away', () => {
    expect(
      profileLabelKey('Window / Door Flashing'),
      'Expected "windowdoorflashing" so the Quote Builder label matches the product_profiles name across punctuation differences.'
    ).toBe('windowdoorflashing');
    expect(profileLabelKey('  coping-cap  '), 'Expected "copingcap" from a slug.').toBe('copingcap');
    expect(profileLabelKey('Coping Cap'), 'Expected "copingcap" from a display name.').toBe('copingcap');
  });

  it('returns an empty key for empty, null and undefined input, never a match', () => {
    expect(profileLabelKey(''), 'Expected "" — an empty key must never match a real profile.').toBe('');
    expect(profileLabelKey(null), 'Expected "" for null.').toBe('');
    expect(profileLabelKey(undefined), 'Expected "" for undefined.').toBe('');
  });
});
