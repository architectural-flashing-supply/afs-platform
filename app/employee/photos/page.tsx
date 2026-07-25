import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import EmployeePhotoUploader, { type EmployeeQueuedPhoto } from '@/components/employee/EmployeePhotoUploader';

interface QueuedPhotoRow {
  id: string;
  storage_key: string;
  caption: string | null;
  status: string;
  queued_at: string;
}

export default async function EmployeePhotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // gbp_photo_queue's operator_admin_select_photos RLS policy
  // (007_delivery_tracking.sql §3) lets any operator read every row — this
  // still scopes to queued_by = this user, per SPEC_DELIVERY_TRACKING_AND_
  // EMPLOYEE_PWA.md §3 Screen 4 ("Shows own queued photos").
  const { data } = await supabase
    .from('gbp_photo_queue')
    .select('id, storage_key, caption, status, queued_at')
    .eq('queued_by', user!.id)
    .order('queued_at', { ascending: false });

  const rows = (data ?? []) as QueuedPhotoRow[];

  // The 'gbp-photos' bucket is private, matching every other Supabase
  // Storage bucket in this codebase — thumbnails need short-lived signed
  // URLs from the service-role client, same pattern as getOrderAttachments.
  const admin = createAdminClient();
  const photos: EmployeeQueuedPhoto[] = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage.from('gbp-photos').createSignedUrl(row.storage_key, 900);
      return {
        id: row.id,
        caption: row.caption,
        status: row.status,
        thumbnailUrl: signed?.signedUrl ?? null,
      };
    })
  );

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-heading text-2xl text-afs-chrome-high mb-4">Photos</h1>
      <EmployeePhotoUploader initialPhotos={photos} />
    </div>
  );
}
