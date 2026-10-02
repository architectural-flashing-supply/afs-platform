import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * THE WHOLE-SCREEN PIXEL HARNESS — shared machinery for the fidelity gate.
 *
 * WHY THIS REPLACED THE COMPUTED-STYLE GATE AS THE AUTHORITY.
 * tests/visual/v7-style-gate.spec.ts compares 66 hand-picked element pairs on
 * properties like font-size and background. It can tell you that `.card` has
 * the right padding. It CANNOT tell you that the card is missing its profile
 * drawing, that its two pills are absent, that the rail has one panel where v7
 * has three, or that the whole section is in the wrong order — because it only
 * looks at pairs somebody thought to list, and only at properties somebody
 * thought to compare. It passed while the owner's report was "nothing matches",
 * and both of those can be true at once. That is the definition of a gate
 * measuring the wrong thing.
 *
 * A whole-screen diff has no such blind spot: anything visible that differs
 * lands in the number. The style gate is kept as a SECONDARY check — it is
 * better at saying *why* two screens differ once the diff says they do.
 *
 * THREE THINGS THIS FILE IS CAREFUL ABOUT.
 *
 * 1. DIFFERENT HEIGHTS MUST COUNT AS DIFFERENCE. Two full-page screenshots of
 *    the same screen are rarely the same size, and a diff library needs equal
 *    dimensions. Cropping to the intersection would make a live page that
 *    renders half of v7's content score WELL, because the missing half would be
 *    outside the compared area. So both images are composited onto one canvas
 *    of the union size over a sentinel magenta, and every pixel where only one
 *    side has content counts as differing. A missing section raises the number;
 *    it cannot lower it.
 *
 * 2. NO ANTIALIASING AMNESTY BEYOND WHAT TYPE NEEDS. `threshold` is pixelmatch's
 *    per-pixel colour tolerance, not an area allowance. It is set to 0.1 —
 *    enough that identical text rendered twice by the same browser does not
 *    register, not enough to forgive a different shade. The AREA allowance is
 *    the pass rule, and it is checked by the caller.
 *
 * 3. THE BASELINE COMES ONLY FROM THE UNTOUCHED PROTOTYPE. `writeBaseline` is
 *    the only writer, it is called only from the prototype side, and the gate
 *    re-captures on every run rather than trusting a committed PNG. There is no
 *    "update baselines" mode, because the baseline is not an expectation that
 *    can drift — it is a render of a committed file.
 */

export const VIEWPORT = { width: 1440, height: 900 };

/** Per-screen pass rule: at most this share of pixels may differ. */
export const DIFF_BUDGET = 0.015;

/** Total mask area may not exceed this share of the screen. */
export const MASK_BUDGET = 0.02;

export const BASELINE_DIR = path.join(__dirname, 'v7-baselines');
export const OUT_DIR = path.join(__dirname, '..', '..', 'test-results', 'v7-pixel');

/**
 * A mask. Every one must carry a justification, and the gate prints them all in
 * the report — a mask with no stated reason is how a diff gets quietly widened
 * until it passes.
 *
 * ONLY genuinely dynamic text qualifies: a clock, a relative time, a value that
 * moves between the two captures. "This bit does not match yet" is not a
 * justification, it is the finding.
 */
export interface ScreenMask {
  /** CSS selector, resolved on BOTH sides. Missing on one side is not an error. */
  selector: string;
  why: string;
}

/**
 * Masks in force, per screen id. Empty today; anything added here appears in
 * docs/design/V7_PIXEL_REPORT.md with its reason and its measured area.
 */
export const SCREEN_MASKS: Record<string, ScreenMask[]> = {};

/* ──────────────────────────── determinism ──────────────────────────────── */

/**
 * Freeze the clock and the random source before any page script runs.
 *
 * v7 pins most of its own time to `NOW = new Date(2026, 9, 1, 10, 30)`, but
 * `nowT()` and `nowStamp()` read the real clock, and the live app reads it in
 * far more places. Without this, a screen captured either side of a minute
 * boundary differs on a timestamp and the diff blames the port.
 *
 * `Date` is replaced wholesale rather than patched, because v7 calls both
 * `new Date()` and `Date.now()`, and `toLocaleTimeString` on the result.
 */
export const FREEZE_INIT = `
(() => {
  const FIXED = new Date(2026, 9, 1, 10, 30, 0, 0).getTime();
  const RealDate = Date;
  function FrozenDate(...args) {
    if (args.length === 0) return new RealDate(FIXED);
    return new RealDate(...args);
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = () => FIXED;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  Object.setPrototypeOf(FrozenDate, RealDate);
  // eslint-disable-next-line no-global-assign
  window.Date = FrozenDate;
  let seed = 0x2f6e2b1;
  Math.random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
})();
`;

/**
 * Hold the page still. Transitions, animations, the caret and smooth scrolling
 * all make two captures of the same markup differ.
 *
 * `caret-color: transparent` rather than hiding focus outlines: v7 focuses the
 * first button in a modal (`render()`'s tail), so the focus ring is REAL state
 * that both sides must show. Only the blinking caret is removed.
 */
export const STILLNESS_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}
html { scroll-behavior: auto !important; }
`;

/**
 * Everything a page needs before it is captured.
 *
 * THE TIMEOUT IS NOT DECORATION. Playwright's default action timeout is
 * UNLIMITED unless the config sets one, and this config does not. A driver
 * whose selector matches nothing then hangs the whole run rather than failing
 * that one screen — which is exactly what happened on the first run: a driver
 * clicked a `[data-go="prof:1"]` that exists on the Customers page and not on
 * the Workbench, and the gate sat on it until the test timeout. Ten seconds is
 * generous for a local click and short enough that a wrong selector is reported
 * as one screen's error instead of swallowing the other thirty-six.
 */
export const ACTION_TIMEOUT_MS = 10_000;

export async function prepare(page: Page): Promise<void> {
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  await page.addInitScript(FREEZE_INIT);
}

/**
 * REMOVE THE PROTOTYPE'S OWN SCAFFOLDING BEFORE CAPTURING A BASELINE.
 *
 * v7's first element is `<div class="proto">`, a 29px amber strip reading
 * "Interactive design prototype, version 7. Everything is clickable…" with a
 * drawing-line toggle and a "Reset the demo" button. It is the harness v7 wraps
 * around itself so a reviewer can drive it — it is not part of the Command
 * Center design, nothing in the app has a counterpart, and nothing should.
 *
 * WHY IT CANNOT JUST BE LEFT IN. It is a static block, so it pushes the whole
 * document down by its own height. Every screen would then differ by a
 * full-width band at the top plus a constant vertical offset on every pixel
 * below it — on a 900px viewport that alone is well over the 1.5% budget, and
 * NO SCREEN COULD EVER PASS however faithful the port. The gate would be
 * measuring the prototype's review chrome.
 *
 * WHY THIS IS NOT "EDITING THE BASELINE TO MAKE A SCREEN PASS". The file on
 * disk is untouched and the baseline is still re-rendered from it every run.
 * What is removed is three elements the prototype itself labels as prototype
 * apparatus, identified by their own class and ids rather than by a pixel
 * offset somebody tuned. Nothing inside `#app` — the design — is touched, and
 * removing them can only make the prototype side MORE like a shipped page, so
 * it cannot hide a difference in the port.
 *
 * `#gpeek` and `#toast` go with it for the same reason: both are prototype
 * overlays, both are normally hidden, and a stray one would land in a capture
 * as a floating panel with no live counterpart.
 */
export async function stripPrototypeChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.proto, #gpeek, #toast').forEach((el) => el.remove());
  });
}

export async function settle(page: Page): Promise<void> {
  await page.addStyleTag({ content: STILLNESS_CSS });
  // Both sides must have the two Barlow families before anything is measured,
  // or one capture uses a fallback metric and every line of text differs.
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
  // One frame for the style tag to take effect, and for any layout the fonts
  // just changed. `waitForTimeout` is the honest tool here: there is no event
  // for "the compositor has caught up".
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Apply a screen's masks by painting them flat, on both sides identically. */
export async function applyMasks(page: Page, masks: ScreenMask[]): Promise<number> {
  if (!masks.length) return 0;
  return page.evaluate((sels: string[]) => {
    let area = 0;
    for (const sel of sels) {
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        area += r.width * r.height;
        el.style.setProperty('background', '#FF00FF', 'important');
        el.style.setProperty('color', '#FF00FF', 'important');
      });
    }
    return area;
  }, masks.map((m) => m.selector));
}

/* ──────────────────────────── structure gate ───────────────────────────── */

export interface StructureItem {
  tag: string;
  text: string;
}

/**
 * THE SECOND GATE: the ordered sequence of visible landmarks.
 *
 * A pixel diff says two screens differ. It does not say "the Quotes list has
 * no Status column header" in words. This produces a list a human can read, in
 * document order, of the things a screen is made of — so the report can name
 * what is missing, extra or out of order rather than only scoring it.
 *
 * Landmarks are headings, buttons, links, labels, table headers, nav items,
 * pills and status chips: the elements whose presence and order IS the screen's
 * structure. Body prose is excluded — it would swamp the comparison with
 * sentences that legitimately differ between sample and real data.
 */
export const LANDMARK_SELECTOR = [
  'h1', 'h2', 'h3', 'h4',
  'th',
  'nav a',
  'button',
  'a.btn', 'a.chip', 'a.crumb', 'a.stretch',
  // v7's clickable WIDGETS, named by class rather than by element.
  //
  // v7 is a single page that re-renders itself, so every one of these is a
  // `<button>` driving its own event delegate. The port is a routed app, so the
  // same widget is often an `<a>` — a day tab, a customer in the list, a
  // settings section. Matching on `button` alone counted v7's and not the
  // port's, and the structure gate reported five "missing" day tabs on a screen
  // the pixel diff put at 0.20%. Measuring the widget on BOTH sides is the
  // honest fix; dropping it from the selector would have been the dishonest one.
  '.nqb', '.dtab', '.tab', '.ci', '.si', '.opt', '.linkcell',
  '.pill', '.tag', '.step', '.lc', '.chip',
  'label', 'option[selected]',
  '.lh > span', '.rh > span',
].join(',');

export async function readStructure(page: Page): Promise<StructureItem[]> {
  return page.evaluate((sel: string) => {
    const out: { tag: string; text: string }[] = [];
    const seen = new Set<Element>();
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      // `[hidden]` ancestors (v7's #hsd, #mm) take their children with them.
      if (el.closest('[hidden]')) return;
      // SCREEN-READER-ONLY TEXT IS NOT A LANDMARK. Tailwind's `.sr-only` keeps
      // an element 1px and clipped rather than `display:none`, so a visibility
      // test alone lets it through — and the live header's `<label class="sr-only">`
      // was reported as an element v7 lacks, when v7 simply uses `aria-label`
      // on the same input. Both spellings are correct and neither renders a
      // pixel, so neither belongs in a comparison of what is ON the screen.
      if (style.clip === 'rect(0px, 0px, 0px, 0px)' || style.clipPath === 'inset(50%)') return;
      if (r.width <= 1 && r.height <= 1) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      out.push({ tag: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''), text });
    });
    return out;
  }, LANDMARK_SELECTOR);
}

export interface StructureDiff {
  missing: string[];
  extra: string[];
  reordered: number;
}

/**
 * Compare two landmark sequences. Reports what the live side LACKS, what it has
 * EXTRA, and how many items are in a different relative order.
 *
 * Multiset-aware: v7 renders "Start quote" on three cards, and a live side with
 * two of them must report one missing rather than none.
 */
export function diffStructure(proto: StructureItem[], live: StructureItem[]): StructureDiff {
  const key = (i: StructureItem) => i.text;
  const countOf = (items: StructureItem[]) => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(key(i), (m.get(key(i)) ?? 0) + 1));
    return m;
  };
  const pc = countOf(proto);
  const lc = countOf(live);
  const missing: string[] = [];
  const extra: string[] = [];
  pc.forEach((n, k) => {
    const have = lc.get(k) ?? 0;
    if (have < n) missing.push(n - have > 1 ? `${k} (×${n - have})` : k);
  });
  lc.forEach((n, k) => {
    const want = pc.get(k) ?? 0;
    if (n > want) extra.push(n - want > 1 ? `${k} (×${n - want})` : k);
  });

  // Order, over the items both sides have: longest common subsequence of the
  // shared keys. Anything outside it moved.
  const shared = new Set([...pc.keys()].filter((k) => lc.has(k)));
  const a = proto.map(key).filter((k) => shared.has(k));
  const b = live.map(key).filter((k) => shared.has(k));
  const lcs = lcsLength(a, b);
  return { missing, extra, reordered: Math.max(a.length, b.length) - lcs };
}

function lcsLength(a: string[], b: string[]): number {
  // Rolling two-row table; these sequences are hundreds of items, not thousands.
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ──────────────────────────────── diffing ──────────────────────────────── */

export interface DiffResult {
  diffPixels: number;
  totalPixels: number;
  ratio: number;
  protoSize: { w: number; h: number };
  liveSize: { w: number; h: number };
}

/** Composite `src` onto a `w x h` canvas over the sentinel, top-left aligned. */
function onCanvas(src: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) << 2;
      if (x < src.width && y < src.height) {
        const i = (y * src.width + x) << 2;
        out.data[o] = src.data[i];
        out.data[o + 1] = src.data[i + 1];
        out.data[o + 2] = src.data[i + 2];
        out.data[o + 3] = 255;
      } else {
        // Sentinel magenta: nothing in either design is this colour, so a
        // size mismatch is unmistakable in the diff image as well as the count.
        out.data[o] = 0xff;
        out.data[o + 1] = 0x00;
        out.data[o + 2] = 0xff;
        out.data[o + 3] = 255;
      }
    }
  }
  return out;
}

export function diffImages(protoBuf: Buffer, liveBuf: Buffer, diffPath: string): DiffResult {
  const a = PNG.sync.read(protoBuf);
  const b = PNG.sync.read(liveBuf);
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const A = onCanvas(a, w, h);
  const B = onCanvas(b, w, h);
  const out = new PNG({ width: w, height: h });
  const diffPixels = pixelmatch(A.data, B.data, out.data, w, h, {
    threshold: 0.1,
    includeAA: false,
    alpha: 0.25,
    diffColor: [255, 0, 0],
  });
  fs.mkdirSync(path.dirname(diffPath), { recursive: true });
  fs.writeFileSync(diffPath, PNG.sync.write(out));
  const totalPixels = w * h;
  return {
    diffPixels,
    totalPixels,
    ratio: diffPixels / totalPixels,
    protoSize: { w: a.width, h: a.height },
    liveSize: { w: b.width, h: b.height },
  };
}

/**
 * The side-by-side a human looks at: prototype left, live right, a 16px gutter,
 * both at full height. The brief requires opening this for every screen, and a
 * composite is the only form where "the sections are in a different order" is
 * visible at a glance — a red diff mask alone just says "a lot is different".
 */
export function writeSideBySide(protoBuf: Buffer, liveBuf: Buffer, outPath: string): void {
  const a = PNG.sync.read(protoBuf);
  const b = PNG.sync.read(liveBuf);
  const gutter = 16;
  const w = a.width + gutter + b.width;
  const h = Math.max(a.height, b.height);
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) << 2;
      // The SAME sentinel magenta the diff canvas uses. It was a dark grey
      // first, and in the very first side-by-side that read as the app's own
      // gunmetal ground showing below a short page — a defect that was not
      // there. Nothing in either design is this colour, so "neither side has
      // content here" cannot be mistaken for anything else.
      let r = 0xff;
      let g = 0x00;
      let bl = 0xff;
      if (x < a.width && y < a.height) {
        const i = (y * a.width + x) << 2;
        r = a.data[i];
        g = a.data[i + 1];
        bl = a.data[i + 2];
      } else if (x >= a.width + gutter) {
        const bx = x - a.width - gutter;
        if (bx < b.width && y < b.height) {
          const i = (y * b.width + bx) << 2;
          r = b.data[i];
          g = b.data[i + 1];
          bl = b.data[i + 2];
        }
      }
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = bl;
      out.data[o + 3] = 255;
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, PNG.sync.write(out));
}

export function writeBaseline(id: string, buf: Buffer): string {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const p = path.join(BASELINE_DIR, `${id}.png`);
  fs.writeFileSync(p, buf);
  return p;
}

export function outPath(id: string, name: string): string {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  return path.join(OUT_DIR, `${id}-${name}.png`);
}
