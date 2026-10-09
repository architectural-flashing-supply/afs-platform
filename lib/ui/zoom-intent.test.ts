import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ZOOM_OPEN_DELAY_MS } from './zoom-intent';

/**
 * THE 230 ms IN THE CODE IS THE 230 ms IN THE FROZEN CONTRACT.
 *
 * `ZOOM_OPEN_DELAY_MS` is the delay before a single click opens the enlarged
 * drawing, and the only reason it exists is to let a double-click cancel it.
 * The number came from the approved V8 mockups; the mockups are frozen by hash
 * (CLAUDE.md rule #36).
 *
 * A constant copied out of a design and then left alone is the easiest kind of
 * drift to miss: 180 ms and 230 ms look identical in a screenshot and feel
 * different in the hand, and nothing in a build would ever complain. So this
 * test reads the delay BACK OUT OF THE CONTRACT HTML — not out of the manifest's
 * convenience copy of it, but out of the mockup's own `setTimeout` line — and
 * asserts all three agree.
 *
 * Checking the HTML rather than CONTRACT_MANIFEST.json's `singleClickDelayMs`
 * matters: the manifest is a hand-written description of the contract, so a
 * mistake there would be reproduced here rather than caught. The HTML is the
 * contract.
 */

const CONTRACT_DIR = path.join(__dirname, '..', '..', 'docs', 'design', 'command-center-v8');

function contractFiles(): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(CONTRACT_DIR, 'CONTRACT_MANIFEST.json'), 'utf8')) as {
    files: { path: string }[];
  };
  return manifest.files.map((f) => path.join(__dirname, '..', '..', f.path));
}

describe('ZOOM_OPEN_DELAY_MS', () => {
  it('matches the delay every V8 contract file actually schedules', () => {
    const files = contractFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const m = src.match(/setTimeout\(\(\)=>openPop\(k\),(\d+)\)/);
      expect(m, `${path.basename(file)} must schedule the enlarge, not open it`).not.toBeNull();
      expect(
        Number(m![1]),
        `${path.basename(file)} schedules at ${m![1]}ms but the code uses ${ZOOM_OPEN_DELAY_MS}ms`,
      ).toBe(ZOOM_OPEN_DELAY_MS);
    }
  });

  it('matches the manifest\'s recorded value too', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(CONTRACT_DIR, 'CONTRACT_MANIFEST.json'), 'utf8'),
    ) as { interaction: { singleClickDelayMs: number } };
    expect(manifest.interaction.singleClickDelayMs).toBe(ZOOM_OPEN_DELAY_MS);
  });

  it('every contract file cancels the pending enlarge on a double-click', () => {
    // The delay is worthless without the cancel: the click would simply be late
    // rather than suppressed, and a double-click would open both overlays.
    for (const file of contractFiles()) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).toContain("document.addEventListener('dblclick'");
      expect(src.match(/dblclick[\s\S]{0,160}clearTimeout\(tm\)/)).not.toBeNull();
    }
  });

  it('is long enough to span a real double-click and short enough to feel immediate', () => {
    // Not a magic-number restatement: the platform double-click interval is
    // typically 300-500ms as a MAXIMUM, while the gap between the two clicks of
    // a deliberate double-click is well under 200ms. Below ~150ms the enlarge
    // starts firing inside real double-clicks; much above ~400ms and a single
    // click feels broken. The contract's 230 sits in that window, and this
    // assertion is what would fail if somebody "tidied" it to 50 or 1000.
    expect(ZOOM_OPEN_DELAY_MS).toBeGreaterThanOrEqual(150);
    expect(ZOOM_OPEN_DELAY_MS).toBeLessThanOrEqual(400);
  });
});
