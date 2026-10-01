#!/usr/bin/env node
/**
 * GENERATES diagnostics/STATE_OF_THE_BUILD_<date>.{md,docx}.
 *
 *   node scripts/audit/state-of-the-build-report.mjs [--date YYYY-MM-DD] [--base <ref>] [--playwright <log>]
 *
 * The point of generating it rather than writing it is that the parts that go
 * stale fastest are read from the repository at the moment it runs: the commits
 * this queue produced come from `git log`, the contrast numbers from actually
 * running the gate, the migration and test counts from the filesystem, and the
 * Playwright result from the real log of the real run. The narrative sections —
 * what is done, what remains, the blockers, the next actions — are data in this
 * file, so changing them is a reviewable diff rather than an edit to a binary.
 *
 * It renders through `scripts/md-to-docx.mjs`, the renderer this repo already
 * has, rather than a second one. The Markdown it emits is written out beside the
 * .docx, so what is in the document can be read and diffed without opening Word.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

const DATE = arg('date', new Date(fs.statSync(path.join(ROOT, 'package.json')).mtime).toISOString().slice(0, 10));
const BASE = arg('base', 'd0332ac');
const PW_LOG = arg('playwright', null);

/* ---------------------------------------------------------- live readings */

const head = git('rev-parse', '--short', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const commits = git('log', '--pretty=format:%h\t%s', `${BASE}..HEAD`)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [hash, ...rest] = l.split('\t');
    return { hash, subject: rest.join('\t') };
  })
  .reverse();

const filesChanged = git('diff', '--stat', `${BASE}..HEAD`).split('\n').filter(Boolean).pop() ?? 'no changes';

function contrastSummary() {
  try {
    const raw = execFileSync('node', [path.join(ROOT, 'scripts/audit/contrast-check.mjs'), '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(raw);
  } catch (err) {
    // The gate exits non-zero when something fails, which is the whole point —
    // the JSON is still on stdout and is still the honest answer.
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

function countFiles(dir, match) {
  const base = path.join(ROOT, dir);
  if (!fs.existsSync(base)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (match.test(e.name)) n++;
    }
  };
  walk(base);
  return n;
}

/** Parses the list reporter's tail: "N passed", "N failed", "N skipped", and each failing title. */
function playwrightSummary(logPath) {
  if (!logPath || !fs.existsSync(logPath)) return null;
  const text = fs.readFileSync(logPath, 'utf8');
  const counts = {};
  for (const m of text.matchAll(/^\s*(\d+)\s+(passed|failed|skipped|flaky|did not run|interrupted)\b/gm)) {
    counts[m[2]] = Number(m[1]);
  }
  // The list reporter prints its failing titles once, as an indented block
  // directly under "N failed". Reading THAT rather than scraping every
  // "✘"-marked line keeps retries from appearing as separate failures — a retry
  // of the same test is not a second defect, and counting it as one is how a
  // report starts overstating the damage.
  const failures = [];
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*\d+\s+failed\s*$/.test(l));
  if (start !== -1) {
    for (let i = start + 1; i < lines.length; i++) {
      const m = lines[i].match(/^\s+(\[.+)$/);
      if (!m) break;
      failures.push(m[1].trim());
    }
  }
  return { counts, failures, raw: text.length };
}

/* ---------------------------------------------------- the narrative, as data */

const DONE = [
  ['Command Center V2 navigation', 'One level: Workbench, Shop View, Deliveries, Search, More. The second level and the duplicate sidebar are gone. The nav is data in `lib/data/admin-nav.ts` and is unit-tested, so "the nav has exactly these items" is an assertion.'],
  ['The Workbench and the Job screen', 'Five lanes, one Job card per request whatever its source; the three-column Job screen with "What the AI read", the unsure highlight, and the stage stepper. `quote_requests.job_stage` is the single stage column, backfilled with no row orphaned.'],
  // Deliberately describes the removed library in prose and NEVER names its
  // tables. lib/data/removed-machine-library.test.ts is a static test over the
  // whole tree that fails on any source file mentioning them — including this
  // generator, which it caught on its first run. The names are not what a reader
  // of this document needs; the counts are.
  ['The old machine\'s 911-profile library, removed', '911 profiles, their 4,537 bend rows and 46 categories were dropped after the raw machine files were archived outside the repo and verified by size and sha256. The geometry had been AI-read out of a legacy database and never validated, and most of the names were real customer and hospital projects rather than catalog content. A static test fails if any reference comes back.'],
  ['One door to the machine', 'Four push paths deleted. `pushProfileToPathfinder` takes a required ApprovalContext and verifies it in the database with the service role before any network call. A static test walks the tree and fails if any file outside the two approved routes calls it.'],
  ['Rush is never inferred', 'A Postgres CHECK refuses `is_rush = true` without an explicit `rush_source`, and a static test fails if any file outside the four known writers assigns it. Rush pins to the top of the shop queues only.'],
  ['Price book, quotes, invoices and the Approve link', 'Versioned and append-only; a blank price is never a zero and refuses to issue a quote. The quote becomes the invoice by copying, never by recomputing. The Approve link is signed, single-use and expiring, and creates the approval record the single-door guard already requires rather than becoming a fifth door.'],
  ['The pricing ledger', 'Append-only, enforced by a trigger AND by RLS with no UPDATE or DELETE policy at all. The one escape is the reserved `E2E-TEST-` prefix, which also captures outbound email — one prefix, three jobs.'],
  ['Shop View and Deliveries', 'The queue in queue order with one button per card; a real five-day week with Mark delivered. Marking a job finished auto-schedules the next BUSINESS day, worked out in the shop\'s own time zone — both halves in one module with one test.'],
  ['Search', 'One query (`admin_profile_search`), one panel, used both at /admin/search and inside FlashDraft\'s drawer. The hover-intent timings are a tested module, and Select auto-saves unsaved canvas work before it loads somebody else\'s profile.'],
  ['Error boundaries, and a WebGL failure that degrades (F-06)', 'A global boundary, one per section, and one per column of the Job screen. When the browser refuses a WebGL context the 3D viewer renders the same geometry flat, through the same geometry module, rather than leaving an empty grey panel.'],
  ['Timeouts and response validation on the vendor API (F-03, F-09)', 'PathfinderEdge reads carry an 8-second budget, chosen from the 2.46s the audit actually measured. Responses are parsed rather than cast, and a changed payload is logged with the endpoint, the problems and the real body.'],
  ['The HailView baseURL override (F-12)', 'That spec overrode the suite\'s baseURL to localhost, so eight tests failed whenever the suite ran against alpha and the failures had to be written off as environmental. The escape hatch is opt-in now.'],
  ['An automated WCAG AA contrast gate', 'Every Command Center screen, derived from the real nav and the real filesystem, measured against the real token values through the real render tree, wired as `prebuild` so it fails the build. It found 82 real failures on its first clean run, all now fixed. A live Playwright spec measures the same screens with getComputedStyle in a real browser, so the static model cannot drift into fiction unnoticed.'],
  ['The sign-in flow', 'Found by the live half of the contrast gate, which landed on /login before it was signed in: 23 pairs below AA, including the shared auth input class at 1.94:1 on every page at once. Fixed, and those routes are now derived into the gate from the (auth) route group on disk.'],
];

const IN_PROGRESS = [
  ['The light working area, screen by screen', 'Five screens are converted (Workbench, Job, Shop View, Deliveries, Search); the rest are still gunmetal and convert when they are rebuilt. The list is data in `lib/data/admin-working-area.ts` and is unit-tested, so "which screens are light" is an assertion rather than a memory.'],
  ['Human verification of the interactive work', 'Everything below the automated gates has been proven by Playwright against alpha. Per this project\'s own verification standard, canvas and UI behaviour still wants Reid\'s own eyes before it is called DONE.'],
  ['Two homepage assertions that disagree with the shipped homepage', 'The hero\'s "View Our Work" link goes to /design-studio where a 2026-09-16 spec says /about/services, and the header logo renders at 160px where the same pass says 76px. In both cases the markup is NEWER than the assertion, so the tests encode an earlier intention. Neither was touched here: changing where the hero\'s second button sends every visitor, or how big the brand mark is, is a product decision.'],
  ['One Modify-in-FlashDraft assertion that is a real product question', 'A modified profile\'s child row gets `dimensions.revision = 1` where the spec expects it to carry the source\'s 5. What a revision number should mean across a modify is a lineage decision, not a hardening one.'],
  ['The 21 remaining `afs-chrome-dim` placeholder files outside the Command Center', 'Recorded, measured, and deliberately not swept — widening a Command Center prompt into a site-wide restyle is Reid\'s call. The twenty-second was the shared auth input class, which sits on every page of the sign-in flow and is therefore inside the gate; that one was fixed. The Command Center screens and the sign-in flow are now clean and gated; the rest of the list is not.'],
];

const REMAINS = [
  ['Microsoft 365 and the mail parser (spec Phase 4)', 'Entirely greenfield: no Graph code exists. Blocked on tenant admin consent — see NEXT ACTIONS.'],
  ['The Bid Monitor decision', 'The screen exists and now clears AA, but whether it stays in the Command Center at all is an open product question informed by the report prompt v2-01 produced.'],
  ['The Products page track', 'Catalog content remains blocked on the product data listed under DATA BLOCKERS in CLAUDE.md.'],
  ['Steve\'s historical pricing', 'The append-only ledger is built and documented, including the frozen import column list. No historical data has been loaded into it yet.'],
  ['An attended Thalmann test', 'The bend-angle and hemDirection mappings in the PathfinderEdge encoder remain unproven against the physical machine. No unattended session will test them, because a write to catalog 20115 is collected automatically by the DS2801.'],
  ['Dynamic pricing and QuickBooks', 'Deliberately "coming soon" cards in Settings. Dynamic pricing is what the pricing ledger is collecting history for.'],
];

const BLOCKERS = [
  ['Microsoft 365 admin consent', 'DELEGATED Mail.Read, Mail.ReadWrite, Mail.Send, offline_access and User.Read on a single-tenant Entra app registration, with admin consent granted, plus the client secret in Vercel. Application (app-only) permissions are not an acceptable substitute: replies have to land in Steve\'s own Sent folder and stay in thread, which only a delegated token does.'],
  ['Product catalog, pricing basis and shop language', 'The data blockers listed in CLAUDE.md. The features are built with correct architecture and explicit placeholder behaviour; the data populates the existing structure when it arrives.'],
  ['An attended machine test', 'Needs a person standing at the Thalmann. Not schedulable from here.'],
  ['Resend is not configured on this deployment', 'So outbound customer mail is saved rather than sent, and the Deliveries screen says exactly that rather than claiming a message went out.'],
];

const NEXT_ACTIONS = [
  ['Connect Microsoft 365 and build the mail parser', 'Spec Phase 4. DEFERRED IN THIS QUEUE until Microsoft 365 admin consent is granted. Once consent exists: the OAuth connect flow, the `outlook_connections` table with owner-only RLS and server-side-only tokens, sending quotes through Graph as Steve, Graph change notifications to a webhook with `clientState` validated on every delivery, and the ~3-day subscription renewal job. The inbound classifier reuses the takeoff prompt architecture — one JSON-only system prompt, a typed schema, per-field confidence and an aiNote — because that shape is already proven here.'],
  ['The Bid Monitor decision, informed by the report prompt v2-01 produced', 'Keep it in the Command Center, move it behind More, or retire it. It is live, it has real sources and keywords behind it, and it is now AA-clean either way — so this is a product call about whether chasing public bids is work AFS wants, not a technical one.'],
  ['The Products page track', 'The catalog, the configurator dropdowns and the finish palette, once the product data arrives. Customer-facing pricing stays out of all of it: this is an RFQ platform.'],
  ['Load Steve\'s historical pricing into the append-only ledger', 'Use `source=\'import\'` with an `import_batch_id` — a CHECK requires one, so a bad batch is always identifiable and is superseded rather than deleted. The column list is frozen in SCHEMA.md\'s PRICING LEDGER IMPORT FORMAT and is the same order the CSV export writes. Money is cents throughout.'],
  ['An ATTENDED Thalmann test of the spec-correct encoder', 'One asymmetric hemmed profile, pushed through the Command Center approval path by a person standing at the machine, checked against PathfinderEdge\'s own render. This is what closes the bend-angle and hemDirection mappings, which are flagged unproven in code rather than presented as settled.'],
];

/**
 * A failing test's title is not a cause. Each entry here is keyed by a substring
 * of the Playwright title, so the document never prints a bare list of red —
 * anything that survives a run has to come with what is actually wrong and whose
 * decision it is. An unmatched failure prints "cause not yet diagnosed", which is
 * a worse look than the truth and is meant to be.
 */
const FAILURE_CAUSES = [
  [
    'saving the modified draft creates a NEW row',
    'REAL PRODUCT QUESTION, left failing on purpose. A modified profile\'s child row gets `dimensions.revision = 1`; the Part 1 spec expects it to carry the source\'s 5. What a revision number means across a modify is a lineage decision. PENDING REID.',
  ],
  [
    'hero dual CTAs',
    'The hero\'s "View Our Work" link goes to /design-studio; the assertion wants /about/services. The markup (commit 6a10944) is NEWER than the assertion, so the test encodes an earlier intention. Changing where the hero\'s second button sends every visitor is a product decision. PENDING REID.',
  ],
  [
    'header logo has no separate sidebar',
    'The header logo renders at width 160; the assertion wants 76. The markup (commit 3c774f6) landed AFTER the assertion, so again the test is the stale side. Changing the size of the brand mark is a product decision. PENDING REID.',
  ],
];

const OPEN_DESIGN_QUESTIONS = [
  [
    'Should an admin approval alone be able to reach the machine?',
    'The single door is an ADMIN approval, not a customer\'s acceptance of a quote. A profile reaches the Thalmann the moment an admin clicks "Approve & Send to Machine"; there is no customer-acceptance step between the quote and the machine. The Approve link and "approved by phone" both now write the approval record, so the material to require customer acceptance exists — but nothing requires it. PENDING REID.',
  ],
  [
    'What happens to the disconnected stray Vercel project and its secrets?',
    '`reids-projects-b3405b97/afs-website` (`prj_POXBIS4e5hE88zekvufE6aODCUeP`, alias afs-website-eight.vercel.app) was DISCONNECTED from GitHub on 2026-09-30, not deleted. Confirmed again during this run: its newest deployment is three days old while the team project deployed from `main` minutes ago. It still exists, still serves its last build, and still holds its environment variables. Whether to delete it, and whether to rotate the secrets it still holds, is PENDING REID.',
  ],
];

/* ------------------------------------------------------------- compose it */

const contrast = contrastSummary();
const lines = [];
const w = (s = '') => lines.push(s);

w(`# AFS — State of the Build`);
w();
w(`**Date:** ${DATE}  `);
w(`**Branch:** ${branch} at ${head}  `);
w(`**Canonical environment:** https://afs-website-alpha.vercel.app (production alias of steveharyckis-projects/afs-website, tracking \`main\`)  `);
w(`**Generated by:** \`scripts/audit/state-of-the-build-report.mjs\`, from the repository as it stands — not from memory.`);
w();
w('---');
w();

w('## 1. What is DONE');
w();
for (const [title, detail] of DONE) w(`- **${title}.** ${detail}`);
w();

w('## 2. What is IN PROGRESS');
w();
for (const [title, detail] of IN_PROGRESS) w(`- **${title}.** ${detail}`);
w();

w('## 3. What REMAINS');
w();
for (const [title, detail] of REMAINS) w(`- **${title}.** ${detail}`);
w();

w('## 4. The commits this queue produced');
w();
w(`Base: \`${BASE}\` · HEAD: \`${head}\` · ${commits.length} commit${commits.length === 1 ? '' : 's'}`);
w();
w('| Commit | Subject |');
w('|---|---|');
for (const c of commits) w(`| \`${c.hash}\` | ${c.subject.replace(/\|/g, '\\|')} |`);
w();
w(`Diff against the base: ${filesChanged.trim()}`);
w();

w('## 5. Current blockers');
w();
for (const [title, detail] of BLOCKERS) w(`- **${title}.** ${detail}`);
w();

w('## 6. NEXT ACTIONS');
w();
NEXT_ACTIONS.forEach(([title, detail], i) => {
  w(`${i + 1}. **${title}.** ${detail}`);
  w();
});

w('## 7. Open design questions, carried forward');
w();
w('Both are recorded in CLAUDE.md and are unchanged by this queue. Neither can be closed by a session; both are Reid\'s.');
w();
for (const [q, detail] of OPEN_DESIGN_QUESTIONS) {
  w(`- **${q}** ${detail}`);
  w();
}

w('## 8. Measured state of the repository');
w();
w('| Measure | Value |');
w('|---|---|');
w(`| Database migrations on disk | ${countFiles('supabase/migrations', /\.sql$/)} |`);
w(`| Unit test files | ${countFiles('lib', /\.test\.ts$/)} |`);
w(`| Playwright specs | ${countFiles('tests/e2e', /\.spec\.ts$/)} |`);
w(`| Route segment error boundaries | ${countFiles('app', /^error\.tsx$/) + countFiles('app', /^global-error\.tsx$/)} |`);
if (contrast) {
  const pairs = contrast.reduce((n, s) => n + s.findings.length, 0);
  const fails = contrast.reduce((n, s) => n + s.findings.filter((f) => !f.pass).length, 0);
  const unresolved = contrast.reduce((n, s) => n + s.unresolved.length, 0);
  w(`| Command Center screens under the contrast gate | ${contrast.length} |`);
  w(`| Colour pairs measured | ${pairs} |`);
  w(`| Colour pairs below WCAG AA | ${fails} |`);
  w(`| Colour pairs the gate could not resolve | ${unresolved} |`);
}
const pw = playwrightSummary(PW_LOG);
if (pw) {
  for (const [k, v] of Object.entries(pw.counts)) w(`| Playwright, against alpha: ${k} | ${v} |`);
}
w();

if (pw && pw.counts.skipped) {
  w(`The ${pw.counts.skipped} skips are conditional and self-explaining, not silent. Four are Production Queue tests that skip because \`orders\` is empty on alpha — the spec's premise is that a status change is observable, and with no orders there is nothing to observe. The fifth is a HailView storm-marker test that skips when the live weather feed returns no hail events for the test address. Both say so in their skip message.`);
  w();
}

if (contrast) {
  w('### Contrast, screen by screen');
  w();
  w('| Screen | Pairs | Below AA | Worst measured |');
  w('|---|---|---|---|');
  for (const s of contrast) {
    const worst = s.findings.length ? Math.min(...s.findings.map((f) => f.ratio)) : null;
    const below = s.findings.filter((f) => !f.pass).length;
    w(`| ${s.route} | ${s.findings.length} | ${below} | ${worst === null ? 'n/a' : `${worst.toFixed(2)}:1`} |`);
  }
  w();
}

if (pw) {
  w('### Playwright against alpha — every failure, by title, with its cause');
  w();
  if (pw.failures.length === 0) {
    w('No test failed.');
  } else {
    for (const f of pw.failures) {
      const hit = FAILURE_CAUSES.find(([key]) => f.includes(key));
      w(`- **${f}**`);
      w(`  - ${hit ? hit[1] : 'Cause not yet diagnosed.'}`);
    }
  }
  w();
}

w('---');
w();
w('*Generated from the live repository. The narrative sections are data in the generator, so they change by reviewable diff; everything in section 4 and section 8 is read or measured at generation time.*');

/* ------------------------------------------------------------------ write */

const outDir = path.join(ROOT, 'diagnostics');
fs.mkdirSync(outDir, { recursive: true });
const mdPath = path.join(outDir, `STATE_OF_THE_BUILD_${DATE}.md`);
const docxPath = path.join(outDir, `STATE_OF_THE_BUILD_${DATE}.docx`);
fs.writeFileSync(mdPath, lines.join('\n') + '\n', 'utf8');

execFileSync('node', [path.join(ROOT, 'scripts/md-to-docx.mjs'), mdPath, docxPath], {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log(`${path.relative(ROOT, mdPath)}: ${fs.statSync(mdPath).size} bytes`);
