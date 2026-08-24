import { createClient } from '@/lib/supabase/server';
import { requireFieldRole } from '@/lib/field/auth';
import { getFieldShopQueue } from '@/lib/data/shop-profile-library';
import ShopJobCompletionList from '@/components/field/ShopJobCompletionList';

/**
 * Shop-floor job completion (afs-fl-003), replacing the disabled placeholder
 * from afs-fl-000. Gated on 'admin' only — shop staff (Steve) already hold
 * the existing 'admin' role; no new role is introduced for this feature.
 */
export default async function FieldShopPage() {
  const supabase = await createClient();
  await requireFieldRole(supabase, ['admin']);

  const jobs = await getFieldShopQueue(supabase);

  return <ShopJobCompletionList initialJobs={jobs} />;
}
