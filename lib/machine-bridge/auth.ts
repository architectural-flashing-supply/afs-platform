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
