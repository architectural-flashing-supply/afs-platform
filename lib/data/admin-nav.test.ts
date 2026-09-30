import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOP_LEVEL_NAV,
  MORE_NAV,
  ADMIN_SEARCH_HREF,
  UNLINKED_ADMIN_ROUTES,
} from './admin-nav';

const REPO_ROOT = join(__dirname, '..', '..');

/** Does a Next.js App Router page exist for this route? */
function routeExists(href: string): boolean {
  const path = href.replace(/^\//, '');
  return (
    existsSync(join(REPO_ROOT, 'app', path, 'page.tsx')) ||
    existsSync(join(REPO_ROOT, 'app', '(public)', path, 'page.tsx'))
  );
}

describe('Command Center navigation is ONE level', () => {
  it('has exactly the V2 top-level items, in order', () => {
    expect(TOP_LEVEL_NAV.map((i) => i.label)).toEqual(['Workbench', 'Shop View', 'Deliveries']);
  });

  it('has exactly the V2 More items, in order', () => {
    expect(MORE_NAV.map((i) => i.label)).toEqual([
      'Customers',
      'Credit Applications',
      'Bid Monitor',
      'Settings',
    ]);
  });

  it('gives the Workbench the only pending-work badge', () => {
    expect(TOP_LEVEL_NAV.filter((i) => i.badge).map((i) => i.href)).toEqual([
      '/admin/command-center',
    ]);
    expect(MORE_NAV.some((i) => i.badge)).toBe(false);
  });

  it('lists no destination twice', () => {
    const all = [...TOP_LEVEL_NAV, ...MORE_NAV].map((i) => i.href);
    expect(new Set(all).size).toBe(all.length);
  });

  it('points every nav item at a route that actually exists', () => {
    const missing = [...TOP_LEVEL_NAV, ...MORE_NAV, { label: 'Search', href: ADMIN_SEARCH_HREF }]
      .filter((i) => !routeExists(i.href))
      .map((i) => `${i.label} -> ${i.href}`);
    expect(missing).toEqual([]);
  });
});

describe('the old two-level nav is gone', () => {
  const topBar = readFileSync(join(REPO_ROOT, 'components', 'layout', 'AdminTopBar.tsx'), 'utf8');
  const shell = readFileSync(join(REPO_ROOT, 'components', 'layout', 'AdminShell.tsx'), 'utf8');

  it('has no gear popover — that was the second level', () => {
    // The gear icon held QuickBooks / Pricing / Settings as a nested menu.
    expect(topBar).not.toMatch(/GearIcon|settingsOpen/);
  });

  it('has no sidebar nav list in AdminShell — it duplicated the top bar', () => {
    expect(shell).not.toMatch(/NAV_ITEMS|<aside/);
  });

  it('drops the labels the two-level nav used', () => {
    for (const gone of ['Dashboard', 'Quote Requests', 'Production', 'Production Queue']) {
      expect(
        [...TOP_LEVEL_NAV, ...MORE_NAV].some((i) => i.label === gone),
        `"${gone}" should no longer be a nav item`
      ).toBe(false);
    }
  });
});

describe('routes that are deliberately unlinked', () => {
  it('keeps geometry-test and the Google Business photo queue out of the nav', () => {
    const navHrefs = new Set([...TOP_LEVEL_NAV, ...MORE_NAV].map((i) => i.href));
    for (const route of UNLINKED_ADMIN_ROUTES) {
      expect(navHrefs.has(route.href), `${route.href} must not be in the nav`).toBe(false);
      // Unlinked, not deleted: the code is retained on purpose.
      expect(routeExists(route.href), `${route.href} should still exist on disk`).toBe(true);
      expect(route.why.length).toBeGreaterThan(20);
    }
  });

  it('never links geometry-test from any nav surface', () => {
    for (const file of ['components/layout/AdminTopBar.tsx', 'components/layout/AdminShell.tsx']) {
      const contents = readFileSync(join(REPO_ROOT, file), 'utf8');
      // The href, not the word: the AdminTopBar header comment explains the
      // decision in prose, which is fine and wanted.
      expect(contents).not.toMatch(/href=["'`]\/admin\/geometry-test/);
      expect(contents).not.toMatch(/href=["'`]\/admin\/gbp-photos/);
    }
  });
});

describe('Building Codes moved off the Command Center', () => {
  it('has no admin page left', () => {
    expect(existsSync(join(REPO_ROOT, 'app', 'admin', 'building-codes', 'page.tsx'))).toBe(false);
  });

  it('has a public page under Resources', () => {
    expect(
      existsSync(join(REPO_ROOT, 'app', '(public)', 'resources', 'building-codes', 'page.tsx'))
    ).toBe(true);
  });

  it('is listed in the public Resources menu', () => {
    const navBar = readFileSync(join(REPO_ROOT, 'components', 'layout', 'NavBar.tsx'), 'utf8');
    expect(navBar).toContain("href: '/resources/building-codes'");
  });
});
