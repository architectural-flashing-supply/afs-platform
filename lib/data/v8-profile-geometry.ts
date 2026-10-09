import { createAdminClient } from '@/lib/supabase/admin';
import type { Hem, HemKick, HemType } from '@/lib/types/profile';
import type { SavedProfileGeometry, ViewerPoint } from '@/lib/flashdraft/viewer-scene';

/**
 * READING ONE SAVED FLASHDRAFT PROFILE'S GEOMETRY — the V8 viewer's only data
 * source, and the one place that decides what "a saved drawing" means.
 *
 * WHERE THE GEOMETRY ACTUALLY IS. `saved_configurations` is the Profile
 * Passport, and `dimensions` is a JSONB blob FlashDraft itself wrote:
 * `{ kind: 'flashdraft', points: [{x,y,radius?}], hemStart, hemEnd,
 * bendRadiiIn }`. lib/data/profile-search.ts's header already records that
 * this is "the only [source] with real FlashDraft geometry the canvas can
 * reload directly", and it is the same blob `loadForModify` reads. So this
 * module reads exactly that and nothing else.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT IT WILL NOT DO, AND WHY THAT IS THE POINT OF THE WHOLE EXERCISE.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * It never falls back to a parametric profile. The Command Center's current
 * drawings come from `lib/design/v7-draw.ts`, which takes a profile KIND out of
 * a nine-entry table plus a few leg lengths — a picture of the CATEGORY the job
 * belongs to, not of the thing the customer drew. A nine-entry table has no
 * entry for a seven-bend custom, no way to express a hem's kick direction, and
 * no concept of a bend's handedness at all (CLAUDE.md rule #12). Dressing that
 * up as the customer's profile on a screen whose next button reaches the
 * Thalmann is the defect V8 exists to remove.
 *
 * So there are exactly two outcomes: real saved geometry, or an explicit
 * absence. `kind: 'none'` carries a `reason` in plain English, and the
 * component renders it as words. The project already takes this position
 * elsewhere — `lib/flashdraft/job-handoff.ts`'s `'reference'` outcome refuses
 * to reconstruct points from `legA`/`legB`, and V7Thumb renders v7's empty
 * `.np` box rather than inventing a shape. This is the same rule, applied to
 * the one screen that still breaks it.
 *
 * VALIDATION IS NOT POLITENESS HERE. The blob is JSON a client wrote, and a
 * malformed hem or a string where a number belongs would otherwise reach a
 * canvas drawing routine. Every field is checked and anything unrecognised is
 * dropped rather than coerced — the same stance lib/hailview/v2 takes with the
 * agent's advisory flags (rule #35).
 *
 * SERVICE ROLE, BECAUSE THE PROFILE BELONGS TO A CUSTOMER. An admin's own
 * session is correctly denied another customer's row by RLS. `createAdminClient`
 * is used rather than a raw fetch so `cache: 'no-store'` is not something this
 * file has to remember (CLAUDE.md rule #22).
 */

export interface SavedProfileRecord {
  kind: 'geometry';
  id: string;
  name: string | null;
  material: string;
  gauge: string;
  geometry: SavedProfileGeometry;
  /** Segment count, bend count and hem count — what the full-size view prints. */
  bendCount: number;
  hemCount: number;
}

export interface NoSavedDrawing {
  kind: 'none';
  id: string;
  /** Said in the estimator's own terms. Never a code. */
  reason: string;
}

export type SavedProfileResult = SavedProfileRecord | NoSavedDrawing;

const HEM_TYPES: HemType[] = ['open', 'smashed', 'teardrop'];
const HEM_KICKS: HemKick[] = ['inside', 'outside'];

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** A saved point, or null if this entry is not one. Never a repaired guess. */
function parsePoint(v: unknown): ViewerPoint | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const x = finiteNumber(o.x);
  const y = finiteNumber(o.y);
  if (x === null || y === null) return null;
  const radius = finiteNumber(o.radius);
  return radius !== null && radius > 0 ? { x, y, radius } : { x, y };
}

/**
 * A saved hem, or null.
 *
 * An unrecognised `type` or `kick` makes the whole hem null rather than
 * defaulting it. A hem's type is how it is formed and its kick is which way it
 * folds — guessing either draws a fold the customer did not ask for, which is
 * worse than drawing no hem and worse still than saying nothing.
 */
function parseHem(v: unknown): Hem | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const type = o.type;
  const kick = o.kick;
  if (typeof type !== 'string' || !HEM_TYPES.includes(type as HemType)) return null;
  if (typeof kick !== 'string' || !HEM_KICKS.includes(kick as HemKick)) return null;
  const lengthIn = finiteNumber(o.lengthIn);
  const gapIn = finiteNumber(o.gapIn);
  if (lengthIn === null || lengthIn <= 0) return null;
  if (gapIn === null || gapIn < 0) return null;
  return { type: type as HemType, kick: kick as HemKick, lengthIn, gapIn };
}

function parseRadii(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const entry of v) {
    const n = finiteNumber(entry);
    if (n === null || n <= 0) return null;
    out.push(n);
  }
  return out.length ? out : null;
}

/**
 * Turn one `saved_configurations` row into a viewer result.
 *
 * Exported separately from the database read so it can be unit-tested against
 * real row shapes without a database — which is also why the fidelity test can
 * compare this module's output against FlashDraft's renderer directly.
 */
export function parseSavedProfileRow(
  id: string,
  row: {
    name?: unknown;
    dimensions?: unknown;
    material_label?: unknown;
    gauge_label?: unknown;
  } | null,
): SavedProfileResult {
  if (!row) return { kind: 'none', id, reason: 'This profile is not in the Passport.' };

  const dims = (row.dimensions ?? null) as Record<string, unknown> | null;
  if (!dims || typeof dims !== 'object') {
    return { kind: 'none', id, reason: 'This profile was saved without a drawing.' };
  }

  const rawPoints = dims.points;
  if (!Array.isArray(rawPoints)) {
    return { kind: 'none', id, reason: 'This profile was saved without a drawing.' };
  }

  const points: ViewerPoint[] = [];
  for (const p of rawPoints) {
    const parsed = parsePoint(p);
    // One unreadable point makes the whole polyline untrustworthy — a drawing
    // with a leg silently missing is more dangerous than no drawing.
    if (!parsed) {
      return { kind: 'none', id, reason: 'This profile’s saved drawing could not be read.' };
    }
    points.push(parsed);
  }

  if (points.length < 2) {
    return { kind: 'none', id, reason: 'This profile was saved without a drawing.' };
  }

  const material = typeof dims.material === 'string' && dims.material.trim()
    ? dims.material
    : typeof row.material_label === 'string' && row.material_label.trim()
      ? row.material_label
      : '';
  const gauge = typeof dims.gauge === 'string' && dims.gauge.trim()
    ? dims.gauge
    : typeof row.gauge_label === 'string' && row.gauge_label.trim()
      ? row.gauge_label
      : '';

  const hemStart = parseHem(dims.hemStart);
  const hemEnd = parseHem(dims.hemEnd);

  return {
    kind: 'geometry',
    id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : null,
    material,
    gauge,
    geometry: {
      points,
      hemStart,
      hemEnd,
      bendRadiiIn: parseRadii(dims.bendRadiiIn),
    },
    bendCount: Math.max(points.length - 2, 0),
    hemCount: (hemStart ? 1 : 0) + (hemEnd ? 1 : 0),
  };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read one saved profile's geometry. Cross-customer, so service role. */
export async function getSavedProfileGeometry(id: string): Promise<SavedProfileResult> {
  if (!UUID_RE.test(id)) return { kind: 'none', id, reason: 'That is not a profile id.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('saved_configurations')
    .select('name, dimensions')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    // A failed read is NOT "no drawing". Saying "no saved drawing" when the
    // database was unreachable would report an absence that may not exist.
    return { kind: 'none', id, reason: 'The drawing could not be loaded just now.' };
  }
  return parseSavedProfileRow(id, data as Parameters<typeof parseSavedProfileRow>[1]);
}
