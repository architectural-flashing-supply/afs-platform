import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * The Machine Bridge is a standalone service polling from a shop-floor
 * computer, not a logged-in Supabase user — it authenticates with a shared
 * Bearer secret (AFS_BRIDGE_SECRET) instead of a session.
 */
export function isAuthorizedBridgeRequest(request: NextRequest): boolean {
  const secret = process.env.AFS_BRIDGE_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length) return false;

  return timingSafeEqual(tokenBuf, secretBuf);
}

/**
 * Logs enough to tell apart "AFS_BRIDGE_SECRET unset on this deployment"
 * from "a request came in without/with a mismatched Bearer token" —
 * from Vercel's function logs alone, a bare 401 doesn't distinguish those.
 * Never logs the secret value or the raw Authorization header content,
 * only presence/length, so this is safe to leave on in production.
 */
export function logBridgeAuthFailure(request: NextRequest, path: string): void {
  const secret = process.env.AFS_BRIDGE_SECRET;
  const authHeader = request.headers.get('authorization');
  console.warn('[machine-bridge auth] rejected request', {
    path,
    timestamp: new Date().toISOString(),
    secretIsSet: !!secret,
    secretLength: secret?.length ?? 0,
    authHeaderPresent: !!authHeader,
  });
}
