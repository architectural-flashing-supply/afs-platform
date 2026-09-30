import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PLACEHOLDER TEXT MEETS WCAG AA ON ITS OWN BACKGROUND — Command Center V2.
 *
 * The v2-02 design rule is "every text/background pair meets WCAG AA, 4.5:1 for
 * body text — placeholder text included". Placeholders are exactly where that
 * slips, because a placeholder is *supposed* to look dimmer and it is easy to
 * reach for the dimmest token on the scale and stop there.
 *
 * `afs-chrome-dim` (#7A8299) is that trap. Measured against every gunmetal
 * surface in the palette it fails, worst of all on `afs-bg-overlay` where the
 * Command Center's reject/request-changes modal put it: **1.94:1**. It is not a
 * marginal miss. `afs-chrome-silver` (#C8D0E0) clears AA on all five surfaces
 * (4.80:1 at worst) and is still visibly dimmer than the white typed text at
 * 7.44:1, so it still reads as a placeholder.
 *
 * This test guards the Command Center only. The same swap is wanted in 22 other
 * files across the public site and is recorded in STATE_OF_THE_BUILD.md's v2-02
 * entry rather than made here — widening a v2-02 prompt into a site-wide
 * restyle is not this prompt's call. If that sweep happens, widen SCOPE below.
 */

/** WCAG 2.1 relative luminance and contrast ratio, from the spec's formulas. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Token values read out of tailwind.config.js, so a retheme cannot desync them. */
function tokens(): Record<string, string> {
  const config = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.js'), 'utf8');
  const found: Record<string, string> = {};
  for (const m of config.matchAll(/'([a-z0-9-]+)':\s*'(#[0-9A-Fa-f]{6})'/g)) {
    found[m[1]] = m[2];
  }
  return found;
}

/** Files this test holds to the rule today. */
const SCOPE = ['components/admin/CommandCenterJobCard.tsx'];

const GUNMETAL_SURFACES = ['bg-dim', 'bg-base', 'bg-raised', 'bg-surface', 'bg-overlay'];

describe('placeholder text meets WCAG AA', () => {
  const t = tokens();

  it('afs-chrome-dim is unusable as placeholder text on every gunmetal surface', () => {
    // The premise of the whole test. If a retheme ever makes chrome-dim pass,
    // this fails and the rule below can be relaxed deliberately rather than by
    // someone noticing the colours look fine.
    for (const surface of GUNMETAL_SURFACES) {
      expect(contrastRatio(t['chrome-dim'], t[surface]), `chrome-dim on ${surface}`).toBeLessThan(4.5);
    }
  });

  it('afs-chrome-silver clears AA on every gunmetal surface', () => {
    for (const surface of GUNMETAL_SURFACES) {
      expect(
        contrastRatio(t['chrome-silver'], t[surface]),
        `chrome-silver on ${surface}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is still dimmer than the typed text, so it still reads as a placeholder', () => {
    expect(contrastRatio(t['chrome-silver'], t['bg-overlay'])).toBeLessThan(
      contrastRatio(t['chrome-high'], t['bg-overlay'])
    );
  });

  it.each(SCOPE)('%s uses no failing placeholder token', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    // Match the class in real markup only — the explanatory comment above the
    // textarea names chrome-dim on purpose and must not trip this.
    const offenders = source
      .split(/\r?\n/)
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /placeholder:text-afs-chrome-(dim|base|mid)\b/.test(line));
    expect(offenders, `failing placeholder token in ${file}`).toEqual([]);
  });
});
