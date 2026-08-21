import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getShopProfileLibrary } from '@/lib/data/shop-profile-library';
import ProfileLibraryTable from '@/components/admin/ProfileLibraryTable';

export default async function ProfileLibraryPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const rows = await getShopProfileLibrary(supabase);

  return (
    <div>
      <div className="mb-6">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">Profile Library</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Every profile sent to PathfinderEdge, with its full shop intake context — from Command Center approvals and
          FlashDraft&apos;s direct send.
        </p>
      </div>

      <ProfileLibraryTable rows={rows} />
    </div>
  );
}
