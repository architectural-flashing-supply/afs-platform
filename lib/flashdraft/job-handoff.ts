/**
 * THE JOB -> FLASHDRAFT HANDOFF. One contract, read by the Command Center and
 * written back by FlashDraft.
 *
 * WHAT WAS WRONG BEFORE THIS FILE EXISTED. The Job screen's only route into
 * FlashDraft was `?modifyProfile=<saved_configurations.id>`, resolved by
 * matching `geometry_fingerprint` (lib/data/job-screen.ts). That link only
 * exists when the customer ALSO saved their drawing as a profile. A job that
 * carries real geometry on its own line item but was never saved as a profile
 * got a `needbox` saying FlashDraft was "not available here", and v7's own
 * "Draw it in FlashDraft" button pointed at a bare `/studio/draft` — a blank
 * canvas, with the order's geometry, material, gauge and job info left behind
 * on the screen the estimator had just walked away from.
 *
 * So the handoff is keyed on the QUOTE REQUEST, which every job has, rather
 * than on a saved profile, which only some jobs have. Same id-in-the-URL shape
 * as `?modifyProfile=` and `?loadPassport=` — not the localStorage blob
 * `ADMIN_JOB_HANDOFF_KEY` uses — for three reasons: the Job screen is a server
 * component and stays one (the button is a plain `<Link>`, no client island),
 * the field photo's signed URL expires and must be minted at load time rather
 * than at click time, and the resulting URL is shareable.
 *
 * THREE HONEST OUTCOMES, AND THE SECOND IS THE POINT.
 *
 *   'geometry'  — the line item carries real drawn points. FlashDraft opens on
 *                 that exact profile, editable.
 *   'reference' — there is no geometry, but there IS something the customer
 *                 sent: a photo of a paper sketch from the field app, or an
 *                 uploaded drawing. FlashDraft opens BLANK with that image
 *                 behind the canvas to trace, and every scrap of real metadata
 *                 filled in. NOTHING IS INVENTED: a photo is not geometry, and
 *                 reconstructing points from `legA`/`legB`/`width`/`height`
 *                 would be a guess about a shape nobody drew.
 *   'metadata'  — neither. FlashDraft opens blank with the order's material,
 *                 gauge, length, quantity, colour and job info set.
 *
 * A quote-builder item's dimensions are NOT promoted to geometry. They describe
 * a catalogue profile by name and a couple of leg lengths; the bend count, the
 * angles, the hems and the handedness are all absent. See CLAUDE.md rule #12 —
 * the signed interior angle is the whole meaning of a bend, and there is none
 * here to read.
 */

export const JOB_HANDOFF_PARAM = 'loadRequest';
export const JOB_HANDOFF_ITEM_PARAM = 'item';

/** A hem exactly as `quote_requests.line_items[].hemStart/hemEnd` stores it. */
export interface JobHandoffHem {
  type: string;
  lengthIn: number;
  gapIn: number;
  kick: string;
}

export interface JobHandoffPoint {
  x: number;
  y: number;
}

export interface JobHandoffGeometry {
  points: JobHandoffPoint[];
  hemStart: JobHandoffHem | null;
  hemEnd: JobHandoffHem | null;
  /** Indexed exactly as FlashDraft itself builds it — one per interior bend. */
  bendRadiiIn: number[] | null;
}

/**
 * Something the customer actually sent, to trace against. A URL here is a
 * short-lived signed Storage URL, so it is minted when the handoff is read and
 * never stored.
 */
export interface JobHandoffReference {
  url: string;
  fileName: string;
  fileType: string;
  /** Why this image is on screen, in the estimator's own terms. */
  caption: string;
}

/** Who last corrected this line in FlashDraft, and when. Never invented. */
export interface JobHandoffCorrection {
  correctedAt: string;
  correctedByName: string | null;
  savedProfileId: string | null;
}

export type JobHandoffKind = 'geometry' | 'reference' | 'metadata';

export interface JobHandoffPayload {
  quoteRequestId: string;
  requestNumber: string;
  /** Which line item of the request this handoff is for. */
  itemIndex: number;
  itemCount: number;
  kind: JobHandoffKind;

  profileName: string;
  profileType: string | null;
  material: string | null;
  gauge: string | null;
  color: string | null;
  finish: string | null;
  lengthFt: number | null;
  quantity: number | null;
  /** The customer's own words. Never rewritten. */
  customerNote: string | null;

  jobInfo: {
    clientBusinessName: string | null;
    clientName: string | null;
    poNumber: string | null;
    jobName: string | null;
    requestedDeliveryDate: string | null;
  };

  geometry: JobHandoffGeometry | null;
  reference: JobHandoffReference | null;
  correction: JobHandoffCorrection | null;
  sourceTool: string | null;
}

/** What FlashDraft POSTs back once the estimator has saved a corrected profile. */
export interface JobHandoffWriteback {
  itemIndex: number;
  savedProfileId: string | null;
  profileName: string;
  material: string | null;
  gauge: string | null;
  points: JobHandoffPoint[];
  hemStart: JobHandoffHem | null;
  hemEnd: JobHandoffHem | null;
  bendRadiiIn: number[] | null;
}

/**
 * THE ONE PLACE THAT BUILDS THE LINK. Both the live Job screen and the fixture
 * one call this, so a change to the parameter names cannot reach one and miss
 * the other.
 *
 * `admin=1` is the same flag `/admin/search` already sends — it marks the
 * FlashDraft session as having been opened from Command Center
 * (app/studio/draft/page.tsx's `adminContext`). It grants nothing on its own:
 * the GET below is role-checked server-side regardless.
 */
export function flashDraftJobHref(quoteRequestId: string, itemIndex = 0): string {
  const item = itemIndex > 0 ? `&${JOB_HANDOFF_ITEM_PARAM}=${itemIndex}` : '';
  return `/studio/draft?admin=1&${JOB_HANDOFF_PARAM}=${encodeURIComponent(quoteRequestId)}${item}`;
}

/** The API route both halves of the handoff live on. */
export function jobHandoffApiPath(quoteRequestId: string): string {
  return `/api/admin/command-center/job-handoff/${encodeURIComponent(quoteRequestId)}`;
}

/**
 * CAN A BROWSER PUT THIS FILE BEHIND THE CANVAS TO TRACE?
 *
 * `takeoff_uploads.file_type` IS NOT A MIME TYPE. Both writers —
 * app/api/field/photo-upload/route.ts and app/api/upload/route.ts — store the
 * FILE EXTENSION in it (`'.jpg'`, `'.pdf'`), so a `startsWith('image/')` test
 * is false for every row in the table and would have silently demoted every
 * field-app job to "no image", which is the one case this whole feature exists
 * for. Checked against the live column, not assumed.
 *
 * HEIC IS DELIBERATELY EXCLUDED even though the field app accepts it
 * (FIELD_PHOTO_ACCEPTED_EXTENSIONS). Chrome cannot decode it in an `<img>`, so
 * offering "trace the photo" would put an empty frame behind the canvas. The
 * handoff falls back to 'metadata' and says nothing was attached that can be
 * traced, which is true and is better than a broken picture.
 *
 * A MIME type is still accepted, so a future writer that stores one correctly
 * needs no change here.
 */
const TRACEABLE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export function isTraceableImageType(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  const t = fileType.trim().toLowerCase();
  if (t.startsWith('image/')) return !t.includes('heic') && !t.includes('heif');
  return TRACEABLE_EXTENSIONS.includes(t.startsWith('.') ? t : `.${t}`);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A real drawn polyline — at least two points, every coordinate finite. */
export function isHandoffPointArray(value: unknown): value is JobHandoffPoint[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (p) =>
        !!p &&
        typeof p === 'object' &&
        isFiniteNumber((p as JobHandoffPoint).x) &&
        isFiniteNumber((p as JobHandoffPoint).y)
    )
  );
}

export function isHandoffHem(value: unknown): value is JobHandoffHem {
  if (!value || typeof value !== 'object') return false;
  const h = value as JobHandoffHem;
  return typeof h.type === 'string' && isFiniteNumber(h.lengthIn) && isFiniteNumber(h.gapIn);
}

/**
 * Reads geometry off one raw `line_items[]` entry, or returns null.
 *
 * Shape-checked rather than cast. A line item is customer-supplied JSON in a
 * JSONB column with no constraint behind it, and the next thing that happens to
 * these numbers is a drawing an estimator prices work from.
 */
export function handoffGeometryFromItem(item: unknown): JobHandoffGeometry | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Record<string, unknown>;
  if (!isHandoffPointArray(raw.points)) return null;
  const radii = raw.bendRadiiIn;
  return {
    points: raw.points,
    hemStart: isHandoffHem(raw.hemStart) ? raw.hemStart : null,
    hemEnd: isHandoffHem(raw.hemEnd) ? raw.hemEnd : null,
    bendRadiiIn: Array.isArray(radii) && radii.every(isFiniteNumber) ? (radii as number[]) : null,
  };
}

/**
 * The correction marker already on a line item, if an estimator has been
 * through it before. Reported, never assumed — a line with no marker is simply
 * one nobody has corrected, which is different from one corrected by nobody.
 */
export function handoffCorrectionFromItem(item: unknown): JobHandoffCorrection | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Record<string, unknown>;
  if (typeof raw.correctedAt !== 'string' || !raw.correctedAt) return null;
  return {
    correctedAt: raw.correctedAt,
    correctedByName: typeof raw.correctedByName === 'string' ? raw.correctedByName : null,
    savedProfileId: typeof raw.correctedProfileId === 'string' ? raw.correctedProfileId : null,
  };
}

/**
 * v7's own four labels for this button, by what the handoff will actually do.
 * The prototype picks between them on the Workbench card (line 1250) and in
 * `profStrip()` (line 1340); this keeps that wording in one place so the Job
 * screen and the fixture screen cannot word the same action differently.
 */
export function flashDraftButtonLabel(kind: JobHandoffKind, sourceTool: string | null): string {
  if (kind === 'geometry') return 'Design in FlashDraft';
  if (sourceTool === 'field_photo_quote') return 'Finish in FlashDraft';
  if (kind === 'reference') return 'Trace it in FlashDraft';
  return 'Draw it in FlashDraft';
}

/**
 * The sentence under the button. Each one states exactly what the estimator
 * will find on the other side, because the difference between "your profile is
 * loaded" and "here is a blank canvas with the photo behind it" is the whole
 * reason this module distinguishes three kinds.
 */
export function flashDraftButtonHint(kind: JobHandoffKind, sourceTool: string | null): string {
  if (kind === 'geometry') {
    return "Opens this order's drawing, editable. Saving writes the corrected profile back onto this line.";
  }
  if (kind === 'reference') {
    return sourceTool === 'field_photo_quote'
      ? 'No profile was drawn in the field — only a photo. FlashDraft opens blank with that photo behind the canvas to trace, and the order details filled in.'
      : 'Nothing was drawn for this order. FlashDraft opens blank with the attached drawing behind the canvas to trace, and the order details filled in.';
  }
  return 'Nothing was drawn for this order and no drawing was attached. FlashDraft opens blank with the order details filled in.';
}
