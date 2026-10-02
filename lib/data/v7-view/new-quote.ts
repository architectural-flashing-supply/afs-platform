/**
 * NEW QUOTE — v7 `pageNewQuote()` (prototype line 1761), fixture side.
 *
 * The live screen is already a careful port of this (see
 * app/admin/quotes/new/page.tsx's own header, which records what each button
 * really does and what "Create customer" deliberately does NOT do). What it
 * could not have is v7's data, so the pixel gate measured it against a
 * prototype showing eleven customers, a reorder strip and three profile cards
 * while the live database has none of those — 17% to 26% of difference that was
 * almost entirely content.
 *
 * This supplies v7's content through the same shapes, so the diff measures the
 * three-column card layout, the reorder strip, the customer rail and the
 * profile-type picker rather than how many customers happen to exist.
 */
import { V7_CUSTS, emailOf, fmtTs, personOf, pieces, v7AllRows, v7Fixture } from '@/lib/fixtures/command-center-v7';
import { V7_DEF, V7_NAMES, dimTxt } from '@/lib/design/v7-draw';
import type { V7DrawingRef } from './types';

export interface V7NewQuoteCustomer {
  key: string;
  company: string;
  /** "Mike · last order Sep 29" or "Mike · no orders yet". */
  line: string;
  /** v7's `.oj` badge — how many past quotes and orders this customer has. */
  count: number;
  selected: boolean;
  href: string;
}

export interface V7NewQuoteProfileCard {
  key: string;
  drawing: V7DrawingRef;
  title: string;
  dims: string;
  lastMade: string;
  href: string;
}

export interface V7NewQuoteView {
  query: string;
  customers: V7NewQuoteCustomer[];
  customersEmpty: string;
  blankHref: string;
  /** Which of v7's three right-hand panes to render. */
  pane: 'prompt' | 'customer' | 'blank';
  detail: {
    name: string;
    person: string;
    email: string;
    /** v7's green "Fastest way: reorder their last order" strip. */
    reorder: { line: string; href: string } | null;
    profiles: V7NewQuoteProfileCard[];
    profilesEmpty: string;
    kindOptions: [string, string][];
    selectedKind: string;
    drawHref: string;
  } | null;
}

/** v7's profile-type picker — the nine definitions, in `DEF` order. */
export function v7KindOptions(): [string, string][] {
  return Object.keys(V7_DEF).map((k) => [k, V7_NAMES[k]] as [string, string]);
}

export function fixtureNewQuote(
  opts: { q?: string; customer?: string; blank?: boolean; kind?: string } = {},
): V7NewQuoteView {
  const f = v7Fixture();
  const rows = v7AllRows(f.profiles, f.jobs);
  const q = (opts.q ?? '').trim().toLowerCase();

  // v7 `custRecent()` — every customer, most recent ORDER first, with the count
  // of everything they have ever had quoted or ordered.
  const recent = V7_CUSTS.map((c) => {
    const mine = rows.filter((r) => r.cust === c[0]).sort((a, b) => b.ts - a.ts);
    const ord = mine.filter((r) => r.lane === 'approved' || r.lane === 'shop' || r.lane === 'done');
    return { name: c[0], person: c[1], last: ord[0] ?? null, n: mine.length };
  }).sort((a, b) => (b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0));

  const shown = recent.filter((c) => !q || `${c.name} ${c.person}`.toLowerCase().includes(q));

  const customers: V7NewQuoteCustomer[] = shown.map((c) => ({
    key: c.name,
    company: c.name,
    line: `${c.person}${c.last ? ` · last order ${fmtTs(c.last.ts)}` : ' · no orders yet'}`,
    count: c.n,
    selected: c.name === opts.customer,
    href: `/admin/quotes/new?customer=${encodeURIComponent(c.name)}&fixture=v7`,
  }));

  const selected = opts.customer && V7_CUSTS.some((c) => c[0] === opts.customer) ? opts.customer : null;

  if (opts.blank || !selected) {
    return {
      query: opts.q ?? '',
      customers,
      customersEmpty: 'No customer matches. Press New customer.',
      blankHref: '/admin/quotes/new?new=1&fixture=v7',
      pane: opts.blank ? 'blank' : 'prompt',
      detail: null,
    };
  }

  // v7's reorder strip is the customer's most recent DELIVERED job that has a
  // saved profile behind it — the one thing that can be repeated exactly.
  const last = rows
    .filter((r) => r.cust === selected && r.pid && r.lane === 'done')
    .sort((a, b) => b.ts - a.ts)[0];

  const profiles = f.profiles
    .filter((p) => p.cust === selected)
    .map((p) => ({
      key: String(p.id),
      drawing: { kind: p.kind, d: p.d, hi: [], paint: p.paint } as V7DrawingRef,
      title: `${V7_NAMES[p.kind]}${p.ver > 1 ? ` v${p.ver}` : ''}`,
      dims: dimTxt(p.kind, p.d),
      lastMade: `Last made ${p.mats[0] ? p.mats[0].last : ''} · ${p.mats.length} material${p.mats.length === 1 ? '' : 's'}`,
      href: `/admin/search?pid=${p.id}&fixture=v7`,
    }));

  return {
    query: opts.q ?? '',
    customers,
    customersEmpty: 'No customer matches. Press New customer.',
    blankHref: '/admin/quotes/new?new=1&fixture=v7',
    pane: 'customer',
    detail: {
      name: selected,
      person: personOf(selected),
      email: emailOf(selected),
      reorder: last
        ? {
            line: `${V7_NAMES[last.kind]} ${dimTxt(last.kind, last.d)} · ${last.spec} · ${last.qty} ${pieces(last.qty)} · ${fmtTs(last.ts)}`,
            href: `/admin/quotes/new?customer=${encodeURIComponent(selected)}&fixture=v7`,
          }
        : null,
      profiles,
      profilesEmpty: 'No saved profiles yet. Draw the first one below.',
      kindOptions: v7KindOptions(),
      selectedKind: opts.kind ?? 'drip',
      drawHref: '/studio/draft',
    },
  };
}
