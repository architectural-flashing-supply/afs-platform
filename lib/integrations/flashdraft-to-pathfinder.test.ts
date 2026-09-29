/**
 * F-01 regression tests (audit 2026-09-24).
 *
 * The defect: every dimension guard on the outgoing PathfinderEdge payload
 * was written `if (x <= 0) throw`. That comparison is FALSE for NaN and for
 * Infinity, so non-finite geometry passed every guard, and JSON.stringify
 * then serialised it to the literal `null` — producing a structurally valid
 * POST into catalog 20115, the catalog the physical Thalmann DS2801 polls
 * automatically, carrying `{"type":"Straight","length":null}`.
 *
 * These are the tests that would have caught it. They are deliberately pure
 * — `flashDraftToMachineProfile` touches no network and no database, and the
 * `pushProfileToPathfinder` cases below all reject BEFORE any fetch is
 * attempted, so nothing here can reach the real machine catalog.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ONE DOOR (2026-09-30): pushProfileToPathfinder now verifies its
// ApprovalContext against the database before anything else. These tests are
// about the GEOMETRY guards, so the approval lookup is stubbed to succeed —
// an admin actor and a quote request still 'submitted'. The dedicated
// single-door tests live in ./pathfinder-single-door.test.ts and stub it the
// other way. Still no real network: supabase-js is mocked entirely.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'profiles'
              ? { data: { id: 'admin-1', role: 'admin' }, error: null }
              : { data: { id: 'qr-1', status: 'submitted' }, error: null },
        }),
      }),
    }),
  }),
}));

const APPROVAL = { kind: 'quote_request_approval' as const, quoteRequestId: 'qr-1', adminId: 'admin-1' };
import { flashDraftToMachineProfile, type FlashDraftPointInput } from './flashdraft-to-pathfinder';
import { pushProfileToPathfinder, type MachineProfile } from './pathfinder-edge';

const SQUARE: FlashDraftPointInput[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

function baseInput(points: FlashDraftPointInput[] = SQUARE) {
  return { profileName: 'Test profile', points, material: 'Aluminum', thicknessIn: 0.04 };
}

/** Recursively collects every numeric leaf, so a test can assert all-finite. */
function numericLeaves(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numericLeaves(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numericLeaves(v, out));
  return out;
}

describe('flashDraftToMachineProfile — finite geometry (happy path)', () => {
  it('converts a well-formed profile and emits only finite numbers', () => {
    const profile = flashDraftToMachineProfile(baseInput());

    expect(profile.blankWidthMm).toBeCloseTo(20 * 25.4, 6);
    expect(profile.bends).toHaveLength(1);
    expect(profile.bends[0].leftLegMm).toBeCloseTo(10 * 25.4, 6);
    expect(profile.bends[0].rightLegMm).toBeCloseTo(10 * 25.4, 6);

    const leaves = numericLeaves(profile);
    expect(leaves.length).toBeGreaterThan(0);
    for (const n of leaves) expect(Number.isFinite(n)).toBe(true);
  });

  it('accepts a legitimate zero bend angle (flat hairpin) without rejecting it', () => {
    // Doubling back on itself: the interior angle is 0, which is a real
    // fabricable case and must NOT be caught by the finiteness guards.
    const profile = flashDraftToMachineProfile(
      baseInput([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0.0001 },
      ])
    );
    expect(Number.isFinite(profile.bends[0].bendAngleDegrees as number)).toBe(true);
  });
});

describe('flashDraftToMachineProfile — F-01 rejections', () => {
  it('rejects a non-numeric coordinate instead of propagating NaN', () => {
    const points = [{ x: 0, y: 0 }, { x: 'abc' as unknown as number, y: 5 }, { x: 10, y: 5 }];
    expect(() => flashDraftToMachineProfile(baseInput(points))).toThrow(/non-finite coordinates/i);
  });

  it('rejects NaN coordinates', () => {
    const points = [{ x: 0, y: 0 }, { x: NaN, y: 5 }, { x: 10, y: 5 }];
    expect(() => flashDraftToMachineProfile(baseInput(points))).toThrow(/non-finite coordinates/i);
  });

  it('rejects Infinity coordinates — the localStorage vector', () => {
    // JSON.parse('{"x": 1e999}') yields Infinity, and `typeof Infinity` is
    // 'number', so this is what a corrupt autosave entry actually produces.
    const parsed = JSON.parse('{"x": 1e999, "y": 0}') as { x: number; y: number };
    expect(parsed.x).toBe(Infinity);

    const points = [{ x: 0, y: 0 }, parsed, { x: 10, y: 5 }];
    expect(() => flashDraftToMachineProfile(baseInput(points))).toThrow(/non-finite coordinates/i);
  });

  it('rejects a non-finite bend radius', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0, radius: NaN }, { x: 10, y: 10 }];
    expect(() => flashDraftToMachineProfile(baseInput(points))).toThrow(/non-finite bend radius/i);
  });

  it('rejects a hem missing its dimensions (the {} / [] vector)', () => {
    const bad = {} as unknown as { type: 'open'; gapIn: number; lengthIn: number; kick: 'outside' };
    expect(() => flashDraftToMachineProfile({ ...baseInput(), hemStart: bad })).toThrow(/non-finite dimensions/i);
  });

  it('rejects a hem with a NaN length', () => {
    const bad = { type: 'open' as const, gapIn: 0.1875, lengthIn: NaN, kick: 'outside' as const };
    expect(() => flashDraftToMachineProfile({ ...baseInput(), hemEnd: bad })).toThrow(/non-finite dimensions/i);
  });
});

describe('pushProfileToPathfinder — guards fire before any network call', () => {
  const ORIGINAL = { base: process.env.PATHFINDER_EDGE_BASE_URL, key: process.env.PATHFINDER_EDGE_API_KEY };

  beforeEach(() => {
    // Stub credentials so getConfig() succeeds and execution reaches the
    // feature builder. Every case below rejects before fetch is reached, so
    // this host is never contacted.
    process.env.PATHFINDER_EDGE_BASE_URL = 'https://pathfinder.invalid';
    process.env.PATHFINDER_EDGE_API_KEY = 'test-key-not-real';
    // ONE DOOR: the approval check runs before the geometry guards, so it
    // needs service-role credentials present to get as far as verifying the
    // (mocked) approval. supabase-js itself is mocked at the top of this
    // file, so nothing is contacted.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-key';
  });

  afterEach(() => {
    if (ORIGINAL.base === undefined) delete process.env.PATHFINDER_EDGE_BASE_URL;
    else process.env.PATHFINDER_EDGE_BASE_URL = ORIGINAL.base;
    if (ORIGINAL.key === undefined) delete process.env.PATHFINDER_EDGE_API_KEY;
    else process.env.PATHFINDER_EDGE_API_KEY = ORIGINAL.key;
  });

  function machineProfile(overrides: Partial<MachineProfile>): MachineProfile {
    return {
      id: 'test',
      nameEn: 'Test',
      profileNumber: 'FD-TEST',
      blankWidthMm: 254,
      bends: [],
      ...overrides,
    };
  }

  it('rejects a NaN leg length rather than sending length: null', async () => {
    const result = await pushProfileToPathfinder(
      machineProfile({ bends: [{ stepNumber: 1, leftLegMm: NaN, rightLegMm: 254, bendAngleDegrees: 90, radiusMm: 0 }] }),
      '20115', APPROVAL);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not a finite number/i);
    expect(result.profileId).toBeNull();
  });

  it('rejects an Infinity leg length', async () => {
    const result = await pushProfileToPathfinder(
      machineProfile({
        bends: [{ stepNumber: 1, leftLegMm: Infinity, rightLegMm: 254, bendAngleDegrees: 90, radiusMm: 0 }],
      }),
      '20115', APPROVAL);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not a finite number/i);
  });

  it('rejects a NaN bend angle', async () => {
    const result = await pushProfileToPathfinder(
      machineProfile({
        bends: [{ stepNumber: 1, leftLegMm: 254, rightLegMm: 254, bendAngleDegrees: NaN, radiusMm: 0 }],
      }),
      '20115', APPROVAL);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not a finite number/i);
  });

  it('rejects a NaN blankWidthMm on a bendless profile', async () => {
    const result = await pushProfileToPathfinder(machineProfile({ blankWidthMm: NaN, bends: [] }), '20115', APPROVAL);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not a finite number/i);
  });

  it('rejects a NaN hem gap, which reaches the wire as hemHeight', async () => {
    const result = await pushProfileToPathfinder(
      machineProfile({ hemStart: { type: 'open', lengthMm: 12.7, gapMm: NaN, kick: 'outside' } }),
      '20115', APPROVAL);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not a finite number/i);
  });

  it('still rejects a plain zero-length leg (the original guard is intact)', async () => {
    const result = await pushProfileToPathfinder(
      machineProfile({ bends: [{ stepNumber: 1, leftLegMm: 0, rightLegMm: 254, bendAngleDegrees: 90, radiusMm: 0 }] }),
      '20115', APPROVAL);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/0 or less/i);
  });
});

describe('F-01 root cause — the properties that made it invisible', () => {
  it('documents why `<= 0` guards could not catch non-finite values', () => {
    expect(NaN <= 0).toBe(false);
    expect(Infinity <= 0).toBe(false);
    expect(Number.isFinite(NaN)).toBe(false);
    expect(Number.isFinite(Infinity)).toBe(false);
  });

  it('documents that JSON.stringify turns non-finite numbers into null', () => {
    expect(JSON.stringify({ type: 'Straight', length: NaN })).toBe('{"type":"Straight","length":null}');
    expect(JSON.stringify({ type: 'Straight', length: Infinity })).toBe('{"type":"Straight","length":null}');
  });

  it('documents that typeof alone accepts non-finite numbers', () => {
    expect(typeof NaN).toBe('number');
    expect(typeof Infinity).toBe('number');
    expect(Number.isFinite(JSON.parse('{"x":1e999}').x)).toBe(false);
  });
});
