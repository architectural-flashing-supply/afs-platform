/**
 * v7-color-deviations.ts — the colour substitutions the style gate will accept.
 *
 * The gate compares the live Command Center against prototype v7 and treats ANY
 * colour difference as a failure, with exactly one exception: a pair listed
 * here. Each entry is a colour v7 uses that fails the WCAG AA build gate, and
 * the nearest passing shade in the same hue family that replaced it.
 *
 * Three files have to agree about this list, and a test enforces each link:
 *   - docs/design/V7_COLOR_DEVIATIONS.md       the reasoning and the measurements
 *   - docs/design/command-center-v7/v7-deviations.css   the applied CSS
 *   - this module                              what the style gate forgives
 *
 * `lib/design/v7-deviations.test.ts` recomputes every ratio from the real CSS,
 * asserts each deviation is still NECESSARY (v7's value really does fail) and
 * SUFFICIENT (the replacement really does pass), and asserts this list matches
 * the CSS. So a deviation cannot be added here to silence the gate without the
 * numbers backing it up, and one that stops being needed fails the test rather
 * than lingering as a permanent excuse.
 */

export interface V7ColorDeviation {
  /** The colour as prototype v7 authors it. */
  v7: string;
  /** The colour the live app uses instead. */
  live: string;
  /** Why v7's value could not be used. */
  reason: string;
  /** Measured contrast of v7's value in the failing use, and what was needed. */
  measured: { ratio: number; required: number; against: string };
}

export const V7_COLOR_DEVIATIONS: V7ColorDeviation[] = [
  {
    v7: '#1E8E52',
    live: '#1D874E',
    reason:
      "v7's green carries white text in .chk i (13px/700), .apv (12.5px/700) and " +
      '.srow.now .pos (18px/700 — bold counts as large only from 18.66px, so all ' +
      'three are small text). Channels scaled uniformly x0.954, holding the hue to ' +
      'within 2%. Applied to the colour everywhere it appears, not to those three ' +
      'selectors, so the interface keeps exactly one green.',
    measured: { ratio: 4.16, required: 4.5, against: '#FFFFFF' },
  },
];

/** Every colour string, normalised to lowercase hex, that may differ. */
const DEVIATION_PAIRS = new Map(
  V7_COLOR_DEVIATIONS.map((d) => [normaliseHex(d.v7), normaliseHex(d.live)]),
);

function normaliseHex(value: string): string {
  return value.trim().toLowerCase();
}

/** `rgb(30, 142, 82)` / `rgba(30, 142, 82, 1)` -> `#1e8e52`. Other formats pass through. */
export function cssColorToHex(value: string): string {
  const m = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!m) return normaliseHex(value);
  const [r, g, b] = [m[1], m[2], m[3]].map((n) => Math.round(Number(n)));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * True when a computed colour difference is an allowed deviation — that is,
 * the prototype shows v7's failing colour and the live app shows its documented
 * replacement. Any other difference, including the reverse direction, is a
 * failure.
 */
export function isAllowedColorDeviation(protoValue: string, liveValue: string): boolean {
  const proto = cssColorToHex(protoValue);
  const live = cssColorToHex(liveValue);
  return DEVIATION_PAIRS.get(proto) === live;
}
