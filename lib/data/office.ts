/**
 * THE OFFICE ADDRESSES, named once.
 *
 * Every approved invoice is emailed to the office automatically. That address
 * was hardcoded, misspelled, in the approved prototype (`TRICIA`, line 233 —
 * a missing `i`), and a wrong auto-invoice address is a live-money error, so
 * the correct spelling now lives in exactly one place and everything reads it
 * from here. Reid confirmed it on 2026-09-30; see
 * docs/COMMAND_CENTER_V2_SPEC.md §1 "SETTLED — Tricia's address".
 *
 * `INVOICE_OFFICE_EMAIL` in the environment overrides it, for the day somebody
 * other than Tricia handles invoicing. It is not set today, and the default is
 * the real address rather than an empty string, so the automatic copy works out
 * of the box on every deployment.
 */
export const OFFICE_INVOICE_EMAIL_DEFAULT = 'tricia@architecturalflashingsupply.com';

export function officeInvoiceEmail(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.INVOICE_OFFICE_EMAIL;
  return override && override.trim() !== '' ? override.trim() : OFFICE_INVOICE_EMAIL_DEFAULT;
}

/** The shop owner. Always copied on new-opportunity alerts; see lib/bid-monitor/alerts.ts. */
export const OWNER_EMAIL = 'steve@architecturalflashingsupply.com';
