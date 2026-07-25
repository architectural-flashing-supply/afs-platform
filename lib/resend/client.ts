// Configuration only. No `resend` npm package is added — matching
// lib/twilio/sms.ts's existing precedent in this codebase (a single POST to
// a REST endpoint doesn't need an SDK). lib/resend/send.ts calls Resend's
// REST API directly via fetch instead.
//
// Despite CLAUDE.md/ARCHITECTURE.md documenting Resend as an already-wired
// integration, no lib/resend/ files existed anywhere in this codebase before
// this build (verified by grep) — every existing "email notification" call
// site (e.g. app/api/admin/orders/[id]/status/route.ts) only inserts a
// `notifications` row with status:'sent'; none of them call a real provider.
// This is a real implementation, not another log-only stub.
export const RESEND_API_URL = 'https://api.resend.com/emails';
export const FROM_NAME = 'AFS Architectural Flashing Supply';
