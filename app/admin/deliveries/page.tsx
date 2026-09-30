import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';

/**
 * Deliveries — a top-level Command Center destination as of Command Center V2
 * prompt v2-01, step 5.
 *
 * WHAT THIS IS NOT, stated plainly rather than implied: the approved
 * prototype's Deliveries screen — a five-day week view with per-day stops, a
 * "Not scheduled yet" panel, a day + time-window scheduling modal and Mark
 * delivered — is Phase 5 of the spec's build plan, and the `deliveries`
 * table it needs does not exist yet. Nothing about a week view is faked here.
 *
 * This page exists because the prompt fixes the top level at exactly
 * Workbench, Shop View, Deliveries, Search and More, and a nav item that
 * 404s is worse than one that tells the truth. It shows what the database
 * genuinely knows about delivery today — jobs that have finished at the
 * machine — and names where the delivery actions currently live.
 */
export const metadata: Metadata = {
  title: 'Deliveries | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface ShopRow {
  id: string;
  profile_name: string | null;
  customer_name: string | null;
  company: string | null;
  quantity: number | null;
  status: string | null;
  requested_delivery_date: string | null;
  completed_at: string | null;
}

function formatDay(iso: string | null): string {
  if (!iso) return 'Not scheduled yet';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default async function AdminDeliveriesPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // shop_profile_library is the real record of what has been sent to the
  // current Thalmann and what has finished there. `complete` rows are the
  // ones that actually need a delivery.
  const { data, error } = await supabase
    .from('shop_profile_library')
    .select('id, profile_name, customer_name, company, quantity, status, requested_delivery_date, completed_at')
    .is('deleted_at', null)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(50)
    .returns<ShopRow[]>();

  const rows = data ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Deliveries</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1 max-w-3xl">
          Jobs the machine has finished, newest first. The week view, the
          day-and-time scheduling window and Mark delivered are being built —
          until then, a job is marked delivered from its card in the Workbench.
        </p>
      </div>

      {error && (
        <p className="font-body text-sm text-afs-crimson mb-6">
          Could not load finished jobs just now. Try again in a moment.
        </p>
      )}

      {!error && rows.length === 0 && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-8">
          <p className="font-body text-sm text-afs-chrome-mid">
            Nothing is waiting to go out. Finished jobs show up here as soon as the machine completes them —{' '}
            <Link href="/admin/shop-view" className="text-afs-crimson hover:underline">
              see what the Thalmann is working on
            </Link>
            .
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-afs-border">
                {['Customer', 'Item', 'Qty', 'Requested delivery', 'Finished'].map((h) => (
                  <th
                    key={h}
                    className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-afs-border last:border-0">
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-high">
                    {r.company ?? r.customer_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid">{r.profile_name ?? '—'}</td>
                  <td className="px-4 py-3 font-data text-sm text-afs-chrome-mid">{r.quantity ?? '—'}</td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid whitespace-nowrap">
                    {formatDay(r.requested_delivery_date)}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid whitespace-nowrap">
                    {formatDay(r.completed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
