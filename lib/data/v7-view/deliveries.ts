/**
 * DELIVERIES — the view model for v7's split screen, fixture side.
 *
 * Only the fixture is built here. The LIVE Deliveries screen keeps the
 * components it already has (`DeliveriesWeek`, `DeliveryTrackPanel`) because
 * they carry real behaviour v7 only mimes: real scheduling against
 * `lib/delivery/business-days.ts` and `windows.ts`, real "Mark delivered", and
 * the real tracking map the customer already sees. CLAUDE.md rule #33's own
 * carve-out covers exactly that case, and `lib/design/v7-delivery-map.ts`
 * explains at length why v7's schematic must never be pointed at a real stop.
 *
 * What this gives the pixel gate is the layout AROUND those parts, measured
 * against the prototype with the prototype's own stops in it: the split, the
 * schedule column, the unscheduled panel, the five day sections, the day tabs,
 * the truck line and the stop rows.
 */
import {
  V7_DAYS,
  V7_LEN,
  colorOf,
  dayStops,
  itemLabel,
  jobDims,
  jobHi,
  v7Fixture,
  type V7Job,
} from '@/lib/fixtures/command-center-v7';
import { v7MapSVG, type V7MapStop } from '@/lib/design/v7-delivery-map';
import type { V7Button, V7DrawingRef, V7SpecChip } from './types';

export interface V7DeliveryCard {
  key: string;
  drawing: V7DrawingRef | null;
  customer: string;
  itemLine: string;
  specLine: string;
  /** Present on a scheduled card; the unscheduled card shows a status instead. */
  window: string | null;
  /** v7's `.st`, `.st.bend`, `.st.finished` — only on an unscheduled card. */
  state: { tone: string; text: string } | null;
  selected: boolean;
  buttons: V7Button[];
}

export interface V7DeliveryDay {
  key: string;
  label: string;
  sub: string;
  today: boolean;
  cards: V7DeliveryCard[];
}

export interface V7DeliveryTrackRow {
  key: string;
  index: number;
  customer: string;
  detail: string;
  pillTone: string;
  state: string;
  selected: boolean;
}

export interface V7DeliveriesView {
  unscheduled: V7DeliveryCard[];
  days: V7DeliveryDay[];
  tabs: { key: string; label: string; on: boolean }[];
  /** The schematic SVG markup, fixture only. Null on the live screen. */
  mapSvg: string | null;
  truckLine: string;
  trackRows: V7DeliveryTrackRow[];
  trackEmpty: string;
  /** v7's `.fl` / `.fm` expand state. */
  full: 'list' | 'map' | null;
}

function cardOf(
  f: ReturnType<typeof v7Fixture>,
  j: V7Job,
  unscheduled: boolean,
  selected: boolean,
): V7DeliveryCard {
  const c: V7SpecChip = { hex: colorOf(j.spec)[1], colorName: colorOf(j.spec)[0], spec: j.spec };
  return {
    key: String(j.n),
    drawing: { kind: j.kind, d: jobDims(f.jobs, f.profiles, j), hi: jobHi(j), paint: j.paint },
    customer: j.cust,
    itemLine: itemLabel(j),
    specLine: `${c.spec} · ${V7_LEN}`,
    window: unscheduled ? null : j.win,
    state: unscheduled
      ? j.shop === 'bending'
        ? { tone: 'st bend', text: 'Bending now' }
        : j.shop === 'finished'
          ? { tone: 'st finished', text: 'Finished' }
          : { tone: 'st', text: 'Queued' }
      : null,
    selected,
    buttons: unscheduled
      ? [{ tone: 'amber', size: 'sm', label: 'Schedule delivery', action: 'sched', actionId: String(j.n) }]
      : [
          { tone: 'green', size: 'sm', label: 'Mark delivered', action: 'delivered', actionId: String(j.n) },
          { tone: 'slate', size: 'sm', label: 'Change', action: 'sched', actionId: String(j.n) },
        ],
  };
}

/** v7 `pageDeliveries()` (line 1818). */
export function fixtureDeliveries(day = 'thu', full: 'list' | 'map' | null = null): V7DeliveriesView {
  const f = v7Fixture();

  const days: V7DeliveryDay[] = V7_DAYS.map((d, i) => ({
    key: d.k,
    label: d.label,
    // v7 renders a non-breaking space when a day has no sub, so the two-line
    // header keeps its height on every day rather than only on the first two.
    sub: d.sub || ' ',
    today: i === 0,
    cards: dayStops(f.jobs, d.k).map((j) => cardOf(f, j, false, false)),
  }));

  const unscheduled = f.jobs
    .filter((j) => j.lane === 'shop' && !j.day)
    .map((j) => cardOf(f, j, true, false));

  const stops = dayStops(f.jobs, day);
  const mapStops: V7MapStop[] = stops.map((j) => ({ customer: j.cust, selected: false }));

  const trackRows: V7DeliveryTrackRow[] = stops.map((j, i) => {
    const now = day === 'thu' && i === 0;
    const state =
      j.shop === 'finished'
        ? now
          ? 'En route'
          : 'Loaded, leaves soon'
        : j.shop === 'bending'
          ? 'Still bending'
          : 'In the queue';
    return {
      key: String(j.n),
      index: i + 1,
      customer: j.cust,
      detail: `${itemLabel(j)} · window ${j.win}`,
      pillTone: now ? 'g' : 'a',
      state,
      selected: false,
    };
  });

  const dayLabel = V7_DAYS.find((d) => d.k === day)?.label ?? '';

  return {
    unscheduled,
    days,
    tabs: V7_DAYS.map((d) => ({
      key: d.k,
      label: `${d.label.split(',')[0]}${d.sub ? ` · ${d.sub}` : ''}`,
      on: d.k === day,
    })),
    // v7's truck is 0.55 along the first leg on today's tab and parked at the
    // shop on any other day — it has not left yet.
    mapSvg: v7MapSVG(mapStops, dayLabel, day === 'thu' ? 0.55 : 0),
    truckLine: stops.length
      ? day === 'thu'
        ? 'On the road to stop 1, about 14 minutes out'
        : 'Loads at the shop in the morning'
      : 'No stops this day',
    trackRows,
    trackEmpty: `No deliveries on ${dayLabel}.`,
    full,
  };
}
