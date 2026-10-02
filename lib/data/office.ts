/**
 * THE OFFICE ADDRESSES, named once.
 *
 * Every approved invoice is emailed to the office automatically, and a wrong
 * auto-invoice address is a live-money error, so the address lives in exactly
 * one place and everything reads it from here.
 *
 * THE SPELLING IS `trica@`, NOT `tricia@`. Reid confirmed this on 2026-10-01,
 * REVERSING the 2026-09-30 decision that had been recorded in
 * docs/COMMAND_CENTER_V2_SPEC.md §1. The prototype's `TRICIA` constant was
 * right all along; the earlier "correction" to `tricia@` was the error, and it
 * had been propagated to 31 places across code, docs and tests before this was
 * caught. Do not "fix" it back without Reid saying so in writing — this comment
 * exists precisely because the obvious-looking spelling is the wrong one.
 *
 * `INVOICE_OFFICE_EMAIL` in the environment overrides it, for the day somebody
 * other than Tricia handles invoicing. It is not set today, and the default is
 * the real address rather than an empty string, so the automatic copy works out
 * of the box on every deployment.
 */
export const OFFICE_INVOICE_EMAIL_DEFAULT = 'trica@architecturalflashingsupply.com';

export function officeInvoiceEmail(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.INVOICE_OFFICE_EMAIL;
  return override && override.trim() !== '' ? override.trim() : OFFICE_INVOICE_EMAIL_DEFAULT;
}

/** The shop owner. Always copied on new-opportunity alerts; see lib/bid-monitor/alerts.ts. */
export const OWNER_EMAIL = 'steve@architecturalflashingsupply.com';
