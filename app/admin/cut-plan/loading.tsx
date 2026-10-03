/**
 * The real loading state for the Cut Plan screen's one asynchronous step — the
 * `product_profiles` read that fills the stock-length list. Next.js shows this
 * while the server component awaits, so the estimator sees the screen's shape
 * immediately instead of a blank panel.
 *
 * It mirrors the page's own layout (header, then a one-third / two-thirds pair
 * of cards) so nothing jumps when the real thing arrives. Nothing here is
 * interactive and nothing here claims a number.
 */
export default function CutPlanLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
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
        <p className="font-body text-sm text-afs-chrome-mid mt-1">Loading stock lengths…</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-5 space-y-3">
          <div className="h-3 w-28 bg-afs-bg-overlay rounded" />
          <div className="h-3 w-20 bg-afs-bg-overlay rounded" />
          <div className="h-3 w-24 bg-afs-bg-overlay rounded" />
        </div>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-5 lg:col-span-2 space-y-3">
          <div className="h-3 w-32 bg-afs-bg-overlay rounded" />
          <div className="h-9 w-full bg-afs-bg-overlay rounded" />
          <div className="h-9 w-full bg-afs-bg-overlay rounded" />
        </div>
      </div>
    </div>
  );
}
