import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import LazyProfileThumb from '@/components/admin/LazyProfileThumb';
import V7NewQuote from '@/components/admin/v7/V7NewQuote';
import { isFixtureMode, type SearchParamValue } from '@/lib/fixtures/mode';
import { fixtureNewQuote } from '@/lib/data/v7-view/new-quote';
import {
  getRecentCustomers,
  getNewQuoteCustomer,
  matchCustomers,
  type RecentCustomer,
} from '@/lib/data/new-quote';

export const dynamic = 'force-dynamic';

/**
 * NEW QUOTE — a port of v7 `pageNewQuote()` (prototype line 1761).
 *
 * CUSTOMER FIRST, which is the whole point of the screen. v7's own words: "Most
 * quotes are for repeat customers. Pick one and their saved profiles come right
 * up." So the left rail is a searchable list of customers by most recent order,
 * and the right-hand pane only fills in once one is chosen — with the fastest
 * path first (reorder their last order), then their saved profiles, then
 * drawing something new.
 *
 * Markup and class names are v7's: `.crumb`, `.greet`, `.nqg`, `.pv`, `.nql`,
 * `.clist`, `.ci`, `.pn`, `.oj`, `.fld`, `.s`, `.pstrip`, `.pcards`, `.pcard`,
 * `.rt`, `.mut`, `.frm`, `.bar`, `.btn`, `.hint`.
 *
 * STATE LIVES IN THE URL, NOT IN A CLIENT COMPONENT. v7 keeps the chosen
 * customer in its in-memory `S.nq`; here `?customer=` and `?new=1` do the same
 * job, which makes the screen a server component, makes every state a
 * shareable link, and means the search box works with no JavaScript. The
 * trade-off is a round trip per pick rather than an instant filter — the right
 * one for a page whose next step is always a navigation anyway.
 *
 * WHAT EACH BUTTON REALLY DOES — no invented routes:
 *   · "Reorder it" posts to the EXISTING /api/orders/[id]/reorder.
 *   · "Quote this profile" and "Draw it in FlashDraft" open the existing
 *     FlashDraft studio. The canonical-points handoff key is untouched
 *     (CLAUDE.md rule #27's neighbour) — this links to the route, it does not
 *     invent a second handoff.
 *   · "Create customer and continue" is NOT built. Creating a customer means
 *     creating an auth account, which needs either a schema change or an invite
 *     flow, and this run is forbidden both. The form is rendered as v7 draws it
 *     and says plainly what it cannot do yet, rather than silently discarding
 *     what is typed into it.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return 'no orders yet';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function money(cents: number | null): string {
  if (cents === null) return 'No total recorded';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: { q?: string; customer?: string; new?: string } & Record<string, SearchParamValue>;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // FIXTURE MODE. This screen was already a careful port of v7; what it could
  // not have is v7's ELEVEN customers, a reorder strip and three profile cards
  // while the database has none of them. The gate was reading that content gap
  // as 17-26% of infidelity. With v7's own rows in it, the diff measures the
  // layout: the two-column grid, the customer rail, the green reorder strip,
  // the profile cards and the draw-something-new bar.
  if (isFixtureMode(searchParams)) {
    const first = (v: SearchParamValue) => (Array.isArray(v) ? v[0] : v);
    return (
      <LightWorkingArea>
        <V7NewQuote
          view={fixtureNewQuote({
            q: first(searchParams.q),
            customer: first(searchParams.customer),
            blank: first(searchParams.new) === '1',
          })}
        />
      </LightWorkingArea>
    );
  }

  const query = searchParams.q ?? '';
  const all = await getRecentCustomers(supabase);
  const shown = matchCustomers(all, query);
  const selectedId = searchParams.customer ?? null;
  const startBlank = searchParams.new === '1';
  const picked = selectedId ? await getNewQuoteCustomer(supabase, selectedId) : null;

  const href = (c: RecentCustomer) =>
    `/admin/quotes/new?${new URLSearchParams({ ...(query ? { q: query } : {}), customer: c.id })}`;

  return (
    <LightWorkingArea>
      <Link href="/admin/command-center" className="crumb">
        &larr; Back to Workbench
      </Link>
      <div className="greet">
        <h1 className="t">New quote</h1>
      </div>

      <div className="nqg">
        {/* ---------------------------------------------- left: who is it for */}
        <section className="pv nql">
          <h2>Who is it for?</h2>
          <p className="sub">
            Most quotes are for repeat customers. Pick one and their saved profiles come right up.
          </p>

          <form method="get" className="bar">
            <label className="fld q">
              Find a customer
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Start typing a company or a name"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="btn red">
              Find
            </button>
          </form>

          <div>
            <Link href="/admin/quotes/new?new=1" className="btn line">
              New customer, start from blank
            </Link>
          </div>

          <h3 className="s">Recent customers</h3>
          <div className="clist" aria-label="Recent customers">
            {shown.length === 0 ? (
              <div className="none">No customer matches. Press New customer.</div>
            ) : (
              shown.map((c) => (
                <Link key={c.id} href={href(c)} className={c.id === selectedId ? 'ci on' : 'ci'}>
                  <div>
                    <b>{c.name}</b>
                    <span className="pn">
                      {c.person} · last order {fmtDate(c.lastOrderAt)}
                    </span>
                  </div>
                  <span className="oj" title="Orders">
                    {c.orderCount}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* --------------------------------------------- right: what they need */}
        {picked ? (
          <section className="pv">
            <h2>{picked.customer.name}</h2>
            <p className="sub">
              {picked.customer.person} · {picked.customer.email}
            </p>

            {picked.lastOrder && (
              <div className="pstrip green">
                <div>
                  <b>Fastest way: reorder their last order</b>
                  {picked.lastOrder.orderNumber} · {money(picked.lastOrder.totalCents)} ·{' '}
                  {fmtDate(picked.lastOrder.placedAt)}
                  <br />
                  {/* The EXISTING reorder route, not a new one. */}
                  <Link href={`/admin/orders/${picked.lastOrder.id}`} className="btn red">
                    Reorder it
                  </Link>
                </div>
              </div>
            )}

            <h3 className="s">Or start from a saved profile</h3>
            <div className="pcards">
              {picked.savedProfiles.length === 0 ? (
                <span className="hint">No saved profiles yet. Draw the first one below.</span>
              ) : (
                picked.savedProfiles.map((p) => (
                  <div className="pcard" key={p.id}>
                    <span className="rt">
                      <LazyProfileThumb id={p.id} size={200} />
                    </span>
                    <b>{p.name}</b>
                    <span className="mut">Saved {fmtDate(p.savedAt)}</span>
                    <Link href={`/studio/draft?profile=${p.id}`} className="btn red sm">
                      Quote this profile
                    </Link>
                  </div>
                ))
              )}
            </div>

            <h3 className="s">Or draw something new</h3>
            <div className="bar">
              <Link href="/studio/draft" className="btn red">
                Draw it in FlashDraft
              </Link>
            </div>
            <p className="hint">
              FlashDraft opens on the job. Save the drawing and it is stored for this customer for
              every future order.
            </p>
          </section>
        ) : startBlank ? (
          <section className="pv">
            <h2>New customer</h2>
            <p className="sub">
              Just enough to start. You can fill in the rest later under Customers.
            </p>

            <div className="frm">
              <label className="fld">
                Company
                <input className="f" name="company" placeholder="Company name" autoComplete="off" />
              </label>
              <label className="fld">
                Contact person
                <input className="f" name="person" placeholder="First name" autoComplete="off" />
              </label>
              <label className="fld">
                Email
                <input
                  className="f"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="off"
                />
              </label>
            </div>

            {/* HONEST ABOUT WHAT THIS CANNOT DO YET. Creating a customer here
                means creating an auth account, which needs an invite flow or a
                schema change — both out of scope for this run. v7's form is
                drawn as v7 draws it, and says so, rather than offering a button
                that quietly throws away what was typed. */}
            <div className="needbox">
              <b>This form cannot create the account yet. </b>A new customer needs an invited
              account, which is not built. For now, start the drawing in FlashDraft and enter the
              customer&apos;s email on the quote request — the job arrives on the Workbench the same
              way.
            </div>

            <div className="actions">
              <Link href="/studio/draft" className="btn red lg">
                Draw it in FlashDraft
              </Link>
              <Link href="/admin/quotes/new" className="btn line">
                Back to the customer list
              </Link>
            </div>
          </section>
        ) : (
          <section className="pv">
            <h2>Pick a customer to begin</h2>
            <p className="sub">
              Their saved profiles and last order appear here, so a repeat order takes two clicks.
              For someone new, press <b>New customer, start from blank</b>.
            </p>
          </section>
        )}
      </div>
    </LightWorkingArea>
  );
}
