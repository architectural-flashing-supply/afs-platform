import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error — a .mjs build script with no type declarations, imported
// here on purpose: the test must exercise the REAL transform, not a copy of it.
import { buildScopedCss, SCOPE, UNSCOPED_IDS } from '../../scripts/design/scope-v7-css.mjs';

/**
 * The Command Center's stylesheet is GENERATED from the committed prototype
 * (scripts/design/scope-v7-css.mjs). These tests guard the three ways that can
 * go wrong without anyone noticing:
 *
 *   1. The committed output goes STALE — someone edits the prototype or the
 *      deviations and forgets `pnpm css:v7`. The build would then ship the old
 *      styles while the repo appears to describe the new ones.
 *   2. The output LEAKS — a selector escapes the `.cc-v7` scope and restyles
 *      the public marketing site, which has no test of its own for this.
 *   3. The CASCADE INVERTS — v7's light theme comes from its THIRD <style>
 *      block overriding the first block's dark one. Lose that order and the
 *      Command Center silently goes dark, which is the exact defect this whole
 *      rebuild exists to correct.
 */

const ROOT = path.join(__dirname, '..', '..');
const GENERATED = path.join(ROOT, 'app', 'styles', 'command-center-v7.generated.css');
const VERBATIM = path.join(ROOT, 'docs', 'design', 'command-center-v7', 'v7.css');
const PROTOTYPE = path.join(
  ROOT,
  'docs',
  'design',
  'command-center-v7',
  'AFS_Command_Center_Prototype_v7.html',
);

const generated = fs.readFileSync(GENERATED, 'utf8');

describe('the generated Command Center stylesheet', () => {
  it('is exactly what the transform produces right now', () => {
    // Regenerating and comparing is the whole point: a stale committed file
    // fails here instead of shipping quietly.
    expect(
      buildScopedCss(),
      'app/styles/command-center-v7.generated.css is stale. Run `pnpm css:v7`.',
    ).toBe(generated);
  });

  it('is derived from the prototype, not retyped', () => {
    // The verbatim extract must still match the prototype's own <style> blocks.
    const html = fs.readFileSync(PROTOTYPE, 'utf8');
    const blocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    expect(blocks.length, 'v7 should have four <style> blocks').toBe(4);

    const verbatim = fs.readFileSync(VERBATIM, 'utf8');
    for (const [i, block] of blocks.entries()) {
      expect(
        verbatim.includes(block),
        `v7.css no longer contains <style> block ${i + 1} verbatim. It is an extract, ` +
          'not a place to edit — re-extract it from the prototype.',
      ).toBe(true);
    }
  });
});

describe('scoping — nothing may reach the public site', () => {
  /** Every selector prelude in the generated sheet. */
  function selectors(css: string): string[] {
    const out: string[] = [];
    // Strip comments first so prose inside them is never read as a selector.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /(^|[}{])([^{}]*?)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(bare))) {
      const prelude = m[2].trim();
      if (!prelude) continue;
      // An at-rule's prelude is not a selector. Skipping it loses no coverage:
      // the rules INSIDE a conditional group are matched separately, because
      // their own prelude follows the group's `{`.
      if (prelude.startsWith('@')) continue;
      // Keyframe steps are not selectors either.
      if (/^\d+%$/.test(prelude) || prelude === 'from' || prelude === 'to') continue;
      out.push(prelude);
    }
    return out;
  }

  const all = selectors(generated);

  it('finds a substantial number of selectors (the test is not vacuous)', () => {
    expect(all.length).toBeGreaterThan(400);
  });

  it('scopes every selector to .cc-v7, except the two fixed overlays', () => {
    const escaped: string[] = [];
    for (const prelude of all) {
      for (const part of prelude.split(',')) {
        const s = part.trim();
        if (!s) continue;
        if (s.startsWith(SCOPE)) continue;
        if (UNSCOPED_IDS.some((id: string) => s === id || s.startsWith(`${id} `) || s.startsWith(`${id}:`))) {
          continue;
        }
        escaped.push(s);
      }
    }
    expect(
      escaped,
      'These selectors are not scoped to .cc-v7 and would restyle the public marketing site.',
    ).toEqual([]);
  });

  it('styles no bare element selector that could hit the marketing site', () => {
    // v7 styles body/table/th/td/input/button/a. After scoping, each must be a
    // DESCENDANT of .cc-v7 — never the element on its own.
    for (const bare of ['body{', 'html{', 'table{', 'th{', 'td{', 'input{', 'button{', 'a{']) {
      expect(
        generated.includes(`\n${bare}`) || generated.startsWith(bare),
        `The generated sheet contains an unscoped "${bare.slice(0, -1)}" rule.`,
      ).toBe(false);
    }
  });

  it('keeps the two fixed-position overlays unscoped on purpose', () => {
    expect(UNSCOPED_IDS).toEqual(['#gpeek', '#toast']);
  });
});

describe('the cascade — v7 is LIGHT, and that depends on block order', () => {
  it('declares the dark palette first and the light palette after it', () => {
    const dark = generated.indexOf('--bg:#343D49');
    const light = generated.indexOf('--bg:#F4F5F7');
    expect(dark, "v7's dark palette (block 1) is missing").toBeGreaterThan(-1);
    expect(light, "v7's light palette (block 3) is missing").toBeGreaterThan(-1);
    expect(
      light,
      'The light palette must come AFTER the dark one. v7 is a light working area ' +
        'with a dark header; if block 1 wins, the Command Center goes dark — the ' +
        'exact defect this rebuild corrects.',
    ).toBeGreaterThan(dark);
  });

  it('lands on the light ground, the dark header and the one red', () => {
    // Resolve each token the way the cascade does: last declaration wins.
    const resolve = (name: string): string => {
      const re = new RegExp(`--${name}:\\s*([^;}]+)`, 'g');
      const hits = [...generated.matchAll(re)].map((m) => m[1].trim());
      expect(hits.length, `--${name} is never declared`).toBeGreaterThan(0);
      return hits[hits.length - 1];
    };
    expect(resolve('bg'), 'the page ground must be v7 light').toBe('#F4F5F7');
    expect(resolve('ink'), 'body text must be v7 near-black').toBe('#0F1318');
    expect(resolve('hdr'), 'the header must stay v7 charcoal').toBe('#14181E');
    expect(resolve('red'), 'the one action colour must be v7 red').toBe('#C8102E');
    expect(resolve('sink'), 'work surfaces must be white').toBe('#FFFFFF');
  });

  it('keeps the header dark even though the page is light', () => {
    expect(generated).toMatch(/\.cc-v7 \.hdr\{background:#14181E;border-bottom:3px solid var\(--red\)\}/);
  });

  it('binds the two fonts to the self-hosted families, keeping v7 fallbacks', () => {
    expect(generated).toContain('var(--font-barlow-semi-condensed)');
    expect(generated).toContain('var(--font-barlow)');
    // v7's own stacks must survive as the next fallback.
    expect(generated).toContain("'Barlow Semi Condensed'");
    expect(generated).toContain("'Helvetica Neue'");
  });
});
