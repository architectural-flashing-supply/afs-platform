import { describe, expect, it } from 'vitest';
import { fixtureHref, isFixtureModeFor } from '@/lib/fixtures/mode';

/**
 * FIXTURE MODE MUST BE UNREACHABLE IN PRODUCTION.
 *
 * Each of the three locks is tested on its own, with the other two open, so a
 * change that quietly drops one fails here rather than in a deployment. The
 * production case is tested twice over: with the env var set (the only
 * combination that could happen by accident) and with the parameter present.
 */
const dev = { CC_FIXTURE: '1', NODE_ENV: 'development' };
const on = { fixture: 'v7' };

describe('isFixtureModeFor', () => {
  it('is on only when all three locks are open', () => {
    expect(isFixtureModeFor(on, dev)).toBe(true);
  });

  it('REFUSES in a production build even with the env var and the parameter set', () => {
    expect(isFixtureModeFor(on, { CC_FIXTURE: '1', NODE_ENV: 'production' })).toBe(false);
  });

  it('refuses without CC_FIXTURE=1', () => {
    expect(isFixtureModeFor(on, { NODE_ENV: 'development' })).toBe(false);
    expect(isFixtureModeFor(on, { CC_FIXTURE: '0', NODE_ENV: 'development' })).toBe(false);
    expect(isFixtureModeFor(on, { CC_FIXTURE: 'true', NODE_ENV: 'development' })).toBe(false);
  });

  it('refuses without ?fixture=v7 on the URL', () => {
    expect(isFixtureModeFor(undefined, dev)).toBe(false);
    expect(isFixtureModeFor({}, dev)).toBe(false);
    expect(isFixtureModeFor({ fixture: '1' }, dev)).toBe(false);
    expect(isFixtureModeFor({ fixture: 'V7' }, dev)).toBe(false);
    expect(isFixtureModeFor({ fixtures: 'v7' }, dev)).toBe(false);
  });

  it('accepts a duplicated parameter, because a redirect can produce one', () => {
    expect(isFixtureModeFor({ fixture: ['a', 'v7'] }, dev)).toBe(true);
    expect(isFixtureModeFor({ fixture: ['a', 'b'] }, dev)).toBe(false);
  });

  it('treats test as a non-production environment, so the gate can run under vitest', () => {
    expect(isFixtureModeFor(on, { CC_FIXTURE: '1', NODE_ENV: 'test' })).toBe(true);
  });
});

describe('fixtureHref', () => {
  it('adds nothing when fixture mode is off', () => {
    expect(fixtureHref('/admin/quotes', false)).toBe('/admin/quotes');
    expect(fixtureHref('/admin/quotes?stage=new', false)).toBe('/admin/quotes?stage=new');
  });

  it('carries the parameter across an internal link when on', () => {
    expect(fixtureHref('/admin/quotes', true)).toBe('/admin/quotes?fixture=v7');
    expect(fixtureHref('/admin/quotes?stage=new', true)).toBe('/admin/quotes?stage=new&fixture=v7');
  });
});
