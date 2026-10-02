import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getPricingRulesRows } from '@/lib/data/pricing';
import EmptyState from '@/components/ui/EmptyState';
import PricingRulesEditorTable from '@/components/admin/PricingRulesEditorTable';

const REQUIREMENTS = [
  '12+ months of historical commodity price data',
  'Supplier invoice history import (3+ years)',
  'Fabrication cost baselines per product',
];

function PricingEngineComingSoonCard() {
  return (
    <div className="bg-afs-bg-surface border border-afs-border rounded p-8">
      <h2 className="font-heading text-xl text-afs-chrome-mid mb-3">Commodity-Indexed Pricing Engine</h2>
      <p className="font-body text-sm text-afs-chrome-mid mb-4 max-w-2xl">
        Commodity-indexed pricing engine in development. Activation targeted 6-12 months post-launch.
      </p>
      <p className="font-body text-sm text-afs-chrome-mid mb-4">
        When activated, it will auto-populate line item prices for each quote request based on real-time metal
        commodity prices, historical supplier cost data, and your margin targets.
      </p>
      <div>
        <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver mb-2">Requirements to activate</p>
        <ul className="flex flex-col gap-1.5">
          {REQUIREMENTS.map((req) => (
            <li key={req} className="font-body text-sm text-afs-chrome-mid flex items-center gap-2">
              <span className="text-afs-chrome-silver">○</span>
              {req}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function AdminPricingPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const rows = await getPricingRulesRows(supabase);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Pricing</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Manual pricing reference notes per product while the commodity engine is deferred.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Pricing Rules Editor</h2>
        {rows.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Pricing rules will appear here once the product catalog is loaded (blocked on checklist #12-21)."
          />
        ) : (
          <PricingRulesEditorTable rows={rows} />
        )}
      </section>

      <PricingEngineComingSoonCard />
    </div>
  );
}
