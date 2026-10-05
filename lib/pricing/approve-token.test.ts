import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  signApproveToken,
  verifyApproveToken,
  approveTokenHash,
  approveTokenSecret,
  approveLinkUrl,
  redeemVerdict,
  DEFAULT_APPROVE_TOKEN_TTL_SECONDS,
} from './approve-token';

/**
 * THE SIGNED, SINGLE-USE, EXPIRING APPROVE LINK.
 *
 * The four cases the v2-03 gate names — VALID, EXPIRED, REUSED and TAMPERED —
 * are each proved here. Two of them are stateless (expiry, tampering) and are
 * decided by `verifyApproveToken`; REUSED is a fact about the stored token row
 * and is decided by `redeemVerdict`. The route does both, in that order, and
 * nothing else, which is what lets all four be tested without a database.
 */

const SECRET = 'test-secret-not-the-real-one';
const QUOTE_ID = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-09-30T12:00:00.000Z');

describe('the secret', () => {
  it('uses QUOTE_APPROVE_SECRET when it is set', () => {
    expect(approveTokenSecret({ QUOTE_APPROVE_SECRET: ' abc ' })).toBe('abc');
  });

  it('derives a SEPARATE key from the service-role key when it is not', () => {
    const serviceKey = 'service-role-key-value';
    const derived = approveTokenSecret({ SUPABASE_SERVICE_ROLE_KEY: serviceKey });
    expect(derived).toHaveLength(64); // hex sha256
    // Key separation: the signing key is not the service-role key, so a leaked
    // signing key cannot be used as the service role.
    expect(derived).not.toBe(serviceKey);
    expect(derived).not.toContain(serviceKey);
  });

  it('is stable, so a link signed yesterday still verifies today', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'k' };
    expect(approveTokenSecret(env)).toBe(approveTokenSecret(env));
  });

  it('refuses to sign with nothing rather than signing with an empty key', () => {
    expect(() => approveTokenSecret({})).toThrow(/neither QUOTE_APPROVE_SECRET/);
  });
});

describe('VALID', () => {
  it('a freshly signed link verifies and returns its quote id', () => {
    const { token } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    const verdict = verifyApproveToken(token, { secret: SECRET, now: NOW });
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.quoteId).toBe(QUOTE_ID);
  });

  it('defaults to a 30-day life', () => {
    const { expiresAt } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    expect(expiresAt.getTime() - NOW.getTime()).toBe(DEFAULT_APPROVE_TOKEN_TTL_SECONDS * 1000);
  });

  it('verifies right up to the last second of its life', () => {
    const { token, expiresAt } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW, ttlSeconds: 60 });
    expect(verifyApproveToken(token, { secret: SECRET, now: expiresAt }).ok).toBe(true);
  });

  it('stores only a HASH, so the table never holds anything replayable', () => {
    const { token, tokenHash } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toContain(token);
    expect(token).not.toContain(tokenHash);
    expect(approveTokenHash(token, SECRET)).toBe(tokenHash);
  });

  it('gives two links for the same quote different values, so single-use means single-use', () => {
    const a = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    const b = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('builds the link against the canonical site URL, with no double slash', () => {
    expect(approveLinkUrl('https://afs-website-alpha.vercel.app/', 'abc.def')).toBe(
      'https://afs-website-alpha.vercel.app/api/quote-approve/abc.def'
    );
  });
});

describe('EXPIRED — rejected', () => {
  it('rejects a link one second past its expiry', () => {
    const { token, expiresAt } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW, ttlSeconds: 60 });
    const verdict = verifyApproveToken(token, { secret: SECRET, now: new Date(expiresAt.getTime() + 1000) });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('expired');
    expect(verdict.message).toContain('expired');
    expect(verdict.message).toContain('send the quote again');
  });

  it('rejects a long-expired link', () => {
    const { token } = signApproveToken(QUOTE_ID, { secret: SECRET, now: new Date('2026-01-01T00:00:00.000Z') });
    const verdict = verifyApproveToken(token, { secret: SECRET, now: new Date('2027-01-01T00:00:00.000Z') });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('expired');
  });

  it('rejects an expired STORED token too, so a row that outlived its link cannot be spent', () => {
    const verdict = redeemVerdict({ expiresAt: '2026-09-01T00:00:00.000Z', usedAt: null }, NOW);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('expired');
  });

  it('checks the signature BEFORE the expiry, so a forged expiry is never believed', () => {
    // A token whose payload claims a far-future expiry but was signed with a
    // different key must come back 'tampered', not 'ok'.
    const { token } = signApproveToken(QUOTE_ID, { secret: 'attacker-key', now: NOW, ttlSeconds: 10 ** 9 });
    const verdict = verifyApproveToken(token, { secret: SECRET, now: NOW });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('tampered');
  });
});

describe('REUSED — rejected', () => {
  it('rejects a token that has already been spent', () => {
    const verdict = redeemVerdict(
      { expiresAt: '2026-12-31T00:00:00.000Z', usedAt: '2026-09-20T10:00:00.000Z' },
      NOW
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('used');
    // A customer clicking their own link twice is not an error, and is not told
    // it is one.
    expect(verdict.message).toContain('already been approved');
  });

  it('accepts an unused, in-date token exactly once', () => {
    const record = { expiresAt: '2026-12-31T00:00:00.000Z', usedAt: null as string | null };
    expect(redeemVerdict(record, NOW).ok).toBe(true);
    record.usedAt = NOW.toISOString(); // the route stamps it
    expect(redeemVerdict(record, NOW).ok).toBe(false);
  });

  it('rejects a signature-valid token with no row behind it', () => {
    const verdict = redeemVerdict(null, NOW);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('unknown');
  });

  it('treats an unreadable stored expiry as expired, not as valid', () => {
    const verdict = redeemVerdict({ expiresAt: 'not a date', usedAt: null }, NOW);
    expect(verdict.ok).toBe(false);
  });
});

describe('TAMPERED — rejected', () => {
  function tamper(token: string, replacement: string): string {
    const sig = token.split('.')[1];
    return `${replacement}.${sig}`;
  }

  it('rejects a swapped quote id', () => {
    const { token } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    const forgedPayload = Buffer.from(
      JSON.stringify({ q: '99999999-9999-9999-9999-999999999999', e: 4102444800, n: 'x' }),
      'utf8'
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const verdict = verifyApproveToken(tamper(token, forgedPayload), { secret: SECRET, now: NOW });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('tampered');
  });

  it('rejects a single flipped character in the signature', () => {
    const { token } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    const dot = token.lastIndexOf('.');
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);

    // FLIP A CHARACTER IN THE MIDDLE, NOT THE LAST ONE — and this is the whole
    // point of the test rather than a detail.
    //
    // This used to flip the token's FINAL character ('A' <-> 'B') and failed
    // intermittently. It was never flaky: it was deterministically wrong
    // whenever the signature ended in a character whose flip the decoder throws
    // away. base64url packs 6 bits per character, but the signature is a
    // 32-byte HMAC — 256 bits — and 43 characters carry 258. The final
    // character therefore has TWO bits that decode to nothing, and 'A'
    // (000000) and 'B' (000001) differ only in the lowest of them. The bytes
    // come out identical, the signature still verifies, and the test fails
    // having tampered with nothing. The nonce is random, so the final character
    // differs run to run — which is what made a deterministic bug look
    // intermittent.
    //
    // A character in the middle has all six bits inside the decoded bytes, so
    // flipping one always changes them.
    const i = Math.floor(signature.length / 2);
    const flippedSignature =
      signature.slice(0, i) + (signature[i] === 'A' ? 'B' : 'A') + signature.slice(i + 1);

    // PROVE IT. The test asserts that the edit really changed the signature's
    // bytes before asserting that verification rejects it — so it can never
    // again pass or fail on a character the decoder ignores.
    const decode = (b64: string): Buffer =>
      Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    expect(flippedSignature).not.toBe(signature);
    expect(decode(flippedSignature).equals(decode(signature))).toBe(false);

    const verdict = verifyApproveToken(`${payload}.${flippedSignature}`, {
      secret: SECRET,
      now: NOW,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('tampered');
  });

  it('rejects a token signed with the wrong key', () => {
    const { token } = signApproveToken(QUOTE_ID, { secret: 'some-other-secret', now: NOW });
    const verdict = verifyApproveToken(token, { secret: SECRET, now: NOW });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('tampered');
  });

  it('rejects a truncated signature without throwing on the length mismatch', () => {
    const { token } = signApproveToken(QUOTE_ID, { secret: SECRET, now: NOW });
    const [payload, sig] = token.split('.');
    const verdict = verifyApproveToken(`${payload}.${sig.slice(0, 10)}`, { secret: SECRET, now: NOW });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('tampered');
  });

  it('rejects malformed shapes rather than crashing', () => {
    for (const bad of ['', '   ', 'nodot', 'a.b.c', '.sig', 'payload.']) {
      const verdict = verifyApproveToken(bad, { secret: SECRET, now: NOW });
      expect(verdict.ok).toBe(false);
    }
  });

  it('rejects a payload that is valid base64 but not the expected object', () => {
    const payload = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    // Sign it properly, so the ONLY thing wrong is the shape.
    const sig = createHmac('sha256', SECRET)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const verdict = verifyApproveToken(`${payload}.${sig}`, { secret: SECRET, now: NOW });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe('malformed');
  });
});
