import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getShopProfileLibraryFull } from '@/lib/data/shop-library';
import ShopViewBoard from '@/components/admin/ShopViewBoard';

export default async function ShopViewPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const rows = await getShopProfileLibraryFull(supabase);

  return (
    <div>
      <div className="mb-6">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">Shop View</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Focus-mode shop-floor reference — one job full-screen at a time, for a direct visual check against
          what&apos;s on the PathfinderEdge/Thalmann screen. Refreshes automatically every 30 seconds.
        </p>
      </div>

      <ShopViewBoard initialRows={rows} />
    </div>
  );
}
