#!/usr/bin/env node
/**
 * ONE DRAWING PATH — a build gate over `app/admin/` and `components/admin/`.
 *
 * Every profile drawing an admin screen shows must come from
 * `components/admin/v8/ProfileViewer.tsx`, which renders ONLY from a saved
 * FlashDraft profile's real geometry, through FlashDraft's own renderer.
 *
 * WHY THAT IS A GATE AND NOT A CONVENTION.
 *
 * The Command Center's drawings today come from `lib/design/v7-draw.ts` via
 * `V7Drawing` / `V7Thumb`: a profile KIND out of a nine-entry table plus a few
 * leg lengths. That is a picture of the CATEGORY of flashing a job belongs to.
 * It is not the customer's drawing and it cannot be — the table has no entry
 * for a seven-bend custom, no way to express which way a hem kicks, and no
 * concept of a bend's handedness at all (CLAUDE.md rule #12, where the signed
 * interior angle IS the meaning of a bend).
 *
 * On a thumbnail that is a wrong picture. Shown full size on the screen whose
 * next button reaches the Thalmann DS2801 (rule #14), it is a wrong
 * INSTRUCTION that looks like a right one. Nothing in a type system or a
 * screenshot catches it, because the markup is correct and the picture is
 * plausible. So it is caught here, by name, on every build.
 *
 * ───────────────────────────── THE ALLOWLIST ─────────────────────────────
 *
 * Phase 0 builds the harness; it converts no screens. So every existing call
 * site is a violation on the day this gate is written, and a gate that failed
 * the build immediately would simply be switched off. Instead the baseline is
 * RECORDED, per file, with an EXACT count, in
 * `single-drawing-path-allowlist.json`.
 *
 * The counts are exact in BOTH directions, and that is the whole mechanism:
 *
 *   MORE than the allowlist says  — a new drawing path was added. Fails.
 *   FEWER than the allowlist says — a phase converted something. ALSO FAILS,
 *                                   asking for the number to be lowered.
 *
 * The second half is what makes "later phases burn this to zero" a fact rather
 * than an intention. Progress that does not have to be written down is progress
 * nobody can audit, and an allowlist that only ever shrinks silently is
 * indistinguishable from one nobody is working on.
 *
 * DO NOT ADD AN ENTRY TO MAKE A BUILD PASS, and do not raise a count. That is
 * CLAUDE.md rule #37. `baselineTotal` is recorded in the allowlist and the gate
 * refuses a total above it, so adding an entry fails twice over.
 *
 * ──────────────────────── WHAT IT LOOKS FOR, AND WHY ────────────────────────
 *
 * Named primitives, matched as USAGE rather than as imports — a file that
 * imports `V7Drawing` and never renders it draws nothing. Each pattern is one
 * real way a profile reaches a screen in this codebase today; they were found
 * by inventory, not guessed:
 *
 *   <V7Drawing>, <V7Thumb>, <V7Plate>   the parametric kind+d path. The point.
 *   drawInner(                          v7-draw.ts called directly.
 *   generateProfileSVG(                 the server-side parametric SVG.
 *   <LazyProfileThumb>, <PastProfileThumb>, <ShopJobDrawing>
 *                                       base64 PNG snapshots. Real geometry
 *                                       once, but a fixed-resolution image: it
 *                                       cannot be enlarged and read off, which
 *                                       is what the V8 full-size view is for.
 *   drawProfileScene(                   FlashDraft's renderer called directly
 *                                       by an admin screen, bypassing the
 *                                       viewer — the near-miss that would
 *                                       otherwise look compliant.
 *   pointsToSvgPath(                    `lib/data/job-screen.ts`. A SECOND
 *                                       polyline renderer, and the subtlest
 *                                       entry on this list: it draws the REAL
 *                                       saved points, so the shape is right,
 *                                       and its own comment says it is
 *                                       deliberately not FlashDraft's renderer.
 *                                       What it omits is every NUMBER - no bend
 *                                       angles, no segment lengths, no hems, no
 *                                       painted side. Correct as the read-only
 *                                       preview it was written to be; not
 *                                       something the shop can read a job off.
 *                                       MISSED by the first draft of this gate
 *                                       and found by reading the live Job
 *                                       screen, which is why this list is an
 *                                       inventory rather than a guess.
 *
 * `0 unresolved` DISCIPLINE (rule #28's principle). A file this script cannot
 * read is COUNTED and PRINTED as unreadable, never skipped. A gate that passes
 * by failing to look is worse than no gate.
 *
 * NOT A SCAN OF THE WHOLE REPO, deliberately. FlashDraft's own editor
 * (`app/studio/draft`) must call `drawProfileScene` — it is the editor. The
 * customer-facing catalogue must call `generateProfileSVG` — a catalogue page
 * really is showing a category. The rule is about ADMIN screens, where a
 * drawing is an instruction about a specific job.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const NL = String.fromCharCode(10);

const REPO_ROOT = path.resolve(
  path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..'),
);
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'scripts', 'audit', 'single-drawing-path-allowlist.json');

const SCAN_DIRS = [path.join('app', 'admin'), path.join('components', 'admin')];

/** The one sanctioned drawing component. Files under it are exempt by definition. */
const VIEWER_DIR = path.join('components', 'admin', 'v8');

const PATTERNS = [
  { id: 'V7Drawing', re: /<V7Drawing[\s/>]/g, why: 'parametric kind+d drawing' },
  { id: 'V7Thumb', re: /<V7Thumb[\s/>]/g, why: 'parametric kind+d thumbnail' },
  { id: 'V7Plate', re: /<V7Plate[\s/>]/g, why: 'parametric kind+d plate' },
  { id: 'drawInner', re: /\bdrawInner\s*\(/g, why: 'lib/design/v7-draw.ts called directly' },
  { id: 'generateProfileSVG', re: /\bgenerateProfileSVG\s*\(/g, why: 'server-side parametric SVG' },
  { id: 'LazyProfileThumb', re: /<LazyProfileThumb[\s/>]/g, why: 'base64 PNG snapshot, not enlargeable' },
  { id: 'PastProfileThumb', re: /<PastProfileThumb[\s/>]/g, why: 'base64 PNG snapshot, not enlargeable' },
  { id: 'ShopJobDrawing', re: /<ShopJobDrawing[\s/>]/g, why: 'base64 PNG snapshot, not enlargeable' },
  { id: 'drawProfileScene', re: /\bdrawProfileScene\s*\(/g, why: "FlashDraft's renderer called outside ProfileViewer" },
  { id: 'pointsToSvgPath', re: /\bpointsToSvgPath\s*\(/g, why: 'a second polyline renderer: real points, but no angles, no lengths, no hems' },
];

function walk(dirAbs, out) {
  if (!fs.existsSync(dirAbs)) return out;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
    } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(entry.name) && !/\.test\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

const files = [];
for (const d of SCAN_DIRS) walk(path.join(REPO_ROOT, d), files);

const violations = new Map(); // relPath -> { count, hits: [] }
const unreadable = [];

for (const abs of files) {
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
  if (rel.startsWith(VIEWER_DIR.split(path.sep).join('/'))) continue;

  let src;
  try {
    src = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    unreadable.push(`${rel} — ${err.message}`);
    continue;
  }

  const hits = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      hits.push({ id: p.id, line, why: p.why });
    }
  }
  if (hits.length) violations.set(rel, { count: hits.length, hits });
}

/**
 * `--print-current` dumps the measured state as allowlist-shaped JSON on
 * stdout. It NEVER writes a file.
 *
 * It exists for diagnosis — "what exactly does the gate see" — and for the one
 * legitimate use, recording the original Phase 0 baseline. Piping it over
 * `single-drawing-path-allowlist.json` to clear a failure is precisely the move
 * CLAUDE.md rule #37 forbids: it would make the gate describe whatever the code
 * happens to do, which is not a gate. The warning goes to stderr so it survives
 * the redirect that would hide it.
 */
if (process.argv.includes('--print-current')) {
  const measured = [...violations.values()].reduce((a, v) => a + v.count, 0);
  const out = { baselineTotal: measured, files: {} };
  for (const [rel, v] of [...violations.entries()].sort()) {
    out.files[rel] = { count: v.count, primitives: [...new Set(v.hits.map((h) => h.id))].sort() };
  }
  process.stdout.write(JSON.stringify(out, null, 2) + NL);
  process.stderr.write(
    'NOTE: this is a measurement, not an approval. Overwriting the allowlist with it' + NL +
      'to silence a failure defeats the gate (CLAUDE.md rule #37).' + NL,
  );
  process.exit(0);
}

const allowlist = fs.existsSync(ALLOWLIST_PATH)
  ? JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'))
  : { baselineTotal: 0, files: {} };

const allowed = allowlist.files ?? {};
const problems = [];
const total = [...violations.values()].reduce((a, v) => a + v.count, 0);

// 1. A file with violations that the allowlist does not cover at all.
for (const [rel, v] of [...violations.entries()].sort()) {
  const want = allowed[rel]?.count;
  if (want === undefined) {
    problems.push({
      kind: 'NEW',
      rel,
      detail:
        `${v.count} drawing call(s) outside ProfileViewer:\n` +
        v.hits.map((h) => `              line ${h.line}: ${h.id} — ${h.why}`).join('\n'),
    });
  } else if (v.count > want) {
    problems.push({
      kind: 'GREW',
      rel,
      detail: `allowlisted at ${want}, now ${v.count}. A drawing path was added to a file that was supposed to be shrinking.`,
    });
  }
}

// 2. An allowlisted file that now has FEWER — progress, recorded as a required
//    allowlist edit so it cannot happen invisibly.
for (const rel of Object.keys(allowed).sort()) {
  const have = violations.get(rel)?.count ?? 0;
  const want = allowed[rel].count;
  if (have < want) {
    problems.push({
      kind: 'SHRANK',
      rel,
      detail:
        `allowlisted at ${want}, now ${have}. Good — lower the count (or delete the entry at 0) ` +
        'in scripts/audit/single-drawing-path-allowlist.json and lower `baselineTotal` by the same amount.',
    });
  }
}

// 3. The total may never exceed the recorded baseline.
if (typeof allowlist.baselineTotal === 'number' && total > allowlist.baselineTotal) {
  problems.push({
    kind: 'OVER',
    rel: '(total)',
    detail: `${total} drawing calls outside ProfileViewer, above the recorded baseline of ${allowlist.baselineTotal}.`,
  });
}

/* ───────────────────────────────── report ───────────────────────────────── */

process.stdout.write('Single drawing path\n');
const byPrimitive = new Map();
for (const v of violations.values()) {
  for (const h of v.hits) byPrimitive.set(h.id, (byPrimitive.get(h.id) ?? 0) + 1);
}
for (const [rel, v] of [...violations.entries()].sort()) {
  const want = allowed[rel]?.count;
  const tag = want === undefined ? 'UNLISTED' : v.count === want ? 'baseline' : 'CHANGED ';
  process.stdout.write(`  ${tag} ${String(v.count).padStart(2)}  ${rel}\n`);
}
process.stdout.write(
  `  by primitive: ${[...byPrimitive.entries()].sort().map(([k, n]) => `${k}=${n}`).join(' ') || '(none)'}\n`,
);
process.stdout.write(
  `  ${files.length} files scanned · ${violations.size} with drawings outside ProfileViewer · ` +
    `${total} calls · baseline ${allowlist.baselineTotal ?? 0} · ${unreadable.length} unreadable\n`,
);
for (const u of unreadable) process.stdout.write(`  UNREADABLE ${u}\n`);

if (unreadable.length) {
  problems.push({
    kind: 'UNREADABLE',
    rel: '(scan)',
    detail: `${unreadable.length} file(s) could not be read. A gate must not pass by failing to look.`,
  });
}

if (problems.length === 0) {
  if (total === 0) {
    process.stdout.write('  EVERY admin profile drawing goes through ProfileViewer. Allowlist is empty.\n');
  }
  process.exit(0);
}

process.stderr.write('\nSINGLE DRAWING PATH — FAILED\n\n');
for (const p of problems) {
  process.stderr.write(`  ${p.kind} ${p.rel}\n              ${p.detail}\n\n`);
}
process.stderr.write(
  '  CLAUDE.md rule #37: every profile drawing on an admin screen goes through\n' +
    '  components/admin/v8/ProfileViewer.tsx, and the allowlist is burned to zero —\n' +
    '  never added to, and never raised, to make a build pass.\n\n',
);
process.exit(1);
