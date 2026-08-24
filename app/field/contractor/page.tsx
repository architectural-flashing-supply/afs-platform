import { createClient } from '@/lib/supabase/server';
import { requireFieldRole } from '@/lib/field/auth';

/**
 * Placeholder shell. Full camera-to-quote implementation is afs-fl-002.
 * Allowed roles: 'contractor' (primary) plus 'admin' — shop staff need to
 * be able to open the contractor flow for oversight/testing without a
 * second account, and 'admin' already has read/write access everywhere
 * else in this schema, so this isn't a new privilege.
 */
export default async function FieldContractorPage() {
  const supabase = await createClient();
  await requireFieldRole(supabase, ['contractor', 'admin']);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl uppercase tracking-wide text-afs-chrome-high">
        Field — Contractor
      </h1>
      <p className="font-body text-base text-afs-chrome-mid">
        Camera-to-quote is coming soon.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 w-full max-w-xs rounded bg-afs-crimson-dim px-6 py-4 font-label text-lg text-afs-chrome-mid disabled:opacity-60"
      >
        Start a Quote
      </button>
    </main>
  );
}
