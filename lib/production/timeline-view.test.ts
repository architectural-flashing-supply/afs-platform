/**
 * EES-OVN.06 AC-01 through AC-12. Tests the production timeline's view model —
 * the rules that decide what each of the three audiences sees.
 *
 * ARRANGE uses the explicit fixtures at the top of this file, never random
 * data; ACT calls `buildTimelineView` once per test; ASSERT compares exact
 * values with a message naming expected, actual and why it matters.
 * No TEARDOWN is needed: the module is pure and touches nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_STAGES,
  TIMELINE_VARIANTS,
  TIMELINE_POST_PRODUCTION_STAGE,
  stageLabel,
  type TimelineVariant,
} from '@/lib/admin/orderStages';
import {
  PHOTO_SLOT_AFTER_STAGE,
  PRE_SHIP_PHOTO_CAPTION,
  TIMELINE_ERROR_BODY,
  TIMELINE_ERROR_HEADLINE,
  TRACKING_ROW_STAGE,
  VARIANT_RULES,
  buildTimelineView,
  resolveTrackingUrl,
  type BuildTimelineViewInput,
  type StatusHistoryEntry,
} from '@/lib/production/timeline-view';

// ---------------------------------------------------------------------------
// FIXTURES — fixed timestamps, in order, so every assertion below is exact.
// ---------------------------------------------------------------------------
const T_SUBMITTED = '2026-01-15T15:02:00.000Z';
const T_RECEIVED = '2026-01-15T16:47:00.000Z';
const T_IN_QUEUE = '2026-01-16T14:00:00.000Z';
const T_CUTTING = '2026-01-17T13:15:00.000Z';
const T_CUTTING_AGAIN = '2026-01-18T13:15:00.000Z';
const T_CANCELLED = '2026-01-16T18:30:00.000Z';
const T_PACKAGED = '2026-01-20T15:00:00.000Z';
const T_SHIPPED = '2026-01-21T15:00:00.000Z';

const HISTORY_TO_CUTTING: StatusHistoryEntry[] = [
  { status: 'submitted', changedAt: T_SUBMITTED, note: null, changedByName: null },
  { status: 'received', changedAt: T_RECEIVED, note: 'Reviewed drawings.', changedByName: 'Tricia' },
  { status: 'in_queue', changedAt: T_IN_QUEUE, note: null, changedByName: 'Steve' },
  { status: 'cutting', changedAt: T_CUTTING, note: 'Coil pulled.', changedByName: 'Steve' },
];

const HISTORY_TO_IN_QUEUE_THEN_CANCELLED: StatusHistoryEntry[] = [
  { status: 'submitted', changedAt: T_SUBMITTED, note: null, changedByName: null },
  { status: 'received', changedAt: T_RECEIVED, note: null, changedByName: null },
  { status: 'in_queue', changedAt: T_IN_QUEUE, note: null, changedByName: null },
  { status: 'cancelled', changedAt: T_CANCELLED, note: 'Customer withdrew.', changedByName: 'Tricia' },
];

const STAGE_KEYS = ORDER_STAGES.map((s) => s.key);

function input(overrides: Partial<BuildTimelineViewInput> = {}): BuildTimelineViewInput {
  return {
    currentStatus: 'cutting',
    statusHistory: HISTORY_TO_CUTTING,
    variant: 'customer',
    ...overrides,
  };
}

/** Every status `orders.status` accepts (migration 007 §6a widened it to 13). */
const ALL_ACCEPTED_STATUSES = [...STAGE_KEYS, 'cancelled', 'in_production', 'packaged', 'out_for_delivery'];

// ---------------------------------------------------------------------------
// AC-01 / AC-02 — the config module and its one label decision
// ---------------------------------------------------------------------------
describe('ORDER_STAGES config (AC-01)', () => {
  it('declares customerLabel, adminLabel and description on all nine stages in production order', () => {
    expect(STAGE_KEYS, 'stage key order IS the production sequence — reordering silently breaks QuickAdvanceButton, backward-move detection and every timeline').toEqual([
      'submitted',
      'received',
      'in_queue',
      'cutting',
      'bending',
      'qc',
      'ready',
      'shipped',
      'delivered',
    ]);

    for (const stage of ORDER_STAGES) {
      expect(
        Object.keys(stage).sort(),
        `stage "${stage.key}" must carry exactly key/customerLabel/adminLabel/description — a missing field means one audience falls back to a raw database value`
      ).toEqual(['adminLabel', 'customerLabel', 'description', 'key']);
      expect(stage.customerLabel.length, `stage "${stage.key}" customerLabel must not be empty`).toBeGreaterThan(0);
      expect(stage.adminLabel.length, `stage "${stage.key}" adminLabel must not be empty`).toBeGreaterThan(0);
      expect(stage.description.length, `stage "${stage.key}" description must not be empty`).toBeGreaterThan(0);
    }
  });

  it('has exactly three timeline variants', () => {
    expect(TIMELINE_VARIANTS, 'the spec names three surfaces: customer order detail, admin order detail, public tracker').toEqual([
      'customer',
      'admin',
      'public',
    ]);
  });
});

describe('stageLabel (AC-02)', () => {
  it('returns adminLabel for the admin variant and customerLabel for customer and public, for all nine stages', () => {
    for (const stage of ORDER_STAGES) {
      expect(
        stageLabel(stage, 'admin'),
        `admin surfaces must read shop wording for "${stage.key}": expected "${stage.adminLabel}"`
      ).toBe(stage.adminLabel);
      expect(
        stageLabel(stage, 'customer'),
        `customer surfaces must read customer wording for "${stage.key}": expected "${stage.customerLabel}"`
      ).toBe(stage.customerLabel);
      expect(
        stageLabel(stage, 'public'),
        `the public tracker is a customer who is not signed in, so "${stage.key}" must read "${stage.customerLabel}", not shop wording`
      ).toBe(stage.customerLabel);
    }
  });

  it('distinguishes the two audiences where the wording actually differs', () => {
    const bending = ORDER_STAGES.find((s) => s.key === 'bending')!;
    expect(stageLabel(bending, 'customer'), 'the customer sees "Forming"').toBe('Forming');
    expect(stageLabel(bending, 'admin'), 'the shop sees "Bending/Forming"').toBe('Bending/Forming');
  });
});

// ---------------------------------------------------------------------------
// AC-03 — row count and order, every variant, every accepted status
// ---------------------------------------------------------------------------
describe('row set (AC-03)', () => {
  it('returns all nine stages in config order for every variant and every accepted status, plus an unknown one', () => {
    for (const variant of TIMELINE_VARIANTS) {
      for (const status of [...ALL_ACCEPTED_STATUSES, 'some_future_status']) {
        const view = buildTimelineView(input({ currentStatus: status, variant }));
        expect(
          view.rows.map((r) => r.key),
          `variant "${variant}" status "${status}" must render all nine stages in sequence — a short or re-sorted list is a different timeline`
        ).toEqual(STAGE_KEYS);
        expect(view.rows.length, `variant "${variant}" status "${status}" row count`).toBe(9);
      }
    }
  });

  it('resolves labels through the config for every variant', () => {
    for (const variant of TIMELINE_VARIANTS) {
      const view = buildTimelineView(input({ variant }));
      expect(
        view.rows.map((r) => r.label),
        `variant "${variant}" labels must come from stageLabel(), not a local copy`
      ).toEqual(ORDER_STAGES.map((s) => stageLabel(s, variant)));
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04 — mid-sequence state
// ---------------------------------------------------------------------------
describe('stage states mid-fabrication (AC-04)', () => {
  it('marks stages before the current one completed, the current one active, and the rest pending', () => {
    const view = buildTimelineView(input({ currentStatus: 'cutting' }));
    expect(
      view.rows.map((r) => r.state),
      'cutting is index 3, so 0-2 are completed, 3 is active and 4-8 are pending — anything else misreports where the job is'
    ).toEqual(['completed', 'completed', 'completed', 'active', 'pending', 'pending', 'pending', 'pending', 'pending']);
  });

  it('marks exactly one row current, and it is the active stage', () => {
    const view = buildTimelineView(input({ currentStatus: 'cutting' }));
    const current = view.rows.filter((r) => r.isCurrent);
    expect(current.length, 'aria-current="step" must appear exactly once — two current steps is an invalid accessibility tree').toBe(1);
    expect(current[0].key, 'the current row is the active stage').toBe('cutting');
  });

  it('reports progress as stage 4 of 9', () => {
    const view = buildTimelineView(input({ currentStatus: 'cutting' }));
    expect(view.progress.stagesReached, 'cutting is the 4th stage, so aria-valuenow is 4').toBe(4);
    expect(view.progress.totalStages, 'aria-valuemax is the number of fabrication stages').toBe(9);
    expect(view.progress.valueText, 'aria-valuetext must name the stage in words, not a bare number').toBe('Cutting — stage 4 of 9');
  });

  it('carries the history timestamp onto the matching row and nothing onto unreached rows', () => {
    const view = buildTimelineView(input({ currentStatus: 'cutting' }));
    const byKey = new Map(view.rows.map((r) => [r.key, r]));
    expect(byKey.get('submitted')!.timestamp, 'submitted row shows when the order was submitted').toBe(T_SUBMITTED);
    expect(byKey.get('cutting')!.timestamp, 'cutting row shows when cutting started').toBe(T_CUTTING);
    expect(byKey.get('bending')!.timestamp, 'a stage with no history entry has no timestamp to show').toBeNull();
  });

  it('marks the first stage active with progress 1 of 9 for a brand-new order', () => {
    const view = buildTimelineView(
      input({ currentStatus: 'submitted', statusHistory: [HISTORY_TO_CUTTING[0]] })
    );
    expect(view.rows[0].state, 'a just-submitted order is active at stage one').toBe('active');
    expect(view.rows.slice(1).every((r) => r.state === 'pending'), 'every later stage is pending').toBe(true);
    expect(view.progress.stagesReached, 'stage 1 of 9').toBe(1);
  });

  it('marks every stage completed and the last one active for a delivered order', () => {
    const view = buildTimelineView(input({ currentStatus: 'delivered' }));
    expect(view.rows.slice(0, 8).every((r) => r.state === 'completed'), 'stages 1-8 of a delivered order are complete').toBe(true);
    expect(view.rows[8].state, 'delivered is the terminal stage and is the one the order is on').toBe('active');
    expect(view.progress.stagesReached, 'a delivered order has reached all nine stages').toBe(9);
    expect(view.banner, 'a delivered order is a normal in-sequence status and needs no banner').toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-05 — cancelled
// ---------------------------------------------------------------------------
describe('cancelled order (AC-05)', () => {
  const view = buildTimelineView(
    input({ currentStatus: 'cancelled', statusHistory: HISTORY_TO_IN_QUEUE_THEN_CANCELLED })
  );

  it('completes the stages it reached and strikes through the ones it never will', () => {
    expect(
      view.rows.map((r) => r.state),
      'history reaches in_queue (index 2), so 0-2 are completed and 3-8 are pending'
    ).toEqual(['completed', 'completed', 'completed', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
    expect(
      view.rows.filter((r) => r.struckThrough).map((r) => r.key),
      'only the unreached stages are struck through — a completed stage really happened'
    ).toEqual(['cutting', 'bending', 'qc', 'ready', 'shipped', 'delivered']);
  });

  it('makes no stage active, because a cancelled order is not being worked on', () => {
    expect(view.rows.some((r) => r.state === 'active'), 'no stage is active').toBe(false);
    expect(view.rows.some((r) => r.isCurrent), 'no row claims aria-current').toBe(false);
  });

  it('shows a cancelled banner carrying the cancellation time', () => {
    expect(view.banner?.kind, 'the banner states the order was cancelled').toBe('cancelled');
    expect(view.banner?.text, 'cancellation wording').toBe('This order was cancelled.');
    expect(view.banner?.at, 'the banner names when it was cancelled, from the history row').toBe(T_CANCELLED);
  });

  it('reports progress as the stages actually completed, and names where it stopped', () => {
    expect(view.progress.stagesReached, 'three stages were completed before cancellation').toBe(3);
    expect(view.progress.valueText, 'progress text must say it was cancelled, not imply work continues').toBe(
      'Cancelled after In Production Queue — 3 of 9 stages completed'
    );
  });

  it('suppresses the estimated ship date, the photo and the tracking block', () => {
    const cancelled = buildTimelineView(
      input({
        currentStatus: 'cancelled',
        statusHistory: HISTORY_TO_IN_QUEUE_THEN_CANCELLED,
        estimatedShipDate: T_SHIPPED,
        shopPhotoUrl: 'https://example.test/signed.png',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );
    expect(cancelled.estimatedShipDate, 'a cancelled order has no ship date to promise').toBeNull();
    expect(cancelled.photo, 'a cancelled order shows no ready-to-ship photo').toBeNull();
    expect(cancelled.tracking, 'a cancelled order shows no tracking link').toBeNull();
  });

  it('handles cancellation before any stage was reached', () => {
    const view0 = buildTimelineView(
      input({ currentStatus: 'cancelled', statusHistory: [{ status: 'cancelled', changedAt: T_CANCELLED }] })
    );
    expect(view0.progress.stagesReached, 'nothing was completed').toBe(0);
    expect(view0.progress.valueText, 'the wording must not index a stage that does not exist').toBe(
      'Cancelled before fabrication started — 0 of 9 stages completed'
    );
    expect(view0.rows.every((r) => r.state === 'pending' && r.struckThrough), 'every stage is unreached and struck through').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-06 — post-production statuses
// ---------------------------------------------------------------------------
describe('post-production statuses (AC-06)', () => {
  it('maps each one onto a real fabrication stage instead of rendering an all-pending timeline', () => {
    for (const [status, stage] of Object.entries(TIMELINE_POST_PRODUCTION_STAGE)) {
      const view = buildTimelineView(input({ currentStatus: status }));
      const idx = STAGE_KEYS.indexOf(stage);
      expect(
        view.rows.slice(0, idx + 1).every((r) => r.state === 'completed'),
        `status "${status}" sits past stage "${stage}", so every stage up to and including it must read completed — all-pending is the PRODUCTION_QUEUE_AUDIT §2a bug`
      ).toBe(true);
      expect(
        view.rows.slice(idx + 1).every((r) => r.state === 'pending'),
        `status "${status}" must leave the stages beyond "${stage}" pending`
      ).toBe(true);
      expect(view.rows.some((r) => r.state === 'active'), `status "${status}" is outside the sequence, so no stage is active`).toBe(false);
    }
  });

  it('names the real status in a banner so no customer reads a stage label that misstates what happened', () => {
    const view = buildTimelineView(input({ currentStatus: 'packaged', statusHistory: [{ status: 'packaged', changedAt: T_PACKAGED }] }));
    expect(view.banner?.kind, 'a post-production order gets a status banner').toBe('post_production');
    expect(view.banner?.text, 'the banner names the real status in words').toBe('Current status: Packaged');
    expect(view.banner?.at, 'and when it happened, when history records it').toBe(T_PACKAGED);
    expect(view.progress.valueText, 'progress text reports the real status, not the mapped stage').toBe(
      'Packaged — 7 of 9 fabrication stages reached'
    );
  });

  it('still shows tracking for out_for_delivery', () => {
    const view = buildTimelineView(
      input({ currentStatus: 'out_for_delivery', trackingNumber: '1Z999AA10123456784', carrier: 'UPS' })
    );
    expect(view.tracking?.trackingNumber, 'an order on a truck has a tracking number worth showing').toBe('1Z999AA10123456784');
  });
});

// ---------------------------------------------------------------------------
// AC-07 — unknown status
// ---------------------------------------------------------------------------
describe('unrecognised status (AC-07)', () => {
  const view = buildTimelineView(input({ currentStatus: 'teleported', statusHistory: [] }));

  it('does not throw and renders every stage as pending', () => {
    expect(view.rows.every((r) => r.state === 'pending'), 'nothing can be claimed complete for a status nobody recognises').toBe(true);
    expect(view.progress.stagesReached, 'no stage has been reached').toBe(0);
  });

  it('says so in a banner naming the raw value rather than rendering a silently blank timeline', () => {
    expect(view.banner?.kind, 'an unknown status is reported, not hidden').toBe('unknown');
    expect(view.banner?.text, 'the banner names the real value so a human can diagnose it').toBe('Current status: teleported');
  });
});

// ---------------------------------------------------------------------------
// AC-08 — the variant visibility matrix
// ---------------------------------------------------------------------------
describe('variant visibility matrix (AC-08)', () => {
  const withEverything = (variant: TimelineVariant) =>
    buildTimelineView(
      input({
        variant,
        currentStatus: 'cutting',
        estimatedShipDate: T_SHIPPED,
        shopPhotoUrl: 'https://example.test/signed.png',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );

  it('customer: descriptions on completed and active rows, photo and ship date, never an internal note', () => {
    const view = withEverything('customer');
    expect(
      view.rows.filter((r) => r.description !== null).map((r) => r.key),
      'the customer reads prose for what has happened and what is happening, not for what has not started'
    ).toEqual(['submitted', 'received', 'in_queue', 'cutting']);
    expect(view.rows.every((r) => r.note === null), 'an internal note must never reach a customer').toBe(true);
    expect(view.rows.every((r) => r.changedByName === null), 'which employee changed a status is not customer information').toBe(true);
    expect(view.estimatedShipDate, 'the customer sees the expected ship date').toBe(T_SHIPPED);
    expect(view.photo?.url, 'the customer sees the pre-ship photo').toBe('https://example.test/signed.png');
    expect(view.photo?.caption, "the spec's own caption").toBe(PRE_SHIP_PHOTO_CAPTION);
  });

  it('admin: shop labels, notes and who changed it, and no duplicate of the page panels', () => {
    const view = withEverything('admin');
    expect(view.rows.every((r) => r.description === null), 'customer prose is not shop language — the admin reads the note instead').toBe(true);
    const received = view.rows.find((r) => r.key === 'received')!;
    expect(received.note, "the admin reads the history note attached to that stage").toBe('Reviewed drawings.');
    expect(received.changedByName, 'and who made the change').toBe('Tricia');
    expect(view.estimatedShipDate, "the admin page already shows the scheduled date in its own panel — two sources of one fact on one screen is the defect").toBeNull();
    expect(view.photo, 'the admin page already has PreShipPhotoSection').toBeNull();
    const shippedAdmin = buildTimelineView(
      input({ variant: 'admin', currentStatus: 'shipped', trackingNumber: '1Z999', carrier: 'UPS' })
    );
    expect(
      shippedAdmin.tracking?.trackingNumber,
      'tracking is the one field that is equally operational and customer-facing, so it stays on every variant'
    ).toBe('1Z999');
  });

  it('public: minimal — prose only for the stage the order is on, and never a note', () => {
    const view = withEverything('public');
    expect(
      view.rows.filter((r) => r.description !== null).map((r) => r.key),
      'the minimal variant explains only what is happening right now'
    ).toEqual(['cutting']);
    expect(view.rows.every((r) => r.note === null), 'an internal note must never reach an anonymous visitor').toBe(true);
    expect(view.rows.every((r) => r.changedByName === null), 'nor an employee name').toBe(true);
    expect(view.estimatedShipDate, 'the public tracker shows the expected ship date').toBe(T_SHIPPED);
    expect(view.photo?.url, 'and the pre-ship photo, which is of the customer’s own order').toBe('https://example.test/signed.png');
  });

  it('declares the matrix as data for all three variants', () => {
    expect(Object.keys(VARIANT_RULES).sort(), 'every variant must have rules — a missing entry would throw at render').toEqual([
      'admin',
      'customer',
      'public',
    ]);
    expect(VARIANT_RULES.admin.notes, 'only the admin variant shows notes').toBe(true);
    expect(VARIANT_RULES.customer.notes, 'the customer variant shows no notes').toBe(false);
    expect(VARIANT_RULES.public.notes, 'the public variant shows no notes').toBe(false);
  });

  it('never exposes a money field on any variant', () => {
    for (const variant of TIMELINE_VARIANTS) {
      const view = withEverything(variant);
      const serialised = JSON.stringify(view);
      // Key-shaped patterns only. A bare /total/ would match `totalStages`,
      // which is an accessibility value, not money.
      expect(
        /"(unit_?)?price|"subtotal|"total"|"amount|"cents|\$[0-9]/i.test(serialised),
        `variant "${variant}" must carry no money field — AFS is an RFQ platform and the timeline is never a place a price appears`
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-09 — tracking
// ---------------------------------------------------------------------------
describe('tracking block (AC-09)', () => {
  it('is null before the order ships, even when a tracking number exists', () => {
    for (const status of ['submitted', 'in_queue', 'cutting', 'bending', 'qc', 'ready', 'in_production', 'packaged']) {
      const view = buildTimelineView(input({ currentStatus: status, trackingNumber: '1Z999', carrier: 'UPS' }));
      expect(
        view.tracking,
        `status "${status}" has not shipped — showing a tracking number would claim a shipment that has not happened`
      ).toBeNull();
    }
  });

  it('is present for shipped, delivered and out_for_delivery', () => {
    for (const status of ['shipped', 'delivered', 'out_for_delivery']) {
      const view = buildTimelineView(input({ currentStatus: status, trackingNumber: '1Z999', carrier: 'UPS' }));
      expect(view.tracking?.trackingNumber, `status "${status}" must show the tracking number`).toBe('1Z999');
    }
  });

  it('is null when there is no tracking number', () => {
    expect(buildTimelineView(input({ currentStatus: 'shipped', carrier: 'UPS' })).tracking, 'no number, no block').toBeNull();
    expect(
      buildTimelineView(input({ currentStatus: 'shipped', trackingNumber: '   ', carrier: 'UPS' })).tracking,
      'a whitespace-only tracking number is not a tracking number'
    ).toBeNull();
  });

  it('attaches to the shipped row and no other', () => {
    const view = buildTimelineView(input({ currentStatus: 'shipped', trackingNumber: '1Z999', carrier: 'UPS' }));
    expect(
      view.rows.filter((r) => r.showTracking).map((r) => r.key),
      'the tracking link belongs beside the Shipped stage'
    ).toEqual([TRACKING_ROW_STAGE]);
  });

  it('resolves a carrier URL case- and punctuation-insensitively, and encodes the number', () => {
    expect(resolveTrackingUrl('UPS', '1Z 999'), 'UPS').toBe('https://www.ups.com/track?loc=en_US&tracknum=1Z%20999');
    expect(resolveTrackingUrl('FedEx', '123456789012'), 'FedEx, mixed case').toBe(
      'https://www.fedex.com/fedextrack/?trknbr=123456789012'
    );
    expect(resolveTrackingUrl(' fed-ex ', '123'), 'a human typed this field — punctuation and spacing must not break the link').toBe(
      'https://www.fedex.com/fedextrack/?trknbr=123'
    );
    expect(resolveTrackingUrl('usps', 'EA123'), 'USPS').toBe(
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=EA123'
    );
  });

  it('returns null for an unrecognised carrier so the number renders as text rather than a dead link', () => {
    expect(resolveTrackingUrl('Bubba Freight', '77'), 'guessing a URL format produces a 404, which is worse than no link').toBeNull();
    const view = buildTimelineView(input({ currentStatus: 'shipped', trackingNumber: '77', carrier: 'Bubba Freight' }));
    expect(view.tracking?.url, 'the view model reports no URL').toBeNull();
    expect(view.tracking?.carrier, 'but still names the carrier').toBe('Bubba Freight');
  });

  it('returns null when either input is missing', () => {
    expect(resolveTrackingUrl(null, '1Z999'), 'no carrier').toBeNull();
    expect(resolveTrackingUrl('UPS', null), 'no number').toBeNull();
    expect(resolveTrackingUrl(undefined, undefined), 'neither').toBeNull();
    expect(resolveTrackingUrl('', ''), 'empty strings').toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-10 — photo slot
// ---------------------------------------------------------------------------
describe('pre-ship photo slot (AC-10)', () => {
  it('sits after QC, before Ready', () => {
    const view = buildTimelineView(input({ shopPhotoUrl: 'https://example.test/p.png' }));
    expect(
      view.rows.filter((r) => r.showPhoto).map((r) => r.key),
      'the spec places the photo between qc and ready'
    ).toEqual([PHOTO_SLOT_AFTER_STAGE]);
    expect(STAGE_KEYS.indexOf(PHOTO_SLOT_AFTER_STAGE) + 1, 'and Ready is the stage right after it').toBe(
      STAGE_KEYS.indexOf('ready')
    );
  });

  it('is absent with no URL, a blank URL, or on the admin variant', () => {
    expect(buildTimelineView(input({})).photo, 'no URL, no photo').toBeNull();
    expect(buildTimelineView(input({ shopPhotoUrl: '  ' })).photo, 'a blank URL is not a photo').toBeNull();
    expect(
      buildTimelineView(input({ variant: 'admin', shopPhotoUrl: 'https://example.test/p.png' })).photo,
      'the admin page has its own photo section'
    ).toBeNull();
    expect(
      buildTimelineView(input({ shopPhotoUrl: 'https://example.test/p.png' })).rows.some((r) => r.showPhoto),
      'the row flag and the photo object must agree'
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-11 / AC-12 — history handling
// ---------------------------------------------------------------------------
describe('status history handling (AC-11, AC-12)', () => {
  it('reports empty with a variant-appropriate message, and still renders all nine stages', () => {
    for (const variant of TIMELINE_VARIANTS) {
      const view = buildTimelineView(input({ variant, statusHistory: [] }));
      expect(view.isEmpty, `variant "${variant}" with no history is empty`).toBe(true);
      expect(view.emptyMessage, `variant "${variant}" must say nothing has been recorded — a blank panel is not information`).toBeTruthy();
      expect(view.rows.length, `variant "${variant}" still draws the stage list`).toBe(9);
    }
    expect(buildTimelineView(input({ variant: 'admin', statusHistory: [] })).emptyMessage, 'the admin wording is the shop-side sentence').toBe(
      'No status changes recorded yet.'
    );
  });

  it('is not empty as soon as one entry exists', () => {
    const view = buildTimelineView(input({ statusHistory: [{ status: 'submitted', changedAt: T_SUBMITTED }] }));
    expect(view.isEmpty, 'one recorded change is history').toBe(false);
    expect(view.emptyMessage, 'and there is nothing to apologise for').toBeNull();
  });

  it('shows the LATER of two entries for the same stage', () => {
    const view = buildTimelineView(
      input({
        statusHistory: [
          ...HISTORY_TO_CUTTING,
          { status: 'cutting', changedAt: T_CUTTING_AGAIN, note: 'Re-cut after QC reject.', changedByName: 'Steve' },
        ],
        variant: 'admin',
      })
    );
    const cutting = view.rows.find((r) => r.key === 'cutting')!;
    expect(cutting.timestamp, 'a stage re-entered after a correction shows when it was LAST entered').toBe(T_CUTTING_AGAIN);
    expect(cutting.note, 'and the note from that later entry').toBe('Re-cut after QC reject.');
  });

  it('sorts unsorted history before deciding which entry wins', () => {
    const view = buildTimelineView(
      input({
        statusHistory: [
          { status: 'cutting', changedAt: T_CUTTING_AGAIN, note: 'later' },
          { status: 'cutting', changedAt: T_CUTTING, note: 'earlier' },
        ],
        variant: 'admin',
      })
    );
    expect(
      view.rows.find((r) => r.key === 'cutting')!.note,
      'the database order must not decide which entry wins — the timestamp does'
    ).toBe('later');
  });

  it('ignores a history entry for a stage the config does not contain', () => {
    const view = buildTimelineView(
      input({ statusHistory: [...HISTORY_TO_CUTTING, { status: 'gone_fishing', changedAt: T_SHIPPED }] })
    );
    expect(view.rows.map((r) => r.key), 'a stray status must not add or remove a row').toEqual(STAGE_KEYS);
    expect(view.rows.filter((r) => r.timestamp !== null).length, 'and must not attach itself to a real stage').toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Boundary inputs and purity
// ---------------------------------------------------------------------------
describe('boundary inputs', () => {
  it('accepts null, undefined and blank for every optional field without throwing', () => {
    const view = buildTimelineView({
      currentStatus: 'cutting',
      statusHistory: [],
      variant: 'customer',
      estimatedShipDate: null,
      trackingNumber: null,
      carrier: null,
      shopPhotoUrl: null,
    });
    expect(view.estimatedShipDate, 'null ship date').toBeNull();
    expect(view.tracking, 'null tracking').toBeNull();
    expect(view.photo, 'null photo').toBeNull();

    const blank = buildTimelineView(
      input({ estimatedShipDate: '   ', trackingNumber: '', carrier: '', shopPhotoUrl: '' })
    );
    expect(blank.estimatedShipDate, 'a blank ship date is not a date').toBeNull();
    expect(blank.tracking, 'a blank tracking number is not a number').toBeNull();
    expect(blank.photo, 'a blank photo URL is not a photo').toBeNull();
  });

  it('hides the estimated ship date once the order has shipped or been delivered', () => {
    for (const status of ['shipped', 'delivered']) {
      const view = buildTimelineView(input({ currentStatus: status, estimatedShipDate: T_SHIPPED }));
      expect(view.estimatedShipDate, `status "${status}" has already shipped — an estimate is no longer information`).toBeNull();
    }
    expect(
      buildTimelineView(input({ currentStatus: 'out_for_delivery', estimatedShipDate: T_SHIPPED })).estimatedShipDate,
      'out_for_delivery has left the building too, but it is the delivery leg — the ship estimate still reads as context'
    ).toBe(T_SHIPPED);
  });

  it('does not mutate the history array it was given', () => {
    const history: StatusHistoryEntry[] = [
      { status: 'cutting', changedAt: T_CUTTING_AGAIN },
      { status: 'submitted', changedAt: T_SUBMITTED },
    ];
    const snapshot = JSON.stringify(history);
    buildTimelineView(input({ statusHistory: history }));
    expect(JSON.stringify(history), 'sorting must happen on a copy — callers pass arrays they still use').toBe(snapshot);
  });

  it('is pure: the same input twice returns deeply equal output', () => {
    const args = input({
      currentStatus: 'shipped',
      estimatedShipDate: T_SHIPPED,
      trackingNumber: '1Z999',
      carrier: 'UPS',
      shopPhotoUrl: 'https://example.test/p.png',
    });
    expect(
      buildTimelineView(args),
      'no clock, no randomness, no I/O — otherwise every assertion in this file is an approximation'
    ).toEqual(buildTimelineView(args));
  });
});

// ---------------------------------------------------------------------------
// Rule #30 wording
// ---------------------------------------------------------------------------
describe('error wording (CLAUDE.md rule #30)', () => {
  it('says what did not happen, and blames nobody', () => {
    expect(TIMELINE_ERROR_BODY, 'the sentence must state that the order itself is unaffected').toContain(
      'Nothing about your order has changed'
    );
    expect(/you (did|failed|entered)/i.test(TIMELINE_ERROR_BODY), 'never blame the user').toBe(false);
    expect(/stack|exception|Error:/i.test(TIMELINE_ERROR_BODY + TIMELINE_ERROR_HEADLINE), 'never show a stack trace').toBe(false);
    expect(TIMELINE_ERROR_HEADLINE.length, 'the headline must say something').toBeGreaterThan(0);
  });
});
