import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getPricingRulesRows } from '@/lib/data/pricing';
import PricingRulesEditorTable from '@/components/admin/PricingRulesEditorTable';
import LightWorkingArea from '@/components/admin/LightWorkingArea';

const REQUIREMENTS = [
  '12+ months of historical commodity price data',
  'Supplier invoice history import (3+ years)',
  'Fabrication cost baselines per product',
];

function PricingEngineComingSoonCard() {
  return (
    <section className="panel">
      <h2>Commodity-Indexed Pricing Engine</h2>
      <p className="hint">
        Commodity-indexed pricing engine in development. Activation targeted 6-12 months post-launch.
      </p>
      <p className="hint">
        When activated, it will auto-populate line item prices for each quote request based on
        real-time metal commodity prices, historical supplier cost data, and your margin targets.
      </p>
      <h3 className="s">Requirements to activate</h3>
      {REQUIREMENTS.map((req) => (
        <div className="chk" key={req}>
          <i className="w" aria-hidden="true">
            •
          </i>
          <div>{req}</div>
        </div>
      ))}
    </section>
  );
}

export default async function AdminPricingPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const rows = await getPricingRulesRows(supabase);

  return (
    // STAGE G — Pricing in v7's look (`pagePricing()`, prototype line 1558):
    // a `.greet` title and blurb, then `.panel` sections.
    //
    // ADMIN ONLY, and that is already enforced twice over: `requireAdminUser`
    // above redirects anyone whose `profiles.role` is not exactly `admin`, and
    // lib/data/admin-nav.ts marks this entry `adminOnly`. Customers must never
    // see pricing (CLAUDE.md rule #1).
    //
    // v7's pricing page is its own live-calculator mock — rates, sheet costs and
    // a price check driven by its in-browser `eng()` function. The real engine
    // is the versioned price book (lib/pricing, migration 035) and its editor
    // lives at /admin/settings/price-book. This page keeps what it really has:
    // the per-product pricing-rules editor and an honest statement of what the
    // commodity engine still needs. No calculator is faked here.
    <LightWorkingArea>
      <div className="greet">
        <div>
          <h1 className="t">Pricing</h1>
          <p className="sub">
            Manual pricing reference notes per product while the commodity engine is deferred.
          </p>
        </div>
      </div>

      <section className="panel">
        <h2>Pricing Rules Editor</h2>
        {rows.length === 0 ? (
          <div className="none">
            No products yet. Pricing rules will appear here once the product catalog is loaded
            (blocked on checklist #12-21).
          </div>
        ) : (
          <PricingRulesEditorTable rows={rows} />
        )}
      </section>

      <PricingEngineComingSoonCard />
    </LightWorkingArea>
  );
}
