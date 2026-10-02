/**
 * v7-component-map.ts — the table the style gate walks.
 *
 * Each entry pairs ONE component in prototype v7 with the SAME component in the
 * live app, and names the page each is on. `tests/visual/v7-style-gate.spec.ts`
 * opens both, reads the computed styles of both, and fails if they differ.
 *
 * THIS TABLE IS THE DEFINITION OF "DONE" FOR A SCREEN. A Command Center
 * component that is not in here is not covered, so every v7 component a stage
 * builds must be added as that stage is built. The gate asserts coverage too:
 * see `EXPECTED_STAGE_COVERAGE` at the bottom and the `coverage` test in the
 * spec, so quietly building a screen without mapping it fails rather than
 * passing by omission.
 *
 * ON `protoPage` / `livePath`
 *
 * The prototype is a single file that swaps pages in JS. The gate reaches a
 * page by CLICKING the prototype's own `[data-go]` nav rather than by calling
 * its internal functions — those are not globals, which an earlier run
 * discovered by having every such call fail silently.
 *
 * ON `stateful`
 *
 * Some components only exist after an interaction (the More menu, the
 * type-ahead panel). `open` names the prototype action and the live action
 * needed to reveal them. A component that cannot be revealed without seeding
 * data is marked `requiresData` and is reported as UNCOVERED rather than
 * silently skipped — the honest outcome, and the same principle as the contrast
 * gate's `0 unresolved`.
 */

/** Computed properties compared for every pair. */
export const COMPARED_PROPERTIES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'color',
  'backgroundColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderBottomWidth',
  'borderBottomStyle',
  'borderBottomColor',
  'borderLeftWidth',
  'borderLeftStyle',
  'borderLeftColor',
  'borderRightWidth',
  'borderRightStyle',
  'borderRightColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'boxShadow',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'height',
] as const;

export type ComparedProperty = (typeof COMPARED_PROPERTIES)[number];

/**
 * Properties whose values are LENGTHS and so compare with a tolerance.
 * Everything else must match exactly (colours, families, keywords, shadows).
 */
export const LENGTH_PROPERTIES: ReadonlySet<string> = new Set([
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'height',
]);

/** 1px, per the brief. */
export const LENGTH_TOLERANCE_PX = 1;

/**
 * `height` is excluded from comparison for components whose height is set by
 * their CONTENT rather than by CSS — a nav pill's width/height follows its
 * label, and the live labels are real data where v7's are samples. Declaring
 * this per-entry (rather than dropping `height` globally) keeps the property
 * asserted everywhere it is actually specified in CSS.
 */
export interface V7ComponentPair {
  /** Stable key, used in the gate's report table. */
  key: string;
  /** Human name for the report. */
  label: string;
  /** Which build stage introduced it. */
  stage: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  /** Prototype page, as its `[data-go]` key. `null` = present on first load. */
  protoPage: string | null;
  /** Prototype selector. */
  proto: string;
  /** Live route. */
  livePath: string;
  /** Live selector. */
  live: string;
  /** Properties to skip for this pair, each with the reason. */
  skip?: Partial<Record<ComparedProperty, string>>;
  /** Interaction needed to reveal the component on each side. */
  open?: { proto: string; live: string };
  /**
   * Set when the component cannot be shown without seeded data. The gate
   * reports these as UNCOVERED rather than passing them.
   */
  requiresData?: string;
  /**
   * Set when the component genuinely has no counterpart in the PROTOTYPE's
   * rendered state, with the reason — v7's seed fills all five lanes, so its
   * empty-lane message never renders even though its CSS defines one.
   *
   * This is NOT a skip. The gate still asserts the LIVE element exists and is
   * rendered; it only forgoes the comparison, and prints the pair as
   * `NO-PROTO` with this reason so it can never be mistaken for a pass. Use it
   * only when the prototype cannot be driven into the state, never to silence
   * a difference — a wrong colour here would be hidden, which is why it is a
   * separate field from `skip` and carries its own column in the report.
   */
  absentInPrototype?: string;
}

/**
 * STAGE A — the shared shell. Everything here is on every admin page, so the
 * gate checks it on the Workbench route and does not repeat it per screen.
 */
export const V7_COMPONENT_MAP: V7ComponentPair[] = [
  {
    key: 'header',
    label: 'Header bar',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr',
    livePath: '/admin/command-center',
    live: 'header.hdr',
    skip: {
      height: 'The header grows with its content; v7 sizes it from padding, which is compared.',
    },
  },
  {
    key: 'header-inner',
    label: 'Header inner row',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .hdr-in',
    livePath: '/admin/command-center',
    live: 'header.hdr .hdr-in',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'brand',
    label: 'Brand lockup',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .brand',
    livePath: '/admin/command-center',
    live: 'header.hdr .brand',
    skip: { height: 'Content-sized — the logo file differs in intrinsic size.' },
  },
  {
    key: 'brand-wordmark',
    label: 'Brand wordmark ("Command Center")',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .brand .bt b',
    livePath: '/admin/command-center',
    live: 'header.hdr .brand .bt b',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'new-quote-button',
    label: '"+ New quote" button (the one red)',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .nqb',
    livePath: '/admin/command-center',
    live: 'header.hdr .nqb',
  },
  {
    key: 'nav',
    label: 'Nav pill group',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr nav.nav',
    livePath: '/admin/command-center',
    live: 'header.hdr nav.nav',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'nav-item',
    label: 'Nav item, inactive',
    stage: 'A',
    protoPage: null,
    // The prototype's first load is the Workbench, so its SECOND nav child
    // ("Quotes") is the inactive one. Live is the same page, same position.
    proto: 'header.hdr nav.nav a:not(.on)',
    livePath: '/admin/command-center',
    live: 'header.hdr nav.nav a:not(.on)',
  },
  {
    key: 'nav-item-active',
    label: 'Nav item, active chip',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr nav.nav a.on',
    livePath: '/admin/command-center',
    live: 'header.hdr nav.nav a.on',
  },
  {
    key: 'search-input',
    label: 'Header search field',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .hs input',
    livePath: '/admin/command-center',
    live: 'header.hdr .hs input',
  },
  {
    key: 'more-button',
    label: 'More button (secondary)',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .more .mbtn',
    livePath: '/admin/command-center',
    live: 'header.hdr .more .mbtn',
  },
  {
    key: 'more-menu',
    label: 'More menu panel',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .more .mm',
    livePath: '/admin/command-center',
    live: 'header.hdr .more .mm',
    open: { proto: 'header.hdr .more .mbtn', live: 'header.hdr .more .mbtn' },
    skip: { height: 'Content-sized — the live menu has four items, v7 has two.' },
  },
  {
    key: 'more-menu-item',
    label: 'More menu item',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .more .mm a',
    livePath: '/admin/command-center',
    live: 'header.hdr .more .mm a',
    open: { proto: 'header.hdr .more .mbtn', live: 'header.hdr .more .mbtn' },
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'who',
    label: 'Signed-in admin name',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .who',
    livePath: '/admin/command-center',
    live: 'header.hdr .who',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'logout',
    label: 'Log out link',
    stage: 'A',
    protoPage: null,
    proto: 'header.hdr .lo',
    livePath: '/admin/command-center',
    live: 'header.hdr .lo',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wrap',
    label: 'Page working area (main.wrap)',
    stage: 'A',
    protoPage: null,
    proto: 'main.wrap',
    livePath: '/admin/command-center',
    live: 'main.wrap',
    skip: { height: 'Page-length, set by content.' },
  },
// ---------------------------------------------------------------- STAGE B
  // The Workbench. `protoPage: null` because the prototype opens on it.
  {
    key: 'wb-greet',
    label: 'Workbench greeting row',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .greet',
    livePath: '/admin/command-center',
    live: 'main.wrap .greet',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-title',
    label: 'Page title (h1.t)',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .greet h1.t',
    livePath: '/admin/command-center',
    live: 'main.wrap .greet h1.t',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-chip',
    label: 'Summary chip, plain',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .chips .chip:not(.go):not(.vio)',
    livePath: '/admin/command-center',
    live: 'main.wrap .chips .chip:not(.go):not(.vio)',
  },
  {
    key: 'wb-lane',
    label: 'Lane column',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new',
    skip: { height: 'Content-sized — lane height follows its cards.' },
  },
  {
    key: 'wb-lane-heading',
    label: 'Lane heading',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .lane-t h2',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .lane-t h2',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-lane-count',
    label: 'Lane count badge',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .lc',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .lc',
  },
  {
    key: 'wb-lane-sub',
    label: 'Lane sub-heading',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .lane-h p',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .lane-h p',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-card',
    label: 'Job card',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .card',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .card',
    skip: { height: 'Content-sized — real customer names wrap differently from samples.' },
  },
  {
    key: 'wb-card-customer',
    label: 'Job card customer link (.stretch)',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .card .stretch',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .card .stretch',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-card-item',
    label: 'Job card item line',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .card .item',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .card .item',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-card-meta',
    label: 'Job card meta row',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .card .meta',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .card .meta',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-card-src',
    label: 'Job card source tag (.src)',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .card .meta .src',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .card .meta .src',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-card-button',
    label: 'Job card action button (red, small)',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane.new .card .btn.red.sm',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane.new .card .btn.red.sm',
  },
  {
    key: 'wb-empty',
    label: 'Empty lane message',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .lanes .lane .empty',
    livePath: '/admin/command-center',
    live: 'main.wrap .lanes .lane .empty',
    skip: { height: 'Content-sized.' },
    absentInPrototype:
      "v7's demo seed puts at least one job in all five lanes, so its empty-lane " +
      'message never renders, even though `.empty` is defined in its CSS. The live ' +
      'element is still asserted to exist and render.',
  },
  {
    key: 'wb-rail-panel',
    label: 'Rail panel (.rp)',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .rail2 .rp',
    livePath: '/admin/command-center',
    live: 'main.wrap .rail2 .rp',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-rail-heading',
    label: 'Rail panel heading',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .rail2 .rp h3',
    livePath: '/admin/command-center',
    live: 'main.wrap .rail2 .rp h3',
    skip: { height: 'Content-sized.' },
  },
  {
    key: 'wb-foot',
    label: 'Board footnote (.foot)',
    stage: 'B',
    protoPage: null,
    proto: 'main.wrap .foot',
    livePath: '/admin/command-center',
    live: 'main.wrap .foot',
    skip: { height: 'Content-sized.' },
  },
];


/**
 * How many pairs each stage is expected to contribute, so that building a
 * screen without mapping its components fails the `coverage` test instead of
 * passing by omission. Raise a number in the same commit that adds the entries.
 */
export const EXPECTED_STAGE_COVERAGE: Partial<Record<V7ComponentPair['stage'], number>> = {
  A: 15,
  B: 17,
};

/** The viewports the brief names for the shell, widest first. */
export const SHELL_VIEWPORTS = [
  { width: 1920, height: 1080, label: '1920' },
  { width: 1440, height: 900, label: '1440' },
  { width: 1280, height: 800, label: '1280' },
  { width: 900, height: 900, label: '900' },
] as const;

/** The pairs the brief names for side-by-side screenshots. */
export const SCREENSHOT_VIEWPORTS = [
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1280, height: 800, label: '1280x800' },
] as const;
