/**
 * THE V7 VIEW MODEL — one shape per screen, two sources.
 *
 * Every Command Center screen is now rendered by ONE set of components whose
 * markup is a verbatim transliteration of prototype v7. Those components take
 * these types and nothing else. Two things build them:
 *
 *   - `lib/data/v7-view/from-fixture.ts` — prototype v7's own sample data, used
 *     only in fixture mode (lib/fixtures/mode.ts). This is what the
 *     whole-screen pixel gate renders, so the diff measures fidelity rather
 *     than photographing a database.
 *   - `lib/data/v7-view/from-live.ts` — the existing `lib/data/*` reads,
 *     unchanged, mapped into the same shape.
 *
 * WHY A VIEW MODEL RATHER THAN TWO SETS OF COMPONENTS. Two renderers for one
 * design is how a port drifts: the one the gate measures stays right and the
 * one people use does not. With a single renderer, a screen that passes the
 * gate in fixture mode is the same markup, the same CSS and the same layout
 * people see with real rows in it. The only thing that differs is the content.
 *
 * WHAT THE LIVE SIDE DELIBERATELY CANNOT SUPPLY is modelled as an explicit
 * absence rather than a fake: `drawing: null` for a job with no geometry,
 * `inbox: null` for the Outlook rail that has no Microsoft Graph behind it
 * (COMMAND_CENTER_V2_SPEC §2.4). The components render v7's own empty state for
 * those, never invented data. Each one is listed in docs/design/V7_PIXEL_REPORT.md.
 */

/** A profile drawing, as v7 draws it: a kind and per-segment lengths. */
export interface V7DrawingRef {
  kind: string;
  d: number[];
  /** Segment indices to highlight — a requested change not yet applied. */
  hi: number[];
  paint: string;
}

/** v7's material colour chip: the swatch hex and the spec text beside it. */
export interface V7SpecChip {
  hex: string;
  /** The colour's name, used as the chip's title attribute. */
  colorName: string;
  spec: string;
}

/** One of v7's `.pill` elements: a letter class and its text. */
export interface V7Pill {
  /** v7's pill modifier: 'g' | 'a' | 'b' | 'r' | 'v', or '' for the plain pill. */
  tone: string;
  text: string;
}

/** One of v7's `.btn` elements. `href` makes it a link; otherwise it posts. */
export interface V7Button {
  /** v7 button classes: 'red' | 'green' | 'amber' | 'blue' | 'violet' | 'slate' | 'line'. */
  tone: string;
  /** 'sm' | 'lg' | '' */
  size: string;
  label: string;
  href?: string;
  /** Identifies a non-navigating action to the client component that owns it. */
  action?: string;
  actionId?: string;
  /** `data-testid`, where the e2e suite addresses a specific control. */
  testId?: string;
}

/** A Workbench card (v7 `card()`, line 1248). */
export interface V7Card {
  /** The job number v7 shows, and the id the live app routes by. */
  key: string;
  jobNumber: number | string;
  /** Which lane this card is in. Read by the e2e suite as `data-stage`. */
  stage: string;
  customer: string;
  /** "Drip edge × 40" */
  itemLine: string;
  spec: V7SpecChip | null;
  /** null when the live side has no geometry for this job — never invented. */
  drawing: V7DrawingRef | null;
  /** v7 marks a sketch-only thumbnail `.photo` and an undrawn one `.np`. */
  thumbState: '' | 'photo' | 'np';
  /** The profile-state pill, always present in v7 (`pPill()`, line 1162). */
  profilePill: V7Pill;
  /** Revised v2 / Addendum waiting (`flagPills()`, line 1717). */
  flagPills: V7Pill[];
  source: string;
  meta: string;
  /** v7 `cardNote().c`: '' | 'warn' | 'ok'. */
  metaTone: '' | 'warn' | 'ok';
  beacon: boolean;
  approved: boolean;
  buttons: V7Button[];
  href: string;
}

export interface V7Lane {
  key: string;
  name: string;
  sub: string;
  cards: V7Card[];
}

export interface V7Chip {
  text: string;
  /** '' | 'go' | 'vio' */
  tone: string;
  beacon: boolean;
  href?: string;
  /** A scroll target inside the page, as v7's `toLane`/`toInbox` do. */
  scrollTo?: string;
}

/** One row in a rail panel or the shop/deliveries lists. */
export interface V7RailRow {
  key: string;
  drawing: V7DrawingRef | null;
  title: string;
  sub: string;
  href?: string;
}

/** An inbox row, which v7 colours by message type. */
export interface V7InboxRow {
  key: string;
  type: string;
  company: string;
  subject: string;
  time: string;
  button: V7Button;
}

export interface V7WorkbenchView {
  /** "Good morning, Steve." — carried as the heading's title attribute. */
  greeting: string;
  chips: V7Chip[];
  lanes: V7Lane[];
  /**
   * The Outlook rail. `null` means there is no Microsoft Graph connection
   * behind it, which is the live truth today — the panel then renders v7's
   * markup with an honest empty state rather than sample messages.
   */
  inbox: { connected: string; newCount: number; rows: V7InboxRow[] } | null;
  shopRows: V7RailRow[];
  deliveryRows: V7RailRow[];
  /** v7's `.foot`. The sample-data sentence is fixture-only; see the builders. */
  footNotes: string[];
}

/* ───────────────────────────── list screens ────────────────────────────── */

/** A Quotes/Orders list row (v7 `listRowHTML()`, line 1725). */
export interface V7ListRow {
  key: string;
  href: string;
  drawing: V7DrawingRef | null;
  customer: string;
  person: string;
  profileName: string;
  dims: string;
  bends: string;
  qty: string;
  spec: V7SpecChip | null;
  total: string;
  jobId: string;
  statusPill: V7Pill;
  flagPills: V7Pill[];
  meta: string;
  date: string;
  source: string;
  button: V7Button | null;
}

/** A filter-bar control. v7 has one text field and three selects. */
export interface V7Filter {
  /** The query-string key this control writes. */
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  options?: [string, string][];
}

export interface V7ListView {
  title: string;
  sub: string;
  showNewQuote: boolean;
  filters: V7Filter[];
  countLine: string;
  rows: V7ListRow[];
  emptyText: string;
}

/* ───────────────────────────────  search  ──────────────────────────────── */

export interface V7SearchRow {
  key: string;
  drawing: V7DrawingRef | null;
  profileName: string;
  dims: string;
  bends: string;
  customer: string;
  person: string;
  jobId: string;
  date: string;
  status: string;
  qty: string;
  spec: V7SpecChip | null;
  total: string;
  price: string;
  buttons: V7Button[];
}

export interface V7SearchView {
  filters: V7Filter[];
  /** v7's "Showing profile #N only" chip, with its clear button. */
  profileChip: { text: string; clearHref: string } | null;
  countLine: string;
  rows: V7SearchRow[];
  emptyText: string;
}

/* ─────────────────────────────── Shop View ─────────────────────────────── */

/** One row of v7's `.stbl` queue table (`pageShop()`, line 1476). */
export interface V7ShopRow {
  key: string;
  position: number;
  drawing: V7DrawingRef | null;
  /** True when a base64 drawing exists to lazy-load. Never the image itself. */
  hasLazyDrawing: boolean;
  itemLine: string;
  customerLine: string;
  spec: V7SpecChip | null;
  /** "2 bends, 2 hems" — v7 prints the bend count beside the painted side. */
  bends: string;
  paint: string;
  bending: boolean;
  /** The raw state key, read by the e2e suite as `data-state`. */
  state: string;
  stateLabel: string;
  /** v7 shows "1 note" / "3 notes" beside the status when there are any. */
  notePill: V7Pill | null;
  isRush: boolean;
  buttons: V7Button[];
}

export interface V7ShopFinishedRow {
  key: string;
  drawing: V7DrawingRef | null;
  hasLazyDrawing: boolean;
  itemLine: string;
  sub: string;
}

export interface V7ShopView {
  rows: V7ShopRow[];
  finishedToday: V7ShopFinishedRow[];
  /** v7's "Next up" panel — the first job in the queue, drawn large. */
  nextUp: { drawing: V7DrawingRef | null; hasLazyDrawing: boolean; key: string; caption: string } | null;
  emptyText: string;
}
