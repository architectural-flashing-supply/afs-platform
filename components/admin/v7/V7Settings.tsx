import Link from 'next/link';
import { V7_TRICIA } from '@/lib/fixtures/command-center-v7';

/**
 * SETTINGS — a transliteration of v7's `pageSettings()` (prototype line 1570):
 * a `.setg` with four sections down the left and one pane on the right.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FIXTURE ONLY, AND THIS IS THE LARGEST DELIBERATE DIVERGENCE IN THE PORT.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v7's Settings is six toggles, an Outlook connection line and two
 * "coming soon" cards. The live /admin/settings is a different screen doing a
 * different job: live integration status read from the environment (Supabase,
 * Stripe, Resend, Twilio, TaxJar, Google Maps, the metals feed), the product
 * stock table, the supplier price-change form and the link to the price book.
 * None of that exists in v7 and none of it is cosmetic — it is how somebody
 * finds out that Resend is unconfigured, which CLAUDE.md rule #25 already makes
 * the Deliveries screen say out loud.
 *
 * SO THE TOGGLES ARE NOT BUILT, rather than being built as controls that look
 * real and change nothing. Every one of v7's six switches would need a settings
 * table and a writer behind it; a switch that flips and is forgotten on reload
 * is worse than no switch, on a screen whose settings decide whether a customer
 * gets an email.
 *
 * What this renders is v7's layout with v7's own copy, so the whole-screen gate
 * measures the `.setg` grid, the section rail, the `.tog` rows and the
 * connection banner instead of leaving four states unmeasured. The live screen
 * is untouched and is listed in docs/design/V7_PIXEL_REPORT.md as a divergence,
 * not as a gap.
 */
const SECTIONS: [string, string][] = [
  ['email', 'Email'],
  ['inv', 'Invoices'],
  ['docs', 'Documents'],
  ['soon', 'Coming soon'],
];

/** v7's toggle rows, per section. `on` is v7's own default state. */
const TOGGLES: Record<string, { key: string; label: string; hint: string; on: boolean }[]> = {
  email: [
    {
      key: 'ob',
      label: 'Turn order and reorder emails into New jobs',
      hint: 'The attachment is read and a draft quote is prepared. Nothing is sent without you.',
      on: true,
    },
    {
      key: 'ap',
      label: 'Move a job to Approved when the customer approves by email',
      hint: 'The job lights up on the Workbench.',
      on: true,
    },
    { key: 'sms', label: 'Text me when an approval comes in', hint: "A short text with the customer's name.", on: true },
  ],
  inv: [
    {
      key: 'inv',
      label: 'Email an estimate to Tricia when I send a quote',
      hint: `She sees it in a pending-approval folder · ${V7_TRICIA}`,
      on: true,
    },
    {
      key: 'cust',
      label: 'Email the invoice to the customer when the shop marks the job finished',
      hint: 'The Shop View screen shows that it was sent.',
      on: true,
    },
    {
      key: 'recon',
      label: 'Send Tricia the final invoice with a reconciliation when a job is finished',
      hint: 'Shows the estimate, the final total, and any difference. Changes and addenda explain the difference.',
      on: true,
    },
  ],
};

export default function V7Settings({ section }: { section: string }) {
  const sec = SECTIONS.some((s) => s[0] === section) ? section : 'email';

  return (
    <>
      <div className="greet" style={{ display: 'block' }}>
        <h1 className="t">Settings</h1>
      </div>
      <div className="setg">
        <nav className="side" aria-label="Settings">
          {SECTIONS.map(([key, label]) => (
            <Link key={key} href={`/admin/settings?section=${key}&fixture=v7`} className={key === sec ? 'si on' : 'si'}>
              {label}
            </Link>
          ))}
        </nav>

        <section className="pane">
          {sec === 'email' && (
            <>
              <h2>Email</h2>
              <p className="lead">
                Quotes go out from your own Outlook, so they show in your Sent folder.
              </p>
              <div className="connb">
                <i className="beacon" />
                Connected to Outlook: steve@architecturalflashingsupply.com
              </div>
              {TOGGLES.email.map((t) => (
                <Toggle key={t.key} label={t.label} hint={t.hint} on={t.on} />
              ))}
            </>
          )}

          {sec === 'inv' && (
            <>
              <h2>Invoices</h2>
              <p className="lead">
                An estimate goes to Tricia when you send a quote. The invoice goes to the customer
                when the shop marks the job finished.
              </p>
              {TOGGLES.inv.map((t) => (
                <Toggle key={t.key} label={t.label} hint={t.hint} on={t.on} />
              ))}
            </>
          )}

          {sec === 'docs' && (
            <>
              <h2>Documents</h2>
              <p className="lead">
                Your quote and invoice, built from the templates in your AFS Internal Docs folder,
                with the company logo. Open a sample of each.
              </p>
              <div className="acts">
                <button type="button" className="btn blue">
                  Open sample quote
                </button>
                <button type="button" className="btn green">
                  Open sample invoice
                </button>
              </div>
              <p className="hint" style={{ marginTop: '12px' }}>
                Tricia&apos;s address is {V7_TRICIA}.
              </p>
            </>
          )}

          {sec === 'soon' && (
            <>
              <h2>Coming soon</h2>
              <p className="lead">These are not turned on yet.</p>
              <div className="cs">
                <div>
                  <b>Dynamic pricing</b>
                  <span className="tag amber">Coming soon</span>
                  <p>
                    Builds from the pricing history. It needs about a year of consistent prices,
                    which is why every quote and rate change is being recorded now.
                  </p>
                </div>
                <div>
                  <b>QuickBooks</b>
                  <span className="tag amber">Coming soon</span>
                  <p>Invoices and payments will sync with your QuickBooks.</p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Toggle({ label, hint, on }: { label: string; hint: string; on: boolean }) {
  return (
    <div className="tog">
      <div>
        <b>{label}</b>
        <span>{hint}</span>
      </div>
      {/* `aria-checked` and `role="switch"` are v7's, so the control announces
          itself correctly. It is not interactive here — see this file's header
          on why a switch with nothing behind it is worse than none. */}
      <button type="button" className={on ? 'sw on' : 'sw'} role="switch" aria-checked={on} aria-label={label} />
    </div>
  );
}
