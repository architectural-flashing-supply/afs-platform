#!/usr/bin/env node
/**
 * THE V8 STYLESHEET IS DERIVED FROM THE FROZEN CONTRACT, NEVER RETYPED.
 *
 * Reads the `<style>` blocks out of the three approved mockups in
 * `docs/design/command-center-v8/` — whose bytes are hash-verified on every
 * build by `scripts/audit/contract-check.mjs` — scopes every selector under
 * `.cc-v8`, and writes `app/styles/command-center-v8.generated.css`.
 *
 * SAME DISCIPLINE AS v7 (CLAUDE.md rule #33), AND THE SAME TRANSFORM. It
 * imports `transform()` from `scope-v7-css.mjs` rather than carrying its own
 * copy: a second 150-line CSS parser is a second place for the look to drift,
 * which is the exact failure that rule exists to prevent. The v7 script's
 * `scope` and `ground` default to v7's own values, so parameterising it left
 * the v7 output byte-identical — verified.
 *
 * EDITING THE GENERATED FILE IS HOW THE LOOK DRIFTS. Change the contract (which
 * needs Reid — rule #36) or the deviations file, and regenerate.
 *
 * THE THREE FILES SHARE MOST OF THEIR CSS, and that is handled rather than
 * assumed: blocks are concatenated in contract order and DE-DUPLICATED by exact
 * text, so a rule defined identically in all three appears once. A rule that
 * differs between them is NOT merged — both land, in order, and the later one
 * wins, which is ordinary cascade and is what the mockups themselves do when
 * you open them one after another.
 *
 * WHY NO PER-SCREEN SPLIT. All three mockups are one design; Workbench B's
 * table and Shop View E's queue share `.btn`, `.pill`, `.thumb`, `.muted` and
 * the whole colour palette. Splitting them per screen would duplicate those
 * and let one screen's button drift from another's.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { transform } from './scope-v7-css.mjs';

const ROOT = path.resolve(
  path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..'),
);
const SRC_DIR = path.join(ROOT, 'docs', 'design', 'command-center-v8');
const MANIFEST = path.join(SRC_DIR, 'CONTRACT_MANIFEST.json');
const DEVIATIONS = path.join(SRC_DIR, 'v8-deviations.css');
const OUT = path.join(ROOT, 'app', 'styles', 'command-center-v8.generated.css');

export const SCOPE = '.cc-v8';
export const GROUND = '.cc-v8-ground';

/** Every `<style>` block in one HTML file, in source order. */
function styleBlocks(html) {
  const out = [];
  const re = /<style>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

export function buildScopedV8Css() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  const seen = new Set();
  const parts = [];
  for (const entry of manifest.files) {
    const abs = path.join(ROOT, entry.path);
    const blocks = styleBlocks(fs.readFileSync(abs, 'utf8'));
    blocks.forEach((css, i) => {
      const key = css.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      parts.push(
        `/* ===== ${path.basename(entry.path)} · <style> block ${i + 1} · ${entry.screen} ===== */\n${css}`,
      );
    });
  }

  // Deviations, if any, last — so a WCAG fix wins over the contract's own
  // value. None exist yet; the file is optional on purpose (rule #33's
  // deviations discipline: a colour may be changed ONLY where it fails the
  // contrast gate, and each one must be recorded).
  const deviations = fs.existsSync(DEVIATIONS) ? fs.readFileSync(DEVIATIONS, 'utf8') : '';

  const banner = `/*
 * command-center-v8.generated.css — GENERATED. DO NOT EDIT.
 *
 * Produced by scripts/design/scope-v8-css.mjs from the <style> blocks of the
 * FROZEN V8 contract files listed in
 * docs/design/command-center-v8/CONTRACT_MANIFEST.json, whose bytes are
 * hash-verified on every build.
 *
 * Every selector is scoped to \`${SCOPE}\`, which only a V8 screen sets, so none
 * of this can reach the public marketing site or a v7 screen. To change a
 * Command Center V8 style, change the contract (Reid's call — CLAUDE.md rule
 * #36) or docs/design/command-center-v8/v8-deviations.css, and run
 * \`pnpm css:v8\`. Editing this file is overwritten and fails
 * lib/design/v8-css.test.ts.
 */
`;

  return `${banner}${transform(parts.join('\n'), SCOPE, GROUND)}${
    deviations ? `\n/* ===== v8-deviations.css ===== */\n${transform(deviations, SCOPE, GROUND)}` : ''
  }\n`;
}

const isDirect = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isDirect) {
  const css = buildScopedV8Css();
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, css, 'utf8');
  process.stdout.write(
    `${prev === css ? 'unchanged' : 'wrote'} ${path.relative(ROOT, OUT)} — ${css.split('\n').length} lines, scope ${SCOPE}\n`,
  );
}
