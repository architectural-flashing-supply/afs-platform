/**
 * VERSIONED TEST FIXTURES for the order validator. Explicit, never random.
 *
 * Every profile constraint below is copied from the REAL seeded row in
 * supabase/migrations/002_seed_afs_data.sql, value for value, so a test that
 * passes here is a test that passes against the live data. The NULLs are real
 * too: Counter Flashing genuinely has no Leg B range, Fascia has no leg ranges
 * at all, and Custom Profile has none of the eight bounds — which is why the
 * range rules are tested bound by bound rather than as one block.
 *
 * Fixtures live in `lib/` rather than `tests/fixtures/` because `vitest.config.mts`
 * only collects `lib/**` for unit tests, and a fixture the suite cannot import
 * is not a fixture. Nothing in the application imports this file.
 */

import type { OrderValidatorItem, ProfileConstraints } from './types';

/** Coping Cap — W 6-36, H 4-16, Leg A 2-8, Leg B 2-8, max 12 ft. */
export const COPING_CAP_CONSTRAINTS: ProfileConstraints = {
  slug: 'coping-cap',
  name: 'Coping Cap',
  minWidth: 6,
  maxWidth: 36,
  minHeight: 4,
  maxHeight: 16,
  minLegA: 2,
  maxLegA: 8,
  minLegB: 2,
  maxLegB: 8,
  maxLengthFt: 12,
  requiresConsultation: false,
};

/** Counter Flashing — W 3-12, H 2-8, Leg A 1-4, NO Leg B range, max 12 ft. */
export const COUNTER_FLASHING_CONSTRAINTS: ProfileConstraints = {
  slug: 'counter-flashing',
  name: 'Counter Flashing',
  minWidth: 3,
  maxWidth: 12,
  minHeight: 2,
  maxHeight: 8,
  minLegA: 1,
  maxLegA: 4,
  minLegB: null,
  maxLegB: null,
  maxLengthFt: 12,
  requiresConsultation: false,
};

/** Fascia — W 6-24, H 4-12, NO leg ranges at all, max 12 ft. */
export const FASCIA_CONSTRAINTS: ProfileConstraints = {
  slug: 'fascia',
  name: 'Fascia',
  minWidth: 6,
  maxWidth: 24,
  minHeight: 4,
  maxHeight: 12,
  minLegA: null,
  maxLegA: null,
  minLegB: null,
  maxLegB: null,
  maxLengthFt: 12,
  requiresConsultation: false,
};

/** Scupper — requires consultation, and has NO max length. */
export const SCUPPER_CONSTRAINTS: ProfileConstraints = {
  slug: 'scupper',
  name: 'Scupper',
  minWidth: 4,
  maxWidth: 24,
  minHeight: 4,
  maxHeight: 24,
  minLegA: 2,
  maxLegA: 12,
  minLegB: 2,
  maxLegB: 12,
  maxLengthFt: null,
  requiresConsultation: true,
};

/** Expansion Joint — max 20 ft, so a 15 ft piece is legal but needs splicing. */
export const EXPANSION_JOINT_CONSTRAINTS: ProfileConstraints = {
  slug: 'expansion-joint',
  name: 'Expansion Joint',
  minWidth: 4,
  maxWidth: 18,
  minHeight: 2,
  maxHeight: 8,
  minLegA: null,
  maxLegA: null,
  minLegB: null,
  maxLegB: null,
  maxLengthFt: 20,
  requiresConsultation: true,
};

/** Every constraint fixture, as the engine takes them. */
export const ALL_CONSTRAINTS: readonly ProfileConstraints[] = [
  COPING_CAP_CONSTRAINTS,
  COUNTER_FLASHING_CONSTRAINTS,
  FASCIA_CONSTRAINTS,
  SCUPPER_CONSTRAINTS,
  EXPANSION_JOINT_CONSTRAINTS,
];

/**
 * A coping cap that breaks no rule. Every dimension sits inside its real range,
 * the legs fit inside the width, the gauge is heavy enough for the span, and the
 * piece comes off one sheet.
 */
export const VALID_COPING_CAP_ITEM: OrderValidatorItem = {
  profileType: 'Coping Cap',
  material: 'Galvanized Steel',
  gauge: '20 ga',
  width: 12,
  height: 6,
  legA: 3,
  legB: 3,
  lengthFt: 10,
  quantity: 4,
};

/**
 * A clean FlashDraft drawing: an L, two legs of 6 in and 4 in, drawn in world
 * inches exactly as `quote_requests.line_items[].points` stores it.
 */
export const VALID_DRAWN_ITEM: OrderValidatorItem = {
  profileType: 'Custom FlashDraft Profile',
  profileName: 'Shop L-angle',
  material: 'Galvanized Steel',
  gauge: '24 ga',
  lengthFt: 10,
  quantity: 2,
  points: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 4 },
  ],
};

/** A polyline that genuinely crosses itself: the third leg cuts back over the first. */
export const SELF_CROSSING_POINTS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 5, y: -5 },
];

/** A "Z" — three legs, two bends, no crossing. The non-regression case. */
export const Z_PROFILE_POINTS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 20, y: 10 },
];

/** A "W" — four legs, three bends, no crossing. */
export const W_PROFILE_POINTS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 5, y: 10 },
  { x: 10, y: 0 },
  { x: 15, y: 10 },
];

/** Builds a straight polyline with `bendCount` interior vertices. */
export function staircasePoints(bendCount: number, legIn = 2): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  for (let i = 0; i < bendCount + 1; i += 1) {
    const previous = points[points.length - 1];
    points.push(i % 2 === 0 ? { x: previous.x + legIn, y: previous.y } : { x: previous.x, y: previous.y + legIn });
  }
  return points;
}
