/**
 * QuickBooks Online integration stub.
 *
 * SPEC_QUICKBOOKS_INTEGRATION.md is a CONDITIONAL build — blocked on client
 * confirmation of QBO subscription, sync scope, and connection ownership
 * (checklist #52-54). Nothing here talks to the QBO API yet. Every export
 * returns a stable "not_configured" result so callers (admin UI, future
 * webhook triggers) have a real interface to build against without any
 * network calls happening.
 */

export type QuickBooksStatus = 'not_configured' | 'connected' | 'error';

export interface QuickBooksResult {
  status: QuickBooksStatus;
  message: string;
}

const NOT_CONFIGURED: QuickBooksResult = {
  status: 'not_configured',
  message: 'QuickBooks integration not yet activated',
};

export async function connectQuickBooks(): Promise<QuickBooksResult> {
  return NOT_CONFIGURED;
}

export async function syncInvoice(_orderId: string): Promise<QuickBooksResult> {
  return NOT_CONFIGURED;
}

export async function syncCustomer(_profileId: string): Promise<QuickBooksResult> {
  return NOT_CONFIGURED;
}

export async function getConnectionStatus(): Promise<QuickBooksResult> {
  return NOT_CONFIGURED;
}
