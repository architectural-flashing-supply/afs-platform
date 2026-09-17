import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getProductStockRows } from '@/lib/data/product-stock';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ProductStockTable from '@/components/admin/ProductStockTable';

interface IntegrationStatus {
  name: string;
  detail: string;
  variant: BadgeVariant;
  label: string;
}

function statusFromEnv(present: boolean, connectedDetail: string, missingDetail: string): Pick<IntegrationStatus, 'variant' | 'label' | 'detail'> {
  return present
    ? { variant: 'success', label: 'Connected', detail: connectedDetail }
    : { variant: 'chrome', label: 'Not Configured', detail: missingDetail };
}

function buildIntegrationStatuses(): IntegrationStatus[] {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const hasStripe = Boolean(stripeKey);
  const stripeMode = stripeKey?.startsWith('sk_live_') ? 'Live key' : stripeKey?.startsWith('sk_test_') ? 'Test key' : null;
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const hasTaxJar = Boolean(process.env.TAXJAR_API_KEY);
  const hasGoogleMaps = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const hasMetalsApi = Boolean(process.env.METALS_API_KEY);

  return [
    {
      name: 'Supabase',
      ...statusFromEnv(hasSupabase, 'Database, Auth, and Storage connected', 'Missing Supabase environment variables'),
    },
    {
      name: 'Stripe',
      ...statusFromEnv(
        hasStripe,
        stripeMode ?? 'Key present',
        'Missing STRIPE_SECRET_KEY — checkout is disabled'
      ),
    },
    {
      name: 'Resend',
      ...statusFromEnv(hasResend, 'Transactional email enabled', 'Missing RESEND_API_KEY — notifications will not send'),
    },
    {
      name: 'Twilio',
      ...statusFromEnv(hasTwilio, 'SMS notifications enabled', 'Missing Twilio credentials — SMS disabled'),
    },
    {
      name: 'TaxJar',
      ...statusFromEnv(hasTaxJar, 'Tax calculation enabled', 'Blocked on tax nexus states (checklist #31)'),
    },
    {
      name: 'Google Maps',
      ...statusFromEnv(hasGoogleMaps, 'Address autocomplete and delivery maps enabled', 'Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
    },
    {
      name: 'Metals API',
      ...statusFromEnv(hasMetalsApi, 'Commodity pricing feed enabled', 'Missing METALS_API_KEY — pricing engine cannot activate'),
    },
    {
      name: 'QuickBooks',
      variant: 'chrome',
      label: 'Not Connected',
      detail: 'QuickBooks sync ships in Phase 8',
    },
  ];
}

interface CronJobStatus {
  name: string;
  schedule: string;
  lastRun: string | null;
  lastResult: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const [{ data: latestCommodity }, { data: latestTrend }] = await Promise.all([
    supabase.from('commodity_prices').select('recorded_at').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('pricing_trend_analysis').select('computed_at').order('computed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const integrations = buildIntegrationStatuses();
  const stockRows = await getProductStockRows(supabase);

  const cronJobs: CronJobStatus[] = [
    {
      name: 'commodity-prices',
      schedule: '0 22 * * 1-5 (UTC) — weekdays after market close',
      lastRun: (latestCommodity as { recorded_at: string } | null)?.recorded_at ?? null,
      lastResult: latestCommodity ? 'Success' : 'No runs recorded yet',
    },
    {
      name: 'pricing-trends',
      schedule: '0 4 * * * (UTC) — nightly',
      lastRun: (latestTrend as { computed_at: string } | null)?.computed_at ?? null,
      lastResult: latestTrend ? 'Success' : 'No runs recorded yet',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Settings</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">Integration status and cron job health.</p>
      </div>

      {/* Phase 2 (Command Center redesign, afs-cc-001) — Pricing lost its own
          sidebar entry per the redesign's simplified nav; this link is what
          keeps the real Pricing Rules Editor (app/admin/pricing/page.tsx)
          reachable, alongside the top bar's gear-icon "Dynamic Pricing
          Engine" popover entry. */}
      <section className="mb-8">
        <Link
          href="/admin/pricing"
          className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-border rounded p-5 hover:bg-afs-bg-surface transition-colors"
        >
          <div>
            <p className="font-heading text-base text-afs-chrome-high">Pricing</p>
            <p className="font-body text-xs text-afs-chrome-mid mt-1">
              Manual pricing rules editor · commodity-indexed engine coming soon
            </p>
          </div>
          <span className="font-label text-xs text-afs-crimson shrink-0">Open →</span>
        </Link>
      </section>

      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Integration Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <div key={integration.name} className="bg-afs-bg-raised border border-afs-border rounded p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-heading text-base text-afs-chrome-high">{integration.name}</p>
                <Badge variant={integration.variant}>{integration.label}</Badge>
              </div>
              <p className="font-body text-xs text-afs-chrome-mid">{integration.detail}</p>
              {integration.name === 'QuickBooks' && (
                <button
                  type="button"
                  disabled
                  title="QuickBooks OAuth connect ships in Phase 8"
                  className="mt-3 w-full font-label text-xs text-afs-chrome-dim border border-afs-border rounded px-3 py-2 cursor-not-allowed"
                >
                  Connect QBO
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Inventory / Stock Status</h2>
        <p className="font-body text-xs text-afs-chrome-mid mb-4 max-w-2xl">
          A manually-set signal, not a real-time quantity count — AFS fabricates custom, so nothing is
          truly "in stock." Set which products fabricate fast from material on hand vs. require a
          special order (see SPEC_LIVE_INVENTORY.md).
        </p>
        {stockRows.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Stock status will appear here once the product catalog is loaded (blocked on checklist #12-21)."
          />
        ) : (
          <ProductStockTable rows={stockRows} />
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Cron Job Status</h2>
        <div className="flex flex-col gap-3">
          {cronJobs.map((job) => (
            <div
              key={job.name}
              className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-border rounded p-5"
            >
              <div className="min-w-0">
                <p className="font-data text-sm text-afs-chrome-high">{job.name}</p>
                <p className="font-body text-xs text-afs-chrome-mid mt-1">{job.schedule}</p>
                <p className="font-body text-xs text-afs-chrome-dim mt-1">
                  Last run: {job.lastRun ? formatDateTime(job.lastRun) : 'Never'} · {job.lastResult}
                </p>
              </div>
              <button
                type="button"
                disabled
                title="Cron routes are not yet deployed (Phase 8)"
                className="font-label text-xs text-afs-chrome-dim border border-afs-border rounded px-3 py-2 cursor-not-allowed shrink-0"
              >
                Trigger Now
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
