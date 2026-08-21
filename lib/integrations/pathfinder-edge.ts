/**
 * PathfinderEdge machine-integration client.
 *
 * The public REST API IS real and documented — confirmed live tonight
 * (2026-08-18) via `GET https://afs.pathfinderedge.com/api/v1/catalogs`
 * returning 200 with real catalog data, and full docs read at
 * https://docs.amscontrols.com/pathfinderEdge/publicapi and
 * https://docs.amscontrols.com/pathfinderEdge/profile-object. The prior
 * version of this file's header claimed no REST API was discoverable at
 * this host — that claim was wrong (a Bearer/X-API-Key/session-login probe
 * was tried, not the actual auth format below) and is corrected here.
 *
 * Auth: the API key goes in the `Authorization` header RAW, with no
 * scheme prefix — not `Bearer <key>`, not `X-API-Key: <key>`. Confirmed
 * both by the live 200 above and by the publicapi doc's own explicit
 * "invalid formats" list.
 *
 * Base URL is per-tenant: `https://<tenant>.pathfinderedge.com/api/v1/...`
 * — `afs` is this tenant, so `PATHFINDER_EDGE_BASE_URL` is already the
 * full tenant root (`https://afs.pathfinderedge.com`).
 *
 * Machine sync model (per https://docs.amscontrols.com/pathfinderEdge/machine-sync):
 * `POST /api/v1/profiles` writes to the tenant's profile LIBRARY only.
 * There is no separate "push to machine" or "submit job" call. If a
 * profile's `owningCatalogId` is a catalog the machine subscribes to, the
 * machine picks it up automatically on its own polling schedule. Per Seth
 * Oliver, catalog 20115 ("afs") is the only catalog the Thalmann DS2801
 * subscribes to. `submitJobToMachine`/`getJobStatus` below reflect this —
 * there is no real endpoint for either concept, so they stay
 * `not_configured` (not guessed), with a corrected message explaining why.
 *
 * UNITS: the profile-object doc says feature `length` is "in your
 * tenant's units" without stating what that is. The doc's own worked
 * example (0.5"/10"/0.25" hem heights) reads like inches, but this is
 * exactly what scripts/pathfinder-roundtrip-test.ts exists to confirm
 * empirically rather than assume — see mmToIn() below and that script's
 * own header comment for the actual confirmed result.
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { HemType, HemKick } from '@/lib/types/profile';

// Catalog 20115 ("afs") is the only PathfinderEdge catalog the Thalmann
// DS2801 subscribes to — confirmed directly by Seth Oliver (2026-08-18),
// not derived. Every real push in this codebase (Command Center approval,
// FlashDraft's direct "Send to PathfinderEdge" button) targets this one
// catalog — a single exported constant here instead of each call site
// redeclaring its own copy.
export const AFS_MACHINE_CATALOG_ID = '20115';

export type PathfinderStatus = 'not_configured' | 'connected' | 'error';

export interface PathfinderResult {
  status: PathfinderStatus;
  message: string;
}

export interface PathfinderEndpoints extends PathfinderResult {
  endpoints: Record<string, number>;
}

export interface Catalog {
  id: string;
  name: string;
}

export interface MachineProfileBend {
  stepNumber: number;
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

// A hem at one profile endpoint, carried in mm like the rest of
// MachineProfile — buildFeatures converts to inches at the same point it
// converts everything else. `type`/`kick` reuse lib/types/profile.ts's
// FlashDraft convention directly rather than re-declaring an equivalent
// enum — that module is already the shared, FlashDraft-neutral home for
// this vocabulary (see its own header comment).
export interface MachineProfileHem {
  type: HemType;
  lengthMm: number;
  gapMm: number;
  kick: HemKick;
}

export interface MachineProfile {
  id: string;
  nameEn: string;
  profileNumber: string;
  blankWidthMm: number | null;
  bends: MachineProfileBend[];
  hemStart?: MachineProfileHem | null;
  hemEnd?: MachineProfileHem | null;
  // Job-identity intake fields + finish (migration 018, afs-jf-000/afs-jf-002,
  // threaded through by afs-jf-003) — composed into the outgoing PathfinderEdge
  // `description` (see composeDescription below), alongside the existing
  // `AFS profile <profileNumber>` reference text. All optional/nullable; a
  // caller with no source value for one (e.g. send-to-pathfinder's FlashDraft
  // live-draw session has no quote_request to read finish/business/client/PO
  // from unless the operator typed them) simply omits it.
  clientBusinessName?: string | null;
  clientName?: string | null;
  poNumber?: string | null;
  requestedBy?: string | null;
  finish?: string | null;
}

export interface PathfinderProfile extends PathfinderResult {
  profileId: string | null;
}

export interface Job extends PathfinderResult {
  jobId: string | null;
}

export interface JobStatus extends PathfinderResult {
  jobId: string;
  state: 'unknown';
}

// mm -> inches, matching scripts/import-machine-profiles.ts's own mmToIn
// convention (round to 4 decimal places rather than leaving raw floating-
// point noise in an outbound request body).
const MM_PER_INCH = 25.4;
function mmToIn(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * 10000) / 10000;
}

const NOT_CONFIGURED_MESSAGE =
  'PathfinderEdge integration not configured — PATHFINDER_EDGE_API_KEY / PATHFINDER_EDGE_BASE_URL are not set.';

const NO_JOB_API_MESSAGE =
  "PathfinderEdge's public API (confirmed via https://docs.amscontrols.com/pathfinderEdge/publicapi and " +
  'https://docs.amscontrols.com/pathfinderEdge/machine-sync) has no job-submission or job-status endpoint. ' +
  'A profile POSTed to the machine-subscribed catalog (see pushProfileToPathfinder) is picked up automatically ' +
  "on the machine's own polling schedule — there is nothing for this function to call.";

function notConfigured(message: string = NOT_CONFIGURED_MESSAGE): PathfinderResult {
  return { status: 'not_configured', message };
}

interface PathfinderConfig {
  baseUrl: string;
  apiKey: string;
}

function getConfig(): PathfinderConfig | null {
  const baseUrl = process.env.PATHFINDER_EDGE_BASE_URL;
  const apiKey = process.env.PATHFINDER_EDGE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

// Raw-key Authorization header — see this file's header comment. Every
// real call goes through this one helper so the auth format only lives in
// one place.
async function pathfinderFetch(config: PathfinderConfig, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: config.apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export async function discoverApiEndpoints(): Promise<PathfinderEndpoints> {
  const config = getConfig();
  if (!config) return { ...notConfigured(), endpoints: {} };

  try {
    const res = await pathfinderFetch(config, '/api/v1/catalogs', { method: 'GET' });
    return {
      status: res.ok ? 'connected' : 'error',
      message: res.ok
        ? `Connected — GET /api/v1/catalogs returned ${res.status}.`
        : `GET /api/v1/catalogs returned ${res.status}.`,
      endpoints: { '/api/v1/catalogs': res.status },
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Network error calling PathfinderEdge.',
      endpoints: {},
    };
  }
}

export async function getPathfinderCatalogs(): Promise<Catalog[]> {
  const config = getConfig();
  if (!config) return [];

  try {
    const res = await pathfinderFetch(config, '/api/v1/catalogs', { method: 'GET' });
    if (!res.ok) return [];
    const data = (await res.json()) as { catalogId: number; catalogName: string }[];
    return data.map((c) => ({ id: String(c.catalogId), name: c.catalogName }));
  } catch {
    return [];
  }
}

// The exact shape confirmed at https://docs.amscontrols.com/pathfinderEdge/profile-object.
// `features` must alternate Straight / non-Straight and start+end with
// Straight — enforced by construction in buildFeatures below, not
// validated after the fact.
interface PathfinderFeature {
  type: 'Straight' | 'Angle' | 'Radius' | 'OpenHem' | 'ClosedHem' | 'TearDropHem';
  length?: number;
  angle?: number;
  radius?: number;
  radiusQuality?: 'Coarse' | 'Medium' | 'Fine';
  hemHeight?: number;
  hemDirection?: 'Positive' | 'Negative';
  hemClampOffset?: number;
}

// UNCONFIRMED mapping — unlike the mm/inches units question (empirically
// round-trip-tested), this codebase's HemKick ('inside'/'outside') has no
// empirical basis for which PathfinderEdge hemDirection it corresponds
// to. 'outside' -> 'Positive' chosen arbitrarily but applied
// consistently; flagged in STATE_OF_THE_BUILD.md pending a real pushed
// hem checked against PathfinderEdge's own profile thumbnail/render.
function hemDirection(kick: HemKick): 'Positive' | 'Negative' {
  return kick === 'outside' ? 'Positive' : 'Negative';
}

// The hem itself, as a PathfinderEdge feature — does NOT include the
// leader Straight that must sit next to it (buildFeatures below adds
// that separately, since its length comes from the same hem.lengthMm but
// is a distinct array element per the doc's own alternating-feature
// rule). 'open'/'smashed'/'teardrop' map to OpenHem/ClosedHem/TearDropHem
// — ClosedHem has no hemHeight field at all (matches 'smashed': the gap
// is collapsed to ~0, there's nothing to report). hemClampOffset has no
// source data anywhere in this codebase (TearDropHem only) — 0 is a
// placeholder default, not a measured value, same precedent as
// radiusQuality below.
function hemFeature(hem: MachineProfileHem): PathfinderFeature {
  const direction = hemDirection(hem.kick);
  if (hem.type === 'open') {
    return { type: 'OpenHem', hemHeight: mmToIn(hem.gapMm), hemDirection: direction };
  }
  if (hem.type === 'smashed') {
    return { type: 'ClosedHem', hemDirection: direction };
  }
  return { type: 'TearDropHem', hemDirection: direction, hemClampOffset: 0 };
}

// Maps MachineProfile.bends (mm, one row per bend: leftLegMm = leg walked
// BEFORE this bend, rightLegMm = trailing leg — same leftLeg/rightLeg
// convention lib/flashdraft/geometry.ts's computeProfilePoints already
// relies on, i.e. only the LAST bend's rightLegMm is a real distinct leg;
// every other bend's own rightLegMm is redundant with the next bend's
// leftLegMm) plus MachineProfile.hemStart/hemEnd into the alternating
// Straight/non-Straight feature list the real API requires.
//
// Hem placement follows the profile-object doc's own worked example
// verbatim: `[Straight(0.5), OpenHem, Straight(10), Angle(90),
// Straight(10), TearDropHem, Straight(0.5)]` — a hem sits between a
// short "leader" Straight (the hem's OWN fold-back leg — 0.5" in that
// example, the exact same value this codebase already defaults
// HEM_DEFAULT_LENGTH_IN to) and the profile's real leg material. A hem
// can never be the first/last feature outright (the doc requires the
// array to start AND end with Straight), so the leader Straight is what
// satisfies that at a hemmed end.
//
// radiusQuality has no source data anywhere — 'Medium' below is a
// placeholder default, not a measured value.
function buildFeatures(profile: MachineProfile): PathfinderFeature[] {
  const bends = profile.bends ?? [];
  const features: PathfinderFeature[] = [];

  if (profile.hemStart) {
    const leaderIn = mmToIn(profile.hemStart.lengthMm);
    if (leaderIn <= 0) {
      throw new Error("Start hem's lengthMm resolves to 0 or less — cannot build a valid Straight feature.");
    }
    features.push({ type: 'Straight', length: leaderIn });
    features.push(hemFeature(profile.hemStart));
  }

  if (bends.length === 0) {
    const lengthIn = mmToIn(profile.blankWidthMm ?? 0);
    if (lengthIn <= 0) {
      throw new Error('Profile has no bends and no positive blankWidthMm — nothing to push.');
    }
    features.push({ type: 'Straight', length: lengthIn });
  } else {
    const firstLegIn = mmToIn(bends[0].leftLegMm ?? 0);
    if (firstLegIn <= 0) {
      throw new Error("First leg's length resolves to 0 or less — cannot build a valid Straight feature.");
    }
    features.push({ type: 'Straight', length: firstLegIn });

    for (let i = 0; i < bends.length; i++) {
      const bend = bends[i];
      const radiusMm = bend.radiusMm ?? 0;
      // bendAngleDegrees is this codebase's INTERIOR/included angle (see
      // geometry.ts's own doc comment) — passed straight through as the
      // PathfinderEdge "angle" feature, which the doc describes only as
      // "bend angle in degrees, -180 to 180" with no turtle-turn framing.
      // This mapping is a best-effort interpretation, NOT confirmed by
      // the round-trip test below (that test only covers a bendless
      // profile, to isolate the units question) — flagged as open in
      // STATE_OF_THE_BUILD.md pending a real bend push+visual check.
      if (radiusMm > 0) {
        features.push({
          type: 'Radius',
          radius: mmToIn(radiusMm),
          radiusQuality: 'Medium',
          angle: bend.bendAngleDegrees ?? 180,
        });
      } else {
        features.push({ type: 'Angle', angle: bend.bendAngleDegrees ?? 180 });
      }

      const nextLegMm = i < bends.length - 1 ? (bends[i + 1].leftLegMm ?? 0) : (bend.rightLegMm ?? 0);
      const nextLegIn = mmToIn(nextLegMm);
      if (nextLegIn <= 0) {
        throw new Error(`Bend ${i + 1}'s trailing leg resolves to 0 or less — cannot build a valid Straight feature.`);
      }
      features.push({ type: 'Straight', length: nextLegIn });
    }
  }

  if (profile.hemEnd) {
    const leaderIn = mmToIn(profile.hemEnd.lengthMm);
    if (leaderIn <= 0) {
      throw new Error("End hem's lengthMm resolves to 0 or less — cannot build a valid Straight feature.");
    }
    features.push(hemFeature(profile.hemEnd));
    features.push({ type: 'Straight', length: leaderIn });
  }

  return features;
}

// Composes the job-identity portion of the outgoing `description`:
// "Business | Client | PO <po> | Req: <name> | <finish>", with any blank/
// missing segment dropped entirely (never rendered as an empty " | "),
// prepended to the pre-existing `AFS profile <profileNumber>` reference-code
// text — the composed identity string never REPLACES that reference text,
// only precedes it (afs-jf-003).
//
// LENGTH LIMIT CHECK (afs-jf-003, done before writing this function):
// searched diagnostics/*.json (7 capture files present) — these record only
// the outgoing POST body (see PATHFINDER_DEBUG_CAPTURE below), never the
// API's response, so they carry no evidence of a server-side limit either
// way. Read PathfinderEdge's own public docs (https://docs.amscontrols.com/
// pathfinderEdge/profile-object and .../publicapi) — `description` is
// documented only as "Free text. This travels to the machine," with no
// length constraint stated anywhere in either doc. A live over-length test
// against the real API was deliberately NOT performed: POST
// /api/v1/profiles writes directly into catalog 20115 — the one real
// catalog the physical Thalmann DS2801 polls and picks up automatically
// (see this file's own header comment and AFS_MACHINE_CATALOG_ID) — an
// irreversible, shop-floor-visible production side effect, not something
// safe to trigger from an unattended session without Reid's explicit
// go-ahead. No truncation is applied as a result. If a real limit is ever
// found, truncate the identity string only (never the "AFS profile
// <profileNumber>" reference text) in this exact priority order: po_number
// first, then clientBusinessName, then requestedBy, then clientName, then
// finish.
function composeDescription(profile: MachineProfile): string {
  const segments = [
    profile.clientBusinessName?.trim() || null,
    profile.clientName?.trim() || null,
    profile.poNumber?.trim() ? `PO ${profile.poNumber.trim()}` : null,
    profile.requestedBy?.trim() ? `Req: ${profile.requestedBy.trim()}` : null,
    profile.finish?.trim() || null,
  ].filter((s): s is string => !!s);
  const identity = segments.join(' | ');
  const reference = profile.profileNumber ? `AFS profile ${profile.profileNumber}` : '';
  if (identity && reference) return `${identity} | ${reference}`;
  return identity || reference;
}

export async function pushProfileToPathfinder(profile: MachineProfile, catalogId: string): Promise<PathfinderProfile> {
  const config = getConfig();
  if (!config) return { ...notConfigured(), profileId: null };

  const owningCatalogId = Number(catalogId);
  if (!Number.isFinite(owningCatalogId)) {
    return { status: 'error', message: `catalogId "${catalogId}" is not a valid number.`, profileId: null };
  }

  let features: PathfinderFeature[];
  try {
    features = buildFeatures(profile);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not build features from profile.',
      profileId: null,
    };
  }

  const profileName = profile.nameEn;
  const body = {
    profileName,
    description: composeDescription(profile),
    owningCatalogId,
    features,
  };

  // Permanent, opt-in diagnostic capture — replaces an ad-hoc console.log
  // used for a one-off manual capture. Silent/zero-overhead unless
  // PATHFINDER_DEBUG_CAPTURE=1 is set (not set by default in .env.local
  // or Vercel) — writes the real outgoing POST body to a file instead of
  // stdout, so it survives past whatever terminal/log buffer happened to
  // be open at push time. A write failure here is logged, never thrown —
  // this must not be able to block or fail a real PathfinderEdge push.
  if (process.env.PATHFINDER_DEBUG_CAPTURE === '1') {
    try {
      const dir = path.join(process.cwd(), 'diagnostics');
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `pathfinder-capture-${Date.now()}.json`);
      await writeFile(file, JSON.stringify(body, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PATHFINDER_DEBUG_CAPTURE] Failed to write capture file:', err);
    }
  }

  try {
    const postRes = await pathfinderFetch(config, '/api/v1/profiles', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!postRes.ok) {
      const text = await postRes.text().catch(() => '');
      return {
        status: 'error',
        message: `PathfinderEdge POST /api/v1/profiles failed: ${postRes.status}${text ? ` — ${text}` : ''}`,
        profileId: null,
      };
    }

    // Confirmed via the publicapi doc: the POST response echoes profile
    // fields but never the server-assigned profileId. Resolving it needs a
    // follow-up catalog-scoped list call, matched by profileName — if two
    // profiles in the same catalog share the exact name, this picks the
    // highest profileId (most-recently-created) as a best-effort
    // disambiguation; the real API gives no stronger guarantee than that.
    const listRes = await pathfinderFetch(
      config,
      `/api/v1/profiles?catalog=${owningCatalogId}&skip=0&take=100`,
      { method: 'GET' }
    );
    if (!listRes.ok) {
      return {
        status: 'connected',
        message: `Profile "${profileName}" created, but could not resolve its assigned profileId (GET /api/v1/profiles returned ${listRes.status}).`,
        profileId: null,
      };
    }
    const list = (await listRes.json()) as { profileId: number; profileName: string }[];
    const matches = list.filter((p) => p.profileName === profileName);
    const resolved = matches.length ? matches.reduce((a, b) => (b.profileId > a.profileId ? b : a)) : null;

    return {
      status: 'connected',
      message: resolved
        ? `Profile "${profileName}" created in catalog ${owningCatalogId} as profileId ${resolved.profileId}.`
        : `Profile "${profileName}" created in catalog ${owningCatalogId}, but its assigned profileId could not be resolved (not found among the first 100 profiles listed for that catalog).`,
      profileId: resolved ? String(resolved.profileId) : null,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Network error calling PathfinderEdge.',
      profileId: null,
    };
  }
}

export async function submitJobToMachine(
  _profileId: string,
  _quantity: number,
  _material: string,
  _notes: string
): Promise<Job> {
  return { status: 'not_configured', message: NO_JOB_API_MESSAGE, jobId: null };
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return { status: 'not_configured', message: NO_JOB_API_MESSAGE, jobId, state: 'unknown' };
}
