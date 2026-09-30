import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getGbpPhotos } from '@/lib/data/command-center-crm';
import { isGbpConfigured } from '@/lib/integrations/google-business';
import GbpPhotosTab from '@/components/admin/GbpPhotosTab';

/**
 * REMOVED FROM THE COMMAND CENTER, CODE DELIBERATELY KEPT.
 *
 * Command Center V2 prompt v2-01, step 5: Google Business photos are not
 * Command Center work, so this route is linked from no navigation surface —
 * not the top bar, not Settings' "Other tools" list. It is retained,
 * unlinked, because the whole photo pipeline is what the future DRIVER
 * MOBILE APP will be built on, and rebuilding it later would be pure waste.
 *
 * The pipeline that is being kept, in full:
 *   app/admin/gbp-photos/page.tsx            this review screen
 *   components/admin/GbpPhotosTab.tsx        approve/reject UI
 *   lib/data/command-center-crm.ts           getGbpPhotos
 *   lib/integrations/google-business.ts      isGbpConfigured + posting
 *   app/employee/photos/page.tsx             employee-side capture screen
 *   components/employee/EmployeePhotoUploader.tsx
 *   components/field/DeliveryPhotoCapture.tsx  delivery-proof capture
 *   gbp_photo_queue table + the private 'gbp-photos' Storage bucket
 *     (migrations 007_delivery_tracking.sql, 021_gbp_photo_queue_shop_job_link.sql)
 *
 * Reachable only by typing the URL, on top of the /admin admin-role gate and
 * the requireAdminUser check below. Do not add a nav link back without an
 * explicit decision from Reid.
 */

export default async function GbpPhotosPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const photos = await getGbpPhotos(supabase);

  return (
    <div>
      <div className="mb-6">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Kept for the driver app</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">GBP Photo Queue</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Review and approve photos queued for Google Business Profile posting.
        </p>
      </div>

      <GbpPhotosTab photos={photos} gbpConfigured={isGbpConfigured()} />
    </div>
  );
}
