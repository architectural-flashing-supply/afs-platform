import { createAdminClient } from '@/lib/supabase/admin';
import { parseSavedProfileRow, UUID_RE, type SavedProfileRecord } from '@/lib/data/v8-profile-geometry';
import type { Hem } from '@/lib/types/profile';
import type { SavedProfileGeometry, ViewerPoint } from '@/lib/flashdraft/viewer-scene';

/**
 * WHAT PICTURE DOES THIS ITEM REALLY HAVE? — the one resolver, four answers.
 *
 * Reid's profile rules (2026-10-09) say every thumbnail shows the REAL saved
 * image from its own source, and that nothing is ever invented, traced,
 * vectorised or parametrically drawn. There are exactly four sources in this
 * system and therefore exactly four answers here:
 *
 *   'geometry'  Drawn in FlashDraft, by a customer or by Steve. Real saved
 *               points, hems and bend radii, rendered by the one ProfileViewer
 *               through FlashDraft's own renderer.
 *   'photo'     Sent from the field app. The ACTUAL photograph, on a short-
 *               lived signed URL. Not a tracing of it, not a shape derived
 *               from it — the picture the contractor took.
 *   'png'       A real saved raster from `shop_profile_library.geometry_svg`
 *               (misnamed: it holds a base64 PNG). A genuine snapshot of
 *               FlashDraft's canvas at the moment the job went to the shop.
 *   'none'      A mail-scraped order, or anything else with no image at all.
 *               This is a TO-DO, not a blank: it carries `todo: true` so the
 *               Workbench can list it, and a reason in plain English.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE ORDER OF PREFERENCE, AND WHY IT IS THIS WAY ROUND.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Geometry first, because it is the only source that can be enlarged to full
 * size and read off — every segment length, every signed interior angle, every
 * hem. A raster cannot answer "how long is that leg" at any zoom.
 *
 * Then the photo, because on a field job the photograph IS the specification
 * until somebody redraws it, and showing it is how Steve knows what he is
 * looking at.
 *
 * Then the saved PNG, which is real but frozen at thumbnail resolution.
 *
 * Then the honest absence. Never a stand-in, at any step.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHERE THE GEOMETRY ACTUALLY LIVES, MEASURED 2026-10-09.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `saved_configurations` — the Profile Passport, the table a profile id points
 * at — holds TWO rows in the whole database. The geometry that exists is on
 * `quote_requests.line_items[]`, on 5 of 18 jobs. So this resolver reads the
 * LINE ITEM first and treats the saved-profile id as the secondary path, which
 * is the opposite of what the phase-0 viewer assumed. A resolver built around
 * ids would have found almost nothing.
 */

export interface ProfileSourceGeometry {
  kind: 'geometry';
  /** Where it came from, for the caption under the thumbnail. */
  origin: 'line_item' | 'saved_profile';
  /** The `saved_configurations` id when there is one — null for a line item. */
  savedProfileId: string | null;
  name: string | null;
  material: string;
  gauge: string;
  geometry: SavedProfileGeometry;
  bendCount: number;
  hemCount: number;
}

export interface ProfileSourcePhoto {
  kind: 'photo';
  /** A short-lived signed Storage URL. Minted on read, never stored. */
  url: string;
  fileName: string;
  contentType: string;
  /** Why this image is on screen, in the estimator's own words. */
  caption: string;
}

export interface ProfileSourcePng {
  kind: 'png';
  /** `data:image/png;base64,…`, exactly as the shop row stores it. */
  dataUri: string;
  caption: string;
}

export interface ProfileSourceNone {
  kind: 'none';
  reason: string;
  /** Always true. A missing drawing is work somebody has to do. */
  todo: true;
}

export type ProfileSource =
  | ProfileSourceGeometry
  | ProfileSourcePhoto
  | ProfileSourcePng
  | ProfileSourceNone;

/** How long a field photo's signed URL lives. Long enough to look at, short enough not to leak. */
export const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 30;

/* ─────────────────────────── line-item geometry ─────────────────────────── */

const HEM_TYPES = new Set(['open', 'smashed', 'teardrop']);
const HEM_KICKS = new Set(['inside', 'outside']);

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function parsePoint(v: unknown): ViewerPoint | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const x = num(o.x);
  const y = num(o.y);
  if (x === null || y === null) return null;
  const r = num(o.radius);
  return r !== null && r > 0 ? { x, y, radius: r } : { x, y };
}

function parseHem(v: unknown): Hem | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const type = typeof o.type === 'string' ? o.type : '';
  const kick = typeof o.kick === 'string' ? o.kick : '';
  if (!HEM_TYPES.has(type) || !HEM_KICKS.has(kick)) return null;
  const lengthIn = num(o.lengthIn);
  const gapIn = num(o.gapIn);
  if (lengthIn === null || lengthIn <= 0 || gapIn === null || gapIn < 0) return null;
  return { type, kick, lengthIn, gapIn } as Hem;
}

function parseRadii(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const e of v) {
    const n = num(e);
    if (n === null || n <= 0) return null;
    out.push(n);
  }
  return out.length ? out : null;
}

/**
 * Geometry off one `quote_requests.line_items[]` entry.
 *
 * SAME STRICTNESS AS THE PASSPORT READER: one unreadable point voids the whole
 * drawing rather than being skipped, because a polyline silently missing a leg
 * is a plausible-looking shape nobody can vouch for, on a screen whose next
 * button reaches a bending machine.
 *
 * A quote-builder item's `legA`/`legB`/`width`/`height` are NOT promoted to
 * geometry here, for the reason `lib/flashdraft/job-handoff.ts` already gives:
 * they describe a catalogue profile by name, and the bend count, the angles,
 * the hems and the handedness are all absent. Reconstructing points from them
 * would be inventing a shape — exactly what rule 1 forbids.
 */
export function geometryFromLineItem(item: unknown): ProfileSourceGeometry | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  if (!Array.isArray(o.points)) return null;

  const points: ViewerPoint[] = [];
  for (const p of o.points) {
    const parsed = parsePoint(p);
    if (!parsed) return null;
    points.push(parsed);
  }
  if (points.length < 2) return null;

  const hemStart = parseHem(o.hemStart);
  const hemEnd = parseHem(o.hemEnd);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

  return {
    kind: 'geometry',
    origin: 'line_item',
    savedProfileId: null,
    name: str(o.profileName) || null,
    material: str(o.material),
    gauge: str(o.gauge),
    geometry: { points, hemStart, hemEnd, bendRadiiIn: parseRadii(o.bendRadiiIn) },
    bendCount: Math.max(points.length - 2, 0),
    hemCount: (hemStart ? 1 : 0) + (hemEnd ? 1 : 0),
  };
}

function fromSavedRecord(rec: SavedProfileRecord): ProfileSourceGeometry {
  return {
    kind: 'geometry',
    origin: 'saved_profile',
    savedProfileId: rec.id,
    name: rec.name,
    material: rec.material,
    gauge: rec.gauge,
    geometry: rec.geometry,
    bendCount: rec.bendCount,
    hemCount: rec.hemCount,
  };
}

/* ───────────────────────────── the resolver ─────────────────────────────── */

export interface JobSourceInput {
  /** `quote_requests.id`. */
  jobId: string;
  /** Which line item. Defaults to the first one carrying geometry. */
  itemIndex?: number;
}

/**
 * Resolve what picture a JOB has. Service role, because the job belongs to a
 * customer and an admin's own session is correctly denied it by RLS.
 */
export async function resolveJobProfileSource(input: JobSourceInput): Promise<ProfileSource> {
  const { jobId, itemIndex } = input;
  if (!UUID_RE.test(jobId)) return { kind: 'none', reason: 'That is not a job id.', todo: true };

  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from('quote_requests')
    .select('id, line_items, upload_id, source_tool, request_number')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    // A failed read is NOT "no drawing". Reporting an absence that may not
    // exist would put a job on the to-do list that has a perfectly good
    // drawing behind it.
    return { kind: 'none', reason: 'The drawing could not be loaded just now.', todo: true };
  }
  if (!job) return { kind: 'none', reason: 'This job no longer exists.', todo: true };

  const row = job as {
    id: string;
    line_items: unknown;
    upload_id: string | null;
    source_tool: string | null;
  };

  // 1. REAL DRAWN GEOMETRY on a line item — the only source that enlarges.
  const items = Array.isArray(row.line_items) ? row.line_items : [];
  if (typeof itemIndex === 'number') {
    const g = geometryFromLineItem(items[itemIndex]);
    if (g) return g;
  } else {
    for (const item of items) {
      const g = geometryFromLineItem(item);
      if (g) return g;
    }
  }

  // 2. THE ACTUAL PHOTOGRAPH from the field app.
  if (row.upload_id) {
    const photo = await signUpload(row.upload_id);
    if (photo) return photo;
  }

  // 3. A REAL SAVED RASTER from the shop library, if this job reached the shop.
  const png = await shopPng(row.id);
  if (png) return png;

  // 4. NOTHING. Said plainly, and flagged as work.
  return {
    kind: 'none',
    reason:
      row.source_tool === 'email_inbound'
        ? 'This order arrived by email with no drawing attached.'
        : 'No drawing has been made for this job yet.',
    todo: true,
  };
}

/**
 * A signed URL for a `takeoff_uploads` row.
 *
 * THE BUCKET IS THE KEY'S FIRST SEGMENT AND THE KEY IS PASSED WHOLE. That looks
 * wrong and is not: `app/api/field/photo-upload/route.ts` writes
 * `documents/field-photos/…` as the key and signs it against the `documents`
 * bucket, so the object really does sit in a `documents/` folder inside the
 * `documents` bucket. Upload and read agree, and
 * `app/admin/quote-requests/[id]/page.tsx` already reads it exactly this way.
 * Normalising it here would break every existing row.
 */
async function signUpload(uploadId: string): Promise<ProfileSourcePhoto | null> {
  const admin = createAdminClient();
  const { data: upload } = await admin
    .from('takeoff_uploads')
    .select('storage_key, file_name, file_type')
    .eq('id', uploadId)
    .maybeSingle();
  if (!upload) return null;

  const u = upload as { storage_key: string; file_name: string; file_type: string };
  if (!u.storage_key) return null;

  const bucket = u.storage_key.split('/')[0];
  const { data: signed } = await admin.storage
    .from(bucket)
    .createSignedUrl(u.storage_key, PHOTO_SIGNED_URL_TTL_SECONDS);
  if (!signed?.signedUrl) return null;

  const isImage = (u.file_type ?? '').startsWith('image/');
  return {
    kind: 'photo',
    url: signed.signedUrl,
    fileName: u.file_name,
    contentType: u.file_type,
    caption: isImage ? 'Photographed in the field' : 'Uploaded with this request',
  };
}

/** The real saved raster for a job that reached the shop, if there is one. */
async function shopPng(jobId: string): Promise<ProfileSourcePng | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('shop_profile_library')
    .select('geometry_svg')
    .eq('quote_request_id', jobId)
    .not('geometry_svg', 'is', null)
    .limit(1)
    .maybeSingle();
  const uri = (data as { geometry_svg: string | null } | null)?.geometry_svg ?? null;
  if (!uri || !uri.startsWith('data:image/')) return null;
  return { kind: 'png', dataUri: uri, caption: 'Saved when this job went to the shop' };
}

/** Resolve a SAVED PROFILE by its Passport id. The secondary path — two rows exist. */
export async function resolveSavedProfileSource(profileId: string): Promise<ProfileSource> {
  if (!UUID_RE.test(profileId)) return { kind: 'none', reason: 'That is not a profile id.', todo: true };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('saved_configurations')
    .select('name, dimensions')
    .eq('id', profileId)
    .maybeSingle();
  if (error) return { kind: 'none', reason: 'The drawing could not be loaded just now.', todo: true };

  const parsed = parseSavedProfileRow(profileId, data as Parameters<typeof parseSavedProfileRow>[1]);
  if (parsed.kind === 'geometry') return fromSavedRecord(parsed);
  return { kind: 'none', reason: parsed.reason, todo: true };
}

/* ──────────────────────────── batch resolution ─────────────────────────── */

export interface BatchJobInput {
  id: string;
  lineItems: unknown;
  uploadId: string | null;
  sourceTool: string | null;
}

/**
 * Resolve the source for MANY jobs at once — what a lane board needs.
 *
 * THREE QUERIES TOTAL, NOT THREE PER CARD. A Workbench with twelve cards
 * resolving itself one job at a time would be thirty-six round trips before
 * the first pixel. The line items are already in hand (the card query selects
 * them), so geometry costs nothing; the uploads and the shop rows are each one
 * `in (…)` lookup; the signed URLs are minted in parallel.
 *
 * NO IMAGE BYTES CROSS THE WIRE (CLAUDE.md rule #26). A photo becomes a signed
 * URL the browser fetches directly from Storage, and a shop PNG is only
 * resolved for jobs that got that far — this does not pull `geometry_svg` for a
 * whole board.
 */
export async function resolveJobProfileSources(
  jobs: BatchJobInput[],
): Promise<Map<string, ProfileSource>> {
  const out = new Map<string, ProfileSource>();
  if (jobs.length === 0) return out;

  // 1. Geometry, free — already in the caller's rows.
  const needPhoto: BatchJobInput[] = [];
  for (const job of jobs) {
    const items = Array.isArray(job.lineItems) ? job.lineItems : [];
    let found: ProfileSourceGeometry | null = null;
    for (const item of items) {
      const g = geometryFromLineItem(item);
      if (g) {
        found = g;
        break;
      }
    }
    if (found) out.set(job.id, found);
    else needPhoto.push(job);
  }
  if (needPhoto.length === 0) return out;

  const admin = createAdminClient();

  // 2. The real photographs, one lookup then parallel signing.
  const uploadIds = needPhoto.map((j) => j.uploadId).filter((v): v is string => Boolean(v));
  const byUpload = new Map<string, { storage_key: string; file_name: string; file_type: string }>();
  if (uploadIds.length) {
    const { data } = await admin
      .from('takeoff_uploads')
      .select('id, storage_key, file_name, file_type')
      .in('id', uploadIds);
    for (const r of (data ?? []) as {
      id: string;
      storage_key: string;
      file_name: string;
      file_type: string;
    }[]) {
      byUpload.set(r.id, r);
    }
  }

  const stillNeed: BatchJobInput[] = [];
  await Promise.all(
    needPhoto.map(async (job) => {
      const up = job.uploadId ? byUpload.get(job.uploadId) : undefined;
      if (!up?.storage_key) {
        stillNeed.push(job);
        return;
      }
      const bucket = up.storage_key.split('/')[0];
      const { data: signed } = await admin.storage
        .from(bucket)
        .createSignedUrl(up.storage_key, PHOTO_SIGNED_URL_TTL_SECONDS);
      if (!signed?.signedUrl) {
        stillNeed.push(job);
        return;
      }
      out.set(job.id, {
        kind: 'photo',
        url: signed.signedUrl,
        fileName: up.file_name,
        contentType: up.file_type,
        caption: (up.file_type ?? '').startsWith('image/')
          ? 'Photographed in the field'
          : 'Uploaded with this request',
      });
    }),
  );
  if (stillNeed.length === 0) return out;

  // 3. The real saved rasters, for jobs that reached the shop.
  const { data: shopRows } = await admin
    .from('shop_profile_library')
    .select('quote_request_id, geometry_svg')
    .in('quote_request_id', stillNeed.map((j) => j.id))
    .not('geometry_svg', 'is', null);
  const byJob = new Map<string, string>();
  for (const r of (shopRows ?? []) as { quote_request_id: string | null; geometry_svg: string | null }[]) {
    if (r.quote_request_id && r.geometry_svg?.startsWith('data:image/')) {
      byJob.set(r.quote_request_id, r.geometry_svg);
    }
  }

  for (const job of stillNeed) {
    const uri = byJob.get(job.id);
    if (uri) {
      out.set(job.id, { kind: 'png', dataUri: uri, caption: 'Saved when this job went to the shop' });
      continue;
    }
    // 4. Nothing. A to-do, said plainly.
    out.set(job.id, {
      kind: 'none',
      reason:
        job.sourceTool === 'email_inbound'
          ? 'This order arrived by email with no drawing attached.'
          : 'No drawing has been made for this job yet.',
      todo: true,
    });
  }

  return out;
}
