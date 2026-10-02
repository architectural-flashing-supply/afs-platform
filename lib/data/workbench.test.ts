import { describe, expect, it } from 'vitest';
import {
  DONE_ARCHIVE_DAYS,
  STALE_QUOTE_DAYS,
  buildCard,
  buildSummary,
  summaryChips,
  describeCardItem,
  shopSubStateFromJobStatuses,
  shopSubStateLabel,
} from './workbench';
import { LIGHT_WORKING_AREA_CLASS, LIGHT_WORKING_AREA_SCREENS } from './admin-working-area';
import { daysSince, greetingFor, waitingPhrase } from '../utils/waiting-time';
import { sourceArrivalLabel, sourceIconKey } from './quote-request-source-tool';

const NOW = new Date('2026-09-30T18:00:00.000Z');

function row(over: Partial<Parameters<typeof buildCard>[0]> = {}) {
  return {
    id: 'r1',
    request_number: 'QR-1001',
    user_id: null,
    guest_email: 'mike@example.com',
    line_items: [{ profileType: 'Drip edge', material: 'Charcoal Kynar', gauge: '24 ga', quantity: 40 }],
    is_rush: false,
    submitted_at: '2026-09-30T16:00:00.000Z',
    quoted_at: null,
    source_tool: 'afs-flashdraft',
    job_stage: 'new',
    stage_changed_at: '2026-09-30T16:00:00.000Z',
    approved_at: null,
    sent_to_machine_at: null,
    done_at: null,
    send_status: null,
    send_error: null,
    pathfinder_profile_ids: null,
    ...over,
  } as Parameters<typeof buildCard>[0];
}

const opts = { customer: 'Hill Country Roofing', shopSub: 'unknown' as const, now: NOW };

describe('waitingPhrase — plain English, never a timestamp', () => {
  it('reads "just now" under a minute', () => {
    expect(waitingPhrase('2026-09-30T17:59:30.000Z', NOW)).toBe('just now');
  });
  it('singularises one minute and one hour', () => {
    expect(waitingPhrase('2026-09-30T17:58:30.000Z', NOW)).toBe('1 minute ago');
    expect(waitingPhrase('2026-09-30T16:59:00.000Z', NOW)).toBe('1 hour ago');
  });
  it('reads hours, then "yesterday", then days', () => {
    expect(waitingPhrase('2026-09-30T16:00:00.000Z', NOW)).toBe('2 hours ago');
    expect(waitingPhrase('2026-09-29T12:00:00.000Z', NOW)).toBe('yesterday');
    expect(waitingPhrase('2026-09-26T12:00:00.000Z', NOW)).toBe('4 days ago');
  });
  it('never prints a negative age for a clock that is ahead', () => {
    expect(waitingPhrase('2026-09-30T18:05:00.000Z', NOW)).toBe('just now');
  });
  it('returns null rather than inventing an age', () => {
    expect(waitingPhrase(null, NOW)).toBeNull();
    expect(waitingPhrase('not-a-date', NOW)).toBeNull();
  });
});

describe('greetingFor — follows the shop clock, not the server clock', () => {
  it('is morning in Texas when UTC already says afternoon', () => {
    // 14:00 UTC is 09:00 in America/Chicago (CDT). A server-clock greeting
    // would say "Good afternoon" to someone starting their day.
    expect(greetingFor(new Date('2026-09-30T14:00:00.000Z'))).toBe('Good morning');
  });
  it('turns over at noon and at 5pm shop time', () => {
    expect(greetingFor(new Date('2026-09-30T16:59:00.000Z'))).toBe('Good morning');
    expect(greetingFor(new Date('2026-09-30T17:01:00.000Z'))).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-09-30T22:01:00.000Z'))).toBe('Good evening');
  });
  it('says morning at shop midnight, not "Good evening"', () => {
    expect(greetingFor(new Date('2026-10-01T05:30:00.000Z'))).toBe('Good morning');
  });
});

describe('the card item line', () => {
  it('reads item, spec and quantity the way the prototype does', () => {
    expect(describeCardItem([{ profileType: 'Drip edge', material: 'Charcoal Kynar', gauge: '24 ga', quantity: 40 }])).toBe(
      'Drip edge, 24 ga Charcoal Kynar × 40'
    );
  });
  it('counts the rest of a multi-item request instead of hiding it', () => {
    expect(
      describeCardItem([
        { profileType: 'Coping', quantity: 12 },
        { profileType: 'Drip edge', quantity: 4 },
        { profileType: 'Z-closure', quantity: 1 },
      ])
    ).toBe('Coping × 12 + 2 more items');
  });
  it('says so plainly when there are no items', () => {
    expect(describeCardItem([])).toBe('No items listed');
    expect(describeCardItem(null)).toBe('No items listed');
  });
});

describe('every card carries exactly ONE action', () => {
  it('New offers Start quote', () => {
    const c = buildCard(row(), 'new', opts);
    expect(c.action).toEqual({ kind: 'start-quote', label: 'Start quote' });
    expect(c.meta).toBe('From FlashDraft, 2 hours ago');
    expect(c.pulse).toBe(false);
  });

  it('Quoted offers NOTHING until the quote is stale', () => {
    const fresh = buildCard(row({ job_stage: 'quoted', quoted_at: '2026-09-29T18:00:00.000Z' }), 'quoted', opts);
    expect(fresh.action).toBeNull();
    expect(fresh.meta).toBe('Quote sent yesterday');
    expect(fresh.metaTone).toBe('neutral');
  });

  it(`Quoted offers Follow up after ${STALE_QUOTE_DAYS} days with no reply`, () => {
    const stale = buildCard(row({ job_stage: 'quoted', quoted_at: '2026-09-26T18:00:00.000Z' }), 'quoted', opts);
    expect(stale.action).toEqual({ kind: 'follow-up', label: 'Follow up' });
    expect(stale.meta).toBe('Quote sent 4 days ago, no reply yet');
    expect(stale.metaTone).toBe('warn');
  });

  it('Approved offers Send to machine and PULSES', () => {
    const c = buildCard(row({ job_stage: 'approved', approved_at: '2026-09-30T17:40:00.000Z' }), 'approved', opts);
    expect(c.action).toEqual({ kind: 'send-to-machine', label: 'Send to machine' });
    expect(c.meta).toBe('Customer approved 20 minutes ago');
    expect(c.metaTone).toBe('good');
    expect(c.pulse).toBe(true);
  });

  it('In the shop names the REAL returned profile number, not a placeholder', () => {
    const c = buildCard(
      row({ job_stage: 'shop', sent_to_machine_at: '2026-09-30T17:00:00.000Z', pathfinder_profile_ids: ['32960114'] }),
      'shop',
      { ...opts, shopSub: 'queued' }
    );
    expect(c.meta).toBe('Sent as profile #32960114. Queued at the Thalmann');
    expect(c.action).toEqual({ kind: 'schedule-delivery', label: 'Schedule delivery' });
  });

  it('In the shop claims NO profile number when none was returned', () => {
    const c = buildCard(row({ job_stage: 'shop', pathfinder_profile_ids: [] }), 'shop', { ...opts, shopSub: 'queued' });
    expect(c.meta).toBe('Queued at the Thalmann');
    expect(c.meta).not.toContain('#');
  });

  it('Done has no action at all', () => {
    const c = buildCard(row({ job_stage: 'done', done_at: '2026-09-29T12:00:00.000Z' }), 'done', opts);
    expect(c.action).toBeNull();
    expect(c.meta).toBe('Delivered yesterday');
  });
});

describe('a failed send is state, not a vanished toast', () => {
  it('outranks the stage, names the real reason, and offers a retry', () => {
    const c = buildCard(
      row({
        job_stage: 'approved',
        approved_at: '2026-09-30T17:00:00.000Z',
        send_status: 'failed',
        send_error: 'PathfinderEdge returned 503.',
      }),
      'approved',
      opts
    );
    expect(c.meta).toBe('Send failed — retry. PathfinderEdge returned 503.');
    expect(c.metaTone).toBe('bad');
    expect(c.action).toEqual({ kind: 'retry-send', label: 'Try sending again' });
    expect(c.pulse).toBe(false);
  });

  it('says so honestly when no reason was recorded', () => {
    const c = buildCard(row({ job_stage: 'approved', send_status: 'failed', send_error: null }), 'approved', opts);
    expect(c.meta).toContain('No reason was recorded.');
  });

  it('an UNCONFIRMED send is not called a success and offers NO retry', () => {
    const c = buildCard(
      row({ job_stage: 'shop', send_status: 'unconfirmed', pathfinder_profile_ids: [] }),
      'shop',
      opts
    );
    expect(c.meta).toContain('did not return a profile number');
    expect(c.meta).toContain('not confirmed');
    expect(c.action).toBeNull();
  });
});

describe('the shop sub-state only says what machine_jobs actually knows', () => {
  it('collapses real statuses, and invents no "bending now"', () => {
    expect(shopSubStateFromJobStatuses([])).toBe('unknown');
    expect(shopSubStateFromJobStatuses(['sent_to_machine'])).toBe('queued');
    expect(shopSubStateFromJobStatuses(['approved_for_machine', 'completed'])).toBe('queued');
    expect(shopSubStateFromJobStatuses(['completed', 'completed'])).toBe('finished');
    expect(shopSubStateFromJobStatuses(['completed', 'machine_error'])).toBe('problem');
  });
  it('reads in plain English', () => {
    expect(shopSubStateLabel('queued')).toBe('Queued at the Thalmann');
    expect(shopSubStateLabel('finished')).toBe('Finished, ready to deliver');
    expect(shopSubStateLabel('problem')).toBe('The machine reported a problem');
  });
});

describe('sources', () => {
  it('names FlashDraft and the field app the way the prototype does', () => {
    expect(sourceArrivalLabel('afs-flashdraft')).toBe('From FlashDraft');
    expect(sourceArrivalLabel('field_photo_quote')).toBe('From the field app');
    expect(sourceIconKey('afs-flashdraft')).toBe('flashdraft');
    expect(sourceIconKey('field_photo_quote')).toBe('photo');
  });
  it('does not print "Unknown" as if it were a tool', () => {
    expect(sourceArrivalLabel(null)).toBe('Source not recorded');
    expect(sourceArrivalLabel('whatever')).toBe('Source not recorded');
  });
});

describe('the morning summary above the lanes', () => {
  it('greets by time of day', () => {
    expect(buildSummary({ quotesToWrite: 3, approvalsReady: 2, inTheShop: 1 }, 'Steve', NOW).greeting).toBe(
      'Good afternoon, Steve.'
    );
    expect(
      buildSummary({ quotesToWrite: 1, approvalsReady: 0, inTheShop: 0 }, 'Steve', new Date('2026-09-30T14:00:00.000Z'))
        .greeting
    ).toBe('Good morning, Steve.');
  });

  it("prints the chips in v7's words and v7's order", () => {
    // Wording and order are prototype v7's (`pageWorkbench()`, line 1283): the
    // thing to act on comes first and is phrased as the shop says it — "2 ready
    // for the machine", not "2 approvals ready for the machine".
    const chips = summaryChips(buildSummary({ quotesToWrite: 3, approvalsReady: 2, inTheShop: 4 }, 'Steve', NOW));
    expect(chips.map((c) => c.text)).toEqual([
      '2 ready for the machine',
      '3 to quote',
      '4 jobs in the shop',
    ]);
    expect(chips.map((c) => c.tone)).toEqual(['go', 'plain', 'plain']);
  });

  it('does not pluralise the two counting chips, because v7 does not', () => {
    const chips = summaryChips(buildSummary({ quotesToWrite: 1, approvalsReady: 1, inTheShop: 1 }, 'Steve', NOW));
    expect(chips.map((c) => c.text)).toEqual([
      '1 ready for the machine',
      '1 to quote',
      '1 job in the shop',
    ]);
  });

  it('keeps the approvals chip at zero, but turns it grey and reworded', () => {
    // v7 shows this chip EITHER WAY — green with a beacon when there is
    // something to send, plain "No approvals waiting" when there is not. An
    // earlier version dropped it entirely at zero so the green chip kept its
    // meaning; v7 solves that by changing the chip instead, which also stops
    // the row reflowing as work arrives.
    const chips = summaryChips(buildSummary({ quotesToWrite: 2, approvalsReady: 0, inTheShop: 0 }, 'Steve', NOW));
    expect(chips.map((c) => c.text)).toEqual(['No approvals waiting', '2 to quote', '0 jobs in the shop']);
    expect(chips.some((c) => c.tone === 'go')).toBe(false);
    expect(chips.some((c) => c.text.startsWith('0 ready'))).toBe(false);
  });
});

describe(`Done auto-archives after ${DONE_ARCHIVE_DAYS} days`, () => {
  it('measures the boundary from done_at', () => {
    expect(daysSince('2026-09-17T18:00:00.000Z', NOW)).toBe(13);
    expect(daysSince('2026-09-16T18:00:00.000Z', NOW)).toBe(14);
    expect(daysSince('2026-09-17T18:00:00.000Z', NOW) >= DONE_ARCHIVE_DAYS).toBe(false);
    expect(daysSince('2026-09-16T18:00:00.000Z', NOW) >= DONE_ARCHIVE_DAYS).toBe(true);
  });
});

describe('the light working area', () => {
  it('names exactly the screens converted so far (v2-02 + v2-04 + v2-05 + v7 Phase 2 + v7 Stage G)', () => {
    expect(LIGHT_WORKING_AREA_SCREENS.map((s) => s.screen)).toEqual([
      'Workbench',
      'Job screen',
      // v2-04 — both rebuilt to the approved prototype in the light area.
      'Shop View',
      'Deliveries',
      // v2-05 — the thumbnail rail replaced the interim results table.
      'Search',
      // v7 Phase 2 - the two office lists.
      'Quotes',
      'Orders',
      // v7 Stage G - Customers and Pricing (top-level in v7's nav) and the two
      // screens under More, which take the same shell and look.
      'Customers',
      'Pricing',
      'Credit Applications',
      'Bid Monitor',
    ]);
  });
  it('paints light AND cancels the shell gunmetal padding, or it would float in a dark frame', () => {
    expect(LIGHT_WORKING_AREA_CLASS).toContain('bg-afs-v7-bg');
    expect(LIGHT_WORKING_AREA_CLASS).toContain('text-afs-v7-ink');
    expect(LIGHT_WORKING_AREA_CLASS).toContain('min-h-screen');
  });

  it("cancels exactly v7's .wrap padding — 20px sides and top, 60px bottom", () => {
    // The shell's <main> is now v7's own `.wrap` (padding: 20px 20px 60px), not
    // the old `pt-16 px-6 lg:px-8 pb-16`. A cancellation that does not match
    // leaves a gunmetal gutter beside every light screen, or pulls content
    // under the sticky header — both look like styling accidents rather than a
    // mismatch with the shell, so the numbers are asserted here.
    for (const cls of ['-mt-5', 'pt-5', '-mx-5', 'px-5', '-mb-[60px]', 'pb-[60px]']) {
      expect(LIGHT_WORKING_AREA_CLASS).toContain(cls);
    }
    // The old values must be gone, or the two paddings fight.
    for (const stale of ['-mt-16', 'pt-16', '-mx-6', 'lg:-mx-8', 'pb-16']) {
      expect(
        LIGHT_WORKING_AREA_CLASS,
        `${stale} cancels the pre-v7 shell padding, which no longer exists.`,
      ).not.toContain(stale);
    }
  });
});
