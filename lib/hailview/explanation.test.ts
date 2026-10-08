import { describe, expect, it } from 'vitest';
import { parseExplanationResponse } from './explanation';

// The agent is ADVISORY. These tests pin the two things that matter about
// its output: the flags are strictly validated (an invented kind or
// severity is dropped, never coerced), and nothing the model returns can
// carry a number back into the result.

describe('parseExplanationResponse — narrative', () => {
  it('extracts the narrative and leaves the flag block out of it', () => {
    const { narrative } = parseExplanationResponse(
      `<narrative>
First paragraph.

Second paragraph.
</narrative>
<audit_flags>
thin_coverage|caution|Only one nearby report.
</audit_flags>`
    );
    expect(narrative).toBe('First paragraph.\n\nSecond paragraph.');
    expect(narrative).not.toMatch(/audit_flags|thin_coverage/);
  });

  it('falls back to the whole response when the model ignores the format, rather than losing the prose', () => {
    const { narrative, auditFlags } = parseExplanationResponse('Just some prose with no tags at all.');
    expect(narrative).toBe('Just some prose with no tags at all.');
    expect(auditFlags).toEqual([]);
  });

  it('returns an empty narrative for an empty response', () => {
    expect(parseExplanationResponse('').narrative).toBe('');
  });
});

describe('parseExplanationResponse — audit flags are strictly validated', () => {
  it('accepts every documented kind and severity', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
source_conflict|caution|Two reports of the same storm differ by 2 inches.
data_gap|info|No reports between 2024 and 2025.
thin_coverage|caution|The estimate rests on one report.
outlier|info|One 4 inch report sits well above its neighbours.
</audit_flags>`
    );
    expect(auditFlags).toHaveLength(4);
    expect(auditFlags.map((f) => f.kind)).toEqual([
      'source_conflict',
      'data_gap',
      'thin_coverage',
      'outlier',
    ]);
    expect(auditFlags[0].message).toBe('Two reports of the same storm differ by 2 inches.');
  });

  it('DROPS an invented kind rather than coercing it', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
score_too_low|caution|The probability should really be higher.
thin_coverage|info|Only two reports.
</audit_flags>`
    );
    expect(auditFlags).toHaveLength(1);
    expect(auditFlags[0].kind).toBe('thin_coverage');
  });

  it('DROPS an invented severity rather than coercing it', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
outlier|critical|Escalate this immediately.
outlier|info|Fine.
</audit_flags>`
    );
    expect(auditFlags).toHaveLength(1);
    expect(auditFlags[0].severity).toBe('info');
  });

  it('drops malformed and empty-message lines', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
outlier|info
outlier|info|
just some text
|||
</audit_flags>`
    );
    expect(auditFlags).toEqual([]);
  });

  it('treats NONE as no flags', () => {
    expect(
      parseExplanationResponse('<narrative>x</narrative>\n<audit_flags>\nNONE\n</audit_flags>').auditFlags
    ).toEqual([]);
  });

  it('tolerates the model bulleting the list', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
- thin_coverage|caution|One report only.
</audit_flags>`
    );
    expect(auditFlags).toHaveLength(1);
  });

  it('keeps pipes inside the message intact', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
data_gap|info|Gap between A|B and C.
</audit_flags>`
    );
    expect(auditFlags[0].message).toBe('Gap between A|B and C.');
  });

  it('cannot return a numeric field — the shape has none', () => {
    const { auditFlags } = parseExplanationResponse(
      `<narrative>x</narrative>
<audit_flags>
outlier|info|Something.
</audit_flags>`
    );
    // The flag type is {kind, severity, message} and nothing else. If a
    // future change adds a numeric field here, this fails — which is the
    // point: SPEC_HAILVIEW.md §6 requires that the agent's response type
    // not even HAVE a numeric field available to accidentally wire up.
    expect(Object.keys(auditFlags[0]).sort()).toEqual(['kind', 'message', 'severity']);
    for (const value of Object.values(auditFlags[0])) {
      expect(typeof value).toBe('string');
    }
  });
});
