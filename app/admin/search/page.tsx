import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import ProfileSearchPanel from '@/components/admin/ProfileSearchPanel';

/**
 * FIND A PAST PROFILE — the Command Center's Search screen, and the
 * destination of the header's search box.
 *
 * v2-01 shipped this as an honest interim: a plain table, with its own
 * comment saying the approved prototype's thumbnail rail and hover preview
 * were Phase 6. This is Phase 6 (prompt v2-05). The QUERY did not change —
 * it is still `admin_profile_search` (migration 029, commit 1646746) behind
 * /api/admin/command-center/profile-search. Only the presentation did, which
 * is exactly what the interim version promised would happen.
 *
 * The page is a thin server shell: it checks admin (on top of the /admin
 * tree's own gate, and on top of the SQL function re-checking for itself),
 * converts to the light working area, and hands the initial query to the
 * client panel. It renders no results itself, so there is no server-rendered
 * payload here to carry an image.
 */
export const metadata: Metadata = {
  title: 'Search | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSearchPage({
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
      <div className="max-w-[1400px] mx-auto">
        <h1 className="font-heading text-4xl text-afs-ink-900">Find a past profile</h1>
        <p className="font-body text-[17px] text-afs-ink-700 mt-1 mb-6 max-w-3xl">
          Search everything AFS has drawn. Pick one and it opens in FlashDraft as a new draft — the profile you
          picked is never changed.
        </p>

        <ProfileSearchPanel initialQuery={initialQuery} />
      </div>
    </LightWorkingArea>
  );
}
