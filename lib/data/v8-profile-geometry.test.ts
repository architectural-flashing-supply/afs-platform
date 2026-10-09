import { describe, it, expect } from 'vitest';
import { parseSavedProfileRow, UUID_RE } from './v8-profile-geometry';

/**
 * WHAT COUNTS AS A SAVED DRAWING — and, more to the point, what does not.
 *
 * `saved_configurations.dimensions` is JSONB a browser wrote. The V8 viewer
 * draws from it directly, so this parser stands between a client-written blob
 * and a canvas routine that will happily draw whatever it is handed.
 *
 * THE RULE THESE TESTS ENFORCE IS ONE SENTENCE: real geometry, or an explicit
 * absence with a reason. Never a repaired guess. A profile with one unreadable
 * point rendered as a polyline missing a leg is more dangerous than no drawing
 * at all, because it looks like an instruction — and the next button along on
 * these screens reaches a physical bending machine (CLAUDE.md rule #14).
 *
 * The same stance appears three other places in this codebase and these tests
 * are the fourth: `lib/flashdraft/job-handoff.ts` refuses to rebuild points
 * from `legA`/`legB`; `V7Thumb` renders an empty box rather than a shape; and
 * `lib/hailview/v2`'s agent flags drop an unrecognised kind rather than coerce
 * it (rule #35).
 */

const OK_POINTS = [
  { x: -3, y: 2 },
  { x: -3, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 2 },
];

const ID = '11111111-2222-4333-8444-555555555555';

function row(dimensions: unknown, name: unknown = 'Coping Cap') {
  return { name, dimensions };
}

describe('parseSavedProfileRow — real geometry', () => {
  it('reads points, both hems, the radius list, and the counts', () => {
    const r = parseSavedProfileRow(
      ID,
      row({
        kind: 'flashdraft',
        points: OK_POINTS,
        hemStart: { type: 'open', lengthIn: 0.5, gapIn: 0.1875, kick: 'outside' },
        hemEnd: { type: 'teardrop', lengthIn: 0.375, gapIn: 0.0625, kick: 'inside' },
        bendRadiiIn: [0.5, 0.5],
        material: 'Galvalume',
        gauge: '24 ga',
      }),
    );
    expect(r.kind).toBe('geometry');
    if (r.kind !== 'geometry') return;
    expect(r.geometry.points).toHaveLength(4);
    expect(r.geometry.hemStart?.type).toBe('open');
    expect(r.geometry.hemEnd?.type).toBe('teardrop');
    expect(r.geometry.bendRadiiIn).toEqual([0.5, 0.5]);
    expect(r.material).toBe('Galvalume');
    expect(r.gauge).toBe('24 ga');
    expect(r.name).toBe('Coping Cap');
    // Bends are the INTERIOR vertices; a 4-point profile has 2.
    expect(r.bendCount).toBe(2);
    expect(r.hemCount).toBe(2);
  });

  it('keeps a point\'s own stored bend radius and drops a non-positive one', () => {
    const r = parseSavedProfileRow(
      ID,
      row({ points: [{ x: 0, y: 0 }, { x: 1, y: 0, radius: 0.75 }, { x: 2, y: 0, radius: 0 }] }),
    );
    expect(r.kind).toBe('geometry');
    if (r.kind !== 'geometry') return;
    expect(r.geometry.points[1].radius).toBe(0.75);
    // A stored 0 is not a radius, it is a missing one — leaving it would make a
    // bend sharp where the material default says it is not.
    expect(r.geometry.points[2].radius).toBeUndefined();
  });

  it('a two-point profile is a profile; its bend count is zero', () => {
    const r = parseSavedProfileRow(ID, row({ points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] }));
    expect(r.kind).toBe('geometry');
    if (r.kind !== 'geometry') return;
    expect(r.bendCount).toBe(0);
  });
});

describe('parseSavedProfileRow — explicit absence, never a guess', () => {
  const absent = (dimensions: unknown) => parseSavedProfileRow(ID, row(dimensions));

  it('no row at all', () => {
    const r = parseSavedProfileRow(ID, null);
    expect(r.kind).toBe('none');
    if (r.kind !== 'none') return;
    expect(r.reason).toMatch(/not in the Passport/i);
  });

  it('no dimensions, no points, or a non-array points', () => {
    for (const dims of [null, {}, { points: null }, { points: 'nope' }, { points: {} }]) {
      expect(absent(dims).kind).toBe('none');
    }
  });

  it('a single point is not a profile — there is no segment to draw', () => {
    expect(absent({ points: [{ x: 1, y: 1 }] }).kind).toBe('none');
    expect(absent({ points: [] }).kind).toBe('none');
  });

  it('ONE unreadable point voids the whole drawing rather than being skipped', () => {
    // A skipped point is a leg that silently vanishes: the remaining polyline is
    // a different, plausible-looking shape. Four good points and one bad one is
    // not "a four-point profile", it is a drawing nobody can vouch for.
    for (const bad of [
      { x: 'a', y: 0 },
      { x: 0 },
      { y: 0 },
      { x: 0, y: Number.NaN },
      { x: Number.POSITIVE_INFINITY, y: 0 },
      null,
      'point',
      42,
    ]) {
      const r = absent({ points: [...OK_POINTS, bad] });
      expect(r.kind, `a ${JSON.stringify(bad)} point must void the drawing`).toBe('none');
      if (r.kind !== 'none') continue;
      expect(r.reason).toMatch(/could not be read/i);
    }
  });
});

describe('parseSavedProfileRow — a hem is all-or-nothing', () => {
  const hemOf = (hemStart: unknown) => {
    const r = parseSavedProfileRow(ID, row({ points: OK_POINTS, hemStart }));
    return r.kind === 'geometry' ? r.geometry.hemStart : undefined;
  };

  it('accepts each real hem type and each kick', () => {
    for (const type of ['open', 'smashed', 'teardrop']) {
      for (const kick of ['inside', 'outside']) {
        expect(hemOf({ type, kick, lengthIn: 0.5, gapIn: 0.125 })?.type).toBe(type);
        expect(hemOf({ type, kick, lengthIn: 0.5, gapIn: 0.125 })?.kick).toBe(kick);
      }
    }
  });

  it('drops the hem entirely rather than defaulting an unknown type or kick', () => {
    // A hem's type is HOW IT IS FORMED and its kick is WHICH WAY IT FOLDS.
    // Defaulting either draws a fold the customer did not ask for — worse than
    // drawing no hem, because a drawn fold reads as a confirmed instruction.
    expect(hemOf({ type: 'rolled', kick: 'inside', lengthIn: 0.5, gapIn: 0.1 })).toBeNull();
    expect(hemOf({ type: 'OPEN', kick: 'inside', lengthIn: 0.5, gapIn: 0.1 })).toBeNull();
    expect(hemOf({ type: 'open', kick: 'left', lengthIn: 0.5, gapIn: 0.1 })).toBeNull();
    expect(hemOf({ type: 'open', lengthIn: 0.5, gapIn: 0.1 })).toBeNull();
  });

  it('drops the hem when its fold length is missing, zero or not a number', () => {
    for (const lengthIn of [undefined, 0, -1, '0.5', Number.NaN]) {
      expect(hemOf({ type: 'open', kick: 'inside', lengthIn, gapIn: 0.1 })).toBeNull();
    }
  });

  it('a zero gap is legitimate (a flush smashed hem); a negative one is not', () => {
    expect(hemOf({ type: 'smashed', kick: 'inside', lengthIn: 0.5, gapIn: 0 })?.gapIn).toBe(0);
    expect(hemOf({ type: 'smashed', kick: 'inside', lengthIn: 0.5, gapIn: -0.1 })).toBeNull();
  });

  it('a dropped hem lowers the hem count, so the count never over-reports', () => {
    const r = parseSavedProfileRow(
      ID,
      row({
        points: OK_POINTS,
        hemStart: { type: 'open', lengthIn: 0.5, gapIn: 0.1875, kick: 'outside' },
        hemEnd: { type: 'rolled', lengthIn: 0.5, gapIn: 0.1875, kick: 'outside' },
      }),
    );
    expect(r.kind).toBe('geometry');
    if (r.kind !== 'geometry') return;
    expect(r.hemCount).toBe(1);
  });
});

describe('parseSavedProfileRow — the bend radius list', () => {
  const radiiOf = (bendRadiiIn: unknown) => {
    const r = parseSavedProfileRow(ID, row({ points: OK_POINTS, bendRadiiIn }));
    return r.kind === 'geometry' ? r.geometry.bendRadiiIn : undefined;
  };

  it('accepts a list of positive numbers', () => {
    expect(radiiOf([0.5, 0.75])).toEqual([0.5, 0.75]);
  });

  it('rejects the whole list on any bad entry, rather than part of it', () => {
    // A partially-read radius list would silently shift every later bend's
    // radius by one position, which is a wrong radius on the right bend.
    for (const list of [[0.5, 'x'], [0.5, 0], [0.5, -1], [0.5, null], ['0.5']]) {
      expect(radiiOf(list)).toBeNull();
    }
  });

  it('an absent or empty list is null, not an empty array', () => {
    expect(radiiOf(undefined)).toBeNull();
    expect(radiiOf([])).toBeNull();
    expect(radiiOf('0.5,0.75')).toBeNull();
  });
});

describe('UUID_RE', () => {
  it('accepts a real uuid and refuses anything that is not one', () => {
    expect(UUID_RE.test(ID)).toBe(true);
    // The previous route in this codebase used /^[0-9a-f-]{36}$/i, which
    // accepts 36 hyphens. Tightened here.
    expect(UUID_RE.test('------------------------------------')).toBe(false);
    expect(UUID_RE.test('11111111-2222-4333-8444-55555555555')).toBe(false);
    expect(UUID_RE.test(`${ID} or 1=1`)).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
  });
});

describe('material and gauge come from the saved blob first', () => {
  it('prefers the blob, falls back to the row\'s own labels, then to empty', () => {
    const fromBlob = parseSavedProfileRow(ID, {
      name: 'x',
      dimensions: { points: OK_POINTS, material: 'Copper', gauge: '18 ga' },
      material_label: 'Aluminum',
      gauge_label: '0.040',
    });
    expect(fromBlob.kind === 'geometry' && fromBlob.material).toBe('Copper');

    const fromRow = parseSavedProfileRow(ID, {
      name: 'x',
      dimensions: { points: OK_POINTS },
      material_label: 'Aluminum',
      gauge_label: '0.040',
    });
    expect(fromRow.kind === 'geometry' && fromRow.material).toBe('Aluminum');
    expect(fromRow.kind === 'geometry' && fromRow.gauge).toBe('0.040');

    // Neither. Empty strings, which the renderer treats as "no gauge selected"
    // — the same fallback FlashDraft itself applies. Not a made-up gauge: a
    // guessed thickness changes the teardrop glyph's size and the bend-radius
    // warning threshold.
    const neither = parseSavedProfileRow(ID, row({ points: OK_POINTS }));
    expect(neither.kind === 'geometry' && neither.material).toBe('');
    expect(neither.kind === 'geometry' && neither.gauge).toBe('');
  });

  it('a blank name is null rather than an empty heading', () => {
    const r = parseSavedProfileRow(ID, row({ points: OK_POINTS }, '   '));
    expect(r.kind === 'geometry' && r.name).toBeNull();
  });
});
