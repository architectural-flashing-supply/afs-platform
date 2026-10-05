import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * THE MANIFEST'S EXECUTABLE HALF.
 *
 * docs/design/command-center-v7/SCREEN_MANIFEST.json is the ENUMERATION: every
 * distinct screen and state v7 can render, with the steps written in English so
 * the list can be reviewed against the prototype on its own. This file is the
 * same list as Playwright actions.
 *
 * They are kept apart on purpose, and then forced to agree: `assertDriversMatchManifest()`
 * fails if the two sets of ids differ in either direction. So a state added to
 * the manifest and not driven fails the run (rather than being silently
 * skipped), and a driver with no manifest entry fails too (rather than
 * measuring something nobody enumerated).
 */

export interface ManifestScreen {
  id: string;
  name: string;
  tier: number;
  protoFn: string | null;
  protoSteps: string[];
  liveRoute: string | null;
  liveSteps?: string[];
  liveNote?: string;
}

const MANIFEST_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'design',
  'command-center-v7',
  'SCREEN_MANIFEST.json',
);

export function loadManifest(): ManifestScreen[] {
  const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { screens: ManifestScreen[] };
  return raw.screens;
}

/** A driver pair. `proto` navigates the prototype; `live` navigates the app. */
export interface ScreenDriver {
  /** Reach this state in the untouched prototype. The page is already loaded. */
  proto?: (page: Page) => Promise<void>;
  /**
   * Reach this state in the live app. Receives the fixture-mode URL for the
   * manifest's `liveRoute`; most drivers just go there.
   */
  live?: (page: Page, url: string) => Promise<void>;
}

/* ─────────────────────────── prototype helpers ──────────────────────────── */

async function nav(page: Page, go: string) {
  await page.locator(`[data-go="${go}"]`).first().click();
  await page.waitForSelector('header.hdr');
}

/** v7 puts Search and Settings behind the More menu. */
async function navMore(page: Page, go: string) {
  const link = page.locator(`.mm [data-go="${go}"]`).first();
  if (!(await link.isVisible().catch(() => false))) {
    await page.locator('.more .mbtn').click();
  }
  await link.click();
  await page.waitForSelector('header.hdr');
}

async function act(page: Page, selector: string) {
  await page.locator(selector).first().click();
}

/**
 * Type into a prototype input the way a person does, so `input` handlers fire —
 * then BLUR it.
 *
 * The blur is not cosmetic. The prototype reaches a filtered state by typing,
 * and the live app reaches the same state from the URL, so without it the
 * prototype side carries a focus ring on the search box that the live side
 * cannot have whatever the port does. That is an artifact of how the gate
 * drives the two sides, not a difference between them, and leaving it in would
 * eventually be "fixed" by widening a mask.
 *
 * It does NOT blur generally: v7 deliberately focuses the first button in a
 * modal (`render()`'s own tail), and that focus IS design state both sides must
 * show.
 */
async function type(page: Page, selector: string, value: string) {
  await page.locator(selector).first().fill(value);
  await page.locator(selector).first().dispatchEvent('input');
  await page.locator(selector).first().evaluate((el: HTMLElement) => el.blur());
}

async function selectOpt(page: Page, selector: string, value: string) {
  await page.locator(selector).first().selectOption(value);
}

const goLive = async (page: Page, url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
};

/* ───────────────────────────── the drivers ─────────────────────────────── */

export const SCREEN_DRIVERS: Record<string, ScreenDriver> = {
  workbench: { proto: async () => {}, live: goLive },

  'shell-more-menu': {
    proto: async (p) => act(p, '.more .mbtn'),
    live: async (p, url) => {
      await goLive(p, url);
      // The live More button is a client component; a click that lands before
      // hydration is swallowed. Press until the menu is really there — the same
      // hydration race the old style gate documents.
      for (let i = 0; i < 4; i++) {
        if (await p.locator('.mm:not([hidden])').count()) break;
        await p.locator('.more .mbtn').first().click();
        await p.locator('.mm:not([hidden])').first().waitFor({ state: 'attached', timeout: 1500 }).catch(() => {});
      }
    },
  },

  'shell-typeahead': {
    proto: async (p) => {
      await type(p, '#hq', 'Hill Country drip');
      await p.waitForSelector('.hsd:not([hidden])', { timeout: 5000 });
    },

    live: async (p, url) => {
      await goLive(p, url);
      // FILL UNTIL IT TAKES. `goLive` waits for `header.hdr`, which is in the
      // server-rendered HTML — it is there before React has hydrated, and a
      // fill that lands first sets the DOM value without ever firing the
      // onChange that opens the dropdown. The gate reported the type-ahead at
      // 8.55% with eight landmarks missing for exactly that reason, and the
      // same page opened the dropdown fine with a wait in front of it. The
      // style gate documents the same race on the More button.
      const input = p.locator('.hs input[type="search"]').first();
      for (let i = 0; i < 5; i++) {
        if (await p.locator('.hsd').count()) break;
        await input.fill('');
        await input.fill('Hill Country drip');
        await p.locator('.hsd').first().waitFor({ state: 'attached', timeout: 1500 }).catch(() => {});
      }
      // Same blur as the prototype side: the two sides reach this state by
      // different routes, and a focus ring on one of them is an artifact of the
      // gate rather than a difference between the screens.
      await input.evaluate((el: HTMLElement) => el.blur());
    },
  },

  quotes: { proto: async (p) => nav(p, 'quotes'), live: goLive },
  'quotes-stage-new': {
    proto: async (p) => {
      await nav(p, 'quotes');
      await selectOpt(p, '[data-in="ls"][data-k="stage"]', 'new');
    },
    live: goLive,
  },
  orders: { proto: async (p) => nav(p, 'orders'), live: goLive },
  'orders-sort-val': {
    proto: async (p) => {
      await nav(p, 'orders');
      await selectOpt(p, '[data-in="ls"][data-k="sort"]', 'val');
    },
    live: goLive,
  },

  shop: { proto: async (p) => nav(p, 'shop'), live: goLive },

  'job-new': { proto: async (p) => nav(p, 'job:412'), live: goLive },
  'job-new-nodraw': { proto: async (p) => nav(p, 'job:413'), live: goLive },
  'job-new-fieldapp': { proto: async (p) => nav(p, 'job:414'), live: goLive },
  'job-quoted': { proto: async (p) => nav(p, 'job:409'), live: goLive },
  'job-approved': { proto: async (p) => nav(p, 'job:405'), live: goLive },
  'job-shop': { proto: async (p) => nav(p, 'job:398'), live: goLive },
  'job-shop-finished': { proto: async (p) => nav(p, 'job:402'), live: goLive },
  'job-done': { proto: async (p) => nav(p, 'job:399'), live: goLive },

  deliveries: { proto: async (p) => nav(p, 'deliveries'), live: goLive },
  'deliveries-full-list': {
    proto: async (p) => {
      await nav(p, 'deliveries');
      await act(p, '.dleft [data-act="dvFull"]');
    },
    live: goLive,
  },
  'deliveries-full-map': {
    proto: async (p) => {
      await nav(p, 'deliveries');
      await act(p, '.dright [data-act="dvFull"]');
    },
    live: goLive,
  },
  'deliveries-day-fri': {
    proto: async (p) => {
      await nav(p, 'deliveries');
      await act(p, '[data-act="dvDay"][data-v="fri"]');
    },
    live: goLive,
  },

  newquote: { proto: async (p) => act(p, '.nqb'), live: goLive },
  'newquote-customer': {
    proto: async (p) => {
      await act(p, '.nqb');
      await act(p, '[data-act="nqPick"][data-v="Hill Country Roofing"]');
    },
    live: goLive,
  },
  'newquote-blank': {
    proto: async (p) => {
      await act(p, '.nqb');
      await act(p, '[data-act="nqBlank"]');
    },
    live: goLive,
  },

  search: { proto: async (p) => navMore(p, 'search'), live: goLive },
  'search-query': {
    proto: async (p) => {
      await navMore(p, 'search');
      await type(p, '#sq', 'Hill Country drip edge');
    },
    live: goLive,
  },
  // v7 reaches a profile-filtered Search by clicking a saved-profile thumbnail.
  // Those live on the Customers page and the Job screen, NOT on the Workbench —
  // clicking `[data-go="prof:1"]` from the landing page matches nothing. (That
  // mistake hung the whole first run; see ACTION_TIMEOUT_MS in the harness.)
  'search-pid': {
    proto: async (p) => {
      await nav(p, 'customers');
      await act(p, '.grid2 [data-go^="prof:"]');
    },
    live: goLive,
  },
  'search-empty': {
    proto: async (p) => {
      await navMore(p, 'search');
      await type(p, '#sq', 'zzzz');
    },
    live: goLive,
  },

  customers: { proto: async (p) => nav(p, 'customers'), live: goLive },
  'customers-edit': {
    proto: async (p) => {
      await nav(p, 'customers');
      await act(p, '[data-act="editContact"]');
    },
    live: goLive,
  },

  pricing: { proto: async (p) => nav(p, 'pricing'), live: goLive },
  'pricing-filled': {
    proto: async (p) => {
      await nav(p, 'pricing');
      await act(p, '.panel [data-act="loadEx"]');
    },
    live: goLive,
  },

  'settings-email': { proto: async (p) => navMore(p, 'settings'), live: goLive },
  'settings-inv': {
    proto: async (p) => {
      await navMore(p, 'settings');
      await act(p, '[data-act="setSec"][data-v="inv"]');
    },
    live: goLive,
  },
  'settings-docs': {
    proto: async (p) => {
      await navMore(p, 'settings');
      await act(p, '[data-act="setSec"][data-v="docs"]');
    },
    live: goLive,
  },
  'settings-soon': {
    proto: async (p) => {
      await navMore(p, 'settings');
      await act(p, '[data-act="setSec"][data-v="soon"]');
    },
    live: goLive,
  },

  // v7's `[data-go="source:412"]` is a button INSIDE the Job screen's request
  // pane ("View original email beside this reading"), not anywhere on the
  // Workbench — so it has to be reached through the job first.
  'source-sketch': {
    proto: async (p) => {
      await nav(p, 'job:412');
      await nav(p, 'source:412');
    },
  },
  'source-photo': {
    proto: async (p) => {
      await nav(p, 'job:412');
      await nav(p, 'source:412');
      await act(p, '[data-act="srcTab"][data-v="1"]');
    },
  },

  'op-bending': {
    proto: async (p) => {
      await nav(p, 'shop');
      await act(p, '.stbl tr[data-id="398"] [data-act="openop"]');
    },
  },
  'op-queued': {
    proto: async (p) => {
      await nav(p, 'shop');
      await act(p, '.stbl tr[data-id="401"] [data-act="openop"]');
    },
  },
  'op-finished': {
    proto: async (p) => {
      await nav(p, 'job:402');
      await act(p, '[data-act="openop"]');
    },
  },
  'op-full': {
    proto: async (p) => {
      await nav(p, 'shop');
      await act(p, '.stbl tr[data-id="398"] [data-act="openop"]');
      await act(p, '.expbtn');
    },
  },

  'modal-doc-quote': {
    proto: async (p) => {
      await nav(p, 'job:409');
      await act(p, '#stagepane [data-act="docq"]');
      await p.waitForSelector('.modal .paper');
    },
  },
  'modal-doc-invoice': {
    proto: async (p) => {
      await nav(p, 'job:402');
      await act(p, '#stagepane [data-act="doci"]');
      await p.waitForSelector('.modal .paper');
    },
  },
  'modal-fd-change': {
    proto: async (p) => {
      await nav(p, 'job:412');
      await act(p, '.pstrip [data-act="fd"]');
      await p.waitForSelector('.modal .fdg');
    },
  },
  'modal-fd-new': {
    proto: async (p) => {
      await nav(p, 'job:413');
      await act(p, '.pstrip [data-act="fd"]');
      await p.waitForSelector('.modal .fdg');
    },
  },
  'modal-mail-order': {
    proto: async (p) => {
      await act(p, '.rl.m[data-id="3"]');
      await p.waitForSelector('.modal .fdg');
    },
  },
  'modal-mail-notice': {
    proto: async (p) => {
      await act(p, '.rl.m[data-id="5"]');
      await p.waitForSelector('.modal .fdg');
    },
  },
  'modal-sched': {
    proto: async (p) => {
      await nav(p, 'deliveries');
      await act(p, '.un [data-act="sched"]');
      await p.waitForSelector('.modal .opts');
    },
  },
  'modal-follow': {
    proto: async (p) => {
      await nav(p, 'job:409');
      await act(p, '#stagepane [data-act="follow"]');
      await p.waitForSelector('.modal #ftext');
    },
  },
  'modal-chg1': {
    proto: async (p) => {
      await nav(p, 'job:409');
      await act(p, '#stagepane [data-act="chg1"]');
      await p.waitForSelector('.modal #c1-qty');
    },
  },
  'modal-chg2': {
    proto: async (p) => {
      await nav(p, 'job:398');
      await act(p, '#stagepane [data-act="chg2"]');
      await p.waitForSelector('.modal #a2-text');
    },
  },

  // Live-only screens: no prototype counterpart exists, so there is no
  // baseline to diff. They are still loaded and asserted to render, so a port
  // that breaks the shell on them is caught.
  'credit-applications': { live: goLive },
  'bid-monitor': { live: goLive },
  'profile-search': { live: goLive },
};

/**
 * Force the two halves of the manifest to agree. Called from the gate's
 * `beforeAll`, so a mismatch fails once with a clear message instead of
 * silently reducing coverage.
 */
export function assertDriversMatchManifest(screens: ManifestScreen[]): void {
  const manifestIds = new Set(screens.map((s) => s.id));
  const driverIds = new Set(Object.keys(SCREEN_DRIVERS));
  const undriven = [...manifestIds].filter((id) => !driverIds.has(id));
  const unlisted = [...driverIds].filter((id) => !manifestIds.has(id));
  const problems: string[] = [];
  if (undriven.length) {
    problems.push(
      `Manifest entries with no driver (they would be skipped, which is how a state goes unchecked): ${undriven.join(', ')}`,
    );
  }
  if (unlisted.length) {
    problems.push(`Drivers with no manifest entry (measuring something nobody enumerated): ${unlisted.join(', ')}`);
  }
  // A manifest entry must say how to reach it on at least one side, or it
  // asserts nothing at all.
  for (const s of screens) {
    const d = SCREEN_DRIVERS[s.id];
    if (!d) continue;
    if (s.protoFn && !d.proto) problems.push(`${s.id}: manifest names a prototype function but the driver has no proto step.`);
    if (s.liveRoute && !d.live) problems.push(`${s.id}: manifest names a live route but the driver has no live step.`);
    if (!s.protoFn && !s.liveRoute) problems.push(`${s.id}: manifest entry has neither a prototype function nor a live route.`);
  }
  if (problems.length) throw new Error(`SCREEN_MANIFEST.json and v7-screen-drivers.ts disagree:\n - ${problems.join('\n - ')}`);
}
