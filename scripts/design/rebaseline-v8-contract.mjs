#!/usr/bin/env node
/**
 * RE-BASELINE THE V8 CONTRACT — the only writer of CONTRACT_MANIFEST.json's
 * hashes, and it refuses to run without Reid's explicit say-so.
 *
 * The V8 contract is three HTML files Reid approved on 2026-10-08, frozen by
 * hash and enforced on every build by scripts/audit/contract-check.mjs. That
 * gate exists because V7's history is a record of a design drifting whenever
 * somebody hand-ported a rule, and of a gate going green while the owner's
 * report was "nothing matches".
 *
 * A frozen design still has to be changeable — Reid may approve a revised
 * mockup. But the ACT of changing it must be his, not a side effect of a build
 * session trying to get to green. So:
 *
 *   - This script writes new hashes into the manifest from the files on disk.
 *   - It refuses unless `CONTRACT_APPROVED_BY_REID=1` is in the environment.
 *   - **NO CLAUDE CODE SESSION MAY SET THAT VARIABLE.** It is recorded in
 *     CLAUDE.md rule #36 as a human-only switch. A session that sets it has
 *     defeated the gate, not satisfied it.
 *
 * It prints every hash it is about to change, old to new, before writing, and
 * it writes nothing when nothing differs — so running it by accident on an
 * intact contract is a no-op that says so.
 *
 * It does NOT copy files in. Putting the approved mockup in
 * docs/design/command-center-v8/ is a deliberate, separate act; this script
 * only records what is there once Reid has put it there.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..'));
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs', 'design', 'command-center-v8', 'CONTRACT_MANIFEST.json');

if (process.env.CONTRACT_APPROVED_BY_REID !== '1') {
  process.stderr.write(
    [
      'REFUSED — the V8 contract is frozen.',
      '',
      '  This script rewrites the approved sha256 of every V8 contract file, which',
      '  is the one act that can change what the Command Center is being built',
      '  against. It runs only with Reid\'s explicit approval in the environment:',
      '',
      '      CONTRACT_APPROVED_BY_REID=1 node scripts/design/rebaseline-v8-contract.mjs',
      '',
      '  CLAUDE.md rule #36: no Claude Code session may set that variable. If a',
      '  build is failing contract-check, the fix is to restore the contract file',
      '  (git checkout docs/design/command-center-v8/), never to re-baseline it.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const changes = [];

for (const entry of manifest.files) {
  const abs = path.join(REPO_ROOT, entry.path);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`REFUSED — ${entry.path} is not on disk. Put the approved file there first.\n`);
    process.exit(1);
  }
  const actual = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  if (actual !== entry.sha256) {
    changes.push({ path: entry.path, from: entry.sha256, to: actual });
    entry.sha256 = actual;
  }
}

if (changes.length === 0) {
  process.stdout.write('Nothing to do — every V8 contract file already matches its recorded hash.\n');
  process.exit(0);
}

for (const c of changes) {
  process.stdout.write(`re-baselined ${c.path}\n  from ${c.from}\n  to   ${c.to}\n`);
}

fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(
  `\n${changes.length} hash${changes.length === 1 ? '' : 'es'} rewritten in ${path.relative(REPO_ROOT, MANIFEST_PATH)}.\n` +
    'Commit the manifest together with the contract file(s) it now describes, and\n' +
    'record the approval in STATE_OF_THE_BUILD.md.\n',
);
