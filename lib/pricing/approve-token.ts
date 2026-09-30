/**
 * THE APPROVE BUTTON'S LINK — signed, single-use, expiring.
 *
 * This module does the SIGNING and the STATELESS half of verification. The
 * single-use half needs the database (a token is spent by
 * `quote_approval_tokens.used_at`), and lives in
 * app/api/quote-approve/[token]/route.ts, which calls `verifyApproveToken`
 * first and only then looks the hash up.
 *
 * ============ THIS IS NOT A PATHFINDEREDGE BYPASS. READ WHY. ============
 *
 * CLAUDE.md rule #14: only a Command Center approval that
 * `pushProfileToPathfinder` VERIFIES IN THE DATABASE may reach catalog 20115.
 * Clicking Approve in the quote email CREATES that record — it sets
 * `quote_requests.job_stage='approved'` and `approval_channel='email'`, and it
 * deliberately LEAVES `status='submitted'` alone so the guard's own condition
 * still holds when an admin later presses "Send to machine". It imports nothing
 * from lib/integrations/pathfinder-edge.ts and makes no outbound request. It is
 * the same contract as approve-by-phone, for the same reason: the customer
 * saying yes is a fact about the approval, not a way around needing one.
 *
 * ============ THE TOKEN ============
 *
 *   <payloadB64url>.<hmacB64url>
 *
 * The payload is `{ q: quoteId, e: expiryEpochSeconds, n: nonce }`, JSON, base64url.
 * The MAC is HMAC-SHA256 over the payload string with the server secret. The
 * signature is compared with `timingSafeEqual`.
 *
 * WHY THE PAYLOAD IS READABLE. It carries nothing secret — a quote id and an
 * expiry — and being readable means an expired link can be told apart from a
 * forged one, so the page can say "this link has expired, ask for a new one"
 * instead of a blank refusal. The MAC is what makes it unforgeable; hiding the
 * quote id would add nothing.
 *
 * WHY THE NONCE. Two links for the same quote with the same expiry would
 * otherwise be the same string, and "single use" would silently mean "single
 * use per second".
 *
 * ============ THE SECRET ============
 *
 * `QUOTE_APPROVE_SECRET` if it is set. Otherwise it is DERIVED from
 * `SUPABASE_SERVICE_ROLE_KEY` via HMAC with a fixed, non-secret label — a
 * standard key-separation construction, so the derived key cannot be used to
 * impersonate the service role and the service role cannot be recovered from
 * it. The service-role key is already required server-side everywhere in this
 * app and is never in the client bundle, which makes it a real secret that is
 * certain to be present; requiring a brand-new env var would have meant the
 * Approve button silently not working on any deployment where somebody forgot
 * to add it. Set `QUOTE_APPROVE_SECRET` to rotate every outstanding link at
 * once.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A link is good for this long unless the caller says otherwise. */
export const DEFAULT_APPROVE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const KEY_DERIVATION_LABEL = 'afs-quote-approve-token-v1';

export interface ApproveTokenPayload {
  quoteId: string;
  expiresAt: Date;
}

export type ApproveTokenVerdict =
  | { ok: true; quoteId: string; expiresAt: Date; tokenHash: string }
  | { ok: false; reason: 'malformed' | 'tampered' | 'expired'; message: string };

/**
 * Only the two variables this module reads. Narrower than `NodeJS.ProcessEnv`
 * on purpose: a test can hand in exactly the environment it means to test,
 * without having to fabricate a whole process environment around it.
 */
export interface ApproveTokenEnv {
  QUOTE_APPROVE_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** So `process.env` itself is assignable; nothing else here is read. */
  [key: string]: string | undefined;
}

/** Resolves the signing secret. Throws rather than signing with nothing. */
export function approveTokenSecret(env: ApproveTokenEnv = process.env): string {
  const explicit = env.QUOTE_APPROVE_SECRET;
  if (explicit && explicit.trim() !== '') return explicit.trim();

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && serviceKey.trim() !== '') {
    return createHmac('sha256', serviceKey.trim()).update(KEY_DERIVATION_LABEL).digest('hex');
  }

  throw new Error(
    'Cannot sign an approve link: neither QUOTE_APPROVE_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set.'
  );
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

function mac(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

/**
 * The value stored in `quote_approval_tokens.token_hash`. A SHA-256-strength
 * HMAC of the whole token under the same secret — so the table never holds
 * anything that could be replayed, and a stolen database dump approves nothing.
 */
export function approveTokenHash(token: string, secret: string = approveTokenSecret()): string {
  return createHmac('sha256', secret).update(`hash:${token}`).digest('hex');
}

export function signApproveToken(
  quoteId: string,
  opts: { ttlSeconds?: number; now?: Date; nonce?: string; secret?: string } = {}
): { token: string; tokenHash: string; expiresAt: Date } {
  if (typeof quoteId !== 'string' || quoteId.trim() === '') {
    throw new Error('signApproveToken needs a quote id.');
  }
  const secret = opts.secret ?? approveTokenSecret();
  const now = opts.now ?? new Date();
  const ttl = opts.ttlSeconds ?? DEFAULT_APPROVE_TOKEN_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  // Deliberately not Math.random: a predictable nonce would let two links for
  // the same quote collide, which is the thing the nonce exists to stop.
  const nonce = opts.nonce ?? b64url(randomBytes(12));

  const payload = b64url(
    Buffer.from(JSON.stringify({ q: quoteId, e: Math.floor(expiresAt.getTime() / 1000), n: nonce }), 'utf8')
  );
  const token = `${payload}.${b64url(mac(payload, secret))}`;
  return { token, tokenHash: approveTokenHash(token, secret), expiresAt };
}

/**
 * The STATELESS checks: shape, signature, expiry — in that order, because a
 * tampered token's claimed expiry must never be believed.
 *
 * Single use is NOT checked here. It cannot be: it is a fact about the
 * database, and the route checks it against `quote_approval_tokens.used_at`
 * immediately after this returns ok.
 */
export function verifyApproveToken(
  token: string,
  opts: { now?: Date; secret?: string } = {}
): ApproveTokenVerdict {
  const secret = opts.secret ?? approveTokenSecret();
  const now = opts.now ?? new Date();

  if (typeof token !== 'string' || token.trim() === '') {
    return { ok: false, reason: 'malformed', message: 'That approval link is not complete.' };
  }
  const parts = token.split('.');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return { ok: false, reason: 'malformed', message: 'That approval link is not complete.' };
  }
  const [payloadPart, signaturePart] = parts;

  const expected = mac(payloadPart, secret);
  const actual = fromB64url(signaturePart);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return {
      ok: false,
      reason: 'tampered',
      message: 'That approval link has been altered, so it cannot be used. Ask us to send the quote again.',
    };
  }

  let parsed: { q?: unknown; e?: unknown };
  try {
    parsed = JSON.parse(fromB64url(payloadPart).toString('utf8')) as { q?: unknown; e?: unknown };
  } catch {
    return { ok: false, reason: 'malformed', message: 'That approval link is not readable.' };
  }
  if (typeof parsed.q !== 'string' || typeof parsed.e !== 'number' || !Number.isFinite(parsed.e)) {
    return { ok: false, reason: 'malformed', message: 'That approval link is not readable.' };
  }

  const expiresAt = new Date(parsed.e * 1000);
  if (now.getTime() > expiresAt.getTime()) {
    return {
      ok: false,
      reason: 'expired',
      message: 'That approval link has expired. Ask us to send the quote again and we will email a fresh one.',
    };
  }

  return { ok: true, quoteId: parsed.q, expiresAt, tokenHash: approveTokenHash(token, secret) };
}

/** The absolute URL that goes in the email. */
export function approveLinkUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/api/quote-approve/${encodeURIComponent(token)}`;
}

/**
 * THE SINGLE-USE HALF, as a pure decision over the stored record.
 *
 * `verifyApproveToken` above proves the link is genuine and in date. This
 * decides whether the token row it points at may still be spent. The route does
 * both, in that order, and does nothing else — which is what makes "single use"
 * testable without a database.
 *
 * `null` for the record means the signature was valid but no such token exists.
 * That is not a normal outcome: it means the quote (and its tokens) was
 * deleted, or the signing secret was rotated after this link was sent.
 */
export type RedeemVerdict =
  | { ok: true }
  | { ok: false; reason: 'unknown' | 'used' | 'expired'; message: string };

export interface ApproveTokenRecord {
  expiresAt: string | Date;
  usedAt: string | Date | null;
}

export function redeemVerdict(record: ApproveTokenRecord | null, now: Date = new Date()): RedeemVerdict {
  if (!record) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'We could not find that approval link. Ask us to send the quote again.',
    };
  }
  if (record.usedAt !== null && record.usedAt !== undefined) {
    return {
      ok: false,
      reason: 'used',
      message: 'This quote has already been approved — thank you. There is nothing more to do.',
    };
  }
  const expiresAt = record.expiresAt instanceof Date ? record.expiresAt : new Date(record.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || now.getTime() > expiresAt.getTime()) {
    return {
      ok: false,
      reason: 'expired',
      message: 'That approval link has expired. Ask us to send the quote again and we will email a fresh one.',
    };
  }
  return { ok: true };
}
