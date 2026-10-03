/**
 * VERSIONED NEXUS FIXTURES — EES-OVN.08.
 *
 * Explicit, hand-written, never random (Elite Test Harness: "ARRANGE with
 * explicit, versioned fixtures in tests/fixtures").
 *
 * ================== THESE ARE NOT AFS's REAL NEXUS STATES ==================
 *
 * AFS's actual nexus list is an OPEN DATA BLOCKER — CLAUDE.md DATA BLOCKERS,
 * "Tax nexus states", checklist #31. Nobody has supplied it. The states below
 * are test scaffolding chosen to exercise each branch of the nexus logic (in
 * force, not yet in force, expired, recorded-but-not-collecting), and they must
 * never be copied into a seed, a migration or any runtime default.
 *
 * `FIXTURE_VERSION` is bumped whenever a shape here changes, so a test failure
 * caused by a fixture edit is distinguishable from one caused by a code change.
 */

import type { NexusState } from '@/lib/tax/types';

export const FIXTURE_VERSION = '2026-10-03.1';

/** The reference "today" every fixture-based test uses. Fixed, never `new Date()`. */
export const FIXTURE_TODAY = '2026-10-03';

/** In force today, collecting. The ordinary case. */
export const NEXUS_TX_COLLECTING: NexusState = {
  id: '00000000-0000-4000-8000-000000000001',
  stateCode: 'TX',
  collecting: true,
  basis: 'physical_presence',
  registrationId: 'TEST-TX-0001',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  note: 'Fixture only — not AFS real data.',
};

/**
 * Nexus RECORDED but AFS is not collecting: the accountant has reported nexus,
 * registration is not finished. Must never produce a calculated tax.
 */
export const NEXUS_CA_NOT_COLLECTING: NexusState = {
  id: '00000000-0000-4000-8000-000000000002',
  stateCode: 'CA',
  collecting: false,
  basis: 'economic_threshold',
  registrationId: null,
  effectiveFrom: '2026-02-01',
  effectiveTo: null,
  note: 'Fixture only — registration not complete.',
};

/** Window already closed — AFS deregistered. Not in force on FIXTURE_TODAY. */
export const NEXUS_OK_EXPIRED: NexusState = {
  id: '00000000-0000-4000-8000-000000000003',
  stateCode: 'OK',
  collecting: true,
  basis: 'employee_presence',
  registrationId: 'TEST-OK-0003',
  effectiveFrom: '2025-01-01',
  effectiveTo: '2026-06-30',
  note: 'Fixture only — window closed before FIXTURE_TODAY.',
};

/** Window has not opened yet — registered ahead of time. Not in force today. */
export const NEXUS_NM_FUTURE: NexusState = {
  id: '00000000-0000-4000-8000-000000000004',
  stateCode: 'NM',
  collecting: true,
  basis: 'voluntary',
  registrationId: 'TEST-NM-0004',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  note: 'Fixture only — starts after FIXTURE_TODAY.',
};

/** All four, in a deliberately unsorted order so fingerprint sorting is exercised. */
export const NEXUS_LIST_MIXED: readonly NexusState[] = [
  NEXUS_NM_FUTURE,
  NEXUS_TX_COLLECTING,
  NEXUS_OK_EXPIRED,
  NEXUS_CA_NOT_COLLECTING,
];

/** The empty list — the state this feature actually ships in. */
export const NEXUS_LIST_EMPTY: readonly NexusState[] = [];
