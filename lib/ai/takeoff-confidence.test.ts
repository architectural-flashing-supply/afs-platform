import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  UNSURE_FOOTNOTE,
  buildAiReadRows,
  hasUnsureRows,
  isTakeoffConfidence,
  isUnsure,
} from './takeoff-confidence';

describe('the unsure threshold is the prototype rule, in ONE place', () => {
  it('treats anything the AI qualified as unsure, not only "low"', () => {
    expect(isUnsure('high')).toBe(false);
    expect(isUnsure('medium')).toBe(true);
    expect(isUnsure('low')).toBe(true);
  });
  it('treats a missing or unrecognised confidence as unsure, never as confident', () => {
    expect(isUnsure(undefined)).toBe(true);
    expect(isUnsure(null)).toBe(true);
    expect(isUnsure('very sure')).toBe(true);
    expect(isTakeoffConfidence('very sure')).toBe(false);
  });
});

describe('"What the AI read" rows', () => {
  const item = {
    profileType: 'Coping Cap',
    material: 'Galvalume',
    gauge: '24 ga',
    width: 12,
    height: 4,
    legA: 3,
    legB: null,
    lengthFt: 10,
    quantity: 40,
    unit: 'EA',
    confidence: 'high',
    aiNote: 'North parapet, sheet A3.1 detail 5',
  };

  it('reads every field the AI actually gave, in a fixed order', () => {
    const rows = buildAiReadRows([item]);
    expect(rows.map((r) => r.term)).toEqual([
      'Profile',
      'Material',
      'Gauge',
      'Dimensions',
      'Length',
      'Quantity',
    ]);
    expect(rows[3].value).toBe('W 12 in, H 4 in, Leg A 3 in');
    expect(rows[5].value).toBe('40 EA');
  });

  it('OMITS a field the AI did not read, rather than printing "null"', () => {
    const rows = buildAiReadRows([{ profileType: 'Drip Edge', confidence: 'high' }]);
    expect(rows.map((r) => r.term)).toEqual(['Profile']);
    expect(rows.every((r) => r.value !== 'null' && r.value !== '')).toBe(true);
  });

  it('highlights every row of an item the AI was unsure about, and carries its note', () => {
    const rows = buildAiReadRows([{ ...item, confidence: 'medium', aiNote: 'gauge not stated' }]);
    expect(rows.every((r) => r.unsure)).toBe(true);
    expect(rows.every((r) => r.note === 'gauge not stated')).toBe(true);
    expect(hasUnsureRows(rows)).toBe(true);
  });

  it('does not highlight a confident read', () => {
    const rows = buildAiReadRows([item]);
    expect(rows.every((r) => !r.unsure)).toBe(true);
    expect(hasUnsureRows(rows)).toBe(false);
  });

  it('labels each item when there is more than one', () => {
    const rows = buildAiReadRows([
      { profileType: 'Coping Cap', confidence: 'high' },
      { profileType: 'Drip Edge', confidence: 'low' },
    ]);
    expect(rows.map((r) => r.term)).toEqual(['Item 1: Profile', 'Item 2: Profile']);
    expect(rows[0].unsure).toBe(false);
    expect(rows[1].unsure).toBe(true);
  });

  it('says the same sentence the prototype says', () => {
    expect(UNSURE_FOOTNOTE).toBe(
      'Highlighted items are ones the AI is less sure about. Check them before sending.'
    );
  });
});

describe('THERE IS ONLY ONE CONFIDENCE PATTERN', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('the takeoff route — which PRODUCES the confidence — imports this module', () => {
    // The prompt's instruction was to reuse app/api/takeoff's confidence
    // pattern rather than invent a second one. The only way to guarantee that
    // over time is for the producer and the consumer to share the definition,
    // so this asserts the producer really does import it.
    expect(read('app/api/takeoff/route.ts')).toContain("from '@/lib/ai/takeoff-confidence'");
  });

  it('the Job screen — which CONSUMES it — imports this module too', () => {
    expect(read('lib/data/job-screen.ts')).toContain("from '@/lib/ai/takeoff-confidence'");
  });

  it('no second literal confidence union has been reintroduced', () => {
    // A local `type X = 'high' | 'medium' | 'low'` anywhere is the exact drift
    // this module exists to prevent.
    for (const file of ['app/upload/page.tsx', 'lib/data/job-screen.ts', 'app/api/takeoff/route.ts']) {
      expect(read(file)).not.toMatch(/=\s*'high'\s*\|\s*'medium'\s*\|\s*'low'/);
    }
  });
});
