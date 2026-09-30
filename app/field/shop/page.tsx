import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFieldRole } from '@/lib/field/auth';
import { getFieldShopQueue } from '@/lib/data/shop-library';
import ShopJobCompletionList from '@/components/field/ShopJobCompletionList';

// Route-scoped PWA install (afs-fl-010) -- overrides the root layout's
// manifest/icons for this segment only, per Next.js metadata resolution
// (a segment's `manifest`/`icons` replace rather than merge with the
// parent's). Does not touch auth: still admin-gated below, unchanged.
export const metadata: Metadata = {
  manifest: '/field-shop-manifest.json',
  icons: {
    icon: '/field-shop-icon-192.png',
    apple: '/field-shop-apple-touch-icon.png',
  },
};

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
