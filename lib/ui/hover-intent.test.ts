import { describe, it, expect } from 'vitest';
import {
  createHoverIntent,
  HOVER_OPEN_DELAY_MS,
  HOVER_GRACE_DELAY_MS,
  type HoverIntent,
} from './hover-intent';

/**
 * The grace delay is the whole reason this module exists, so it is tested
 * with a deterministic clock rather than a sleep: every assertion below is
 * about WHEN something happens relative to the two delays, and a real timer
 * would make the interesting cases flaky exactly where they matter.
 */
class Clock {
  private now = 0;
  private next = 1;
  private pending = new Map<number, { at: number; fn: () => void }>();

  set = (fn: () => void, ms: number): number => {
    const id = this.next++;
    this.pending.set(id, { at: this.now + ms, fn });
    return id;
  };

  clear = (id: number): void => {
    this.pending.delete(id);
  };

  /** Advance time, firing anything due, in order. */
  tick(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let soonestId: number | null = null;
      let soonestAt = Infinity;
      for (const [id, t] of this.pending) {
        if (t.at <= target && t.at < soonestAt) {
          soonestAt = t.at;
          soonestId = id;
        }
      }
      if (soonestId === null) break;
      const entry = this.pending.get(soonestId)!;
      this.pending.delete(soonestId);
      this.now = entry.at;
      entry.fn();
    }
    this.now = target;
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}

interface Harness {
  intent: HoverIntent;
  clock: Clock;
  events: string[];
}

function harness(): Harness {
  const clock = new Clock();
  const events: string[] = [];
  const intent = createHoverIntent({
    onOpen: (id) => events.push(`open:${id}`),
    onClose: () => events.push('close'),
    setTimer: clock.set as unknown as (fn: () => void, ms: number) => ReturnType<typeof setTimeout>,
    clearTimer: clock.clear as unknown as (h: ReturnType<typeof setTimeout>) => void,
  });
  return { intent, clock, events };
}

describe('hover intent — opening', () => {
  it('does not open until the pointer has settled for the open delay', () => {
    const { intent, clock, events } = harness();
    intent.pointerEnterItem('a');
    clock.tick(HOVER_OPEN_DELAY_MS - 1);
    expect(events).toEqual([]);
    clock.tick(1);
    expect(events).toEqual(['open:a']);
    expect(intent.openId()).toBe('a');
  });

  it('opens nothing when the pointer sweeps across the whole rail', () => {
    const { intent, clock, events } = harness();
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      intent.pointerEnterItem(id);
      clock.tick(20);
      intent.pointerLeaveItem();
      clock.tick(5);
    }
    clock.tick(1000);
    expect(events).toEqual([]);
    expect(intent.openId()).toBeNull();
  });

  it('swaps immediately once something is already open', () => {
    const { intent, clock, events } = harness();
    intent.pointerEnterItem('a');
    clock.tick(HOVER_OPEN_DELAY_MS);
    intent.pointerLeaveItem();
    intent.pointerEnterItem('b');
    expect(events).toEqual(['open:a', 'open:b']);
    clock.tick(1000);
    // The swap must also have cancelled the pending close from leaving 'a'.
    expect(events).toEqual(['open:a', 'open:b']);
  });
});

describe('hover intent — the grace delay is what makes the preview reachable', () => {
  it('keeps the preview open while the pointer crosses the gap', () => {
    const { intent, clock, events } = harness();
    intent.pointerEnterItem('a');
    clock.tick(HOVER_OPEN_DELAY_MS);

    intent.pointerLeaveItem();
    // The journey from thumbnail to preview. Still open the whole way.
    clock.tick(HOVER_GRACE_DELAY_MS - 1);
    expect(events).toEqual(['open:a']);
    expect(intent.openId()).toBe('a');

    intent.pointerEnterPreview();
    clock.tick(10_000);
    expect(events).toEqual(['open:a']);
    expect(intent.openId()).toBe('a');
  });

  it('closes when the pointer leaves and does NOT arrive', () => {
    const { intent, clock, events } = harness();
    intent.pointerEnterItem('a');
    clock.tick(HOVER_OPEN_DELAY_MS);
    intent.pointerLeaveItem();
    clock.tick(HOVER_GRACE_DELAY_MS - 1);
    expect(events).toEqual(['open:a']);
    clock.tick(1);
    expect(events).toEqual(['open:a', 'close']);
    expect(intent.openId()).toBeNull();
  });

  it('gives the same grace on the way back out of the preview', () => {
    const { intent, clock, events } = harness();
    intent.pointerEnterItem('a');
    clock.tick(HOVER_OPEN_DELAY_MS);
    intent.pointerLeaveItem();
    intent.pointerEnterPreview();
    intent.pointerLeavePreview();
    clock.tick(HOVER_GRACE_DELAY_MS - 1);
    expect(events).toEqual(['open:a']);
    clock.tick(1);
    expect(events).toEqual(['open:a', 'close']);
  });

  it('re-entering the preview after leaving it cancels the close again', () => {
    const { intent, clock, events } = harness();
    intent.openNow('a');
    intent.pointerLeavePreview();
    clock.tick(HOVER_GRACE_DELAY_MS - 50);
    intent.pointerEnterPreview();
    clock.tick(10_000);
    expect(events).toEqual(['open:a']);
  });
});

describe('hover intent — keyboard and touch do not wait', () => {
  it('openNow opens on the same tick', () => {
    const { intent, events } = harness();
    intent.openNow('a');
    expect(events).toEqual(['open:a']);
  });

  it('openNow is idempotent for the same id — arrowing back does not re-fire', () => {
    const { intent, events } = harness();
    intent.openNow('a');
    intent.openNow('a');
    expect(events).toEqual(['open:a']);
  });

  it('closeNow closes on the same tick, with no grace', () => {
    const { intent, clock, events } = harness();
    intent.openNow('a');
    intent.closeNow();
    expect(events).toEqual(['open:a', 'close']);
    clock.tick(10_000);
    expect(events).toEqual(['open:a', 'close']);
  });

  it('closeNow on an already-closed preview says nothing', () => {
    const { intent, events } = harness();
    intent.closeNow();
    expect(events).toEqual([]);
  });
});

describe('hover intent — teardown leaves no timer behind', () => {
  it('dispose clears the pending open', () => {
    const { intent, clock } = harness();
    intent.pointerEnterItem('a');
    expect(clock.pendingCount).toBe(1);
    intent.dispose();
    expect(clock.pendingCount).toBe(0);
  });

  it('dispose clears the pending close', () => {
    const { intent, clock, events } = harness();
    intent.openNow('a');
    intent.pointerLeaveItem();
    expect(clock.pendingCount).toBe(1);
    intent.dispose();
    clock.tick(10_000);
    expect(events).toEqual(['open:a']);
  });
});

describe('the delays are the approved ones', () => {
  it('is 150 ms in and 300 ms of grace', () => {
    expect(HOVER_OPEN_DELAY_MS).toBe(150);
    expect(HOVER_GRACE_DELAY_MS).toBe(300);
  });

  it('gives more grace than it demands intent — the gap must be crossable', () => {
    expect(HOVER_GRACE_DELAY_MS).toBeGreaterThan(HOVER_OPEN_DELAY_MS);
  });
});
