/**
 * THE LIVE SIDE OF THE VIEW MODEL — real rows, mapped into v7's shape.
 *
 * Reads nothing new. Every input comes from the existing `lib/data/*` modules
 * with their signatures and logic untouched; this file only reshapes what they
 * already return so the SAME components render it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHERE THE LIVE APP CANNOT FILL ONE OF v7's SLOTS, IT SAYS SO.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v7 is a prototype with complete sample data, so every slot on every screen is
 * full. The live app has three slots it genuinely cannot fill today, and each is
 * an explicit absence here rather than an invention:
 *
 *   1. THE PROFILE DRAWING on a card or a list row. The Workbench query
 *      deliberately selects no geometry at all — `lib/data/workbench.ts`'s
 *      egress rule and CLAUDE.md rule #26, because `geometry_svg` is a base64
 *      PNG at 70KB-786KB a row and a lane board would pull megabytes. So
 *      `drawing: null`, and the component renders v7's own empty `.np`
 *      thumbnail: the right box in the right place with nothing in it.
 *      Inventing a shape here would be drawing a profile nobody specified, on
 *      the screen whose next button sends work to a bending machine.
 *
 *   2. THE OUTLOOK INBOX RAIL. There is no Microsoft Graph code in this repo
 *      (docs/COMMAND_CENTER_V2_SPEC.md §2.4) and the Entra registration is
 *      pending, so `inbox: null` and the panel says it is not connected.
 *
 *   3. THE PROFILE-STATE PILL's "change asked" and "new version" states. Those
 *      come from v7's change-order model, which is gap-audit items 8 and 9 and
 *      does not exist. The live mapping can tell "has a saved profile" from
 *      "has none", which is the pill's other two states, and never claims the
 *      two it cannot know.
 *
 * Every one of these is listed in docs/design/V7_PIXEL_REPORT.md.
 */
import { V7_COLORS } from '@/lib/fixtures/command-center-v7';
import type {
  V7Button,
  V7Card,
  V7Chip,
  V7Lane,
  V7Pill,
  V7RailRow,
  V7SpecChip,
  V7WorkbenchView,
} from './types';
import type { MetaTone, Workbench, WorkbenchCard } from '@/lib/data/workbench';

/**
 * v7 paints a colour swatch beside every material. The live spec line is free
 * text assembled from `gauge` + `material`, so an exact key match into v7's
 * eight-entry library is rare; a loose match on the colour word is what makes
 * the chip meaningful rather than always grey.
 *
 * NO GUESSING BEYOND A NAMED COLOUR. If nothing matches, the chip takes v7's
 * own unknown grey (`#999999`, from `colorOf()`'s fallback) rather than a
 * plausible-looking one — a wrong swatch on a shop screen is worse than a
 * neutral one.
 */
export function liveSpecChip(spec: string): V7SpecChip | null {
  if (!spec) return null;
  const exact = V7_COLORS[spec];
  if (exact) return { hex: exact[1], colorName: exact[0], spec };
  const lower = spec.toLowerCase();
  for (const [key, val] of Object.entries(V7_COLORS)) {
    const word = val[0].toLowerCase();
    if (lower.includes(word) || lower.includes(key.toLowerCase())) {
      return { hex: val[1], colorName: val[0], spec };
    }
  }
  return { hex: '#999999', colorName: '', spec };
}

/** v7 `cardNote().c` has three values; the data module has four tones. */
const META_TONE: Record<MetaTone, '' | 'warn' | 'ok'> = {
  neutral: '',
  warn: 'warn',
  good: 'ok',
  // v7 has no separate "bad" tone — a failed send is amber-urgent on the card
  // and states its own message in the button row.
  bad: 'warn',
};

/**
 * The profile-state pill, as far as live data can honestly tell.
 *
 * `hasSavedProfile` is the only one of v7's four states the live model knows.
 * The other two ("change asked", "new version saved") belong to a change-order
 * feature that does not exist, and claiming one would put a sentence on the
 * card that nothing behind it can support.
 */
export function liveProfilePill(card: WorkbenchCard, hasSavedProfile: boolean): V7Pill {
  if (hasSavedProfile) return { tone: 'g', text: 'Past profile' };
  return {
    tone: 'r',
    text: card.sourceIcon === 'photo' ? 'Photo of sketch, not drawn yet' : 'New profile, needs drawing',
  };
}

function liveCardButtons(card: WorkbenchCard, href: string): V7Button[] {
  if (!card.action) return [];
  const a = card.action;
  if (a.kind === 'send-to-machine') {
    return [{ tone: 'green', size: 'sm', label: a.label, action: 'machine', actionId: card.id }];
  }
  if (a.kind === 'retry-send') {
    // v7's light theme resolves red and green to the one action colour; the
    // distinction stays in the markup without inventing a colour.
    return [{ tone: 'red', size: 'sm', label: a.label, action: 'machine', actionId: card.id }];
  }
  if (a.kind === 'schedule-delivery') {
    return [{ tone: 'amber', size: 'sm', label: a.label, href: '/admin/deliveries' }];
  }
  if (a.kind === 'start-quote') return [{ tone: 'red', size: 'sm', label: a.label, href }];
  return [{ tone: 'amber', size: 'sm', label: a.label, href }];
}

function liveCard(card: WorkbenchCard): V7Card {
  const href = `/admin/command-center/job/${card.id}`;
  return {
    key: card.id,
    jobNumber: card.requestNumber,
    customer: card.customer,
    itemLine: card.itemLine,
    spec: liveSpecChip(card.specLine),
    // See this file's header, point 1.
    drawing: null,
    thumbState: 'np',
    profilePill: liveProfilePill(card, false),
    // v7's flag pills are Revised v2 and Addendum waiting — gap-audit items 8
    // and 9, neither of which exists. Rush is the one flag this app really has,
    // and it is only ever set from an explicit source (CLAUDE.md rule #15).
    flagPills: card.isRush ? [{ tone: 'r', text: 'RUSH' }] : [],
    source: card.sourceLabel,
    meta: card.meta,
    metaTone: META_TONE[card.metaTone],
    beacon: card.stage === 'approved' && card.pulse,
    approved: card.stage === 'approved' && card.pulse,
    buttons: liveCardButtons(card, href),
    href,
  };
}

/** v7 `pageWorkbench()`, from the live Workbench read. */
export function liveWorkbench(
  wb: Workbench,
  nextTwoDays: { heading: string; stops: { id: string; customer: string; window: string; item: string }[] }[],
): V7WorkbenchView {
  const lanes: V7Lane[] = wb.lanes.map((l) => ({
    key: l.key,
    name: l.name,
    sub: l.sub,
    cards: l.cards.map(liveCard),
  }));

  const approvals = wb.summary.approvalsReady;
  const deliveriesToday = nextTwoDays[0]?.stops.length ?? 0;

  // v7's four chips, in v7's order. The third is the email count, which has no
  // Graph connection behind it — it says that rather than printing a zero that
  // would read as "no new mail" when the truth is "nothing is being read".
  const chips: V7Chip[] = [
    approvals
      ? { text: `${approvals} ready for the machine`, tone: 'go', beacon: true, scrollTo: 'lane-approved' }
      : { text: 'No approvals waiting', tone: '', beacon: false },
    { text: `${wb.summary.quotesToWrite} to quote`, tone: '', beacon: false, scrollTo: 'lane-new' },
    { text: 'Email not connected', tone: 'vio', beacon: false, scrollTo: 'inbox' },
    {
      text: `${deliveriesToday ? `${deliveriesToday} deliver${deliveriesToday === 1 ? 'y' : 'ies'}` : 'No deliveries'} today`,
      tone: '',
      beacon: false,
      href: '/admin/deliveries',
    },
  ];

  const shopRows: V7RailRow[] = (wb.lanes.find((l) => l.key === 'shop')?.cards ?? []).map((c) => ({
    key: c.id,
    drawing: null,
    title: c.itemLine,
    sub: `${c.customer} · ${c.meta}`,
    href: '/admin/shop-view',
  }));

  const deliveryRows: V7RailRow[] = nextTwoDays.flatMap((d) =>
    d.stops.map((s) => ({
      key: s.id,
      drawing: null,
      title: s.customer,
      sub: `${d.heading} · ${s.window} · ${s.item}`,
      href: '/admin/deliveries',
    })),
  );

  const footNotes = ['Done jobs leave the board after 14 days. Search still finds them.'];
  if (wb.archivedFromDone > 0) {
    // Never a silent truncation: if the 14-day rule hid something, say so.
    footNotes.push(
      wb.archivedFromDone === 1
        ? '1 finished job has left the board.'
        : `${wb.archivedFromDone} finished jobs have left the board.`,
    );
  }

  return {
    chips,
    lanes,
    // See this file's header, point 2.
    inbox: null,
    shopRows,
    deliveryRows,
    footNotes,
  };
}
