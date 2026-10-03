import { describe, expect, it } from 'vitest';
import {
  acknowledgeableFindings,
  blockingFindings,
  findingsForAudience,
  findingsForItem,
  informationalFindings,
  validateOrder,
  withAdvisories,
  worstFindingForField,
} from './validate';
import { ALL_RULES } from './rules';
import {
  ALL_CONSTRAINTS,
  COPING_CAP_CONSTRAINTS,
  SELF_CROSSING_POINTS,
  VALID_COPING_CAP_ITEM,
  VALID_DRAWN_ITEM,
} from './fixtures';
import type { OrderValidatorItem, ValidationFinding } from './types';

const RULE_ORDER = ALL_RULES.map((rule) => rule.code);

describe('validateOrder: the finding shape', () => {
  it('returns every required key on every finding', () => {
    const { findings } = validateOrder({
      items: [{ ...VALID_COPING_CAP_ITEM, width: 2, legA: 0 }],
      constraints: ALL_CONSTRAINTS,
    });
    expect(findings.length, 'Expected at least one finding from a width of 2 in and a leg of 0.').toBeGreaterThan(0);
    for (const finding of findings) {
      expect(typeof finding.code, `A finding with no code cannot be referred to: ${JSON.stringify(finding)}`).toBe(
        'string'
      );
      expect(
        ['error', 'warn', 'info'],
        `Severity "${finding.severity}" is outside the declared vocabulary; a UI switching on it would render nothing.`
      ).toContain(finding.severity);
      expect(
        ['customer', 'admin'],
        `Audience "${finding.audience}" is outside the declared vocabulary; an unknown audience would be filtered out of both scopes and the finding would vanish.`
      ).toContain(finding.audience);
      expect(['deterministic', 'ai'], `Source "${finding.source}" is outside the declared vocabulary.`).toContain(
        finding.source
      );
      expect(
        typeof finding.field,
        `A finding with no field cannot decorate an input: ${JSON.stringify(finding)}`
      ).toBe('string');
      expect(
        Number.isInteger(finding.itemIndex) && finding.itemIndex >= 0,
        `itemIndex ${finding.itemIndex} is not a usable array index, so a UI would decorate the wrong row or none.`
      ).toBe(true);
      expect(
        finding.message.trim().length,
        `Finding ${finding.code} has an empty message. A finding nobody can read is a refusal with no reason.`
      ).toBeGreaterThan(0);
      expect(
        finding.message,
        `Finding ${finding.code} leaks its rule code into the message: "${finding.message}". Codes are for admins reading the panel, never inside the prose.`
      ).not.toContain(finding.code);
    }
  });
});

describe('validateOrder: determinism', () => {
  it('returns deeply equal results for two runs on the same input', () => {
    const input = {
      items: [
        { ...VALID_COPING_CAP_ITEM, width: 2 },
        { ...VALID_DRAWN_ITEM, points: SELF_CROSSING_POINTS },
      ],
      constraints: ALL_CONSTRAINTS,
    };
    const first = validateOrder(input);
    const second = validateOrder(input);
    expect(
      JSON.stringify(second),
      'The same drawing is validated three times on its way through this platform — live in the Quote Builder, on the server at Next, and again on the admin review screen. If those could disagree, the customer and the estimator would be told different things about the same piece of metal.'
    ).toBe(JSON.stringify(first));
  });

  it('does not mutate the items it was given', () => {
    const item: OrderValidatorItem = { ...VALID_COPING_CAP_ITEM, width: 2 };
    const before = JSON.stringify(item);
    validateOrder({ items: [item], constraints: ALL_CONSTRAINTS });
    expect(
      JSON.stringify(item),
      'Expected the input untouched. The Quote Builder passes the live form state in on every keystroke; mutating it would rewrite what the customer typed.'
    ).toBe(before);
  });

  it('does not mutate a frozen item array', () => {
    const items = Object.freeze([Object.freeze({ ...VALID_COPING_CAP_ITEM, width: 2 })]);
    expect(
      () => validateOrder({ items, constraints: ALL_CONSTRAINTS }),
      'Expected no throw on a frozen input: a pure engine has no reason to write to its arguments.'
    ).not.toThrow();
  });
});

describe('validateOrder: ordering', () => {
  it('sorts findings by item first, so one row\'s messages stay together', () => {
    const { findings } = validateOrder({
      items: [
        { ...VALID_COPING_CAP_ITEM, width: 2 },
        { ...VALID_COPING_CAP_ITEM, height: 1 },
        { ...VALID_COPING_CAP_ITEM, legA: 0 },
      ],
      constraints: ALL_CONSTRAINTS,
    });
    const indices = findings.map((f) => f.itemIndex);
    expect(
      indices,
      `Expected non-decreasing item indices; got ${JSON.stringify(indices)}. Interleaved rows would read as one jumbled list on a multi-item request.`
    ).toEqual([...indices].sort((a, b) => a - b));
  });

  it('sorts findings within one item by the engine\'s own rule order', () => {
    const { findings } = validateOrder({
      items: [
        {
          profileType: '',
          material: 'Galvanized Steel',
          gauge: '26 ga',
          width: 30,
          height: 6,
          legA: 3,
          legB: 3,
          lengthFt: 0,
          quantity: 0,
        },
      ],
      constraints: ALL_CONSTRAINTS,
    });
    const positions = findings.map((f) => RULE_ORDER.indexOf(f.code));
    expect(
      positions,
      `Expected non-decreasing rule positions; got ${JSON.stringify(positions)} for codes ${JSON.stringify(findings.map((f) => f.code))}. Which message a customer reads first is a decision recorded in ALL_RULES, not an accident of append order.`
    ).toEqual([...positions].sort((a, b) => a - b));
  });

  it('puts the structural problems before the range problems', () => {
    const { findings } = validateOrder({
      items: [{ ...VALID_COPING_CAP_ITEM, profileType: '', width: 2 }],
      constraints: ALL_CONSTRAINTS,
    });
    expect(
      findings[0].code,
      `Expected the missing profile type first; got ${findings[0].code}. There is no point telling someone their width is out of range before they have said what they are ordering.`
    ).toBe('OV_PROFILE_TYPE_MISSING');
  });
});

describe('validateOrder: counts and blocking', () => {
  it('counts each severity over every finding', () => {
    const result = validateOrder({
      items: [
        { ...VALID_COPING_CAP_ITEM, width: 2 },
        {
          profileType: 'Scupper',
          material: 'Galvanized Steel',
          gauge: '26 ga',
          width: 30,
          height: 12,
          legA: 4,
          legB: 4,
          lengthFt: 18,
          quantity: 1,
        },
      ],
      constraints: ALL_CONSTRAINTS,
    });
    const recounted = {
      error: result.findings.filter((f) => f.severity === 'error').length,
      warn: result.findings.filter((f) => f.severity === 'warn').length,
      info: result.findings.filter((f) => f.severity === 'info').length,
    };
    expect(
      result.counts,
      `Expected the counts to match the findings they summarise. Got counts ${JSON.stringify(result.counts)} against ${JSON.stringify(recounted)} — a drifting count puts the wrong number in a banner heading.`
    ).toEqual(recounted);
  });

  it('is not blocked and not blocked-for-customer when nothing is wrong', () => {
    const result = validateOrder({ items: [VALID_COPING_CAP_ITEM], constraints: ALL_CONSTRAINTS });
    expect(result.blocked, 'Expected a clean coping cap to pass.').toBe(false);
    expect(result.blockedForCustomer, 'Expected a clean coping cap to pass for the customer too.').toBe(false);
  });

  it('is blocked by a deterministic error', () => {
    const result = validateOrder({
      items: [{ ...VALID_COPING_CAP_ITEM, width: 2 }],
      constraints: ALL_CONSTRAINTS,
    });
    expect(result.blocked, 'A width below the real seeded minimum cannot be fabricated.').toBe(true);
    expect(result.blockedForCustomer, 'The customer can see and fix a width, so it blocks them too.').toBe(true);
  });

  it('is not blocked by warnings or information alone', () => {
    const result = validateOrder({
      items: [
        {
          // 24 in is exactly the seeded Scupper max_width, so nothing is out of
          // range — but it is also exactly the gauge-span threshold in 26 ga,
          // and a Scupper requires consultation. One warning, one note, no error.
          profileType: 'Scupper',
          material: 'Galvanized Steel',
          gauge: '26 ga',
          width: 24,
          height: 12,
          legA: 4,
          legB: 4,
          lengthFt: 2,
          quantity: 1,
        },
      ],
      constraints: ALL_CONSTRAINTS,
    });
    expect(
      result.findings.map((f) => f.code),
      `Expected exactly a gauge-span warning and a consultation note; got ${JSON.stringify(result.findings.map((f) => f.code))}.`
    ).toEqual(['OV_GAUGE_SPAN_LIGHT', 'OV_REQUIRES_CONSULTATION']);
    expect(result.counts.error, 'Expected no errors on this item.').toBe(0);
    expect(
      result.blocked,
      'A warning asks the customer to confirm, and an information note asks nothing. Neither may stop a quote request.'
    ).toBe(false);
  });

  it('separates "blocked" from "blocked for the customer" when the only error is admin-scope', () => {
    // No rule produces an admin-scope error today, and that is deliberate: an
    // error the customer cannot see is an error they cannot fix. This asserts
    // the SHAPE of the distinction so the day one is added, the Quote Builder
    // does not silently disable Next with no message on screen.
    const adminError: ValidationFinding = {
      code: 'OV_BLANK_WIDTH_ONE_STRIP',
      severity: 'error',
      field: 'blankWidth',
      message: 'Internal only.',
      itemIndex: 0,
      audience: 'admin',
      source: 'deterministic',
    };
    const customerVisible = findingsForAudience([adminError], 'customer');
    expect(
      customerVisible,
      'Expected an admin-scope error to be invisible to the customer. If one is ever added, the Quote Builder must not disable Next over a message it cannot show.'
    ).toEqual([]);
  });

  it('returns an empty, unblocked result for no items', () => {
    const result = validateOrder({ items: [], constraints: ALL_CONSTRAINTS });
    expect(result.findings, 'Expected no findings for no items.').toEqual([]);
    expect(result.counts, 'Expected zero counts for no items.').toEqual({ error: 0, warn: 0, info: 0 });
    expect(result.blocked, 'Nothing submitted is not something impossible.').toBe(false);
  });

  it('tolerates a missing constraints list without inventing ranges', () => {
    const result = validateOrder({ items: [VALID_COPING_CAP_ITEM] });
    expect(
      result.findings.map((f) => f.code),
      'Expected only the admin note that the range check did not run. A guest cannot read product_profiles (its RLS requires a session), so the live client-side pass legitimately has no constraints.'
    ).toEqual(['OV_PROFILE_CONSTRAINTS_UNKNOWN']);
    expect(result.blocked, 'Missing reference data must never block a submission.').toBe(false);
  });
});

describe('validateOrder: matching an item to its product_profiles row', () => {
  it('matches on the display name', () => {
    const result = validateOrder({ items: [{ ...VALID_COPING_CAP_ITEM, width: 2 }], constraints: ALL_CONSTRAINTS });
    expect(
      result.findings.map((f) => f.code),
      'Expected the range rule to fire, which it only can if "Coping Cap" matched the seeded row by name.'
    ).toContain('OV_DIMENSION_BELOW_MIN');
  });

  it('matches on the slug, for an admin-side caller holding one', () => {
    const result = validateOrder({
      items: [{ ...VALID_COPING_CAP_ITEM, profileType: 'coping-cap', width: 2 }],
      constraints: [COPING_CAP_CONSTRAINTS],
    });
    expect(
      result.findings.map((f) => f.code),
      'Expected the slug to match too: the Quote Builder sends display labels, but an admin-side caller may already hold the slug.'
    ).toContain('OV_DIMENSION_BELOW_MIN');
  });

  it('does not match a different profile that merely starts the same way', () => {
    const result = validateOrder({
      items: [{ ...VALID_COPING_CAP_ITEM, profileType: 'Coping Cap Cover', width: 2 }],
      constraints: [COPING_CAP_CONSTRAINTS],
    });
    expect(
      result.findings.map((f) => f.code),
      'Expected no range check and an admin note instead. Matching is exact on the normalised label, not a prefix or substring search — a wrong profile row means wrong dimension limits, which is worse than none.'
    ).toEqual(['OV_PROFILE_CONSTRAINTS_UNKNOWN']);
  });
});

describe('findingsForAudience', () => {
  const findings: ValidationFinding[] = [
    {
      code: 'OV_DIMENSION_BELOW_MIN',
      severity: 'error',
      field: 'width',
      message: 'Customer-facing.',
      itemIndex: 0,
      audience: 'customer',
      source: 'deterministic',
    },
    {
      code: 'OV_BLANK_WIDTH_ONE_STRIP',
      severity: 'info',
      field: 'blankWidth',
      message: 'Internal.',
      itemIndex: 0,
      audience: 'admin',
      source: 'deterministic',
    },
  ];

  it('gives an admin everything, so an estimator sees what the customer was told plus the detail', () => {
    expect(
      findingsForAudience(findings, 'admin'),
      'Admin scope is a SUPERSET of customer scope. An estimator who could not see the customer\'s own error message would be reading a different story from the one the customer got.'
    ).toEqual(findings);
  });

  it('gives a customer only the customer-scope findings', () => {
    expect(
      findingsForAudience(findings, 'customer').map((f) => f.code),
      'Expected the admin-scope note withheld.'
    ).toEqual(['OV_DIMENSION_BELOW_MIN']);
  });

  it('returns a copy, so a caller cannot sort the engine\'s array in place', () => {
    const forAdmin = findingsForAudience(findings, 'admin');
    forAdmin.reverse();
    expect(
      findings[0].code,
      'Expected the original array untouched after the caller reversed its copy; a shared array would let one surface reorder another\'s messages.'
    ).toBe('OV_DIMENSION_BELOW_MIN');
  });
});

describe('severity projections', () => {
  const result = validateOrder({
    items: [
      {
        profileType: 'Coping Cap',
        material: 'Galvanized Steel',
        gauge: '26 ga',
        width: 30,
        height: 1,
        legA: 3,
        legB: 3,
        lengthFt: 10,
        quantity: 1,
      },
    ],
    constraints: ALL_CONSTRAINTS,
  });

  it('separates blocking, acknowledgeable and informational findings', () => {
    expect(
      blockingFindings(result.findings).every((f) => f.severity === 'error'),
      'Expected only errors in the blocking set — anything else would disable Next over a message the customer is allowed to proceed past.'
    ).toBe(true);
    expect(
      acknowledgeableFindings(result.findings).every((f) => f.severity === 'warn'),
      'Expected only warnings in the acknowledgeable set; an error must never be dismissible with "Acknowledge and Continue".'
    ).toBe(true);
    expect(
      informationalFindings(result.findings).every((f) => f.severity === 'info'),
      'Expected only information in the informational set.'
    ).toBe(true);
  });

  it('finds a height below the seeded minimum and a light gauge over a wide span together', () => {
    expect(
      blockingFindings(result.findings).map((f) => f.code),
      'Expected a height of 1 in to be refused against the seeded Coping Cap min_height of 4 in.'
    ).toEqual(['OV_DIMENSION_BELOW_MIN']);
    expect(
      acknowledgeableFindings(result.findings).map((f) => f.code),
      'Expected 26 ga over a 30 in span to be the warning, reported in the same pass rather than after the error is fixed.'
    ).toEqual(['OV_GAUGE_SPAN_LIGHT']);
  });
});

describe('findingsForItem and worstFindingForField', () => {
  const result = validateOrder({
    items: [
      { ...VALID_COPING_CAP_ITEM, width: 2 },
      { ...VALID_COPING_CAP_ITEM, height: 1 },
    ],
    constraints: ALL_CONSTRAINTS,
  });

  it('returns only the findings for the item asked about', () => {
    expect(
      findingsForItem(result.findings, 1).every((f) => f.itemIndex === 1),
      'Expected only item 1. The Quote Builder decorates the inputs of the item being edited, and a leaked finding would put a red border on a field the customer did not touch.'
    ).toBe(true);
  });

  it('returns an empty list for an item index with nothing wrong', () => {
    const clean = validateOrder({ items: [VALID_COPING_CAP_ITEM], constraints: ALL_CONSTRAINTS });
    expect(findingsForItem(clean.findings, 0), 'Expected [] for a clean item.').toEqual([]);
  });

  it('returns null for a field with nothing against it', () => {
    expect(
      worstFindingForField(result.findings, 0, 'quantity'),
      'Expected null so the input renders with no border and no message.'
    ).toBeNull();
  });

  it('returns the most serious finding when a field has several', () => {
    const mixed: ValidationFinding[] = [
      {
        code: 'OV_GAUGE_SPAN_LIGHT',
        severity: 'warn',
        field: 'width',
        message: 'Warning.',
        itemIndex: 0,
        audience: 'customer',
        source: 'deterministic',
      },
      {
        code: 'OV_DIMENSION_BELOW_MIN',
        severity: 'error',
        field: 'width',
        message: 'Error.',
        itemIndex: 0,
        audience: 'customer',
        source: 'deterministic',
      },
    ];
    expect(
      worstFindingForField(mixed, 0, 'width')?.severity,
      'Expected the error, not the warning that happened to come first. An input showing only its warning while the engine blocks on its error is how a disabled Next button becomes unexplainable.'
    ).toBe('error');
  });
});

describe('withAdvisories: the AI layer can never block', () => {
  const blocked = validateOrder({
    items: [{ ...VALID_COPING_CAP_ITEM, width: 2 }],
    constraints: ALL_CONSTRAINTS,
  });
  const clean = validateOrder({ items: [VALID_COPING_CAP_ITEM], constraints: ALL_CONSTRAINTS });

  const advisoryClaimingError: ValidationFinding = {
    code: 'OV_AI_ADVISORY',
    severity: 'error',
    field: 'width',
    message: 'The model thinks this is impossible.',
    itemIndex: 0,
    audience: 'customer',
    source: 'ai',
  };

  it('returns the result unchanged when there are no advisories', () => {
    expect(
      withAdvisories(clean, []),
      'Expected the identical result object content. With the AI flag off this is the only path, and it must add nothing.'
    ).toEqual(clean);
  });

  it('clamps an advisory that claims to be an error down to a warning', () => {
    const merged = withAdvisories(clean, [advisoryClaimingError]);
    expect(
      merged.findings.map((f) => f.severity),
      'SPEC section 5 would have had AI errors block an advance. This build refuses that: model output is unverified, and refusing a fabricable order costs AFS the job.'
    ).toEqual(['warn']);
  });

  it('does not set blocked when a clean order gets an advisory claiming an error', () => {
    const merged = withAdvisories(clean, [advisoryClaimingError]);
    expect(
      merged.blocked,
      'Expected false. On a platform where the next button along reaches a physical Thalmann, a model does not get a veto.'
    ).toBe(false);
    expect(merged.blockedForCustomer, 'Expected false for the customer too.').toBe(false);
  });

  it('does not clear blocked when a blocked order gets advisories', () => {
    const merged = withAdvisories(blocked, [{ ...advisoryClaimingError, severity: 'info' }]);
    expect(
      merged.blocked,
      'Expected the deterministic refusal to survive. An advisory layer that could UNBLOCK would be just as dangerous as one that could block.'
    ).toBe(true);
  });

  it('keeps an advisory marked info as info', () => {
    const merged = withAdvisories(clean, [{ ...advisoryClaimingError, severity: 'info' }]);
    expect(
      merged.findings.map((f) => f.severity),
      'Expected info to stay info: the clamp lowers a severity, it does not raise one, so a note is not promoted into something the customer has to acknowledge.'
    ).toEqual(['info']);
  });

  it('forces the source to ai even if the advisory claims to be deterministic', () => {
    const merged = withAdvisories(clean, [
      { ...advisoryClaimingError, severity: 'warn', source: 'deterministic' },
    ]);
    expect(
      merged.findings[0].source,
      'Expected "ai". A finding that came from a model and claimed to be one of AFS\'s own rules would be the worst of both: unverified content with the authority of a rule.'
    ).toBe('ai');
  });

  it('recounts severities after merging', () => {
    const merged = withAdvisories(clean, [advisoryClaimingError]);
    expect(
      merged.counts,
      `Expected the warn count to include the clamped advisory; got ${JSON.stringify(merged.counts)}.`
    ).toEqual({ error: 0, warn: 1, info: 0 });
  });

  it('sorts the merged findings by the same rule, so the order stays stable', () => {
    const merged = withAdvisories(blocked, [{ ...advisoryClaimingError, severity: 'warn' }]);
    const indices = merged.findings.map((f) => f.itemIndex);
    expect(
      indices,
      `Expected non-decreasing item indices after the merge; got ${JSON.stringify(indices)}.`
    ).toEqual([...indices].sort((a, b) => a - b));
  });
});
