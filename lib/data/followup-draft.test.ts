import { describe, expect, it } from 'vitest';
import { buildFollowupDraft, summariseItemsForDraft } from './followup-draft';

describe('the follow-up draft', () => {
  const base = {
    contactFirstName: 'Ray',
    itemSummary: '60 pieces of z-closure',
    quotedPhrase: '4 days ago',
    requestNumber: 'QR-1042',
    fromFirstName: 'Steve',
  };

  it('opens to the person, names what was quoted and when, and signs off', () => {
    const draft = buildFollowupDraft(base);
    expect(draft.startsWith('Hi Ray,')).toBe(true);
    expect(draft).toContain('4 days ago');
    expect(draft).toContain('60 pieces of z-closure');
    expect(draft).toContain('QR-1042');
    expect(draft.trimEnd().endsWith('Steve')).toBe(true);
  });

  it('reads correctly when the send date is unknown — no "sent null ago"', () => {
    const draft = buildFollowupDraft({ ...base, quotedPhrase: null });
    expect(draft).toContain('I sent over a quote for 60 pieces');
    expect(draft).not.toContain('null');
    expect(draft).not.toContain('undefined');
  });

  it('offers the customer a way to change it, not just a chase', () => {
    expect(buildFollowupDraft(base)).toContain('If anything needs changing');
  });

  it('never contains a dollar amount — pricing is not the follow-up\'s job', () => {
    expect(buildFollowupDraft(base)).not.toMatch(/\$|USD/);
  });
});

describe('the item summary the draft reads from', () => {
  it('singularises one piece', () => {
    expect(summariseItemsForDraft([{ profileType: 'Drip Edge', quantity: 1 }])).toBe('1 piece of drip edge');
  });
  it('pluralises the rest', () => {
    expect(summariseItemsForDraft([{ profileType: 'Drip Edge', quantity: 40 }])).toBe('40 pieces of drip edge');
  });
  it('drops the count when there is no quantity rather than saying "0 pieces"', () => {
    expect(summariseItemsForDraft([{ profileType: 'Coping Cap', quantity: 0 }])).toBe('coping cap');
  });
  it('totals a multi-item request', () => {
    expect(
      summariseItemsForDraft([
        { profileType: 'Coping Cap', quantity: 12 },
        { profileType: 'Drip Edge', quantity: 7 },
      ])
    ).toBe('2 items, 19 pieces in total');
  });
  it('says something usable when there are no items at all', () => {
    expect(summariseItemsForDraft([])).toBe('your recent request');
  });
});
