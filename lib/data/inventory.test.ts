import { describe, expect, it } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  ADJUSTMENT_PAGE_SIZE,
  isNotProvisionedError,
  loadStateFromError,
  mapAdjustmentRow,
  mapItemRow,
} from './inventory';

/**
 * THE READ LAYER'S SPECIFICATION.
 *
 * Three things are worth pinning here, and each one has already been a real bug
 * somewhere in this codebase or is one line away from being one:
 *
 *   1. "The migration has not been run" is a DIFFERENT state from "something
 *      broke" and from "there is nothing here yet". Collapsing them would send
 *      somebody debugging the wrong thing — and today, with migration 039
 *      deliberately unapplied, the first of the three is the live state.
 *   2. PostgREST returns `numeric` as a JSON STRING. Subtracting one of those
 *      gives NaN, silently.
 *   3. A NULL quantity must survive the mapping as `null`. The moment it
 *      becomes 0, the screen claims a measurement nobody took.
 *
 * Fixtures are plain objects shaped like the real PostgREST payloads — no
 * mocking library, nothing to keep in step with a framework version.
 */

/* ------------------------------------------------------------- fixtures */

function postgrestError(code: string, message = 'boom'): PostgrestError {
  return { code, message, details: '', hint: '' } as PostgrestError;
}

/** A row Steve created but nobody has counted. The live shape: numerics as strings. */
const UNCOUNTED_SOURCE = {
  id: 'item-1',
  material_id: 'mat-copper',
  gauge_id: 'gauge-16oz',
  finish: null,
  coil_width_in: null,
  stock_unit: 'sheet' as const,
  qty_on_hand: null,
  qty_reserved: '0',
  reorder_point: null,
  retired_at: null,
  updated_at: '2026-10-03T12:00:00.000Z',
  materials: { name: 'Copper' },
  gauges: { label: '16 oz' },
};

/** 40 on hand, 10 reserved, reorder at 12 — available 30, which is ok. */
const HEALTHY_SOURCE = {
  ...UNCOUNTED_SOURCE,
  id: 'item-2',
  finish: 'Matte Black',
  coil_width_in: '23.50',
  qty_on_hand: '40.00',
  qty_reserved: '10.00',
  reorder_point: '12.00',
};

const ADJUSTMENT_SOURCE = {
  id: 'adj-1',
  item_id: 'item-2',
  kind: 'reserve' as const,
  source: 'admin_ui',
  delta_on_hand: null,
  counted_on_hand: null,
  delta_reserved: '10.00',
  on_hand_after: '40.00',
  reserved_after: '10.00',
  reason: 'Held for the Lakeway job',
  created_at: '2026-10-03T12:00:00.000Z',
  profiles: { full_name: 'Steve Harycki' },
};

/* -------------------------------------------------- not-provisioned detection */

describe('isNotProvisionedError', () => {
  it('recognises PGRST205, which is what an unapplied migration 039 ACTUALLY produces', () => {
    // MEASURED LIVE, not assumed. This module first looked only for
    // PostgreSQL's 42P01, and opening the real screen reported the generic
    // "could not be read" error instead of the panel that names the migration
    // file: PostgREST keeps its OWN SCHEMA CACHE and refuses the request before
    // Postgres is ever reached, so 42P01 never arrives. Below is the exact
    // payload the live database returned on 2026-10-03.
    expect(
      isNotProvisionedError({
        code: 'PGRST205',
        message: "Could not find the table 'public.inventory_items' in the schema cache",
      }),
      'PGRST205 is the live signal that the migration has not been applied. Missing it turns an operator action ("run the migration") into a reported fault, and sends somebody debugging the wrong thing.'
    ).toBe(true);
  });

  it('still recognises PostgreSQL 42P01, for a path that does reach the database', () => {
    expect(
      isNotProvisionedError(postgrestError('42P01', 'relation "inventory_items" does not exist')),
      '42P01 is what SQL itself raises — a function body or a future server-side call would see it even though PostgREST does not send it'
    ).toBe(true);
  });

  it('recognises a missing function, both the SQLSTATE and PostgREST\'s own code', () => {
    expect(isNotProvisionedError(postgrestError('42883')), '42883 is undefined_function').toBe(true);
    expect(
      isNotProvisionedError(postgrestError('PGRST202')),
      "PGRST202 is PostgREST's answer when an RPC is not in the exposed schema"
    ).toBe(true);
  });

  it('falls back to the message for any of the three objects this migration owns', () => {
    for (const name of ['inventory_items', 'inventory_adjustments', 'inventory_apply_adjustment']) {
      expect(
        isNotProvisionedError(postgrestError('', `Could not find public.${name} in the schema cache`)),
        `when no code is surfaced at all, a message naming ${name} is the only signal left`
      ).toBe(true);
    }
  });

  it('does NOT explain away an unrelated failure as a missing migration', () => {
    expect(
      isNotProvisionedError(postgrestError('42501', 'new row violates row-level security policy')),
      'an RLS refusal is a real, important failure. Reporting it as "the migration has not been run" would hide a security boundary doing its job.'
    ).toBe(false);
    expect(
      isNotProvisionedError(postgrestError('23505', 'duplicate key value violates unique constraint')),
      'a duplicate is a real conflict the user can fix, not a missing table'
    ).toBe(false);
    expect(
      isNotProvisionedError(postgrestError('', 'Could not find the function public.something_else in the schema cache')),
      'the message fallback is narrowed to the three objects migration 039 owns, so another feature\'s missing object is never quietly swallowed here'
    ).toBe(false);
    expect(isNotProvisionedError(null), 'no error is not a missing table').toBe(false);
  });
});

describe('loadStateFromError', () => {
  it('maps a missing table to not_provisioned, with no error message to show', () => {
    const state = loadStateFromError(postgrestError('42P01'), 'test');
    expect(state.state, 'an unapplied migration is its own state').toBe('not_provisioned');
  });

  it('maps anything else to error, carrying a sentence that says nothing was changed', () => {
    const state = loadStateFromError(postgrestError('08006', 'connection failure'), 'test');
    expect(state.state, 'a real fault is reported as a fault, never swallowed into an empty list').toBe('error');
    if (state.state !== 'error') throw new Error('unreachable');
    expect(
      state.message,
      'CLAUDE.md rule #30: an error message says what did NOT happen. On a screen with a Save button, "nothing was changed" is the sentence that matters.'
    ).toContain('Nothing was changed');
  });
});

/* ------------------------------------------------------------ item mapping */

describe('mapItemRow', () => {
  it('keeps a never-counted quantity as null, and derives uncounted from it', () => {
    const row = mapItemRow(UNCOUNTED_SOURCE);
    expect(
      row.onHand,
      'NULL on hand must survive as null. The moment it becomes 0 the screen claims a measurement nobody took (CLAUDE.md rule #19 applied to quantities).'
    ).toBeNull();
    expect(row.available, 'available of an uncounted item is unknown, not zero').toBeNull();
    expect(row.level, 'the level is uncounted').toBe('uncounted');
    expect(row.reorderPoint, 'no threshold has been set').toBeNull();
  });

  it('converts every numeric column out of the JSON string PostgREST sends', () => {
    const row = mapItemRow(HEALTHY_SOURCE);
    expect(
      row.onHand,
      'PostgREST serialises numeric as a string because the type is wider than a double. Subtracting a string gives NaN, silently — so every numeric column is converted here.'
    ).toBe(40);
    expect(row.reserved, 'reserved converts too').toBe(10);
    expect(row.reorderPoint, 'the reorder point converts too').toBe(12);
    expect(row.coilWidthIn, 'the coil width converts too').toBe(23.5);
    expect(typeof row.onHand, 'and the result is a number, not a string that looks like one').toBe('number');
  });

  it('derives available and the level, so no component does its own arithmetic', () => {
    const row = mapItemRow(HEALTHY_SOURCE);
    expect(row.available, '40 on hand minus 10 reserved is 30 available').toBe(30);
    expect(row.level, 'available 30 against a reorder point of 12 is ok').toBe('ok');
  });

  it('derives low from the same numbers when they say so', () => {
    const row = mapItemRow({ ...HEALTHY_SOURCE, qty_on_hand: '15.00' });
    expect(row.available, '15 - 10 = 5').toBe(5);
    expect(row.level, 'available 5 against a reorder point of 12 is low').toBe('low');
  });

  it('carries the material and gauge names through the join', () => {
    const row = mapItemRow(HEALTHY_SOURCE);
    expect(row.materialName, 'the material name comes from the joined materials row').toBe('Copper');
    expect(row.gaugeLabel, 'the gauge label comes from the joined gauges row').toBe('16 oz');
    expect(row.finish, 'the printed colour name is carried verbatim — it is what AFS orders against').toBe('Matte Black');
  });

  it('says so when a join came back empty, instead of printing a blank cell', () => {
    const row = mapItemRow({ ...HEALTHY_SOURCE, materials: null, gauges: null });
    expect(
      row.materialName,
      'material_id is a NOT NULL foreign key, so a missing join is a read problem. An empty cell would read as "this item has no material", which is impossible and misleading.'
    ).toBe('Unknown material');
    expect(row.gaugeLabel, 'same for the gauge').toBe('Unknown gauge');
  });
});

/* ------------------------------------------------------ adjustment mapping */

describe('mapAdjustmentRow', () => {
  it('maps a reservation row, with its signed delta and its snapshot', () => {
    const row = mapAdjustmentRow(ADJUSTMENT_SOURCE);
    expect(row.kind, 'the kind is carried through').toBe('reserve');
    expect(row.deltaReserved, 'the signed reserved delta converts from its string').toBe(10);
    expect(row.deltaOnHand, 'a reservation does not touch on hand, and the column is null').toBeNull();
    expect(row.countedOnHand, 'a reservation is not a count').toBeNull();
    expect(row.onHandAfter, 'the snapshot makes the log auditable by reading rather than by replaying every delta').toBe(40);
    expect(row.reservedAfter, 'the reserved snapshot converts too').toBe(10);
    expect(row.reason, 'the reason is the whole point of the log and is carried verbatim').toBe('Held for the Lakeway job');
    expect(row.adjustedByName, 'and who made it').toBe('Steve Harycki');
  });

  it('keeps a count row\'s absolute value separate from a delta', () => {
    const row = mapAdjustmentRow({
      ...ADJUSTMENT_SOURCE,
      kind: 'count',
      delta_reserved: null,
      counted_on_hand: '24.00',
      on_hand_after: '24.00',
      reserved_after: '0',
    });
    expect(row.countedOnHand, 'a count stores the absolute counted value').toBe(24);
    expect(row.deltaOnHand, 'and no delta, so the log cannot be misread as an addition of 24').toBeNull();
    expect(row.onHandAfter, 'the snapshot equals the count').toBe(24);
  });

  it('survives a missing profile without losing the row', () => {
    const row = mapAdjustmentRow({ ...ADJUSTMENT_SOURCE, profiles: null });
    expect(
      row.adjustedByName,
      'the ledger is append-only, so a row whose author profile cannot be read must still be shown — dropping it would hide history'
    ).toBeNull();
    expect(row.reason, 'everything else is intact').toBe('Held for the Lakeway job');
  });
});

describe('the history page size', () => {
  it('is a stated number, because a silent cap reads as "that is all of it"', () => {
    expect(
      ADJUSTMENT_PAGE_SIZE,
      'the read asks for one more than this to know whether to report truncated — CLAUDE.md\'s no-silent-caps principle'
    ).toBe(200);
  });
});
