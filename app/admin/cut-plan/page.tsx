import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { readProfileStockLengths } from '@/lib/data/product-profiles';
import CutPlanWorkbench from '@/components/admin/CutPlanWorkbench';

/**
 * CUT PLAN — the discrete trim-length optimizer, for AFS fabrication.
 *
 * WHY THIS SCREEN EXISTS AND THE CUSTOMER-FACING ONE DOES NOT REPLACE IT.
 * specs/SPEC_TRIM_LENGTH_OPTIMIZER.md places the optimizer inside the Auto
 * Material Calculator, and that is built and shipped: the quote form's Step 2
 * renders components/quote/TrimLengthOptimizerSection.tsx, which answers the
 * CONTINUOUS-RUN question ("how much stock does 47 linear feet consume?").
 *
 * The DISCRETE question — a list of finished pieces with their own lengths and
 * quantities, packed into bars, with an explicit answer when a piece is longer
 * than any stock — has no spec-defined flow in the customer path, and
 * app/configure/page.tsx (the scope audit's second mount point) no longer
 * exists at all, FlashDraft having replaced the Configurator. So the packer is
 * surfaced here instead, where its real consumer is: whoever decides what to
 * cut. Recorded in STATE_OF_THE_BUILD.md as a gap against the customer path
 * rather than quietly treated as equivalent.
 *
 * DELIBERATELY UNLINKED, like /admin/geometry-test. It is registered in
 * lib/data/admin-nav.ts's UNLINKED_ADMIN_ROUTES with its reason, and it is NOT
 * in TOP_LEVEL_NAV or MORE_NAV: v7's header is shared by every Command Center
 * screen and is under the whole-screen pixel gate (CLAUDE.md rule #34), so
 * adding a nav item would be a v7 change.
 *
 * Gunmetal, not the light working area: this is not one of the converted V2
 * screens (lib/data/admin-working-area.ts) and its text is set in the
 * light-on-dark afs-chrome-* tokens, which would be unreadable on v7's ground.
 *
 * `noindex` because it is an internal tool.
 */
export const metadata: Metadata = {
  title: 'Cut Plan | AFS Admin',
  robots: { index: false, follow: false },
};

export default async function CutPlanPage() {
  // The same redundant page-local role check every /admin page makes on top of
  // app/admin/layout.tsx's own requireAdminUser — see lib/admin/auth.ts.
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // Read with the CALLER'S client, not the service role: these are public
  // catalog rows and this page needs no more than the signed-in admin can
  // already see.
  const { profiles, failed } = await readProfileStockLengths(supabase);

  return (
    <div>
      <div className="mb-6">
        {/* A crimson CHIP, not crimson text. afs-crimson as text on gunmetal
            measures 1.42:1 (CLAUDE.md rule #29) — a real failure, not a
            marginal one, and there is no darker red that helps on a dark
            surface. White on the crimson fill measures 6.45:1, so the brand
            accent survives as a fill. Other unlinked admin pages still set
            this eyebrow as crimson text; those are listed in the run report,
            not copied here. */}
        <p className="inline-block bg-afs-crimson text-white font-label text-xs tracking-widest uppercase px-2 py-0.5 rounded mb-2">
          Fabrication
        </p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">Cut Plan</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1 max-w-3xl">
          Pack a list of finished pieces into stock lengths and see what comes off each one, what
          is left over, and how much of the metal is waste. Quantities only — this screen carries
          no prices.
        </p>
      </div>

      <CutPlanWorkbench profiles={profiles} catalogFailed={failed} />
    </div>
  );
}
