#!/usr/bin/env node
/**
 * THE V8 CONTRACT CHECK — a build gate, not a review step.
 *
 * Command Center V8 is a PORT of three HTML files Reid approved on 2026-10-08.
 * They live in docs/design/command-center-v8/ and they are FROZEN: the design
 * cannot drift because the thing being ported is a committed file with a known
 * hash, and this script re-derives that hash on every build.
 *
 * It is wired into `prebuild`, beside contrast-check, so `pnpm build` runs it
 * and a Vercel deployment cannot get past it.
 *
 * WHY A HASH AND NOT A REVIEW. V7's own history is the argument. Rule #33
 * records that the look drifted whenever a rule was hand-ported instead of
 * derived, and rule #34 records a 66-pair style gate passing 66 of 66 while the
 * owner's report was "nothing matches". A hash cannot be talked round. Either
 * the file somebody is building against is the file Reid approved, or the build
 * stops and says which file changed and by how much.
 *
 * WHAT IT DOES NOT DO. It does not look at the app. It asserts only that the
 * CONTRACT is intact. Whether the app matches the contract is the pixel gate's
 * job (tests/visual/v8-pixel-gate.spec.ts) and the interaction gate's
 * (tests/visual/v8-interaction-gate.spec.ts). This gate exists so those two
 * have something trustworthy to measure against.
 *
 * TWO FAILURE MODES, BOTH REAL, BOTH REPORTED SEPARATELY:
 *
 *   MISSING  — the manifest names a file that is not on disk. Fails. A gate
 *              that treated an absent contract file as "nothing to check" would
 *              pass loudest exactly when the contract had been deleted.
 *   CHANGED  — the file is there and its hash differs. Fails, printing both
 *              hashes and the byte-size delta, so the reader can tell a
 *              one-character edit from a wholesale replacement.
 *
 * AND ONE MORE, WHICH IS THE POINT OF THE `extra` SCAN: an .html file sitting
 * in the contract folder that the manifest does NOT list is reported as
 * UNGOVERNED. Dropping a fourth mockup in beside the three and porting that
 * instead is the one way to defeat a hash check without ever changing a hash.
 *
 * RE-BASELINING. There is no flag on this script that accepts a new hash. The
 * only writer is scripts/design/rebaseline-v8-contract.mjs, which refuses
 * unless CONTRACT_APPROVED_BY_REID=1 is in the environment. No Claude Code
 * session sets that variable.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..'));
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs', 'design', 'command-center-v8', 'CONTRACT_MANIFEST.json');
const CONTRACT_DIR = path.join(REPO_ROOT, 'docs', 'design', 'command-center-v8');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function fail(lines) {
  for (const line of lines) process.stderr.write(`${line}\n`);
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  fail([
    'V8 CONTRACT CHECK — FAILED',
    `  The manifest is missing: ${path.relative(REPO_ROOT, MANIFEST_PATH)}`,
    '  The V8 contract is frozen by that file. Without it there is no contract.',
  ]);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (err) {
  fail([
    'V8 CONTRACT CHECK — FAILED',
    `  The manifest is not valid JSON: ${err.message}`,
  ]);
}

const files = Array.isArray(manifest.files) ? manifest.files : [];
if (files.length === 0) {
  fail([
    'V8 CONTRACT CHECK — FAILED',
    '  The manifest lists no files. An empty contract would pass every check',
    '  while governing nothing, so it is treated as a failure.',
  ]);
}

const problems = [];
const ok = [];

for (const entry of files) {
  const rel = entry.path;
  if (typeof rel !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) {
    problems.push({
      kind: 'MALFORMED',
      rel: String(rel),
      detail: 'entry needs a string `path` and a 64-hex-character `sha256`',
    });
    continue;
  }
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    problems.push({ kind: 'MISSING', rel, detail: 'the contract file is not on disk' });
    continue;
  }
  const buf = fs.readFileSync(abs);
  const actual = sha256(buf);
  if (actual !== entry.sha256) {
    problems.push({
      kind: 'CHANGED',
      rel,
      detail: `expected ${entry.sha256}\n            actual   ${actual}\n            size now ${buf.length} bytes`,
    });
    continue;
  }
  ok.push({ rel, bytes: buf.length, screen: entry.screen ?? '' });
}

// An .html in the contract folder that the manifest does not govern.
const governed = new Set(files.map((f) => path.basename(String(f.path))));
const extra = fs.existsSync(CONTRACT_DIR)
  ? fs
      .readdirSync(CONTRACT_DIR)
      .filter((n) => n.toLowerCase().endsWith('.html'))
      .filter((n) => !governed.has(n))
  : [];

process.stdout.write('V8 contract check\n');
for (const f of ok) {
  process.stdout.write(`  ok       ${f.rel}  (${f.bytes} bytes${f.screen ? ` · ${f.screen}` : ''})\n`);
}
for (const p of problems) {
  process.stdout.write(`  ${p.kind.padEnd(8)} ${p.rel}\n            ${p.detail}\n`);
}
for (const n of extra) {
  process.stdout.write(`  UNGOVERNED ${n}\n            an .html file in the contract folder that CONTRACT_MANIFEST.json does not list\n`);
}
process.stdout.write(
  `  ${ok.length} verified · ${problems.length} problem${problems.length === 1 ? '' : 's'} · ${extra.length} ungoverned\n`,
);

if (problems.length > 0 || extra.length > 0) {
  fail([
    '',
    'V8 CONTRACT CHECK — FAILED',
    '',
    '  The V8 design contract is frozen (CLAUDE.md rule #36). A hash mismatch',
    '  means the file being built against is not the file Reid approved.',
    '',
    '  DO NOT edit CONTRACT_MANIFEST.json to make this pass, and do not reach',
    '  for the re-baseline script to silence it. If the change to the contract',
    '  file was accidental, restore it:',
    '',
    '      git checkout docs/design/command-center-v8/',
    '',
    '  A DELIBERATE change to the approved design is Reid\'s decision, applied',
    '  by him, with CONTRACT_APPROVED_BY_REID=1 set in his own shell:',
    '',
    '      node scripts/design/rebaseline-v8-contract.mjs',
    '',
  ]);
}
