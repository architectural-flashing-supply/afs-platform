import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import ProfileSearchPanel from '@/components/admin/ProfileSearchPanel';

/**
 * FIND A PAST PROFILE — the profile rail.
 *
 * MOVED from /admin/search to /admin/search/profiles in v7 Stage D. v7's
 * Search screen (`pageSearch()`, prototype line 1667) searches QUOTES AND
 * ORDERS, and that is what /admin/search now is; this answers a different
 * question — "what have we drawn before?" — and keeps its own route rather than
 * being squeezed into the same page.
 *
 * CLAUDE.md rule #27 is intact. It requires ONE profile query
 * (`admin_profile_search`) and ONE panel (ProfileSearchPanel), mounted at the
 * Search screen and inside FlashDraft's `?admin=1` drawer. Both still hold —
 * only the URL of the first mount point changed, and the new Search page links
 * straight here.
 *
 * v2-01 shipped this as an honest interim: a plain table, with its own comment
 * saying the approved prototype's thumbnail rail and hover preview were
 * Phase 6. This is Phase 6 (prompt v2-05). The QUERY did not change — it is
 * still `admin_profile_search` (migration 029, commit 1646746) behind
 * /api/admin/command-center/profile-search. Only the presentation did, which is
 * exactly what the interim version promised would happen.
 *
 * The page is a thin server shell: it checks admin (on top of the /admin tree's
 * own gate, and on top of the SQL function re-checking for itself), converts to
 * the light working area, and hands the initial query to the client panel. It
 * renders no results itself, so there is no server-rendered payload here to
 * carry an image.
 */
export const metadata: Metadata = {
  title: 'Find a past profile | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminProfileSearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const raw = searchParams.q;
  const initialQuery = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  return (
    <LightWorkingArea>
      <Link href="/admin/search" className="crumb">
        &larr; Back to Search
      </Link>
      <div className="greet">
        <div>
          <h1 className="t">Find a past profile</h1>
          <p className="sub">
            Search everything AFS has drawn. Pick one and it opens in FlashDraft as a new draft — the
            profile you picked is never changed.
          </p>
        </div>
      </div>

      <ProfileSearchPanel initialQuery={initialQuery} />
    </LightWorkingArea>
  );
}
