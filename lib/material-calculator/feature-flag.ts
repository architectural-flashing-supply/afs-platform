/**
 * AUTO MATERIAL CALCULATOR — THE FEATURE GATE. DEFAULT OFF.
 *
 * The §3 calculator section is additive to a quote wizard that is already live
 * and already submitting real RFQs. With this gate off, Step 3 renders exactly
 * what it rendered before the section existed and the submitted request body is
 * byte-identical — the section returns null and its contribution to the `notes`
 * string is null, which app/quote/page.tsx's pre-existing `.filter(Boolean)`
 * drops.
 *
 * WHY `NEXT_PUBLIC_`. app/quote/page.tsx is a client component ('use client'),
 * so the value has to survive into the browser bundle, and Next.js only inlines
 * `NEXT_PUBLIC_`-prefixed variables. A server-only name would read `undefined` in
 * the browser and the gate would appear permanently stuck off. Do not "tidy" the
 * prefix away.
 *
 * AND WHY THE DEFAULT READ IS A LITERAL `process.env.NEXT_PUBLIC_...` MEMBER
 * EXPRESSION, NOT A DEFAULT PARAMETER OF `= process.env`.
 *
 * That is not a style preference. The first version of this file had
 * `env: MaterialCalculatorEnv = process.env` and read `env.NEXT_PUBLIC_...`, and the
 * gate was PERMANENTLY STUCK OFF in the browser even with the variable set at build
 * time. Next.js inlines these through webpack's DefinePlugin, which performs a
 * TEXTUAL substitution of the exact expression `process.env.NEXT_PUBLIC_<NAME>`. It
 * cannot follow `process.env` through an assignment, a parameter default or a cast,
 * so in the client bundle `process.env` is an empty object and every lookup on it is
 * `undefined`.
 *
 * Caught by running the gate-on Playwright spec against a real
 * `NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR=1` build — which is the only thing that could
 * have caught it. `tsc`, the unit tests (which inject `env`) and the gate-off specs
 * were all green while the feature was unreachable.
 *
 * The injected `env` parameter is kept for the tests, the same shape
 * lib/fixtures/mode.ts uses, so feature-flag.test.ts can exercise every value
 * without mutating the process — but it is explicitly optional now, and the
 * production path does not go through it.
 *
 * EXACTLY ONE STRING TURNS IT ON. '1'. Not 'true', not 'yes', not 'on' — a gate
 * with several spellings is a gate somebody enables by accident.
 */

export const MATERIAL_CALCULATOR_FLAG = 'NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR';

export interface MaterialCalculatorEnv {
  NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR?: string;
}

export function isMaterialCalculatorEnabled(env?: MaterialCalculatorEnv): boolean {
  // The else branch MUST stay a literal `process.env.NEXT_PUBLIC_...` member
  // expression for webpack's DefinePlugin to substitute it. See the header.
  const value = env
    ? env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR
    : process.env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR;
  return value === '1';
}
