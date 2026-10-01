import { test, expect, type Page } from '@playwright/test';
import { LIGHT_WORKING_AREA_SCREENS } from '@/lib/data/admin-working-area';

/**
 * THE LIVE HALF OF THE CONTRAST GATE.
 *
 * `scripts/audit/contrast-check.mjs` measures every Command Center screen from
 * the source and the Tailwind config, and it is the one that fails the build —
 * it needs nothing but the repository, so it can run where no server exists.
 * The obvious objection to a static measurement is that it is a model of what
 * the browser does, not the browser.
 *
 * This spec is the answer to that objection. It opens the real screens on the
 * real deployment, as a real admin, walks every visible text node, reads the
 * colours Chromium ACTUALLY COMPUTED (`getComputedStyle`, with the background
 * resolved up the ancestor chain the way the renderer resolves it), and applies
 * the same WCAG 2.1 formula. If the two ever disagree, one of them is wrong and
 * this is how that gets found — rather than the static gate quietly drifting
 * into fiction.
 *
 * It runs against whatever PLAYWRIGHT_BASE_URL points at, skips without
 * credentials like every other admin spec, and creates no rows.
 */

// Signed in as the E2E admin, the same way every other admin spec in this suite
// does it. Without this the Command Center routes redirect to /login and the
// spec measures the SIGN-IN PAGE while reporting it as a Command Center result —
// which is exactly what happened on its first run against alpha, and is worse
// than no check at all. The skip below detects the redirect, so a credential-less
// run says so rather than passing on the wrong page.
test.use({ storageState: 'tests/e2e/.auth/user.json' });

const ADMIN_SCREENS = [
  '/admin/command-center',
  '/admin/shop-view',
  '/admin/deliveries',
  '/admin/search',
  '/admin/settings',
  '/admin/customers',
];

interface LivePair {
  ratio: number;
  color: string;
  background: string;
  text: string;
  tag: string;
  large: boolean;
}

/**
 * Runs IN THE PAGE. Walks every element that has its own visible text, resolves
 * the painted background by climbing ancestors until one is not transparent
 * (which is what the compositor does), and returns the measured pairs.
 */
async function measure(page: Page): Promise<LivePair[]> {
  return page.evaluate(() => {
    const toRgb = (value: string): [number, number, number, number] | null => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((p) => Number(p.trim()));
      if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    };
    const lum = ([r, g, b]: number[]) =>
      [r, g, b]
        .map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        })
        .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const over = (fg: [number, number, number, number], bg: number[]) =>
      [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));

    const paintedBackground = (el: Element): number[] => {
      let node: Element | null = el;
      const layers: [number, number, number, number][] = [];
      while (node) {
        const bg = toRgb(getComputedStyle(node).backgroundColor);
        if (bg && bg[3] > 0) {
          layers.push(bg);
          if (bg[3] === 1) break;
        }
        node = node.parentElement;
      }
      let result = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i], result);
      return result;
    };

    const out: LivePair[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? '').trim())
        .join(' ')
        .trim();
      if (!ownText) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fg = toRgb(style.color);
      if (!fg) continue;
      const bg = paintedBackground(el);
      const color = over(fg, bg);
      const px = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = px >= 24 || (weight >= 700 && px >= 18.66);

      out.push({
        ratio: ratio(color, bg),
        color: `rgb(${color.map(Math.round).join(',')})`,
        background: `rgb(${bg.map(Math.round).join(',')})`,
        text: ownText.slice(0, 60),
        tag: el.tagName.toLowerCase(),
        large,
      });
    }
    return out;
  });
}

test.describe('Command Center contrast, measured in the browser', () => {
  test('every visible text node on every Command Center screen clears WCAG AA', async ({ page }) => {
    test.setTimeout(180_000);
    const failures: string[] = [];
    const summary: string[] = [];

    for (const route of ADMIN_SCREENS) {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      // Not signed in as an admin on this run — the suite's own auth.setup.ts
      // skips without credentials, so say so rather than measuring /login and
      // reporting it as a Command Center result.
      if (/\/(login|register|auth)\b/.test(page.url()) || response?.status() === 404) {
        test.skip(true, `Not signed in as an admin; ${route} redirected to ${page.url()}`);
      }

      const pairs = await measure(page);
      expect(pairs.length, `${route} rendered no measurable text`).toBeGreaterThan(5);

      const bad = pairs.filter((p) => p.ratio < (p.large ? 3 : 4.5));
      const worst = Math.min(...pairs.map((p) => p.ratio));
      summary.push(`${bad.length ? 'FAIL' : 'PASS'}  ${route}  ${pairs.length} text nodes · worst ${worst.toFixed(2)}:1`);
      for (const b of bad) {
        failures.push(
          `${route}  ${b.ratio.toFixed(2)}:1 (needs ${b.large ? 3 : 4.5}:1)  ${b.color} on ${b.background}  <${b.tag}> "${b.text}"`
        );
      }
    }

    console.log(['', 'LIVE CONTRAST — measured with getComputedStyle', ...summary, ...failures].join('\n'));
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('the light working area really is light where lib/data says it is', async ({ page }) => {
    // Guards the static gate's single biggest assumption: that
    // LIGHT_WORKING_AREA_CLASS reaches the page inside it. If a wrapper ever
    // stops painting, the static gate would keep measuring against gunmetal and
    // keep passing, and only this would notice.
    const routes = LIGHT_WORKING_AREA_SCREENS.map((s) => s.route).filter((r) => !r.includes('['));
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      if (/\/(login|register|auth)\b/.test(page.url())) test.skip(true, 'Not signed in as an admin.');
      const bg = await page.evaluate(() => {
        const main = document.querySelector('main');
        const panel = main?.firstElementChild;
        return panel ? getComputedStyle(panel).backgroundColor : null;
      });
      expect(bg, `${route} working area background`).toBe('rgb(241, 242, 244)'); // afs-bg-band #F1F2F4
    }
  });
});
