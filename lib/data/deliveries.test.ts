import { describe, it, expect } from 'vitest';
import { schedulableFrom, type DeliveriesView, type DeliveryStop } from './deliveries';
import { describe as describeNotify } from '@/lib/delivery/notify';

/**
 * The Deliveries view's own wording and composition, asserted without a
 * database. The ORDERING halves of rule #15 live in ./shop-queue.test.ts,
 * beside the shop-queue comparator they are the counterpart to.
 */

function stop(over: Partial<DeliveryStop>): DeliveryStop {
  return {
    deliveryId: 'd1',
    shopJobId: 's1',
    quoteRequestId: null,
    customer: 'Hill Country Roofing',
    item: 'Drip edge',
    quantity: 40,
    scheduledDate: '2026-10-02',
    timeWindow: '08-10',
    timeWindowLabel: '8–10 AM',
    status: 'scheduled',
    deliveredAt: null,
    autoScheduled: true,
    notifyNote: null,
    isRush: false,
    ...over,
  };
}

function view(over: Partial<DeliveriesView>): DeliveriesView {
  return {
    days: [],
    unscheduled: [],
    beyondWeek: { count: 0, earliest: null, earliestHeading: null },
    deliveredThisWeek: 0,
    ...over,
  };
}

describe('what can be given a day', () => {
  it('offers both the unscheduled jobs and the already-scheduled stops', () => {
    const v = view({
      days: [{ date: '2026-10-02', heading: 'Fri, Oct 2', stops: [stop({ shopJobId: 'scheduled' })] }],
      unscheduled: [
        {
          shopJobId: 'waiting',
          quoteRequestId: null,
          customer: 'Martinez Builders',
          item: 'Custom coping',
          quantity: 12,
          jobStage: 'shop',
          isRush: false,
          finishedAt: null,
          queuePosition: 1,
          dueDate: null,
          createdAt: '2026-10-01T10:00:00Z',
        },
      ],
    });
    const options = schedulableFrom(v);
    expect(options.map((o) => o.shopJobId)).toEqual(['waiting', 'scheduled']);
    // An unscheduled job has no current day; a scheduled stop carries its own,
    // so the picker can open on the day it is already set to.
    expect(options[0].currentDate).toBeNull();
    expect(options[1].currentDate).toBe('2026-10-02');
    expect(options[1].currentWindow).toBe('08-10');
  });

  it('never offers a stop that has already been delivered', () => {
    const v = view({
      days: [
        {
          date: '2026-10-02',
          heading: 'Fri, Oct 2',
          stops: [stop({ shopJobId: 'gone', status: 'delivered', deliveredAt: '2026-10-02T15:00:00Z' })],
        },
      ],
    });
    expect(schedulableFrom(v)).toEqual([]);
  });
});

describe('the notification note says what really happened', () => {
  it('a captured test message is never reported as sent', () => {
    const note = describeNotify('captured_test_mode', 'captured_test_mode', 'e2e@example.com', '+15125550000');
    expect(note).toContain('recorded and NOT sent');
    expect(note).not.toMatch(/^Emailed/);
  });

  it('an unconfigured provider is honest about it rather than claiming success', () => {
    const note = describeNotify('not_configured', 'no_number', 'mike@example.com', '');
    expect(note).toContain('Email is not connected yet');
    expect(note).toContain('nothing went to mike@example.com');
    expect(note).toContain('no text was sent');
  });

  it('an opt-out is stated, not silently skipped', () => {
    expect(describeNotify('sent', 'opted_out', 'mike@example.com', '+15125550000')).toContain(
      'has not opted in to texts'
    );
  });

  it('no address at all is stated too', () => {
    expect(describeNotify('no_address', 'no_number', '', '')).toBe(
      'No email address on this job, so nobody was emailed. No phone number on this job, so no text was sent.'
    );
  });

  it('a real send reads plainly', () => {
    expect(describeNotify('sent', 'sent', 'mike@example.com', '+15125550000')).toBe(
      'Emailed mike@example.com. Texted +15125550000.'
    );
  });
});
