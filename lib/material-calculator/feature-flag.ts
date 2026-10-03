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
 * The env object is injected rather than read from `process.env` at module scope,
 * the same shape lib/fixtures/mode.ts uses, so feature-flag.test.ts can exercise
 * every value without mutating the process.
 *
 * EXACTLY ONE STRING TURNS IT ON. '1'. Not 'true', not 'yes', not 'on' — a gate
 * with several spellings is a gate somebody enables by accident.
 */

export const MATERIAL_CALCULATOR_FLAG = 'NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR';

export interface MaterialCalculatorEnv {
  NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR?: string;
}

export function isMaterialCalculatorEnabled(
  env: MaterialCalculatorEnv = process.env as MaterialCalculatorEnv
): boolean {
  return env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR === '1';
}
