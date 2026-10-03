/**
 * THE ORDER VALIDATOR'S OWN COLOURS, MEASURED — AND THE ONE CASE THE BUILD GATE
 * CANNOT SEE.
 *
 * `scripts/audit/contrast-check.mjs` is a real build gate (CLAUDE.md rule #28),
 * but its screen list comes from `lib/data/admin-nav.ts` plus the pages beneath
 * those routes, and the two surfaces this feature renders on are in neither:
 * `/quote` is the public Quote Builder, and `/admin/quote-requests/[id]` is the
 * pre-V2 admin quote review, which is deliberately absent from the one-level
 * Command Center navigation. So these pairs are nobody's gate, and this file is
 * the gate for them.
 *
 * FOUR REAL FAILURES WERE FOUND BY MEASURING RATHER THAN BY READING THE TOKEN
 * NAMES, and all four are the same mistake CLAUDE.md rule #29 describes, applied
 * to a BOUNDARY rather than to text:
 *
 *   - the step-2 input's error border, `afs-crimson` on `afs-bg-overlay`: 1.15:1
 *   - the same border in `afs-warning`:                                   2.47:1
 *   - the admin severity chip's outline, `afs-crimson` on `afs-bg-raised`: 1.71:1
 *   - the same chip in `afs-info`:                                        2.34:1
 *
 * SPEC_AI_ORDER_VALIDATOR.md section 2 asks for a "red border on input". The step-2
 * inputs are `bg-afs-bg-overlay` on a panel that is ALSO `bg-afs-bg-overlay`, so
 * that border is the only thing separating the two — at 1.15:1 there would have
 * been no visible border at all, which is the one thing it exists to be.
 *
 * AND ONE FAILURE THE TOKEN NAME ACTIVELY HID: `afs-chrome-silver` is the
 * correct dim text on gunmetal (rule #18) and measures 4.13:1 on the amber
 * banner, because a 12% tint over `afs-bg-overlay` resolves to #625E5D and IS A
 * DIFFERENT SURFACE. Rule #23's point, one step further on than rule #23 itself
 * goes.
 *
 * Both premises are asserted — that the fill colours really do fail, and that
 * the replacements really do pass — so a retheme cannot make this file silently
 * vacuous.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
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

/**
 * A CSS custom property's rgba() value from app/globals.css, composited over an
 * opaque background.
 *
 * The ghost tints are the surface the banner text is really on, and nothing in
 * the palette records what they resolve to — the gate's own `/90` compositing
 * exists for the same reason (rule #28's sixth load-bearing behaviour).
 */
function ghostOver(variable: string, background: string): string {
  const css = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const match = new RegExp(`--${variable}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([0-9.]+)\\)`).exec(css);
  if (!match) throw new Error(`--${variable} is not an rgba() custom property in app/globals.css`);
  const [, r, g, b, a] = match;
  const alpha = Number(a);
  const channel = (tint: string, index: number): string => {
    const base = parseInt(background.slice(index, index + 2), 16);
    return Math.round(alpha * Number(tint) + (1 - alpha) * base)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(r, 1)}${channel(g, 3)}${channel(b, 5)}`;
}

const BODY_TEXT = 4.5;
const NON_TEXT = 3;

describe('the Quote Builder step-2 field decoration', () => {
  const T = tokens();
  const surface = T['bg-overlay'];

  it('reads the surface the inputs and the panel both use', () => {
    expect(
      surface,
      'Expected afs-bg-overlay to be resolvable from tailwind.config.js. Every assertion below is measured against it, so an unresolved value would make this file assert nothing.'
    ).toBe('#4E5568');
  });

  it('confirms the obvious border colours really do fail, so the fix is not cosmetic', () => {
    for (const token of ['crimson', 'warning']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-overlay and must stay BELOW the ${NON_TEXT}:1 non-text rule for this test to mean anything. If it now passes, the palette changed and fieldBorderClass can be simplified — check before doing so.`
      ).toBeLessThan(NON_TEXT);
    }
  });

  it('clears the non-text rule with the on-dark border colours fieldBorderClass uses', () => {
    for (const token of ['danger-on-dark', 'warning-on-dark']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-overlay, below the ${NON_TEXT}:1 required of a form-field boundary. SPEC section 2 asks for a visible border on an erroring input, and the input's fill is the same colour as the panel behind it, so this border is the only thing separating them.`
      ).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it('clears the body-text rule with the on-dark message colours', () => {
    for (const token of ['danger-on-dark', 'warning-on-dark', 'info-on-dark']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-overlay, below ${BODY_TEXT}:1. This is the message printed under an input, which is where the customer is told what to change.`
      ).toBeGreaterThanOrEqual(BODY_TEXT);
    }
  });
});

describe('the Quote Builder validation banners', () => {
  const T = tokens();
  const crimsonGhost = ghostOver('afs-crimson-ghost', T['bg-overlay']);
  const amberGhost = ghostOver('afs-amber-ghost', T['bg-overlay']);

  it('composites the ghost tints over the panel, because a tint is a different surface', () => {
    expect(
      crimsonGhost,
      `Expected the 12% crimson tint over #4E5568 to resolve to #5c4b5f; got ${crimsonGhost}. Measuring banner text against the UNTINTED panel would be measuring a surface that is not on screen.`
    ).toBe('#5c4b5f');
    expect(amberGhost, `Expected the amber tint to resolve to #625e5d; got ${amberGhost}.`).toBe('#625e5d');
  });

  it('clears the body-text rule for the banner headings and messages', () => {
    for (const [name, surface] of [
      ['the error banner', crimsonGhost],
      ['the warning banner', amberGhost],
    ] as const) {
      const ratio = contrastRatio(T['chrome-high'], surface);
      expect(
        ratio,
        `afs-chrome-high on ${name} measures ${ratio.toFixed(2)}:1, below ${BODY_TEXT}:1.`
      ).toBeGreaterThanOrEqual(BODY_TEXT);
    }
  });

  it('confirms chrome-silver fails on the amber banner, which is why the AI note is white', () => {
    const ratio = contrastRatio(T['chrome-silver'], amberGhost);
    expect(
      ratio,
      `afs-chrome-silver measures ${ratio.toFixed(2)}:1 on the composited amber banner and must stay BELOW ${BODY_TEXT}:1 for this assertion to mean anything. It is the CORRECT dim text on plain gunmetal (4.80:1, rule #18) and the wrong choice here — rule #23's "the surface decides the token", where the surface is a 12% tint of the one the token was chosen for.`
    ).toBeLessThan(BODY_TEXT);
  });
});

describe('the admin fabrication-check panel', () => {
  const T = tokens();
  const surface = T['bg-raised'];

  it('confirms the crimson and info fills fail even the non-text rule as a chip outline', () => {
    // Deliberately only these two. afs-warning measures 3.67:1 here and does
    // CLEAR the 3:1 boundary rule — claiming otherwise would be a premise this
    // file asserts and the palette contradicts. It is still not used, for the
    // reason the next test gives: the chip's colour is its outline AND its
    // label, so the 4.5:1 text rule is the binding one, and afs-warning misses
    // that.
    for (const token of ['crimson', 'info']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-raised and must stay BELOW the ${NON_TEXT}:1 non-text rule for this assertion to mean anything. A chip with a 1.7:1 outline has no visible outline, which defeats having a chip.`
      ).toBeLessThan(NON_TEXT);
    }
  });

  it('clears both rules with the on-dark chip colours, which are border and text alike', () => {
    for (const token of ['danger-on-dark', 'warning-on-dark', 'info-on-dark']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-raised, below ${BODY_TEXT}:1. The chip uses one colour for its outline and its label, so the stricter of the two rules applies.`
      ).toBeGreaterThanOrEqual(BODY_TEXT);
    }
  });

  it('clears the body-text rule for the panel body, metadata and assumption disclosure', () => {
    for (const token of ['chrome-high', 'chrome-mid', 'chrome-silver', 'success-on-dark']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-raised, below ${BODY_TEXT}:1.`
      ).toBeGreaterThanOrEqual(BODY_TEXT);
    }
  });

  it('never uses a status fill colour as panel text, because all four miss the text rule', () => {
    for (const token of ['crimson', 'success', 'warning', 'info']) {
      const ratio = contrastRatio(T[token], surface);
      expect(
        ratio,
        `afs-${token} measures ${ratio.toFixed(2)}:1 on afs-bg-raised and must stay BELOW ${BODY_TEXT}:1. This asserts the PREMISE of CLAUDE.md rule #29 — these are FILL colours and none of them is close to AA as text — so the panel's use of the *-on-dark family cannot later be "simplified" back to them. It is also why the chip's outline uses the on-dark colour even for warning, which clears the 3:1 boundary rule: one colour serves as both the outline and the label, so the stricter rule governs.`
      ).toBeLessThan(BODY_TEXT);
    }
  });
});
