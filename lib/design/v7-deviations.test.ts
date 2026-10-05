import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { V7_COLOR_DEVIATIONS, isAllowedColorDeviation } from '../../tests/visual/v7-color-deviations';

/**
 * Every colour deviation from prototype v7 must be NECESSARY and SUFFICIENT,
 * and the three places that record it must agree.
 *
 * This matters because a deviation is the one loophole in "v7 wins every
 * conflict about appearance". Left unchecked it becomes the place where any
 * inconvenient colour goes to be excused. So the numbers are computed here from
 * the real CSS rather than trusted from a comment:
 *
 *   NECESSARY  — v7's own value really does fail the threshold it is used at.
 *                If it ever passes, the deviation must be removed and v7's
 *                value restored.
 *   SUFFICIENT — the replacement really does pass.
 *   IN HUE     — the replacement is the same colour family, not a new one.
 *   AGREED     — the doc, the CSS and the gate's allow-list say the same thing.
 */

const ROOT = path.join(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs', 'design', 'V7_COLOR_DEVIATIONS.md');
const DEV_CSS = path.join(ROOT, 'docs', 'design', 'command-center-v7', 'v7-deviations.css');
const GENERATED = path.join(ROOT, 'app', 'styles', 'command-center-v7.generated.css');

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function channels(hex: string): [number, number, number] {
  const [r, g, b] = hex.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16));
  return [r, g, b];
}

describe('v7 colour deviations', () => {
  it('has at least one and they are all documented in the markdown', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    expect(V7_COLOR_DEVIATIONS.length).toBeGreaterThan(0);
    for (const d of V7_COLOR_DEVIATIONS) {
      expect(doc, `${d.v7} is not documented in V7_COLOR_DEVIATIONS.md`).toContain(d.v7);
      expect(doc, `${d.live} is not documented in V7_COLOR_DEVIATIONS.md`).toContain(d.live);
    }
  });

  it('each deviation is NECESSARY — v7 really fails its threshold', () => {
    for (const d of V7_COLOR_DEVIATIONS) {
      const actual = contrast(d.v7, d.measured.against);
      expect(
        Number(actual.toFixed(2)),
        `The ratio recorded for ${d.v7} against ${d.measured.against} is wrong.`,
      ).toBe(d.measured.ratio);
      expect(
        actual,
        `${d.v7} measures ${actual.toFixed(2)}:1, which PASSES ${d.measured.required}:1. ` +
          "The deviation is no longer necessary — restore v7's own colour.",
      ).toBeLessThan(d.measured.required);
    }
  });

  it('each deviation is SUFFICIENT — the replacement passes', () => {
    for (const d of V7_COLOR_DEVIATIONS) {
      const actual = contrast(d.live, d.measured.against);
      expect(
        actual,
        `${d.live} measures ${actual.toFixed(2)}:1 against ${d.measured.against} and still ` +
          `fails ${d.measured.required}:1. Pick a nearer passing shade.`,
      ).toBeGreaterThanOrEqual(d.measured.required);
    }
  });

  it('each replacement stays in the same hue family', () => {
    for (const d of V7_COLOR_DEVIATIONS) {
      const [r1, g1, b1] = channels(d.v7);
      const [r2, g2, b2] = channels(d.live);
      // Compare channel RATIOS, which is what hue is, rather than absolute
      // distance — a darker shade of the same hue holds its ratios.
      const before = [g1 / r1, b1 / r1];
      const after = [g2 / r2, b2 / r2];
      for (const [i, name] of ['green:red', 'blue:red'].entries()) {
        const drift = Math.abs(after[i] - before[i]) / before[i];
        expect(
          drift,
          `${d.live} shifts the ${name} channel ratio by ${(drift * 100).toFixed(1)}% from ` +
            `${d.v7}. That is a different colour, not the nearest passing shade.`,
        ).toBeLessThan(0.05);
      }
    }
  });

  it("is applied in the deviations CSS and reaches the app's generated sheet", () => {
    const devCss = fs.readFileSync(DEV_CSS, 'utf8');
    const generated = fs.readFileSync(GENERATED, 'utf8');
    for (const d of V7_COLOR_DEVIATIONS) {
      expect(devCss, `${d.live} is documented but never applied in v7-deviations.css`).toContain(
        d.live,
      );
      expect(generated, `${d.live} never reaches the generated stylesheet`).toContain(d.live);
    }
  });

  it('leaves v7.css itself untouched — it is a verbatim artefact', () => {
    const verbatim = fs.readFileSync(
      path.join(ROOT, 'docs', 'design', 'command-center-v7', 'v7.css'),
      'utf8',
    );
    for (const d of V7_COLOR_DEVIATIONS) {
      expect(
        verbatim,
        `${d.live} appears in v7.css. Deviations belong in v7-deviations.css; editing the ` +
          'verbatim extract would make the style gate agree with itself and hide the drift.',
      ).not.toContain(d.live);
      expect(verbatim, `v7.css should still carry the prototype's own ${d.v7}`).toContain(d.v7);
    }
  });
});

describe('the style gate only forgives documented pairs', () => {
  it('accepts a documented substitution', () => {
    expect(isAllowedColorDeviation('rgb(30, 142, 82)', 'rgb(29, 135, 78)')).toBe(true);
    expect(isAllowedColorDeviation('#1E8E52', '#1d874e')).toBe(true);
  });

  it('rejects an undocumented difference', () => {
    expect(isAllowedColorDeviation('rgb(200, 16, 46)', 'rgb(0, 0, 0)')).toBe(false);
  });

  it('rejects the substitution in reverse', () => {
    // The prototype showing the FIXED colour and the app showing the failing
    // one is a real defect, not a deviation.
    expect(isAllowedColorDeviation('rgb(29, 135, 78)', 'rgb(30, 142, 82)')).toBe(false);
  });

  it('accepts an exact match trivially', () => {
    expect(isAllowedColorDeviation('rgb(1,2,3)', 'rgb(1,2,3)')).toBe(false);
    // (Equality is handled before the deviation check in the gate; this records
    // that the helper itself is about DIFFERENCES only.)
  });
});
