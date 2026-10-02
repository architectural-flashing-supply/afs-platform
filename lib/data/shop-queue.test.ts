import { describe, it, expect } from 'vitest';
import {
  compareShopQueue,
  describeSpec,
  shopCardAction,
  shopCardStateFromStatus,
  SHOP_CARD_STATE_LABEL,
} from './shop-queue';
import { compareUnscheduled, compareStops, type DeliveryStop, type UnscheduledJob } from './deliveries';
import { buildCard } from './workbench';

/**
 * RULE #15, BOTH HALVES. CLAUDE.md: "Rush pins to the top of the SHOP QUEUES
 * ONLY … Everywhere else, including the Workbench and the office pending list,
 * ordering is newest arrival first and rush changes nothing but the badge."
 *
 * A rule with two halves needs two tests, or the half nobody asserts is the
 * half that drifts. So: rush pins in the shop queue, and rush does NOT pin in
 * Deliveries or on the Workbench — asserted against the very same fixture
 * data, so the difference is the comparator and nothing else.
 */

function queueRow(over: Partial<{ isRush: boolean; queuePosition: number | null; dueDate: string | null; createdAt: string }>) {
  return {
    isRush: false,
    queuePosition: null,
    dueDate: null,
    createdAt: '2026-10-01T10:00:00Z',
    ...over,
  };
}

describe('the shop queue pins rush to the top', () => {
  it('a rush job at position 9 comes before a normal job at position 1', () => {
    const rushLate = queueRow({ isRush: true, queuePosition: 9 });
    const normalFirst = queueRow({ isRush: false, queuePosition: 1 });
    expect([normalFirst, rushLate].sort(compareShopQueue)).toEqual([rushLate, normalFirst]);
  });

  it('two rush jobs keep queue order between themselves', () => {
    const a = queueRow({ isRush: true, queuePosition: 2 });
    const b = queueRow({ isRush: true, queuePosition: 1 });
    expect([a, b].sort(compareShopQueue)).toEqual([b, a]);
  });

  it('with no rush anywhere, it is plain queue order — position, then due date, then arrival', () => {
    const p1 = queueRow({ queuePosition: 1 });
    const p2 = queueRow({ queuePosition: 2 });
    const unpositioned = queueRow({ queuePosition: null });
    expect([unpositioned, p2, p1].sort(compareShopQueue)).toEqual([p1, p2, unpositioned]);
  });

  it('is FIFO, not newest-first: the oldest arrival is next to bend', () => {
    const older = queueRow({ createdAt: '2026-09-28T08:00:00Z' });
    const newer = queueRow({ createdAt: '2026-10-01T08:00:00Z' });
    expect([newer, older].sort(compareShopQueue)).toEqual([older, newer]);
  });
});

function unscheduled(over: Partial<UnscheduledJob>): UnscheduledJob {
  return {
    shopJobId: 'x',
    quoteRequestId: null,
    customer: 'Someone',
    item: 'Drip edge',
    quantity: 1,
    jobStage: 'shop',
    isRush: false,
    finishedAt: null,
    queuePosition: null,
    dueDate: null,
    createdAt: '2026-10-01T10:00:00Z',
    ...over,
  };
}

describe('Deliveries does NOT pin rush — it is a calendar, not a shop queue', () => {
  it('the same rush-at-9 / normal-at-1 pair sorts the OTHER way here', () => {
    const rushLate = unscheduled({ shopJobId: 'rush', isRush: true, queuePosition: 9 });
    const normalFirst = unscheduled({ shopJobId: 'normal', isRush: false, queuePosition: 1 });

    // Shop queue: rush first.
    expect([normalFirst, rushLate].sort(compareShopQueue).map((r) => r.shopJobId)).toEqual([
      'rush',
      'normal',
    ]);
    // Deliveries: queue order, rush ignored.
    expect([rushLate, normalFirst].sort(compareUnscheduled).map((r) => r.shopJobId)).toEqual([
      'normal',
      'rush',
    ]);
  });

  it('stops inside a day sort by time window, and rush does not jump the 8am slot', () => {
    const stop = (over: Partial<DeliveryStop>): DeliveryStop => ({
      deliveryId: 'd',
      shopJobId: 's',
      quoteRequestId: null,
      orderId: null,
      deliveryAddress: null,
      customer: 'A',
      item: 'Drip edge',
      quantity: 1,
      scheduledDate: '2026-10-02',
      timeWindow: '08-10',
      timeWindowLabel: '8–10 AM',
      status: 'scheduled',
      deliveredAt: null,
      autoScheduled: false,
      notifyNote: null,
      isRush: false,
      ...over,
    });
    const rushAfternoon = stop({ deliveryId: 'pm', timeWindow: '15-17', isRush: true });
    const normalMorning = stop({ deliveryId: 'am', timeWindow: '08-10', isRush: false });
    expect([rushAfternoon, normalMorning].sort(compareStops).map((s) => s.deliveryId)).toEqual([
      'am',
      'pm',
    ]);
  });
});

describe('the Workbench still does not pin rush (unchanged by v2-04)', () => {
  const now = new Date('2026-10-01T15:00:00Z');
  function row(id: string, isRush: boolean, submittedAt: string) {
    return {
      id,
      request_number: `QR-${id}`,
      user_id: null,
      guest_email: 'a@b.com',
      line_items: [{ profileType: 'Drip edge', quantity: 1 }],
      is_rush: isRush,
      submitted_at: submittedAt,
      quoted_at: null,
      source_tool: 'flashdraft',
      job_stage: 'shop',
      stage_changed_at: submittedAt,
      approved_at: null,
      sent_to_machine_at: submittedAt,
      done_at: null,
      send_status: null,
      send_error: null,
      pathfinder_profile_ids: null,
    };
  }
  it('a rush card is still just a card with a badge', () => {
    const rush = buildCard(row('r', true, '2026-09-20T10:00:00Z'), 'shop', {
      customer: 'A',
      shopSub: 'queued',
      now,
    });
    expect(rush.isRush).toBe(true);
    // The Workbench's own ordering is submitted_at DESC in getWorkbench; the
    // card itself carries no ordering hint that rush could hijack.
    expect(Object.keys(rush)).not.toContain('sortKey');
  });
});

describe('the shop card state and its one action', () => {
  it('maps the existing status lifecycle onto the operator words', () => {
    expect(shopCardStateFromStatus('queued')).toBe('queued');
    expect(shopCardStateFromStatus('in_progress')).toBe('bending');
    expect(shopCardStateFromStatus('complete')).toBe('finished');
    // Anything unrecognised reads as queued rather than crashing a tablet.
    expect(shopCardStateFromStatus('who knows')).toBe('queued');
  });
  it('labels them as the prototype does', () => {
    expect(SHOP_CARD_STATE_LABEL.queued).toBe('Queued');
    expect(SHOP_CARD_STATE_LABEL.bending).toBe('Bending now');
    expect(SHOP_CARD_STATE_LABEL.finished).toBe('Finished');
  });
  it('offers exactly ONE action, and none once finished', () => {
    expect(shopCardAction('queued')).toEqual({
      kind: 'start',
      label: 'Start bending',
      nextStatus: 'in_progress',
    });
    expect(shopCardAction('bending')).toEqual({
      kind: 'finish',
      label: 'Mark finished',
      nextStatus: 'complete',
    });
    expect(shopCardAction('finished')).toBeNull();
  });
});

describe('describeSpec', () => {
  it('assembles what is there and omits what is not', () => {
    expect(
      describeSpec({ gauge: '24 ga', material: 'Kynar', color: 'Charcoal', finish: null, lengthFt: 10 })
    ).toBe('24 ga, Kynar, Charcoal, 10 ft');
  });
  it('says so rather than printing an empty string', () => {
    expect(describeSpec({ gauge: null, material: null, color: null, finish: null, lengthFt: null })).toBe(
      'No specification recorded'
    );
    expect(describeSpec({ gauge: '  ', material: '', color: null, finish: null, lengthFt: null })).toBe(
      'No specification recorded'
    );
  });
});
