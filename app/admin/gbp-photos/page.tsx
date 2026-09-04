import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getGbpPhotos } from '@/lib/data/command-center-crm';
import { isGbpConfigured } from '@/lib/integrations/google-business';
import GbpPhotosTab from '@/components/admin/GbpPhotosTab';

export default async function GbpPhotosPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const photos = await getGbpPhotos(supabase);

  return (
    <div>
      <div className="mb-6">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Command Center</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">GBP Photo Queue</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Review and approve photos queued for Google Business Profile posting.
        </p>
      </div>

      <GbpPhotosTab photos={photos} gbpConfigured={isGbpConfigured()} />
    </div>
  );
}
