import { createClient } from '@/lib/supabase/server';
import { requireFieldRole } from '@/lib/field/auth';

/**
 * Placeholder shell. Full job-completion implementation is afs-fl-003.
 * Gated on 'admin' only — shop staff (Steve) already hold the existing
 * 'admin' role; no new role is introduced for this feature.
 */
export default async function FieldShopPage() {
  const supabase = await createClient();
  await requireFieldRole(supabase, ['admin']);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl uppercase tracking-wide text-afs-chrome-high">
        Field — Shop
      </h1>
      <p className="font-body text-base text-afs-chrome-mid">
        Job completion is coming soon.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 w-full max-w-xs rounded bg-afs-crimson-dim px-6 py-4 font-label text-lg text-afs-chrome-mid disabled:opacity-60"
      >
        View Job Queue
      </button>
    </main>
  );
}
