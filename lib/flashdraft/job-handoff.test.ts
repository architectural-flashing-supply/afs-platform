import { describe, expect, it } from 'vitest';
import {
  flashDraftButtonHint,
  flashDraftButtonLabel,
  flashDraftJobHref,
  handoffCorrectionFromItem,
  handoffGeometryFromItem,
  isHandoffHem,
  isHandoffPointArray,
  isTraceableImageType,
  jobHandoffApiPath,
  JOB_HANDOFF_ITEM_PARAM,
  JOB_HANDOFF_PARAM,
} from './job-handoff';

/**
 * THE HANDOFF CONTRACT, asserted rather than described.
 *
 * Three of these tests exist because the thing they check was WRONG in this
 * feature's own first draft, found against the live database rather than
 * reasoned about:
 *
 *   - `takeoff_uploads.file_type` holds a FILE EXTENSION, never a MIME type,
 *     so the obvious `image/` prefix test matched nothing and demoted every
 *     field-app job to "no image" — the exact case the feature is for.
 *   - A quote-builder line item carries `legA`/`legB`/`width`/`height` and no
 *     points. Promoting those to geometry would invent a shape nobody drew.
 *   - A field-app request's `line_items` is an explicit `[]`, so every helper
 *     here has to survive being handed nothing at all.
 */

const REQUEST_ID = 'dead4b5a-f491-47a6-839e-42143e980319';

const FLASHDRAFT_ITEM = {
  unit: 'LF',
  gauge: '20 ga',
  material: 'Stainless Steel',
  quantity: 1,
  lengthFt: 10.13,
  profileName: 'Coping run B',
  profileType: 'Custom FlashDraft Profile',
  points: [
    { x: -18.775, y: -9.5 },
    { x: -12.625, y: 4.5 },
    { x: 7.625, y: 4.5 },
  ],
  hemStart: { kick: 'outside', type: 'open', gapIn: 1.125, lengthIn: 1.625 },
  hemEnd: { kick: 'outside', type: 'open', gapIn: 0.8125, lengthIn: 1.6875 },
  bendRadiiIn: [0.5],
};

/** Exactly the shape the live database holds for an afs-quote-builder row. */
const QUOTE_BUILDER_ITEM = {
  legA: 3,
  legB: 2,
  unit: 'LF',
  gauge: '26 ga',
  width: 12,
  height: 4,
  lengthFt: 10,
  material: 'Galvanized Steel',
  quantity: 1,
  profileType: 'Coping Cap',
};

describe('the link', () => {
  it('points at FlashDraft with the request id and the admin flag', () => {
    const href = flashDraftJobHref(REQUEST_ID);
    expect(href).toContain('/studio/draft');
    expect(href).toContain(`${JOB_HANDOFF_PARAM}=${REQUEST_ID}`);
    expect(href).toContain('admin=1');
  });

  it('omits the item parameter for the first line and carries it otherwise', () => {
    expect(flashDraftJobHref(REQUEST_ID, 0)).not.toContain(JOB_HANDOFF_ITEM_PARAM);
    expect(flashDraftJobHref(REQUEST_ID, 2)).toContain(`${JOB_HANDOFF_ITEM_PARAM}=2`);
  });

  it('escapes the id rather than interpolating it raw', () => {
    expect(flashDraftJobHref('a b&c=d')).toContain('a%20b%26c%3Dd');
    expect(jobHandoffApiPath('a b&c=d')).toContain('a%20b%26c%3Dd');
  });
});

describe('geometry is read, never inferred', () => {
  it('reads real drawn points, hems and radii off a FlashDraft line item', () => {
    const g = handoffGeometryFromItem(FLASHDRAFT_ITEM);
    expect(g).not.toBeNull();
    expect(g!.points).toHaveLength(3);
    expect(g!.hemStart?.lengthIn).toBe(1.625);
    expect(g!.hemEnd?.kick).toBe('outside');
    expect(g!.bendRadiiIn).toEqual([0.5]);
  });

  it('REFUSES to build geometry from a quote-builder item', () => {
    // legA/legB/width/height describe a catalogue profile by name. The bend
    // count, the angles, the hems and the handedness are all absent, and
    // CLAUDE.md rule #12 is that the signed interior angle IS the bend.
    expect(handoffGeometryFromItem(QUOTE_BUILDER_ITEM)).toBeNull();
  });

  it('survives a field-app request, which has no line items at all', () => {
    expect(handoffGeometryFromItem(undefined)).toBeNull();
    expect(handoffGeometryFromItem(null)).toBeNull();
    expect(handoffGeometryFromItem({})).toBeNull();
  });

  it('rejects a malformed point array rather than drawing from it', () => {
    expect(isHandoffPointArray([{ x: 0, y: 0 }])).toBe(false); // one point is not a profile
    expect(isHandoffPointArray([{ x: 0, y: 0 }, { x: 1 }])).toBe(false);
    expect(isHandoffPointArray([{ x: 0, y: 0 }, { x: NaN, y: 2 }])).toBe(false);
    expect(isHandoffPointArray([{ x: 0, y: 0 }, { x: '3', y: 2 }])).toBe(false);
    expect(isHandoffPointArray([{ x: 0, y: 0 }, { x: 3, y: 2 }])).toBe(true);
  });

  it('drops a hem that is missing its measurements instead of defaulting them', () => {
    expect(isHandoffHem({ type: 'open', lengthIn: 1, gapIn: 0.25, kick: 'outside' })).toBe(true);
    expect(isHandoffHem({ type: 'open' })).toBe(false);
    expect(isHandoffHem(null)).toBe(false);
    // A hem whose numbers did not survive is read as NO hem, never as a
    // zero-length one — a zero is a measurement, and a made-up one.
    expect(handoffGeometryFromItem({ ...FLASHDRAFT_ITEM, hemEnd: { type: 'open' } })!.hemEnd).toBeNull();
  });
});

describe('what a browser can actually put behind the canvas', () => {
  it('accepts the EXTENSIONS the upload routes really store', () => {
    // app/api/field/photo-upload and app/api/upload both write the extension
    // into file_type. This is the bug the feature shipped with and is why the
    // assertion names the real values.
    expect(isTraceableImageType('.jpg')).toBe(true);
    expect(isTraceableImageType('.jpeg')).toBe(true);
    expect(isTraceableImageType('.PNG')).toBe(true);
    expect(isTraceableImageType('.webp')).toBe(true);
  });

  it('still accepts a real MIME type, for a writer that stores one', () => {
    expect(isTraceableImageType('image/png')).toBe(true);
  });

  it('refuses what no canvas can show, so the button never promises a photo it cannot display', () => {
    expect(isTraceableImageType('.pdf')).toBe(false);
    expect(isTraceableImageType('.dwg')).toBe(false);
    // Accepted by the field app, undecodable by Chrome in an <img>.
    expect(isTraceableImageType('.heic')).toBe(false);
    expect(isTraceableImageType('image/heic')).toBe(false);
    expect(isTraceableImageType(null)).toBe(false);
    expect(isTraceableImageType('')).toBe(false);
  });
});

describe('the correction stamp', () => {
  it('is absent on a line nobody has corrected', () => {
    expect(handoffCorrectionFromItem(FLASHDRAFT_ITEM)).toBeNull();
    expect(handoffCorrectionFromItem({})).toBeNull();
    expect(handoffCorrectionFromItem(null)).toBeNull();
  });

  it('reports who and when, exactly as written', () => {
    const c = handoffCorrectionFromItem({
      ...FLASHDRAFT_ITEM,
      correctedAt: '2026-10-03T12:00:00.000Z',
      correctedByName: 'Steve',
      correctedProfileId: REQUEST_ID,
    });
    expect(c).toEqual({
      correctedAt: '2026-10-03T12:00:00.000Z',
      correctedByName: 'Steve',
      savedProfileId: REQUEST_ID,
    });
  });

  it('does not invent a name for a stamp that has none', () => {
    const c = handoffCorrectionFromItem({ correctedAt: '2026-10-03T12:00:00.000Z' });
    expect(c!.correctedByName).toBeNull();
    expect(c!.savedProfileId).toBeNull();
  });
});

describe('the wording matches what the estimator will actually find', () => {
  it('says DESIGN when the order carries a drawing', () => {
    expect(flashDraftButtonLabel('geometry', 'afs-flashdraft')).toBe('Design in FlashDraft');
    expect(flashDraftButtonHint('geometry', 'afs-flashdraft')).toContain('editable');
  });

  it("says FINISH for a field-app job, which is v7's own word for it", () => {
    // Prototype line 1250: `ps === 'none' && j.src === 'Field app'` -> "Finish
    // in FlashDraft". v7 wins every wording conflict (CLAUDE.md rule #33).
    expect(flashDraftButtonLabel('reference', 'field_photo_quote')).toBe('Finish in FlashDraft');
    expect(flashDraftButtonHint('reference', 'field_photo_quote')).toContain('only a photo');
  });

  it('promises a blank canvas when that is what there is', () => {
    expect(flashDraftButtonLabel('metadata', 'afs-quote-builder')).toBe('Draw it in FlashDraft');
    expect(flashDraftButtonHint('metadata', 'afs-quote-builder')).toContain('blank');
    // and never claims a drawing exists
    expect(flashDraftButtonHint('metadata', 'afs-quote-builder')).not.toContain('editable');
  });
});
