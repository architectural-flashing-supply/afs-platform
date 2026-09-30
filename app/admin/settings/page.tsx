import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getProductStockRows } from '@/lib/data/product-stock';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ProductStockTable from '@/components/admin/ProductStockTable';
import SupplierPriceChangeForm from '@/components/admin/SupplierPriceChangeForm';
import { getResolvedPriceBook } from '@/lib/pricing/db';
import { officeInvoiceEmail } from '@/lib/data/office';

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

  // The price book's own readiness, and how much history has accumulated.
  // Both are counts rather than data — Settings links to the real screens.
  const priceBookRows = await getResolvedPriceBook(supabase);
  const priceBookActive = priceBookRows.filter((r) => r.item.retiredAt === null);
  const priceBookTotal = priceBookActive.length;
  const priceBookUnpriced = priceBookActive.filter((r) => !r.isComplete).length;

  // Counted through `pricing_ledger_real`, so a test run's rows can never
  // inflate the number Steve reads here.
  const { count: ledgerCountRaw } = await supabase
    .from('pricing_ledger_real')
    .select('id', { count: 'exact', head: true });
  const ledgerCount = ledgerCountRaw ?? 0;

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

      {/* Command Center V2 (prompt v2-01, step 5): Settings ABSORBS Pricing,
          and the gear popover that used to hold Pricing and QuickBooks is
          gone — it was the second navigation level, and the prompt removes
          that level entirely. Everything it held lives here now. */}
      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Pricing</h2>
        <div className="flex flex-col gap-4">
          <Link
            href="/admin/settings/price-book"
            className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-border rounded p-5 hover:bg-afs-bg-surface transition-colors"
          >
            <div>
              <p className="font-heading text-base text-afs-chrome-high">Price book</p>
              <p className="font-body text-xs text-afs-chrome-mid mt-1">
                Sheet cost, per bend, per hem and extras, per material and gauge.{' '}
                {priceBookUnpriced > 0
                  ? `${priceBookUnpriced} of ${priceBookTotal} rows still need filling in.`
                  : `All ${priceBookTotal} rows are priced.`}
              </p>
            </div>
            <span className="font-label text-xs text-afs-crimson shrink-0">Open →</span>
          </Link>

          <Link
            href="/admin/pricing"
            className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-border rounded p-5 hover:bg-afs-bg-surface transition-colors"
          >
            <div>
              <p className="font-heading text-base text-afs-chrome-high">Price rules</p>
              <p className="font-body text-xs text-afs-chrome-mid mt-1">
                The older per-product rules. The price book above is what quotes are built from.
              </p>
            </div>
            <span className="font-label text-xs text-afs-crimson shrink-0">Open →</span>
          </Link>
        </div>
      </section>

      {/* ---- Pricing history ------------------------------------------- */}
      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Pricing history</h2>
        <div className="flex flex-col gap-4">
          <div className="bg-afs-bg-raised border border-afs-border rounded p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-heading text-base text-afs-chrome-high">Everything that has been priced</p>
                <p className="font-body text-xs text-afs-chrome-mid mt-1">
                  {ledgerCount === 0
                    ? 'Nothing recorded yet. Every quote, revision, outcome, invoice, price change and supplier notice lands here from now on.'
                    : `${ledgerCount.toLocaleString('en-US')} records so far — every quote, revision, outcome, invoice, price change and supplier notice.`}
                </p>
                <p className="font-body text-xs text-afs-chrome-mid mt-1">
                  Nothing in here can be edited or deleted, by anyone. That is enforced by the
                  database, not by a rule somebody has to remember.
                </p>
              </div>
              <a
                href="/api/admin/pricing-ledger/export"
                data-testid="ledger-export"
                className="font-label text-xs font-bold text-afs-chrome-high border border-afs-chrome-base rounded px-4 min-h-11 inline-flex items-center shrink-0 hover:bg-afs-bg-surface"
              >
                Download as a spreadsheet
              </a>
            </div>
          </div>

          <SupplierPriceChangeForm />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Coming soon</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/admin/quickbooks"
            className="bg-afs-bg-raised border border-afs-border rounded p-5 hover:bg-afs-bg-surface transition-colors block"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading text-base text-afs-chrome-high">QuickBooks</p>
              <span className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-high border border-afs-chrome-base rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                Coming soon
              </span>
            </div>
            <p className="font-body text-xs text-afs-chrome-mid mt-2">
              Send approved invoices and customers straight to QuickBooks. Not connected yet.
            </p>
          </Link>

          <div data-testid="dynamic-pricing-card" className="bg-afs-bg-raised border border-afs-border rounded p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading text-base text-afs-chrome-high">
                Dynamic pricing — coming soon (learning from this history)
              </p>
              <span className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-high border border-afs-chrome-base rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                Coming soon
              </span>
            </div>
            <p className="font-body text-xs text-afs-chrome-mid mt-2">
              Prices that follow the metal market. It will learn from the pricing history above —
              every quote, every yes and no, every supplier increase — so the longer you use this,
              the better it gets.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Invoices --------------------------------------------------- */}
      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Invoices</h2>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-5">
          <p className="font-heading text-base text-afs-chrome-high">
            Every approved invoice is emailed to the office automatically
          </p>
          <p data-testid="office-invoice-email" className="font-data text-sm text-afs-chrome-high mt-2">
            {officeInvoiceEmail()}
          </p>
          <p className="font-body text-xs text-afs-chrome-mid mt-2">
            When a customer clicks Approve in their quote email, the invoice is created from that
            quote — nothing is re-typed — and a copy goes to this address and to the customer. To
            change the address, set INVOICE_OFFICE_EMAIL in the deployment settings.
          </p>
        </div>
      </section>

      {/* Real, working admin tools that the one-level nav does not give a
          top-level slot to. Listed here so they are not lost while the
          Workbench's lanes (v2-02) take over what they do. Deliberately NOT
          listed: /admin/geometry-test (developer-only, must stay unlinked)
          and /admin/gbp-photos (removed from the Command Center — its code is
          kept for the future driver mobile app, not surfaced here). */}
      <section className="mb-8">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Other tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              href: '/admin/quote-requests',
              title: 'Quote requests',
              blurb: 'Every request that has come in. The Workbench New lane replaces this.',
            },
            {
              href: '/admin/orders',
              title: 'Production queue',
              blurb: 'Fabrication stage per order. Shop View is the tablet version.',
            },
            {
              href: '/admin/shop-library',
              title: 'Shop profile library',
              blurb: 'What has been sent to the Thalmann, and its machine profile number.',
            },
          ].map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="bg-afs-bg-raised border border-afs-border rounded p-5 hover:bg-afs-bg-surface transition-colors block"
            >
              <p className="font-heading text-base text-afs-chrome-high">{tool.title}</p>
              <p className="font-body text-xs text-afs-chrome-mid mt-1">{tool.blurb}</p>
            </Link>
          ))}
        </div>
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
