/**
 * EES-OVN.06 AC-13 through AC-16 — COMPONENT RENDER TESTS for all three
 * variants of ProductionTimeline.
 *
 * HOW, AND WHY THIS WAY. This repo has no jsdom and no testing library, and
 * this run may not install dependencies, so rendering goes through
 * `react-dom/server`'s `renderToStaticMarkup` — which `react-dom` already
 * provides. That is enough for everything this component needs proving about
 * it: it has no state, no effects and no event handlers of its own (the one
 * interactive part, the photo lightbox, is a separate client child), so its
 * static markup IS its render. vitest.config.mts sets `esbuild.jsx` to the
 * automatic runtime because tsconfig's `jsx: "preserve"` would otherwise hand
 * node unparsed JSX.
 *
 * ARRANGE with the fixtures below; ACT is one render per test; ASSERT on exact
 * counts, attribute values and extracted text order, each with a message
 * stating what the failure would mean on screen.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ProductionTimeline from '@/components/account/ProductionTimeline';
import { ORDER_STAGES, TIMELINE_VARIANTS, stageLabel } from '@/lib/admin/orderStages';
import type { StatusHistoryEntry } from '@/lib/production/timeline-view';

const T_SUBMITTED = '2026-01-15T15:02:00.000Z';
const T_RECEIVED = '2026-01-15T16:47:00.000Z';
const T_IN_QUEUE = '2026-01-16T14:00:00.000Z';
const T_CUTTING = '2026-01-17T13:15:00.000Z';
const T_CANCELLED = '2026-01-16T18:30:00.000Z';

const HISTORY_TO_CUTTING: StatusHistoryEntry[] = [
  { status: 'submitted', changedAt: T_SUBMITTED, note: null, changedByName: null },
  { status: 'received', changedAt: T_RECEIVED, note: 'Reviewed drawings.', changedByName: 'Tricia' },
  { status: 'in_queue', changedAt: T_IN_QUEUE, note: null, changedByName: 'Steve' },
  { status: 'cutting', changedAt: T_CUTTING, note: 'Coil pulled.', changedByName: 'Steve' },
];

const STAGE_KEYS = ORDER_STAGES.map((s) => s.key);

/** Count non-overlapping occurrences of a literal substring. */
function countOf(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/**
 * The stage labels, in the order they appear in the markup. Read out of each
 * stage row's own `<span class="font-heading …">`, which is the only element
 * that carries a stage label.
 */
function renderedStageLabels(html: string): string[] {
  // Sorted by position in the document, NOT by STAGE_KEYS, so the assertion
  // really tests the rendered order instead of reproducing the expected one.
  return STAGE_KEYS.map((key) => ({ key, at: html.indexOf(`data-testid="stage-${key}"`) }))
    .filter((entry) => entry.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((entry) => {
      const headingAt = html.indexOf('font-heading text-base', entry.at);
      const open = html.indexOf('>', headingAt);
      return html.slice(open + 1, html.indexOf('</span>', open)).trim();
    });
}

function render(props: Partial<Parameters<typeof ProductionTimeline>[0]> = {}): string {
  return renderToStaticMarkup(
    <ProductionTimeline
      currentStatus="cutting"
      statusHistory={HISTORY_TO_CUTTING}
      variant="customer"
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// AC-13 — list and progress semantics
// ---------------------------------------------------------------------------
describe('accessibility semantics (AC-13)', () => {
  it('renders an ordered list with an explicit list role and one item per stage, on every variant', () => {
    for (const variant of TIMELINE_VARIANTS) {
      const html = render({ variant });
      expect(
        html.includes('<ol role="list"'),
        `variant "${variant}": the stages are an ordered sequence, and the explicit role is needed because list-none strips list semantics in Safari`
      ).toBe(true);
      expect(countOf(html, '<li'), `variant "${variant}": one list item per stage`).toBe(ORDER_STAGES.length);
      for (const key of STAGE_KEYS) {
        expect(
          html.includes(`data-testid="stage-${key}"`),
          `variant "${variant}": stage "${key}" must render — a missing row is a stage the customer cannot see`
        ).toBe(true);
      }
    }
  });

  it('marks exactly one row aria-current="step" when a stage is active', () => {
    const html = render({ currentStatus: 'cutting' });
    expect(
      countOf(html, 'aria-current="step"'),
      'two current steps is an invalid accessibility tree and reads as two simultaneous stages'
    ).toBe(1);
    const currentAt = html.indexOf('aria-current="step"');
    const cuttingAt = html.indexOf('data-testid="stage-cutting"');
    expect(
      currentAt > cuttingAt && currentAt - cuttingAt < 200,
      'the current step must be the cutting row, not some other row'
    ).toBe(true);
  });

  it('marks no row current when the order is cancelled or outside the fabrication sequence', () => {
    expect(
      countOf(render({ currentStatus: 'cancelled', statusHistory: [{ status: 'cancelled', changedAt: T_CANCELLED }] }), 'aria-current'),
      'a cancelled order is not on a step'
    ).toBe(0);
    expect(
      countOf(render({ currentStatus: 'packaged' }), 'aria-current'),
      'a post-production order has left the sequence, so no stage is the current one'
    ).toBe(0);
  });

  it('renders one progressbar carrying all four ARIA value attributes', () => {
    const html = render({ currentStatus: 'cutting' });
    expect(countOf(html, 'role="progressbar"'), 'exactly one progressbar').toBe(1);
    expect(html.includes('aria-valuemin="0"'), 'aria-valuemin').toBe(true);
    expect(html.includes('aria-valuemax="9"'), 'aria-valuemax is the number of fabrication stages').toBe(true);
    expect(html.includes('aria-valuenow="4"'), 'cutting is stage 4, so aria-valuenow is 4').toBe(true);
    expect(
      html.includes('aria-valuetext="Cutting — stage 4 of 9"'),
      'a progressbar announces aria-valuetext, and "stage 4 of 9 — Cutting" is more use than a percentage'
    ).toBe(true);
  });

  it('gives the dots and connectors aria-hidden so a screen reader reads stages, not decoration', () => {
    const html = render();
    expect(countOf(html, 'aria-hidden="true"') > 0, 'the rail is decorative and must not be announced').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-14 — label text and ordering per variant
// ---------------------------------------------------------------------------
describe('config-driven labels and stage ordering (AC-14)', () => {
  it('renders stage labels in config order, for every variant', () => {
    for (const variant of TIMELINE_VARIANTS) {
      const html = render({ variant });
      expect(
        renderedStageLabels(html),
        `variant "${variant}": the rendered order must equal ORDER_STAGES order — a re-sorted timeline misreports the fabrication sequence`
      ).toEqual(ORDER_STAGES.map((s) => stageLabel(s, variant)));
    }
  });

  it('shows the shop wording on admin and the customer wording on customer and public', () => {
    const bendingLabel = (variant: 'customer' | 'admin' | 'public') => {
      const html = render({ variant });
      const at = html.indexOf('data-testid="stage-bending"');
      const headingAt = html.indexOf('font-heading text-base', at);
      const open = html.indexOf('>', headingAt);
      return html.slice(open + 1, html.indexOf('</span>', open)).trim();
    };
    expect(bendingLabel('admin'), 'the shop calls it Bending/Forming').toBe('Bending/Forming');
    expect(bendingLabel('customer'), 'the customer sees Forming').toBe('Forming');
    expect(bendingLabel('public'), 'the public tracker is a customer who is not signed in').toBe('Forming');
  });

  it('contains no stage label the config module does not declare', () => {
    const html = render({ variant: 'customer' });
    for (const stage of ORDER_STAGES) {
      expect(
        html.includes(stage.customerLabel),
        `the customer render must show "${stage.customerLabel}" exactly as the config declares it`
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Variant content, rendered
// ---------------------------------------------------------------------------
describe('variant content as rendered', () => {
  const full = {
    currentStatus: 'cutting',
    statusHistory: HISTORY_TO_CUTTING,
    estimatedShipDate: '2026-01-25T15:00:00.000Z',
    shopPhotoUrl: 'https://example.test/signed.png',
    trackingNumber: '1Z999',
    carrier: 'UPS',
  };

  it('customer: descriptions, ship date and photo slot; no internal note and no employee name', () => {
    const html = render({ ...full, variant: 'customer' });
    expect(html.includes('Your material is being cut to specification.'), 'the active stage explains itself').toBe(true);
    expect(html.includes('data-testid="timeline-estimated-ship"'), 'the customer sees the expected ship date').toBe(true);
    expect(html.includes('data-testid="pre-ship-photo-slot"'), 'the customer sees the pre-ship photo slot').toBe(true);
    expect(html.includes('Coil pulled.'), 'an internal note must never reach a customer').toBe(false);
    expect(html.includes('Tricia'), 'which employee changed a status is not customer information').toBe(false);
  });

  it('admin: notes and who changed it; no customer prose, no ship date, no photo slot', () => {
    const html = render({ ...full, variant: 'admin' });
    expect(html.includes('data-testid="stage-note-received"'), 'the admin reads the note attached to that stage').toBe(true);
    expect(html.includes('Reviewed drawings.'), 'the note text').toBe(true);
    expect(html.includes('by Tricia'), 'and who made the change').toBe(true);
    expect(html.includes('Your material is being cut to specification.'), 'customer prose is not shop language').toBe(false);
    expect(
      html.includes('data-testid="timeline-estimated-ship"'),
      'the admin order detail already shows the scheduled date in its own panel'
    ).toBe(false);
    expect(html.includes('data-testid="pre-ship-photo-slot"'), 'the admin page already has PreShipPhotoSection').toBe(false);
  });

  it('public: prose for the current stage only, photo slot, and never a note or a name', () => {
    const html = render({ ...full, variant: 'public' });
    expect(html.includes('Your material is being cut to specification.'), 'the minimal variant explains what is happening now').toBe(true);
    expect(html.includes('Your order is confirmed and in our system.'), 'and nothing else — this is the minimal variant').toBe(false);
    expect(html.includes('data-testid="pre-ship-photo-slot"'), 'the photo is of the visitor’s own order').toBe(true);
    expect(html.includes('Coil pulled.'), 'an internal note must never reach an anonymous visitor').toBe(false);
    expect(html.includes('Tricia'), 'nor an employee name').toBe(false);
  });

  it('renders the tracking block as a link for a known carrier and as text for an unknown one', () => {
    const shipped = { currentStatus: 'shipped', statusHistory: HISTORY_TO_CUTTING, trackingNumber: '1Z999' };
    const known = render({ ...shipped, carrier: 'UPS', variant: 'customer' });
    expect(known.includes('https://www.ups.com/track?loc=en_US&amp;tracknum=1Z999'), 'a known carrier gets a real link').toBe(true);
    expect(known.includes('Track shipment: 1Z999 (UPS)'), 'with the number and the carrier named').toBe(true);

    const unknown = render({ ...shipped, carrier: 'Bubba Freight', variant: 'customer' });
    expect(unknown.includes('<a'), 'an unknown carrier must not get a guessed link that 404s').toBe(false);
    expect(unknown.includes('Tracking: 1Z999 · Bubba Freight'), 'the number still shows, as plain text').toBe(true);
  });

  it('renders no tracking block before the order ships', () => {
    expect(
      render({ currentStatus: 'cutting', statusHistory: HISTORY_TO_CUTTING, trackingNumber: '1Z999', carrier: 'UPS' }).includes(
        'data-testid="timeline-tracking"'
      ),
      'showing a tracking number before the order ships claims a shipment that has not happened'
    ).toBe(false);
  });

  it('strikes through the stages a cancelled order never reached and names the cancellation', () => {
    const html = render({
      currentStatus: 'cancelled',
      statusHistory: [
        ...HISTORY_TO_CUTTING.slice(0, 3),
        { status: 'cancelled', changedAt: T_CANCELLED, note: null, changedByName: null },
      ],
    });
    expect(html.includes('data-testid="timeline-banner-cancelled"'), 'the banner states the order was cancelled').toBe(true);
    expect(html.includes('This order was cancelled.'), 'in words').toBe(true);
    expect(countOf(html, 'line-through'), 'the six stages it will never reach are struck through').toBe(6);
  });

  it('names the real status for an order that has left the fabrication sequence', () => {
    const html = render({ currentStatus: 'packaged', statusHistory: [{ status: 'packaged', changedAt: T_CUTTING }] });
    expect(html.includes('data-testid="timeline-banner-post_production"'), 'the banner is rendered').toBe(true);
    expect(
      html.includes('Current status: Packaged'),
      'the customer is told the real status, not left to read a stage label that misstates it'
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-15 — load states
// ---------------------------------------------------------------------------
describe('loading, empty and error states (AC-15)', () => {
  it('loading: marks itself busy, says so, and renders no stage rows', () => {
    const html = render({ loadState: 'loading', statusHistory: [] });
    expect(html.includes('aria-busy="true"'), 'a loading panel must announce that it is busy').toBe(true);
    expect(html.includes('data-testid="production-timeline-loading"'), 'and be identifiable').toBe(true);
    expect(html.includes('Loading production status'), 'in words, not only as a spinner').toBe(true);
    expect(countOf(html, 'data-testid="stage-'), 'no stage row may render before the data arrives').toBe(0);
  });

  it('error: says what did not happen, blames nobody, and shows no stack trace', () => {
    const html = render({ loadState: 'error' });
    expect(html.includes('data-testid="production-timeline-error"'), 'the error panel is identifiable').toBe(true);
    expect(html.includes('role="alert"'), 'and announced').toBe(true);
    expect(
      html.includes('Nothing about your order has changed'),
      'CLAUDE.md rule #30: always say what did NOT happen — on this platform that sentence is the message'
    ).toBe(true);
    expect(/stack|at Object\.|TypeError/i.test(html), 'never a stack trace').toBe(false);
    expect(countOf(html, 'data-testid="stage-'), 'a failed display renders no half-timeline').toBe(0);
  });

  it('error: prefers a caller-supplied message when there is a more useful one', () => {
    const html = render({ loadState: 'error', errorMessage: 'Order not found or email does not match our records.' });
    expect(html.includes('Order not found or email does not match our records.'), 'the specific message wins').toBe(true);
    expect(html.includes('Nothing about your order has changed'), 'and replaces the generic body').toBe(false);
  });

  it('empty: still draws all nine stages and says nothing has been recorded', () => {
    const html = render({ statusHistory: [], currentStatus: 'submitted' });
    expect(html.includes('data-testid="production-timeline-empty"'), 'the empty state is identifiable').toBe(true);
    expect(html.includes('No production updates have been recorded yet'), 'and explains itself to a customer').toBe(true);
    expect(countOf(html, 'data-testid="stage-'), 'the stage list still renders — what is coming is information').toBe(9);
  });

  it('empty: uses the shop-side sentence on the admin variant', () => {
    const html = render({ statusHistory: [], variant: 'admin' });
    expect(
      html.includes('No status changes recorded yet.'),
      'this is the wording the admin order detail already used, preserved so the screen reads the same'
    ).toBe(true);
  });

  it('does not render an empty state once there is history', () => {
    expect(render().includes('data-testid="production-timeline-empty"'), 'there is nothing to apologise for').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-16 — source hygiene, so the build gate cannot regress silently
// ---------------------------------------------------------------------------
describe('colour hygiene (AC-16)', () => {
  const source = readFileSync(path.join(process.cwd(), 'components/account/ProductionTimeline.tsx'), 'utf8');
  // The file's own header explains each correction, and quoting a token inside
  // that prose would make the assertions below trivially false — so they run
  // against the code, with the leading comment block removed.
  const code = source.slice(source.indexOf('import {'));

  it('uses no afs-chrome-dim, which measures 2.88:1 on afs-bg-raised', () => {
    expect(
      code.includes('afs-chrome-dim'),
      'CLAUDE.md rule #18: afs-chrome-dim is never a text colour on gunmetal, and this component is inside the contrast build gate via /admin/orders/[id]'
    ).toBe(false);
  });

  it('never uses a status fill colour as a text colour', () => {
    expect(
      /text-afs-(crimson|success|warning|info|amber)\b/.test(code),
      'CLAUDE.md rule #29: those are FILL colours and measure 1.4-4.3:1 as text on gunmetal — the text variants are afs-*-on-dark'
    ).toBe(false);
  });

  it('uses no arbitrary colour value, which would raise the gate’s unresolved count', () => {
    expect(
      /(?:bg|text|border)-\[/.test(code),
      'CLAUDE.md rule #28: `0 unresolved` is load-bearing — an arbitrary value the gate cannot read means the gate got blinder'
    ).toBe(false);
  });

  it('declares no stage label of its own', () => {
    for (const stage of ORDER_STAGES) {
      expect(
        code.includes(`'${stage.customerLabel}'`) || code.includes(`"${stage.customerLabel}"`),
        `"${stage.customerLabel}" must come from lib/admin/orderStages.ts — a literal here is the drift that makes checklist #39 a two-file edit`
      ).toBe(false);
    }
  });
});
