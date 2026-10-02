import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import type { V7NewQuoteView } from '@/lib/data/v7-view/new-quote';

/**
 * NEW QUOTE — a transliteration of v7's `pageNewQuote()` (prototype line 1761).
 *
 * CUSTOMER FIRST, which is the whole point of the screen: v7's own words are
 * "Most quotes are for repeat customers. Pick one and their saved profiles come
 * right up." So the left rail is the customer list by most recent order, and
 * the right pane only fills once one is chosen — fastest path first (reorder
 * their last order), then their saved profiles, then drawing something new.
 *
 * STATE LIVES IN THE URL. v7 keeps the chosen customer in its in-memory `S.nq`;
 * `?customer=` and `?new=1` do the same job here, which keeps this a server
 * component, makes every state a shareable link, and means the search box works
 * with no JavaScript. The cost is a round trip per pick rather than an instant
 * filter — the right trade for a page whose next step is always a navigation.
 *
 * "CREATE CUSTOMER AND CONTINUE" IS RENDERED AND DOES NOT WORK YET, and the
 * form says so where somebody would read it rather than silently discarding
 * what was typed. Creating a customer means creating an auth account, which
 * needs either a schema change or an invite flow, and neither is this run's.
 */
export default function V7NewQuote({ view }: { view: V7NewQuoteView }) {
  return (
    <>
      <Link href="/admin/command-center" className="crumb">
        ← Back to Workbench
      </Link>
      <div className="greet" style={{ display: 'block' }}>
        <h1 className="t">New quote</h1>
      </div>

      <div className="nqg">
        <section className="pv nql">
          <h2>Who is it for?</h2>
          <p className="sub">
            Most quotes are for repeat customers. Pick one and their saved profiles come right up.
          </p>
          <label className="fld" style={{ marginTop: '12px' }}>
            Find a customer
            <input
              defaultValue={view.query}
              placeholder="Start typing a company or a name"
              autoComplete="off"
              name="q"
              aria-label="Find a customer"
            />
          </label>
          <div style={{ margin: '12px 0' }}>
            <Link href={view.blankHref} className="btn line">
              New customer, start from blank
            </Link>
          </div>
          <h3 className="s" style={{ marginTop: '6px' }}>
            Recent customers
          </h3>
          <div className="clist" id="nqlist">
            {view.customers.length ? (
              view.customers.map((c) => (
                <Link key={c.key} href={c.href} className={c.selected ? 'ci on' : 'ci'}>
                  <div>
                    <b>{c.company}</b>
                    <span className="pn">{c.line}</span>
                  </div>
                  <span className="oj" title="Past quotes and orders">
                    {c.count}
                  </span>
                </Link>
              ))
            ) : (
              <div className="none" style={{ padding: '10px' }}>
                {view.customersEmpty}
              </div>
            )}
          </div>
        </section>

        {view.pane === 'prompt' && (
          <section className="pv">
            <h2>Pick a customer to begin</h2>
            <p className="sub">
              Their saved profiles and last order appear here, so a repeat order takes two clicks.
              For someone new, press <b>New customer, start from blank</b>.
            </p>
          </section>
        )}

        {view.pane === 'blank' && (
          <section className="pv">
            <h2>New customer</h2>
            <p className="sub">
              Just enough to start. You can fill in the rest later under Customers.
            </p>
            <div className="frm">
              <label className="fld">
                Company
                <input className="f" placeholder="Company name" autoComplete="off" name="co" />
              </label>
              <label className="fld">
                Contact person
                <input className="f" placeholder="First name" autoComplete="off" name="person" />
              </label>
              <label className="fld">
                Email
                <input className="f" placeholder="name@company.com" autoComplete="off" name="email" />
              </label>
            </div>
            <p className="hint" style={{ marginTop: '10px' }}>
              Leave the contact blank and the emails say &ldquo;Hi there&rdquo;. You can add it later
              under Customers.
            </p>
            <div style={{ marginTop: '14px' }}>
              <button type="button" className="btn red lg">
                Create customer and continue
              </button>
            </div>
          </section>
        )}

        {view.pane === 'customer' && view.detail && (
          <section className="pv">
            <h2>{view.detail.name}</h2>
            <p className="sub">
              {view.detail.person} · {view.detail.email}
            </p>

            {view.detail.reorder && (
              <div className="pstrip green" style={{ marginTop: '12px' }}>
                <div>
                  <b>Fastest way: reorder their last order</b>
                  {view.detail.reorder.line}
                  <br />
                  <Link href={view.detail.reorder.href} className="btn red">
                    Reorder it
                  </Link>
                </div>
              </div>
            )}

            <h3 className="s">Or start from a saved profile</h3>
            <div className="pcards">
              {view.detail.profiles.length ? (
                view.detail.profiles.map((p) => (
                  <div className="pcard" key={p.key}>
                    <span className="rt">
                      <V7Drawing
                        kind={p.drawing.kind}
                        d={p.drawing.d}
                        options={{ w: 200, h: 150, pad: 14, sw: 5 }}
                      />
                    </span>
                    <b>{p.title}</b>
                    <span className="mut">{p.dims}</span>
                    <span className="mut">{p.lastMade}</span>
                    <Link href={p.href} className="btn red sm">
                      Quote this profile
                    </Link>
                  </div>
                ))
              ) : (
                <span className="hint">{view.detail.profilesEmpty}</span>
              )}
            </div>

            <h3 className="s">Or draw something new</h3>
            <div className="bar" style={{ margin: 0 }}>
              <label className="fld">
                Profile type
                <select defaultValue={view.detail.selectedKind} name="kind">
                  {view.detail.kindOptions.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <Link href={view.detail.drawHref} className="btn red">
                Draw it in FlashDraft
              </Link>
            </div>
            <p className="hint" style={{ marginTop: '8px' }}>
              FlashDraft opens on the job. Save the drawing and it is stored for this customer for
              every future order.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
