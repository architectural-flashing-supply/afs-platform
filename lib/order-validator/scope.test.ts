/**
 * THE SCOPE CONTRACT, asserted over the WHOLE rule set rather than rule by rule.
 *
 * Two invariants this feature cannot be allowed to break, both of them platform
 * rules rather than validator details:
 *
 *   INV-1  No customer-visible message contains a figure with a currency on it.
 *          AFS is an RFQ platform: "Customers never see prices on the website.
 *          Ever." (CLAUDE.md, BUSINESS MODEL). A validator is exactly where a
 *          cost would leak in by accident, because the honest explanation for
 *          half of these rules is about sheets and waste.
 *
 *   INV-2  No `audience: 'admin'` finding ever reaches a customer surface.
 *
 * A per-rule test proves one rule behaves. This drives EVERY rule at once from
 * one deliberately awful fixture set, so a rule added later is covered the
 * moment it fires, without anyone remembering to extend this file.
 */

import { describe, expect, it } from 'vitest';
import { ALL_RULES } from './rules';
import { findingsForAudience, validateOrder } from './validate';
import { ALL_CONSTRAINTS, SELF_CROSSING_POINTS, staircasePoints } from './fixtures';
import type { OrderValidatorItem, ValidationCode, ValidationFinding } from './types';

/**
 * A request engineered to trip as many rules as one pass can. Each item is a
 * different kind of wrong, and together they cover every code the engine can
 * produce except the two that need an override (the configured incompatibility)
 * or a different limits table.
 */
const AWFUL_REQUEST: OrderValidatorItem[] = [
  // Nothing filled in at all.
  { profileType: '', material: null, gauge: null, lengthFt: 0, quantity: 0 },
  // A coping cap whose legs swallow the cap, in too light a gauge for the span,
  // too long for the profile, with a nonsense height.
  {
    profileType: 'Coping Cap',
    material: 'Galvanized Steel',
    gauge: '26 ga',
    width: 30,
    height: 0,
    legA: 20,
    legB: 20,
    lengthFt: 40,
    quantity: 2,
  },
  // Below every seeded minimum, with a leg too short to form.
  {
    profileType: 'Coping Cap',
    material: 'Galvanized Steel',
    gauge: '20 ga',
    width: 2,
    height: 1,
    legA: 0.125,
    legB: 0.125,
    lengthFt: 4,
    quantity: 1,
  },
  // A drawing that crosses itself.
  {
    profileType: 'Custom FlashDraft Profile',
    material: 'Copper',
    gauge: '20 oz',
    lengthFt: 10,
    quantity: 1,
    points: SELF_CROSSING_POINTS,
  },
  // A drawing with a duplicated point, a hair-thin leg and two unformable hems.
  {
    profileType: 'Custom FlashDraft Profile',
    material: 'Copper',
    gauge: '20 oz',
    lengthFt: 10,
    quantity: 1,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.1, y: 6 },
    ],
    hemStart: { lengthIn: 0.05 },
    hemEnd: { lengthIn: 0 },
  },
  // A blank far wider than a sheet.
  {
    profileType: 'Custom FlashDraft Profile',
    material: 'Galvanized Steel',
    gauge: '24 ga',
    lengthFt: 10,
    quantity: 1,
    points: [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
    ],
  },
  // A blank that yields exactly one strip (admin info).
  {
    profileType: 'Custom FlashDraft Profile',
    material: 'Galvanized Steel',
    gauge: '24 ga',
    lengthFt: 10,
    quantity: 1,
    points: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 10 },
    ],
  },
  // Far too many bends.
  {
    profileType: 'Custom FlashDraft Profile',
    material: 'Galvanized Steel',
    gauge: '24 ga',
    lengthFt: 10,
    quantity: 1,
    points: staircasePoints(30, 1),
  },
  // Enough bends to warn but not to refuse.
  {
    profileType: 'Custom FlashDraft Profile',
    material: 'Galvanized Steel',
    gauge: '24 ga',
    lengthFt: 10,
    quantity: 1,
    points: staircasePoints(14, 1),
  },
  // A step flashing narrower than the spec-stated minimum.
  { profileType: 'Step Flashing', material: 'Galvanized Steel', gauge: '26 ga', width: 3, lengthFt: 1, quantity: 40 },
  // In range in every dimension, but in a material + gauge pairing the limits
  // table has been told AFS will not fabricate. (The shipped default list is
  // empty — see the override below.)
  {
    profileType: 'Fascia',
    material: 'Galvanized Steel',
    gauge: '18 ga',
    width: 12,
    height: 6,
    lengthFt: 10,
    quantity: 1,
  },
  // A scupper: requires consultation, and long enough to need splicing.
  {
    profileType: 'Scupper',
    material: 'Copper',
    gauge: '20 oz',
    width: 12,
    height: 12,
    legA: 4,
    legB: 4,
    lengthFt: 18,
    quantity: 1,
  },
];

const RESULT = validateOrder({
  items: AWFUL_REQUEST,
  constraints: ALL_CONSTRAINTS,
  limits: {
    // The shipped default is empty (SPEC section 4 — the data is blocked), so the
    // rule is driven here from an explicit configuration instead. 18 ga is a
    // real gauge option on the Quote Builder for galvanized steel, and it is
    // heavier than the span threshold, so this item trips the incompatibility
    // rule and nothing else.
    incompatibleCombinations: [
      {
        materialCategory: 'galvanized',
        gaugeNumber: 18,
        reason: 'AFS does not fabricate this profile in 18 ga galvanized steel.',
      },
    ],
  },
});

const CUSTOMER_FINDINGS = findingsForAudience(RESULT.findings, 'customer');
const ADMIN_FINDINGS = findingsForAudience(RESULT.findings, 'admin');

/**
 * Anything that reads as money. Deliberately broad: a bare '$', a currency
 * word, a cents figure, 'per sheet' pricing language, and 'cost'/'price'
 * themselves — because the leak this guards against is prose, not a number
 * field, and prose like "costs an extra sheet" has no digit in it at all.
 */
const CURRENCY_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /\$/, why: 'a dollar sign' },
  { pattern: /\bUSD\b/i, why: 'a currency code' },
  { pattern: /\bcents?\b/i, why: 'a cents figure' },
  { pattern: /\bdollars?\b/i, why: 'the word dollars' },
  { pattern: /\bpric(e|es|ed|ing)\b/i, why: 'pricing language' },
  { pattern: /\bcosts?\b/i, why: 'the word cost' },
  { pattern: /\bsurcharge\b/i, why: 'a surcharge' },
  { pattern: /\bupcharge\b/i, why: 'an upcharge' },
];

describe('the awful request really does exercise the rule set', () => {
  it('produces every code the rules can produce', () => {
    const produced = new Set(RESULT.findings.map((f) => f.code));
    const declared = ALL_RULES.map((rule) => rule.code);
    const missing = declared.filter((code) => !produced.has(code));
    expect(
      missing,
      `These rules never fired against the fixture set, so the scope and currency invariants below are not actually checking them: ${JSON.stringify(missing)}. Add an item to AWFUL_REQUEST that triggers each one — a rule nobody drives here is a rule that can leak an admin message or a price into a customer banner unnoticed.`
    ).toEqual([]);
  });

  it('produces findings of all three severities', () => {
    expect(
      RESULT.counts.error,
      'Expected errors in the fixture set, or the blocking path is untested here.'
    ).toBeGreaterThan(0);
    expect(RESULT.counts.warn, 'Expected warnings in the fixture set.').toBeGreaterThan(0);
    expect(RESULT.counts.info, 'Expected information in the fixture set.').toBeGreaterThan(0);
  });
});

describe('INV-2: admin scope never reaches a customer', () => {
  it('withholds every admin-audience finding from the customer projection', () => {
    const leaked = CUSTOMER_FINDINGS.filter((f) => f.audience !== 'customer');
    expect(
      leaked.map((f) => f.code),
      `These admin-scope findings reached the customer projection: ${JSON.stringify(leaked.map((f) => f.code))}. findingsForAudience is the only exit from the engine precisely so this cannot happen by someone forgetting a filter on one surface.`
    ).toEqual([]);
  });

  it('shows the admin everything the customer was shown, and more', () => {
    const customerCodes = CUSTOMER_FINDINGS.map((f) => `${f.itemIndex}:${f.code}:${f.field}`);
    const adminCodes = new Set(ADMIN_FINDINGS.map((f) => `${f.itemIndex}:${f.code}:${f.field}`));
    const hidden = customerCodes.filter((key) => !adminCodes.has(key));
    expect(
      hidden,
      `An estimator could not see these, which the customer could: ${JSON.stringify(hidden)}. Admin scope is a SUPERSET; an estimator reading a different story from the customer's is how a support call goes wrong.`
    ).toEqual([]);
    expect(
      ADMIN_FINDINGS.length,
      `Expected the admin projection (${ADMIN_FINDINGS.length}) to be larger than the customer's (${CUSTOMER_FINDINGS.length}) — the fixture set deliberately includes internal-only notes, so equal counts would mean the admin-only rules never fired.`
    ).toBeGreaterThan(CUSTOMER_FINDINGS.length);
  });

  it('keeps every internal-only code out of customer scope by name', () => {
    const adminOnlyCodes: ValidationCode[] = [
      'OV_PROFILE_CONSTRAINTS_UNKNOWN',
      'OV_PIECE_NEEDS_SPLICING',
      'OV_BLANK_WIDTH_ONE_STRIP',
    ];
    for (const code of adminOnlyCodes) {
      expect(
        ADMIN_FINDINGS.some((f) => f.code === code),
        `${code} never fired, so this assertion proves nothing. Check the fixture set.`
      ).toBe(true);
      expect(
        CUSTOMER_FINDINGS.some((f) => f.code === code),
        `${code} reached customer scope. It is internal: either it is about AFS's own capacity (how many strips come off a sheet, which pieces need splicing) or it says a check could not be made — none of which is the customer's to act on, and the first two are cost-adjacent.`
      ).toBe(false);
    }
  });
});

describe('INV-1: no customer-visible message reads as money', () => {
  it('finds no currency language in any customer-facing message', () => {
    const offences: string[] = [];
    for (const finding of CUSTOMER_FINDINGS) {
      for (const { pattern, why } of CURRENCY_PATTERNS) {
        if (pattern.test(finding.message)) {
          offences.push(`${finding.code} contains ${why}: "${finding.message}"`);
        }
      }
    }
    expect(
      offences,
      `A customer-facing validator message reads as money:\n${offences.join('\n')}\nCLAUDE.md's first critical rule: a customer sees no dollar amount before AFS has issued a formal quote. The honest explanation for several of these rules IS about sheets and waste, which is exactly why those findings are admin-scope instead of being reworded.`
    ).toEqual([]);
  });

  it('checks a message that would fail, so the pattern set is not vacuous', () => {
    const planted: ValidationFinding = {
      code: 'OV_BLANK_WIDTH_ONE_STRIP',
      severity: 'info',
      field: 'blankWidth',
      message: 'This profile costs an extra sheet at $42 per piece.',
      itemIndex: 0,
      audience: 'customer',
      source: 'deterministic',
    };
    const caught = CURRENCY_PATTERNS.filter(({ pattern }) => pattern.test(planted.message));
    expect(
      caught.length,
      'Expected the currency patterns to catch a planted message containing a dollar sign and the word "costs". A guard that cannot fail is not a guard.'
    ).toBeGreaterThan(1);
  });
});

describe('every customer-facing message is actionable prose', () => {
  it('never shows a customer a rule code or a TypeScript field name', () => {
    const offences: string[] = [];
    for (const finding of CUSTOMER_FINDINGS) {
      if (/\bOV_[A-Z_]+\b/.test(finding.message)) offences.push(`${finding.code}: "${finding.message}"`);
      if (/\blengthFt\b|\bprofileType\b|\blegA\b|\blegB\b|\bitemIndex\b/.test(finding.message)) {
        offences.push(`${finding.code} uses an internal field name: "${finding.message}"`);
      }
    }
    expect(
      offences,
      `These customer messages leak internals:\n${offences.join('\n')}\nThe customer reads "Leg A", not "legA", and never reads a code.`
    ).toEqual([]);
  });

  it('writes every customer message as at least one full sentence', () => {
    for (const finding of CUSTOMER_FINDINGS) {
      expect(
        finding.message.trim().length,
        `${finding.code} has a ${finding.message.trim().length}-character message: "${finding.message}". A validator that blocks a quote request owes the customer a sentence, not a label.`
      ).toBeGreaterThan(20);
      expect(
        /[.!?]$/.test(finding.message.trim()),
        `${finding.code} does not end in a full stop: "${finding.message}".`
      ).toBe(true);
    }
  });

  it('never blames the customer or shows a stack trace', () => {
    for (const finding of CUSTOMER_FINDINGS) {
      expect(
        /\b(invalid|illegal|forbidden|you failed|error:)\b/i.test(finding.message),
        `${finding.code} reads as a reprimand: "${finding.message}". CLAUDE.md rule #30's wording rule — never blame the user, never show a stack trace, say what did not happen.`
      ).toBe(false);
      expect(
        /\bat .+\.ts:\d+|Error:|undefined\b|NaN\b/.test(finding.message),
        `${finding.code} leaks a runtime value or a trace: "${finding.message}".`
      ).toBe(false);
    }
  });
});
