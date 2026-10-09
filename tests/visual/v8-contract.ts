import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { prepare, settle, VIEWPORT } from './v7-pixel-harness';

/**
 * THE V8 CONTRACT, AS THE TEST SUITE SEES IT.
 *
 * Command Center V8 is a port of three HTML files Reid approved on 2026-10-08
 * and froze (CLAUDE.md rule #36). This module is the single place the test
 * suite learns what those files are, which states each of them can be driven
 * into, and how to drive them. Everything else — the baseline capture, the
 * interaction gate, and in later phases the pixel gate — reads it from here.
 *
 * WHY IT READS CONTRACT_MANIFEST.json RATHER THAN LISTING THE FILES.
 * The manifest is already the thing scripts/audit/contract-check.mjs enforces
 * on every build. A second hand-maintained list in the test suite would be a
 * place for the two to disagree, and the failure mode is the quiet one: a test
 * suite that keeps measuring a file nobody is building against any more. So
 * there is one list, it carries the hashes, and the suite re-verifies them
 * itself (`assertContractIntact`) rather than assuming prebuild ran.
 *
 * THE HARNESS IS V7's, DELIBERATELY. `prepare`, `settle`, `VIEWPORT` and the
 * freeze/stillness scripts in v7-pixel-harness.ts are not v7-specific — they
 * are "hold a page still enough to photograph it". Reusing them is what keeps
 * a V8 capture comparable with a V7 one, and means the clock-freezing bug
 * nobody wants to debug twice is debugged once. V8 adds only its own baseline
 * directory and its own state drivers.
 *
 * NO PROTOTYPE CHROME STRIPPING HERE. v7's prototype carried a `.proto` review
 * banner that offset the whole document; these three files carry no such block
 * (each ends in a `.note` paragraph INSIDE the page, which is part of the
 * mockup and is captured). `stripPrototypeChrome` is therefore not applied —
 * there is nothing in these files that the prototype itself labels as
 * apparatus. If a future contract file grows one, strip it by its own id here
 * and say so, the way v7's harness does.
 */

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_DIR = path.join(REPO_ROOT, 'docs', 'design', 'command-center-v8');
const MANIFEST_PATH = path.join(CONTRACT_DIR, 'CONTRACT_MANIFEST.json');

export const V8_BASELINE_DIR = path.join(__dirname, 'v8-baselines');
export const V8_OUT_DIR = path.join(REPO_ROOT, 'test-results', 'v8');

export { VIEWPORT };

export interface ContractFile {
  path: string;
  sha256: string;
  screen: string;
  title: string;
  role: string;
}

export interface ContractState {
  id: string;
  file: string;
  name: string;
  /**
   * How to get the file into this state. `none` is the file as it loads.
   * `job:<id>` calls the mockup's own `job()` to open a job screen.
   * `full:<kind>` calls its own `openFullBtn()` to raise the full-size overlay.
   *
   * Both of those are the MOCKUP's OWN entry points, called by name — not a
   * sequence of synthetic clicks that happens to produce a similar picture. A
   * driver that re-implements the interaction would make the baseline a
   * photograph of the driver.
   */
  drive: string;
}

export interface Contract {
  contractVersion: string;
  approvedBy: string;
  approvedOn: string;
  frozen: boolean;
  files: ContractFile[];
  states: ContractState[];
  interaction: {
    zoomSelector: string;
    singleClickOpens: string;
    singleClickDelayMs: number;
    doubleClickOpens: string;
    popTitleId: string;
    popSvgId: string;
    fullTitleId: string;
    fullMetaId: string;
    fullSvgId: string;
    scrimId: string;
    popCloseId: string;
    fullCloseId: string;
    expandButtonSelector: string;
    closesOn: string[];
    fullMustContain: string[];
    legendColors: Record<string, string>;
  };
}

export function loadContract(): Contract {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Contract;
}

/**
 * Re-hash every contract file before any test uses it.
 *
 * The build gate does this too. It is repeated here because a test run does not
 * imply a build ran, and a suite that measured an edited contract file would
 * report "pass" against the wrong design — the single most expensive kind of
 * green. Cheap (three files, ~130KB) and it removes the assumption entirely.
 */
export function assertContractIntact(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  const contract = loadContract();
  const bad: string[] = [];
  for (const f of contract.files) {
    const abs = path.join(REPO_ROOT, f.path);
    if (!fs.existsSync(abs)) {
      bad.push(`${f.path} — missing`);
      continue;
    }
    const actual = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    if (actual !== f.sha256) bad.push(`${f.path} — ${actual} (expected ${f.sha256})`);
  }
  if (bad.length) {
    throw new Error(
      `The V8 contract has changed and is frozen (CLAUDE.md rule #36):\n  ${bad.join('\n  ')}\n` +
        'Restore it with `git checkout docs/design/command-center-v8/`. Never re-baseline to go green.',
    );
  }
}

export function contractFileUrl(relPath: string): string {
  return pathToFileURL(path.join(REPO_ROOT, relPath)).href;
}

/** Every state, or just the ones belonging to one contract file. */
export function statesFor(fileRelPath?: string): ContractState[] {
  const states = loadContract().states;
  return fileRelPath ? states.filter((s) => s.file === fileRelPath) : states;
}

/**
 * Open one contract state and hold it still.
 *
 * The `drive` verbs call the mockup's own functions through `page.evaluate`.
 * `job()` and `openFullBtn()` are both globals the files define for exactly
 * this purpose (`window.openFullBtn = function(k){openFull(k)}`), so driving
 * them is using the mockup as it is written rather than simulating a user.
 * Interaction BEHAVIOUR is a different question and is measured by real
 * clicks, in v8-interaction-gate.spec.ts.
 */
export async function openContractState(page: Page, state: ContractState): Promise<void> {
  await prepare(page);
  await page.goto(contractFileUrl(state.file), { waitUntil: 'load' });
  await page.waitForSelector('body', { timeout: 15_000 });

  if (state.drive !== 'none') {
    const [verb, arg] = state.drive.split(':');
    if (verb === 'job') {
      await page.evaluate((id) => {
        (window as unknown as { job: (s: string) => void }).job(id);
      }, arg);
    } else if (verb === 'full') {
      await page.evaluate((kind) => {
        (window as unknown as { openFullBtn: (s: string) => void }).openFullBtn(kind);
      }, arg);
    } else {
      throw new Error(`Unknown contract drive verb: ${state.drive}`);
    }
  }

  await settle(page);
}

export function writeV8Baseline(id: string, buf: Buffer): string {
  fs.mkdirSync(V8_BASELINE_DIR, { recursive: true });
  const p = path.join(V8_BASELINE_DIR, `${id}.png`);
  fs.writeFileSync(p, buf);
  return p;
}
