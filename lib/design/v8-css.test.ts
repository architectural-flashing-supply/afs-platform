import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — a .mjs build script with no type declarations, imported here on
// purpose: the test must run the REAL generator, not a copy of its logic.
import { buildScopedV8Css, SCOPE } from '../../scripts/design/scope-v8-css.mjs';

/**
 * THE V8 STYLESHEET IS DERIVED, AND THIS IS WHAT KEEPS IT THAT WAY.
 *
 * Same contract as `v7-css.test.ts` (CLAUDE.md rule #33): regenerate from the
 * frozen contract and compare against the committed file, so a STALE output
 * fails the suite instead of shipping, and a HAND-EDITED one fails too.
 *
 * It also re-verifies the contract hashes itself. The build gate does that, but
 * a test run does not imply a build ran, and a stylesheet derived from an
 * edited mockup would be a design nobody approved — generated, scoped and
 * perfectly consistent with the wrong source.
 */

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'app', 'styles', 'command-center-v8.generated.css');
const CONTRACT_DIR = path.join(ROOT, 'docs', 'design', 'command-center-v8');

describe('the generated Command Center V8 stylesheet', () => {
  it('is exactly what the transform produces right now', () => {
    expect(
      buildScopedV8Css(),
      'app/styles/command-center-v8.generated.css is stale or was edited by hand. Run `pnpm css:v8`.',
    ).toBe(fs.readFileSync(OUT, 'utf8'));
  });

  it('comes from contract files whose hashes still verify', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(CONTRACT_DIR, 'CONTRACT_MANIFEST.json'), 'utf8'),
    ) as { files: { path: string; sha256: string }[] };
    expect(manifest.files.length).toBeGreaterThan(0);
    for (const f of manifest.files) {
      const actual = createHash('sha256')
        .update(fs.readFileSync(path.join(ROOT, f.path)))
        .digest('hex');
      expect(actual, `${f.path} has changed — the V8 contract is frozen (rule #36)`).toBe(f.sha256);
    }
  });

  it('scopes every rule, so none of it can reach the public site or a v7 screen', () => {
    const css = fs.readFileSync(OUT, 'utf8');
    // Strip comments, then every selector prelude must carry the scope.
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const preludes = [...body.matchAll(/(^|\})([^{}@]+)\{/g)].map((m) => m[2].trim()).filter(Boolean);
    expect(preludes.length).toBeGreaterThan(20);
    const unscoped = preludes.filter((p) => !p.includes(SCOPE) && !p.startsWith('from') && !p.startsWith('to') && !/^\d/.test(p));
    expect(unscoped, `these selectors escaped the ${SCOPE} scope`).toEqual([]);
  });

  it('carries the contract\'s own palette rather than a retyped one', () => {
    // A spot check against values read straight out of the mockups. If someone
    // "tidies" the generator into retyping the CSS, these stop matching the
    // frozen file and this fails — which is the point.
    const css = fs.readFileSync(OUT, 'utf8');
    const html = fs.readFileSync(
      path.join(CONTRACT_DIR, 'Workbench_B-stage-strip-table.html'),
      'utf8',
    );
    for (const token of ['--canvas:', '--nav:', '--ink:']) {
      const inHtml = html.match(new RegExp(`${token}\\s*(#[0-9A-Fa-f]{3,8})`));
      expect(inHtml, `${token} is not in the contract any more`).not.toBeNull();
      expect(css, `${token} in the generated CSS does not match the contract`).toContain(
        `${token}${inHtml![1]}`.replace(':', ':'),
      );
    }
  });
});
