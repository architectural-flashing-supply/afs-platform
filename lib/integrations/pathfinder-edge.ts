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
  // This codebase's INTERIOR/included angle, signed in FlashDraft's own
  // y-DOWN world coordinates. This is NOT what PathfinderEdge's `angle`
  // field means — see specBendAngleDegrees below and buildFeatures's
  // toSpecBendAngle. Kept as-is because it is what machine_jobs.custom_bends,
  // machine_profile_bends and every geometry summary already store.
  bendAngleDegrees: number | null;
  radiusMm: number | null;
  // PathfinderEdge's own BEND angle for this fold, already in the spec's
  // orientation and sign convention (+ = left/counter-clockwise, - =
  // right/clockwise, magnitude = 180 - interior). Set directly by
  // flashDraftToMachineProfile, which has the real point geometry and can
  // compute it unambiguously from segment headings. When absent (the
  // fallback/library paths, which have no points), buildFeatures derives it
  // from bendAngleDegrees instead.
  specBendAngleDegrees?: number | null;
  // TRUE only for a deliberate long curving arc that the machine should
  // execute as a series of shallow bends (PathfinderEdge `Radius`). An
  // ordinary fold with a corner radius is NOT this. FlashDraft has no
  // curved-arc concept at all, so nothing sets this today and no Radius
  // feature is ever emitted — see buildFeatures. Present so the capability
  // is gated explicitly rather than inferred from `radiusMm > 0`, which is
  // what made every AFS profile unmanufacturable.
  isCurvedArc?: boolean;
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
  // PathfinderEdge profile-level `paintedSide` (spec p.5): which side of the
  // FIRST segment is painted. 'Positive' = left of the first segment,
  // 'Negative' = right, 'None' = unpainted. Omitted entirely when null.
  paintedSide?: PaintedSide | null;
}

export type PaintedSide = 'Positive' | 'Negative' | 'None';

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

// F-01 (audit 2026-09-24). Every dimension guard in buildFeatures below used
// to read `if (x <= 0) throw`. That is FALSE for NaN and for Infinity — so a
// non-finite value passed every guard, and JSON.stringify then serialised it
// to the literal `null`, producing a structurally valid POST into catalog
// 20115 (the catalog the physical Thalmann DS2801 polls automatically)
// carrying `{"type":"Straight","length":null}`. Confirmed by executed repro,
// not inferred.
//
// The ordering matters: Number.isFinite is checked FIRST, because any
// comparison against NaN silently returns false and would let it through.
// Every dimension that reaches the wire goes through this one function so
// the rule cannot drift apart across call sites.
function assertPositiveDimension(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${label} is not a finite number (got ${String(value)}) — refusing to build a machine feature from it.`
    );
  }
  if (value <= 0) {
    throw new Error(`${label} resolves to 0 or less — cannot build a valid Straight feature.`);
  }
  return value;
}

// Bend angles are legitimately negative and legitimately zero (a flat
// hairpin — see flashdraft-to-pathfinder.ts's bendAngleAt boundary notes),
// so they get a finiteness check WITHOUT the positivity check that would be
// wrong for them. PathfinderEdge documents the field as -180 to 180.
function assertFiniteAngle(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${label} is not a finite number (got ${String(value)}) — refusing to build a machine feature from it.`
    );
  }
  if (value < -180 || value > 180) {
    throw new Error(`${label} is ${value}°, outside PathfinderEdge's documented -180..180 range.`);
  }
  return value;
}

// Last line of defence, run on the fully composed body immediately before
// it is serialised and sent. Walks every numeric leaf and rejects any
// non-finite one. This is deliberately redundant with the per-feature
// guards above: it is what stops a FUTURE call site, or a future feature
// type, from reintroducing F-01 without anyone noticing.
function assertBodyAllFinite(body: unknown, path = 'body'): void {
  if (typeof body === 'number') {
    if (!Number.isFinite(body)) {
      throw new Error(`${path} is ${String(body)} — a non-finite number must never reach PathfinderEdge.`);
    }
    return;
  }
  if (Array.isArray(body)) {
    body.forEach((v, i) => assertBodyAllFinite(v, `${path}[${i}]`));
    return;
  }
  if (body && typeof body === 'object') {
    for (const [k, v] of Object.entries(body)) assertBodyAllFinite(v, `${path}.${k}`);
  }
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
// SPEC (Profile-Object.pdf p.2): hemDirection "defines to which side of the
// material the hem is bent" — Positive = left, Negative = right. (The PDF's
// own parenthetical pairs "left" with "clockwise" here, contradicting its
// Angle section, which pairs "+ / left" with "counter clockwise". The
// left/right half is consistent across both sections and across
// paintedSide's "left (Positive) or right (Negative)", so left/right is
// what this code keys off.)
//
// FlashDraft's HemKick is 'outside' | 'inside' — relative to the profile's
// own convex face, NOT to left/right. Resolving it therefore needs the
// adjacent bend: if the profile turns LEFT at that end, its convex/outside
// face is on the RIGHT, and vice versa. The previous implementation ignored
// geometry entirely and returned a fixed Positive/Negative per kick, which
// is right only half the time.
//
// adjacentBendAngle is the spec-signed bend angle of the bend nearest this
// hem (the first bend for hemStart, the last for hemEnd). With no bends at
// all the profile is a flat strip with no convex face, so 'outside' has no
// geometric meaning — 'Positive' is an arbitrary but documented default.
function hemDirection(kick: HemKick, adjacentBendAngle: number | null): 'Positive' | 'Negative' {
  if (adjacentBendAngle == null || adjacentBendAngle === 0) {
    return kick === 'outside' ? 'Positive' : 'Negative';
  }
  const turnsLeft = adjacentBendAngle > 0;
  const outsideIsLeft = !turnsLeft;
  const wantLeft = kick === 'outside' ? outsideIsLeft : !outsideIsLeft;
  return wantLeft ? 'Positive' : 'Negative';
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
function hemFeature(hem: MachineProfileHem, adjacentBendAngle: number | null): PathfinderFeature {
  const direction = hemDirection(hem.kick, adjacentBendAngle);
  if (hem.type === 'open') {
    // F-01: gapMm reaches the wire as hemHeight, so it needs the same
    // finiteness guard as every other dimension. Zero is allowed here (a
    // fully-collapsed gap is a real, if unusual, open hem) — only
    // non-finite and negative values are rejected.
    const hemHeight = mmToIn(hem.gapMm);
    if (!Number.isFinite(hemHeight)) {
      throw new Error(
        `Open hem's gapMm is not a finite number (got ${String(hem.gapMm)}) — refusing to build a machine feature from it.`
      );
    }
    if (hemHeight < 0) {
      throw new Error(`Open hem's gapMm is negative (${hemHeight}") — not fabricable.`);
    }
    return { type: 'OpenHem', hemHeight, hemDirection: direction };
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
// Converts this codebase's signed INTERIOR angle (FlashDraft's y-down world
// convention) into PathfinderEdge's BEND angle (spec p.1: "the amount to
// bend", sign - for right/clockwise, + for left/counter-clockwise).
//
// Two separate corrections happen here, and they were the two defects that
// made every AFS-created profile unmanufacturable ("Thalmann:fail"):
//
//   MAGNITUDE. The spec wants 180 - interior, not the interior angle. An
//   ordinary 90° fold happens to be 90 either way, which is why this went
//   unnoticed; the spec's own "V Shaped Thingy" (interior 45°) is Angle 135,
//   and a FlashDraft V used to go out as 45.
//
//   SIGN. FlashDraft's world coordinates are y-DOWN (app/studio/draft/
//   page.tsx's worldToScreen is a pure scale+translate with no y flip), so
//   an atan2-derived signed angle has the opposite handedness from the
//   spec's orientation. Negating is what un-mirrors the profile — this is
//   the cause of PathfinderEdge rendering AFS parts as a mirror image of
//   the FlashDraft drawing.
//
// BOUNDARIES: interior ±180 means "straight through, no bend" -> 0.
// interior 0 means a flat hairpin -> 180 (a half turn; +180 by convention,
// since a fully-folded hairpin has no meaningful handedness in 2D).
export function toSpecBendAngle(interiorSignedDegrees: number): number {
  const interior = interiorSignedDegrees;
  if (Math.abs(interior) === 180) return 0;
  if (interior === 0) return 180;
  return -Math.sign(interior) * (180 - Math.abs(interior));
}

// Resolves the spec bend angle for one bend, preferring the value the
// producer computed directly from real point geometry.
function specBendAngleOf(bend: MachineProfileBend, label: string): number {
  const direct = bend.specBendAngleDegrees;
  if (direct !== undefined && direct !== null) {
    return assertFiniteAngle(direct, label);
  }
  return assertFiniteAngle(toSpecBendAngle(bend.bendAngleDegrees ?? 180), label);
}

// Builds the alternating Straight / non-Straight feature list the spec
// requires (p.1: "every Profile will have an odd number of Features in its
// list, and the first and last Feature will always be legs").
//
// FEATURE CHOICE (the F-02 fix). Every ordinary fold is an `Angle`. A
// `Radius` is reserved for what the spec actually describes it as (p.3): "a
// long, curving arc", executed at the machine as many shallow bends around
// an imaginary circle. A normal fold that merely has a corner radius is NOT
// that. This encoder previously emitted `Radius` for every bend whose
// radiusMm > 0 — which is every FlashDraft bend, since FlashDraft assigns a
// default corner radius by material — and PathfinderEdge consequently
// reported bendCount 0 and flagged the parts unmanufacturable. FlashDraft
// has no curved-arc concept at all, so `isCurvedArc` is never set and no
// Radius feature is emitted from any current call site; the branch is kept,
// explicitly gated, for a future real arc feature.
//
// Hem placement follows the spec's own worked example verbatim (p.5-6): the
// hem's return length is just another Straight adjacent to it, so a hemmed
// end reads [Straight(return), Hem, Straight(leg) ... Straight(leg), Hem,
// Straight(return)]. That also satisfies the start-and-end-with-Straight
// rule.
function buildFeatures(profile: MachineProfile): PathfinderFeature[] {
  const bends = profile.bends ?? [];
  const features: PathfinderFeature[] = [];

  // Resolved up front: the hems need the adjacent bend's direction to map
  // FlashDraft's outside/inside kick onto the spec's left/right.
  const specAngles = bends.map((b, i) => specBendAngleOf(b, `Bend ${i + 1}'s angle`));
  const firstBendAngle = specAngles.length ? specAngles[0] : null;
  const lastBendAngle = specAngles.length ? specAngles[specAngles.length - 1] : null;

  if (profile.hemStart) {
    const leaderIn = assertPositiveDimension(mmToIn(profile.hemStart.lengthMm), "Start hem's lengthMm");
    features.push({ type: 'Straight', length: leaderIn });
    features.push(hemFeature(profile.hemStart, firstBendAngle));
  }

  if (bends.length === 0) {
    const lengthIn = mmToIn(profile.blankWidthMm ?? 0);
    if (!Number.isFinite(lengthIn)) {
      throw new Error(
        `blankWidthMm is not a finite number (got ${String(profile.blankWidthMm)}) — refusing to build a machine feature from it.`
      );
    }
    if (lengthIn <= 0) {
      throw new Error('Profile has no bends and no positive blankWidthMm — nothing to push.');
    }
    features.push({ type: 'Straight', length: lengthIn });
  } else {
    const firstLegIn = assertPositiveDimension(mmToIn(bends[0].leftLegMm ?? 0), "First leg's length");
    features.push({ type: 'Straight', length: firstLegIn });

    for (let i = 0; i < bends.length; i++) {
      const bend = bends[i];
      const angle = specAngles[i];

      if (bend.isCurvedArc === true) {
        const radiusMm = bend.radiusMm ?? 0;
        features.push({
          type: 'Radius',
          radius: assertPositiveDimension(mmToIn(radiusMm), `Bend ${i + 1}'s arc radius`),
          radiusQuality: 'Medium',
          angle,
        });
      } else {
        features.push({ type: 'Angle', angle });
      }

      const nextLegMm = i < bends.length - 1 ? (bends[i + 1].leftLegMm ?? 0) : (bend.rightLegMm ?? 0);
      const nextLegIn = assertPositiveDimension(mmToIn(nextLegMm), `Bend ${i + 1}'s trailing leg`);
      features.push({ type: 'Straight', length: nextLegIn });
    }
  }

  if (profile.hemEnd) {
    const leaderIn = assertPositiveDimension(mmToIn(profile.hemEnd.lengthMm), "End hem's lengthMm");
    features.push(hemFeature(profile.hemEnd, lastBendAngle));
    features.push({ type: 'Straight', length: leaderIn });
  }

  return features;
}

// Test-only seam onto buildFeatures. buildFeatures stays private because
// nothing outside this module should be composing PathfinderEdge feature
// arrays; the conformance suite needs to assert the exact array, so it gets
// an explicit named export rather than reaching into module internals.
export function buildFeaturesForTest(profile: MachineProfile): PathfinderFeature[] {
  return buildFeatures(profile);
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
  const description = composeDescription(profile);
  // paintedSide is profile-level and OPTIONAL (spec p.5) — omitted entirely
  // rather than sent as null when the caller has no paint selection, so the
  // body stays exactly what the spec documents. `description` is likewise
  // dropped when empty.
  const body: {
    profileName: string;
    description?: string;
    owningCatalogId: number;
    paintedSide?: PaintedSide;
    features: PathfinderFeature[];
  } = {
    profileName,
    ...(description ? { description } : {}),
    owningCatalogId,
    ...(profile.paintedSide ? { paintedSide: profile.paintedSide } : {}),
    features,
  };

  // F-01 backstop. buildFeatures already guards every dimension it builds,
  // but this walks the fully-composed body one last time before it is
  // serialised — so a future feature type or a future call site cannot
  // reintroduce a non-finite number without tripping here first. Returned
  // as a normal error result (not thrown) so it surfaces to the operator
  // exactly like any other pre-flight failure.
  try {
    assertBodyAllFinite(body);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Outgoing profile body failed its finiteness check.',
      profileId: null,
    };
  }

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

    // The POST response DOES carry the server-assigned profileId. This
    // file previously asserted the opposite and always performed a
    // follow-up catalog listing to recover it — confirmed wrong by the
    // controlled experiment of 2026-09-25, whose 200 response body was
    // `{"profileId":32950795,...}`. Reading it here is exact, costs no
    // extra round trip, and cannot mis-resolve when two profiles share a
    // name. The listing lookup is kept ONLY as a fallback for a response
    // that omits or malforms the field.
    const postText = await postRes.text().catch(() => '');
    let created: { profileId?: unknown } | null = null;
    try {
      created = postText ? (JSON.parse(postText) as { profileId?: unknown }) : null;
    } catch {
      created = null;
    }
    const directId =
      created && (typeof created.profileId === 'number' || typeof created.profileId === 'string')
        ? String(created.profileId)
        : null;
    if (directId) {
      return {
        status: 'connected',
        message: `Profile "${profileName}" created in catalog ${owningCatalogId} as profileId ${directId}.`,
        profileId: directId,
      };
    }

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
        ? `Profile "${profileName}" created in catalog ${owningCatalogId} as profileId ${resolved.profileId} (resolved via listing fallback).`
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
