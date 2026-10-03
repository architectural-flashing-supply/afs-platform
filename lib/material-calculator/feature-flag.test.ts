import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MATERIAL_CALCULATOR_FLAG, isMaterialCalculatorEnabled } from './feature-flag';

/**
 * THE FEATURE GATE.
 *
 * The §3 calculator section is additive to a quote wizard that is already live and
 * already submitting real RFQs, so it ships OFF. The only thing that matters about
 * this function is that it is off unless somebody deliberately turned it on —
 * every near-miss spelling below is a way a half-finished configuration could
 * accidentally publish an unreviewed section to customers.
 */
describe('isMaterialCalculatorEnabled — default OFF', () => {
  it('is off when the variable is absent entirely', () => {
    // ARRANGE — a fresh deployment with nothing set
    // ACT
    const enabled = isMaterialCalculatorEnabled({});

    // ASSERT
    expect(
      enabled,
      `With ${MATERIAL_CALCULATOR_FLAG} unset the calculator must be off, so /quote renders ` +
        `exactly what it rendered before this section existed. A gate that defaults on is ` +
        `not a gate.`
    ).toBe(false);
  });

  it('is off when the variable is explicitly undefined', () => {
    // ARRANGE / ACT
    const enabled = isMaterialCalculatorEnabled({ NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR: undefined });

    // ASSERT
    expect(enabled, 'An explicitly undefined value must behave as absent.').toBe(false);
  });

  it('is ON for exactly the string "1"', () => {
    // ARRANGE / ACT
    const enabled = isMaterialCalculatorEnabled({ NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR: '1' });

    // ASSERT
    expect(
      enabled,
      `"1" is the one value that turns the section on. If this is false the gate can never ` +
        `be opened and the feature is unreachable.`
    ).toBe(true);
  });

  const nearMisses: readonly string[] = ['', '0', 'true', 'TRUE', 'True', 'yes', 'on', 'enabled', '1 ', ' 1', '01', '2'];

  for (const value of nearMisses) {
    it(`is off for ${JSON.stringify(value)}`, () => {
      // ARRANGE / ACT
      const enabled = isMaterialCalculatorEnabled({
        NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR: value,
      });

      // ASSERT
      expect(
        enabled,
        `${JSON.stringify(value)} must NOT enable the calculator. A gate with several ` +
          `spellings is a gate somebody opens by accident — and "true" and "yes" are the ` +
          `two most likely accidents.`
      ).toBe(false);
    });
  }

  it('names the environment variable with the NEXT_PUBLIC_ prefix', () => {
    // ARRANGE — app/quote/page.tsx is a client component, and Next.js only inlines
    // NEXT_PUBLIC_-prefixed variables into the browser bundle. A server-only name
    // would read undefined in the browser and the gate would look permanently stuck.
    // ACT / ASSERT
    expect(
      MATERIAL_CALCULATOR_FLAG,
      `The flag must keep its NEXT_PUBLIC_ prefix or the client component that reads it ` +
        `always sees undefined. Got "${MATERIAL_CALCULATOR_FLAG}".`
    ).toBe('NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR');
  });

  /**
   * THE REGRESSION TEST FOR A BUG THAT MADE THE WHOLE FEATURE UNREACHABLE.
   *
   * The first version read `env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR` through a
   * parameter defaulted to `process.env`. Webpack's DefinePlugin substitutes the
   * TEXT `process.env.NEXT_PUBLIC_<NAME>` and cannot follow `process.env` through an
   * assignment, a default or a cast — so in the browser bundle `process.env` was `{}`
   * and the gate was stuck off even with the variable set at build time. tsc was
   * clean, every unit test here passed (they inject `env`), and only a gate-on
   * Playwright run against a real build found it.
   */
  it('reads the flag as a literal process.env member expression, so webpack can inline it', () => {
    // ARRANGE
    const source = readFileSync(join(process.cwd(), 'lib', 'material-calculator', 'feature-flag.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // ACT / ASSERT
    expect(
      code.includes('process.env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR'),
      'feature-flag.ts must contain the literal expression ' +
        '`process.env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR`. Webpack substitutes that exact ' +
        'text; anything that reaches the value indirectly reads undefined in the browser ' +
        'and the gate can never be opened.'
    ).toBe(true);
    expect(
      /=\s*process\.env\s*[;)as]/.test(code),
      'feature-flag.ts must NOT assign or default a variable to bare `process.env`. That is ' +
        'precisely the form that defeated DefinePlugin and made the feature unreachable.'
    ).toBe(false);
  });

  it('is off in this test process, proving the repository default is off', () => {
    // ARRANGE — no injected env: reads the real process.env
    // ACT
    const enabled = isMaterialCalculatorEnabled();

    // ASSERT
    expect(
      enabled,
      `Nothing checked into this repository may set ${MATERIAL_CALCULATOR_FLAG}=1. If this ` +
        `fails, the flag has been committed to a .env file that the test process loads, and ` +
        `the gate is open by default.`
    ).toBe(false);
  });
});
