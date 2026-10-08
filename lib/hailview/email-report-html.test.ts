import { describe, expect, it } from 'vitest';
import { escapeHtml, singleLineForSubject } from '../email/escape-html';
import {
  MAX_NARRATIVE_LENGTH,
  MAX_PER_EVENT_COUNT,
  buildReportHtml,
  buildReportSubject,
  validateEmailReportBody,
  type EmailReportEvent,
} from './email-report-html';

// REGRESSION TESTS FOR A REAL HTML-INJECTION DEFECT (hv2-02).
//
// app/api/hailview/email-report is an UNAUTHENTICATED PUBLIC POST that sends
// an AFS-branded email, from AFS's verified sending domain, to a recipient
// the caller chooses. hv2-01 interpolated eleven caller-supplied strings into
// the body with no escaping at all, and validated `perEvent` only with
// `Array.isArray`.
//
// These tests assert the three things that must stay true: every string is
// escaped, every enum is checked at runtime rather than merely typed, and a
// malformed request is a 400 rather than a 500.

const XSS = '<script>alert(1)</script>';
const ATTR_BREAK = '" onload="alert(1)';

function validEvent(overrides: Partial<EmailReportEvent> = {}): Record<string, unknown> {
  return {
    convectiveDayUtc: '2026-05-10',
    estimatedSizeIn: 0.97,
    estimatedSizeLowIn: 0.82,
    estimatedSizeHighIn: 1.13,
    reportCount: 2,
    measuredCount: 2,
    estimatedCount: 0,
    interpolation: 'extrapolated',
    windowStatus: 'in_window',
    windowLabel: 'Within the typical 12-month claim window',
    ...overrides,
  };
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: 'someone@example.com',
    address: 'Burnet, Burnet County, Texas, 78611, United States',
    material: 'asphalt_shingle',
    score: 18,
    tier: 'Low',
    narrative: 'First paragraph.\n\nSecond paragraph.',
    probability: 0.185,
    low: 0.052,
    high: 0.363,
    evidenceGrade: 'B',
    evidenceGradeReason: 'This result rests on the 2026-05-10 storm.',
    modelVersion: 'v2.0-uncalibrated',
    claimWindowMonths: 12,
    cosmeticExclusion: false,
    sensitivityNote: 'A quarter-inch change moves the result from 5 to 36.',
    perEvent: [validEvent()],
    ...overrides,
  };
}

function render(overrides: Record<string, unknown> = {}): string {
  const v = validateEmailReportBody(validBody(overrides));
  if (!v.ok) throw new Error(`expected a valid body, got: ${v.error}`);
  return buildReportHtml(v.body);
}

describe('escapeHtml', () => {
  it('neutralises the four characters that break out of HTML text or an attribute', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    expect(escapeHtml(XSS)).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes the ampersand FIRST, so an escape is never double-escaped wrongly', () => {
    // If < were replaced before &, '<' would become '&lt;' and then '&amp;lt;'.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('singleLineForSubject', () => {
  it('collapses newlines and tabs, so a subject can never be multi-line', () => {
    expect(singleLineForSubject('a\r\nb\tc')).toBe('a b c');
    expect(singleLineForSubject('a\n\n\nb')).toBe('a b');
  });

  it('caps the length', () => {
    const out = singleLineForSubject('x'.repeat(500), 50);
    expect(out.length).toBe(50);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('the rendered report escapes EVERY caller-supplied string', () => {
  it('escapes the address', () => {
    const html = render({ address: XSS });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the narrative, including across its paragraph and line-break handling', () => {
    const html = render({ narrative: `${XSS}\n${ATTR_BREAK}\n\nsecond ${XSS}` });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onload="alert(1)"');
    // The <br/> substitution still happens — on the ESCAPED text.
    expect(html).toContain('<br/>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the evidence reason, the sensitivity note and the model version', () => {
    const html = render({
      evidenceGradeReason: XSS,
      sensitivityNote: XSS,
      modelVersion: '<i>v9</i>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<i>v9</i>');
    expect(html).toContain('&lt;i&gt;v9&lt;/i&gt;');
  });

  it('escapes every per-event string field', () => {
    const html = render({
      perEvent: [validEvent({ convectiveDayUtc: XSS, windowLabel: ATTR_BREAK })],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // The payload's text survives as TEXT — what matters is that its
    // double quote is escaped, so it cannot close the surrounding
    // attribute and start a new one. Asserting the absence of the
    // substring "onload=" would be wrong: it legitimately appears inside
    // the escaped `&quot; onload=`, where it is inert.
    expect(html).not.toContain('" onload=');
    expect(html).toContain('&quot; onload=');
  });

  it('leaves no raw tag or attribute break from ANY untrusted field', () => {
    const payload = `${XSS}${ATTR_BREAK}`;
    const html = render({
      address: payload,
      narrative: payload,
      evidenceGradeReason: payload,
      sensitivityNote: payload,
      modelVersion: '<i>v9</i>',
      perEvent: [validEvent({ convectiveDayUtc: payload, windowLabel: payload })],
    });
    // No raw double quote from the payload survives, so no attribute can be
    // closed and no new one opened.
    expect(html).not.toContain('" onload=');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<\/script/i);
  });

  it('keeps the subject on one line even when the address contains newlines', () => {
    const v = validateEmailReportBody(validBody({ address: 'Line one\r\nBcc: victim@example.com' }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const subject = buildReportSubject(v.body);
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe('enums are checked AT RUNTIME, not merely typed', () => {
  it('rejects an unknown material instead of echoing it into the email', () => {
    // hv2-01 typed this as MaterialCategory and then rendered
    // `MATERIAL_LABELS[material] ?? material` — so any string reached the HTML.
    const v = validateEmailReportBody(validBody({ material: XSS }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/Material must be one of/);
  });

  it('rejects an unknown tier', () => {
    const v = validateEmailReportBody(validBody({ tier: XSS }));
    expect(v.ok).toBe(false);
  });

  it('rejects an unknown evidence grade', () => {
    expect(validateEmailReportBody(validBody({ evidenceGrade: 'Z' })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ evidenceGrade: XSS })).ok).toBe(false);
  });

  it('rejects an unknown interpolation or window status on a per-event row', () => {
    expect(validateEmailReportBody(validBody({ perEvent: [validEvent({ interpolation: 'magic' as never })] })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ perEvent: [validEvent({ windowStatus: 'maybe' as never })] })).ok).toBe(false);
  });

  it('accepts every legitimate enum value', () => {
    for (const material of ['asphalt_shingle', 'metal_r_panel', 'metal_standing_seam', 'tpo_pvc_membrane', 'wood_shake']) {
      expect(validateEmailReportBody(validBody({ material })).ok, material).toBe(true);
    }
    for (const tier of ['Low', 'Moderate', 'High']) {
      expect(validateEmailReportBody(validBody({ tier })).ok, tier).toBe(true);
    }
    for (const evidenceGrade of ['A', 'B', 'C', 'D']) {
      expect(validateEmailReportBody(validBody({ evidenceGrade })).ok, evidenceGrade).toBe(true);
    }
  });
});

describe('a malformed request is a 400, never a 500', () => {
  it('rejects a per-event row whose numbers are not numbers', () => {
    // hv2-01 called .toFixed() on these without checking, so a string threw.
    const v = validateEmailReportBody(
      validBody({ perEvent: [validEvent({ estimatedSizeIn: 'big' as never })] })
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/invalid storm entry/);
  });

  it('rejects a per-event row that is not an object at all', () => {
    for (const bad of [null, 'x', 42, []]) {
      expect(validateEmailReportBody(validBody({ perEvent: [bad] })).ok).toBe(false);
    }
  });

  it('rejects NaN and Infinity, which are numbers but not values', () => {
    expect(validateEmailReportBody(validBody({ score: Number.NaN })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ probability: Number.POSITIVE_INFINITY })).ok).toBe(false);
    expect(
      validateEmailReportBody(validBody({ perEvent: [validEvent({ reportCount: Number.NaN })] })).ok
    ).toBe(false);
  });

  it('rejects an out-of-range score or probability', () => {
    expect(validateEmailReportBody(validBody({ score: -1 })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ score: 101 })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ probability: 1.5 })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ low: -0.1 })).ok).toBe(false);
  });

  it('rejects a non-object, a missing field and a bad email', () => {
    expect(validateEmailReportBody(null).ok).toBe(false);
    expect(validateEmailReportBody('x').ok).toBe(false);
    expect(validateEmailReportBody({}).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ email: 'not-an-email' })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ email: `${'a'.repeat(300)}@example.com` })).ok).toBe(false);
  });
});

describe('free text is length-capped and perEvent is count-capped', () => {
  it('caps the narrative', () => {
    expect(validateEmailReportBody(validBody({ narrative: 'x'.repeat(MAX_NARRATIVE_LENGTH) })).ok).toBe(true);
    expect(validateEmailReportBody(validBody({ narrative: 'x'.repeat(MAX_NARRATIVE_LENGTH + 1) })).ok).toBe(false);
  });

  it('caps the address, the reason, the note and the model version', () => {
    expect(validateEmailReportBody(validBody({ address: 'x'.repeat(301) })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ evidenceGradeReason: 'x'.repeat(1001) })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ sensitivityNote: 'x'.repeat(1001) })).ok).toBe(false);
    expect(validateEmailReportBody(validBody({ modelVersion: 'x'.repeat(41) })).ok).toBe(false);
  });

  it('caps the number of storms', () => {
    const many = (n: number) => Array.from({ length: n }, () => validEvent());
    expect(validateEmailReportBody(validBody({ perEvent: many(MAX_PER_EVENT_COUNT) })).ok).toBe(true);
    expect(validateEmailReportBody(validBody({ perEvent: many(MAX_PER_EVENT_COUNT + 1) })).ok).toBe(false);
  });

  it('caps a per-event label', () => {
    expect(
      validateEmailReportBody(validBody({ perEvent: [validEvent({ windowLabel: 'x'.repeat(201) })] })).ok
    ).toBe(false);
  });
});

describe('the V2 fields stay optional, so an older client still works', () => {
  it('accepts a body carrying only the pre-V2 fields', () => {
    const v = validateEmailReportBody({
      email: 'someone@example.com',
      address: 'Burnet, TX',
      material: 'asphalt_shingle',
      score: 42,
      tier: 'Moderate',
      narrative: 'Some prose.',
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const html = buildReportHtml(v.body);
    // Falls back to the legacy score line and omits every V2 block.
    expect(html).toContain('42/100');
    expect(html).not.toContain('Storms considered');
    expect(html).not.toContain('Uncalibrated model');
    expect(html).not.toContain('Evidence grade');
  });

  it('renders the honest empty state when perEvent is present but empty', () => {
    const html = render({ perEvent: [] });
    expect(html).toContain('Storms considered');
    expect(html).toMatch(/weak evidence of no hail rather than proof of it/);
  });
});

describe('the report still says what it is meant to say', () => {
  it('states what the number means, the range, and the uncalibrated disclosure', () => {
    const html = render();
    expect(html).toContain('Chance an insurer pays for a full roof replacement');
    expect(html).toContain('19%');
    expect(html).toContain('range 5%');
    expect(html).toContain('Uncalibrated model');
    expect(html).toContain('v2.0-uncalibrated');
  });

  it('words per-storm sizes as ESTIMATED at the address, never confirmed', () => {
    const html = render();
    expect(html).toContain('estimated at your address');
    expect(html).not.toMatch(/confirmed/i);
  });

  it('lists an out-of-window storm with its label rather than dropping it', () => {
    const html = render({
      perEvent: [
        validEvent({
          convectiveDayUtc: '2023-05-05',
          windowStatus: 'outside_window',
          windowLabel: 'Outside typical claim window (about 41 months ago)',
        }),
      ],
    });
    expect(html).toContain('2023-05-05');
    expect(html).toContain('Outside typical claim window');
  });
});
