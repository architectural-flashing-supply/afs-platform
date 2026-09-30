import { createClient } from '@supabase/supabase-js';

/**
 * The service-role Supabase client. Server-side only — this key bypasses RLS
 * and must never reach a client bundle.
 *
 * ================== WHY IT PASSES `cache: 'no-store'` ==================
 *
 * Next.js PATCHES global `fetch` and caches GET responses in its Data Cache.
 * supabase-js does its reads with `fetch`, so two identical PostgREST GETs
 * inside a route can be served the FIRST one's body — and a row that changed in
 * between is simply not seen.
 *
 * That is not hypothetical. It was diagnosed live on alpha (2026-09-30) by the
 * v2-03 end-to-end test: the Approve link's EXPIRED case read the token row,
 * the test then put the row's expiry back, and the VALID case that followed
 * kept being told the link had expired. The database was right and the test was
 * right; the route was reading a cached row. Every symptom pointed at a date
 * bug, and it was not one.
 *
 * The service role exists precisely to read and write authoritative state —
 * whether a single-use token has been spent, what stage a job is at, whether an
 * invoice already exists. A cached answer to any of those is a wrong answer, so
 * this client never takes one. `cache: 'no-store'` is set on every request it
 * makes, which opts each one out of the Data Cache regardless of the route's
 * own `dynamic` setting.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  );
}
