'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JobScreenData } from '@/lib/data/job-screen';
import { formatCents } from '@/lib/pricing/quote-math';

/**
 * Column 3 of the Job screen: THE STAGE-SPECIFIC ACTION, per the approved
 * prototype's `actionPanel` (lines 347–375).
 *
 * ONE PRIMARY ACTION PER STAGE, and every piece of feedback is a full sentence
 * in plain English. No status codes, no toast that disappears before it has
 * been read, and nothing claimed that the server did not report.
 *
 * v2-03 FILLS IN TWO OF THE THREE THINGS v2-02 LEFT OUT ON PURPOSE: the priced
 * quote table with its pre-written email (the price book now exists), and the
 * Approved checklist with the invoice (the `invoices` table now exists). The
 * third — delivery scheduling — is still Phase 5 and still says so rather than
 * pretending a delivery is booked.
 *
 * THE ONE RULE THE QUOTE TABLE KEEPS: it never shows a number it cannot
 * calculate. When the price book has a blank this job needs, the table is
 * replaced by the list of rows to go and fill in, and Send quote is disabled.
 * A total built on an unfilled cell is an invented dollar amount, which is the
 * one thing CLAUDE.md's business-model rules forbid outright.
 */

type Result = { tone: 'ok' | 'info' | 'error'; message: string } | null;

export default function JobActionPanel({ job }: { job: JobScreenData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [draft, setDraft] = useState<string>(job.followupDraft ?? '');
  const [rush, setRush] = useState<boolean>(job.isRush);
  const [sendTo, setSendTo] = useState<string>(job.customerEmail ?? '');
  const [quantities, setQuantities] = useState<number[]>(
    job.quotePreview?.ok ? job.quotePreview.lines.map((l) => l.quantity) : []
  );

  const priced = job.quotePreview?.ok === true ? job.quotePreview : null;
  const blocked = job.quotePreview?.ok === false ? job.quotePreview : null;

  // Re-totalled in the browser as the estimator edits Qty, from the SAME
  // per-unit prices the server used. Nothing new is invented here: material is
  // the sheet cost over the strips that come off it, and bends and hems are per
  // piece. The server prices it again from the price book when Send is pressed,
  // so what is emailed is never whatever the browser happened to compute.
  const editedLines = (priced?.lines ?? []).map((line, i) => {
    const qty = quantities[i] ?? line.quantity;
    const material = Math.round((line.pricesUsed.sheetCostCents * qty) / line.stripsPerSheet);
    const bends = line.pricesUsed.perBendCents * line.bendCount * qty;
    const hems = line.pricesUsed.perHemCents * line.hemCount * qty;
    const total = material + bends + hems + line.extrasCents;
    return { line, qty, total };
  });
  const editedTotalCents = editedLines.reduce((sum, l) => sum + l.total, 0);

  async function post(
    label: string,
    url: string,
    body: Record<string, unknown>,
    onOk?: (data: Record<string, unknown>) => void
  ) {
    setBusy(label);
    setResult(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setResult({
          // An "already happened" answer is information, not a failure.
          tone: data.alreadySent === true || data.alreadyApproved === true || data.confirmed === false ? 'info' : 'ok',
          message: typeof data.message === 'string' ? data.message : 'Done.',
        });
        onOk?.(data);
        router.refresh();
      } else {
        setResult({
          tone: 'error',
          message: typeof data.error === 'string' ? data.error : 'That did not go through.',
        });
      }
    } catch {
      setResult({ tone: 'error', message: 'The connection dropped, so nothing was changed.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3.5">
      <h2 className="font-heading text-2xl text-afs-ink-900">{HEADINGS[job.stage]}</h2>

      {/* --- The stage's own content ------------------------------------- */}
      {job.stage === 'new' && (
        <>
          {priced && (
            <>
              <table data-testid="quote-table" className="w-full border-collapse">
                <caption className="sr-only">The priced quote for this job</caption>
                <thead>
                  <tr className="border-b border-afs-line-strong">
                    <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left pb-2">
                      Item
                    </th>
                    <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right pb-2 w-20">
                      Qty
                    </th>
                    <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right pb-2">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editedLines.map(({ line, qty, total }, i) => (
                    <tr key={`${line.description}-${i}`} className="border-b border-afs-border-light">
                      <td className="py-2.5 pr-2">
                        <span className="font-body text-[15px] text-afs-ink-900">{line.description}</span>
                        <span className="block font-body text-[13px] text-afs-ink-700">
                          {[line.material, line.gauge, `${line.bendCount} bends`, `${line.hemCount} hems`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <label className="sr-only" htmlFor={`qty-${i}`}>
                          Quantity for {line.description}
                        </label>
                        <input
                          id={`qty-${i}`}
                          data-testid={`quote-qty-${i}`}
                          type="number"
                          min={1}
                          step={1}
                          value={qty}
                          onChange={(e) => {
                            const next = [...quantities];
                            next[i] = Math.max(1, Math.round(Number(e.target.value) || 1));
                            setQuantities(next);
                          }}
                          className="w-20 min-h-11 text-right rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-data px-2"
                        />
                      </td>
                      <td
                        data-testid={`quote-line-total-${i}`}
                        className="py-2.5 text-right font-data text-[15px] text-afs-ink-900 whitespace-nowrap"
                      >
                        {money(total)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-3 font-label text-[17px] font-bold text-afs-ink-900">Total</td>
                    <td />
                    <td
                      data-testid="quote-total"
                      className="pt-3 text-right font-data text-[17px] font-bold text-afs-ink-900 whitespace-nowrap"
                    >
                      {money(editedTotalCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="font-body text-[13px] text-afs-ink-700">
                Priced from your price book: per bend, cut from 10 × 4 ft sheets.
              </p>

              <div className="flex flex-col gap-2">
                <label htmlFor="send-to" className="font-label text-sm font-bold text-afs-ink-900">
                  Send the quote to
                </label>
                <input
                  id="send-to"
                  data-testid="quote-send-to"
                  type="email"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="name@company.com"
                  className="min-h-11 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body text-[15px] px-3 placeholder:text-afs-chrome-dim"
                />
              </div>

              <Sunk>
                <p className="font-label font-bold text-afs-ink-900">The email they will get</p>
                <p className="font-body text-[15px] text-afs-ink-700">
                  Hi {job.contactFirstName}, here is your quote for{' '}
                  {job.jobName ?? job.items[0]?.profileType ?? 'your job'} — {money(editedTotalCents)} in
                  total. It has a big green <strong>Approve this quote</strong> button. One click
                  approves it, creates the invoice, and emails a copy to {job.officeEmail}. The link
                  works once and expires in 30 days.
                </p>
              </Sunk>
            </>
          )}

          {blocked && (
            <div data-testid="quote-blocked" className="bg-afs-amber-bg rounded-lg p-3.5 flex flex-col gap-2">
              <p className="font-label font-bold text-afs-amber-ink">This job cannot be quoted yet</p>
              <ul className="flex flex-col gap-1.5 list-disc pl-5">
                {blocked.problems.map((problem, i) => (
                  <li key={i} className="font-body text-[15px] text-afs-ink-900">
                    {problem.message}
                  </li>
                ))}
              </ul>
              <a
                href="/admin/settings/price-book"
                className="font-label text-sm font-bold text-afs-green-ink underline min-h-11 inline-flex items-center"
              >
                Open the price book
              </a>
            </div>
          )}
        </>
      )}

      {job.stage === 'quoted' && (
        <>
          <Sunk>
            <p className="font-label font-bold text-afs-ink-900">
              {job.issuedQuote
                ? `Quote ${job.issuedQuote.number} emailed ${job.quotedPhrase ?? 'recently'}`
                : `Quote sent ${job.quotedPhrase ?? 'recently'}`}
            </p>
            <p className="font-body text-[15px] text-afs-ink-700">
              Waiting for {job.contactFirstName} to click Approve
              {job.issuedQuote?.sentTo ? ` — sent to ${job.issuedQuote.sentTo}` : ''}.
            </p>
            {job.issuedQuote && (
              <>
                <p data-testid="quoted-total" className="font-data text-[15px] text-afs-ink-900">
                  {money(job.issuedQuote.totalCents)}
                  {job.issuedQuote.revision > 1 ? ` · revision ${job.issuedQuote.revision}` : ''}
                </p>
                <p className="font-body text-[13px] text-afs-ink-700">
                  {job.issuedQuote.approveLink === 'live'
                    ? 'Their Approve link is still live.'
                    : job.issuedQuote.approveLink === 'used'
                      ? 'Their Approve link has been used.'
                      : job.issuedQuote.approveLink === 'expired'
                        ? 'Their Approve link has expired — send the quote again to issue a fresh one.'
                        : 'There is no Approve link on this quote.'}
                </p>
                <a
                  href={`/api/admin/quotes/${job.issuedQuote.id}/pdf`}
                  className="font-label text-sm font-bold text-afs-green-ink underline min-h-11 inline-flex items-center"
                >
                  Download the quote PDF
                </a>
              </>
            )}
          </Sunk>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              post('draft', '/api/admin/command-center/draft-followup', { quoteRequestId: job.id }, (d) => {
                if (typeof d.draft === 'string') setDraft(d.draft);
              })
            }
            className="min-h-11 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
          >
            {busy === 'draft' ? 'Writing…' : 'Write a follow-up'}
          </button>
          {draft !== '' && (
            <div className="flex flex-col gap-2">
              <label htmlFor="followup" className="font-label text-sm font-bold text-afs-ink-900">
                Follow-up message
              </label>
              <textarea
                id="followup"
                data-testid="followup-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                className="font-body text-[15px] rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 p-3"
              />
              <p data-testid="followup-not-sent-notice" className="font-body text-[13px] text-afs-ink-700">
                Sending from Outlook is not connected yet. Copy this into your email — the draft is
                saved here either way.
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  post('save-draft', '/api/admin/command-center/draft-followup', {
                    quoteRequestId: job.id,
                    draft,
                  })
                }
                className="min-h-11 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
              >
                {busy === 'save-draft' ? 'Saving…' : 'Save my edits'}
              </button>
            </div>
          )}
        </>
      )}

      {job.stage === 'approved' && (
        <>
          {/* The prototype's green checklist. Every line is a fact read back
              out of the database, not a step this screen assumes happened —
              so an unchecked line means it really did not happen. */}
          <div data-testid="approved-checklist" className="bg-afs-green-soft rounded-lg p-3.5 flex flex-col gap-1.5">
            <Check
              done
              label={`Customer approved ${job.approvedPhrase ?? 'recently'}${
                job.approvalChannel === 'phone'
                  ? ' — recorded by phone'
                  : job.approvalChannel === 'email'
                    ? ' — they clicked Approve in the email'
                    : ''
              }`}
            />
            <Check
              done={job.invoice !== null}
              label={
                job.invoice
                  ? `Invoice ${job.invoice.number} created from the quote — ${money(job.invoice.totalCents)}`
                  : 'Invoice not created yet — it is created automatically when the customer clicks Approve'
              }
            />
            <Check
              done={job.invoice?.officeEmailedAt != null}
              label={
                job.invoice?.officeEmailedAt
                  ? `Invoice emailed to ${job.invoice.officeEmailedTo ?? job.officeEmail}`
                  : `Invoice not emailed to ${job.officeEmail} yet`
              }
            />
            {job.invoice && (
              <a
                href={`/api/invoices/${job.invoice.id}/pdf`}
                className="font-label text-sm font-bold text-afs-green-ink underline min-h-11 inline-flex items-center"
              >
                Download the invoice PDF
              </a>
            )}
          </div>
          {job.sendStatus === 'failed' && (
            <p className="font-body text-[15px] text-afs-crimson">
              The last send did not reach the machine. {job.sendError ?? 'No reason was recorded.'}
            </p>
          )}
        </>
      )}

      {job.stage === 'shop' && (
        <>
          <Sunk>
            {job.pathfinderProfileIds.length > 0 ? (
              <p className="font-label font-bold text-afs-ink-900">
                ✓ Sent to the machine as{' '}
                {job.pathfinderProfileIds.map((id) => `profile #${id}`).join(', ')}
              </p>
            ) : (
              <p className="font-label font-bold text-afs-amber-ink">
                Sent to the machine, but no profile number came back, so it is not confirmed.
              </p>
            )}
            <p className="font-body text-[15px] text-afs-ink-700">{job.shopSubStateLabel}</p>
          </Sunk>
          {job.sendStatus === 'unconfirmed' && (
            <p className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded p-2.5">
              Do not send this again before checking the machine — a second send would create a
              duplicate profile. {job.sendError ?? ''}
            </p>
          )}
          <p className="font-body text-[13px] text-afs-ink-700">
            Delivery scheduling is still being built. Nothing here pretends a delivery is booked
            when the database has no delivery to show.
          </p>
        </>
      )}

      {job.stage === 'done' && (
        <div className="bg-afs-green-soft rounded-lg p-3.5">
          <p className="font-label font-bold text-afs-green-ink">
            ✓ Delivered {job.deliveredPhrase ?? ''}
          </p>
        </div>
      )}

      {/* --- The ONE primary action ------------------------------------- */}
      {/* Send quote is THE primary action on a New job. It is disabled, with
          the reason above it, whenever the price book cannot price this job —
          a disabled button beside a list of rows to fill in is honest; a live
          button that fails on click is not. */}
      {job.stage === 'new' || job.stage === 'quoted' ? (
        <button
          type="button"
          data-testid="send-quote"
          disabled={busy !== null || priced === null || sendTo.trim() === ''}
          onClick={() =>
            post('quote', '/api/admin/command-center/send-quote', {
              quoteRequestId: job.id,
              sendTo: sendTo.trim(),
              quantities: editedLines.map((l) => l.qty),
            })
          }
          className="min-h-14 text-[19px] w-full rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy === 'quote'
            ? 'Sending…'
            : job.stage === 'quoted'
              ? 'Send a revised quote'
              : 'Send quote'}
        </button>
      ) : null}

      {(job.stage === 'new' || job.stage === 'quoted') && priced === null && job.quotePreview !== null ? (
        <p className="font-body text-[13px] text-afs-ink-700">
          Send quote turns on as soon as the price book can price every line above.
        </p>
      ) : null}

      {job.stage === 'new' || job.stage === 'quoted' ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => post('phone', '/api/admin/command-center/approve-by-phone', { quoteRequestId: job.id })}
          className="min-h-14 text-[19px] w-full rounded-lg font-label font-bold bg-afs-bg-card border-2 border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised disabled:opacity-70"
        >
          {busy === 'phone' ? 'Recording…' : 'Customer approved by phone'}
        </button>
      ) : null}

      {job.stage === 'approved' ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            post('send', '/api/admin/command-center/approve-quote-request', { quoteRequestId: job.id })
          }
          className="min-h-14 text-[19px] w-full rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-70"
        >
          {busy === 'send'
            ? 'Sending…'
            : job.sendStatus === 'failed'
              ? 'Try sending to the machine again'
              : 'Send to machine'}
        </button>
      ) : null}

      {result && (
        <p
          role="status"
          data-testid="job-action-result"
          className={`font-body text-[15px] rounded-lg p-3 ${
            result.tone === 'error'
              ? 'bg-afs-bg-light-raised text-afs-crimson'
              : result.tone === 'info'
                ? 'bg-afs-amber-bg text-afs-amber-ink'
                : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {result.message}
        </p>
      )}

      {/* --- Rush: the ONLY admin way to set it ------------------------- */}
      <div className="border-t border-afs-border-light pt-3.5 flex flex-col gap-2">
        <label className="flex items-center gap-2.5 font-label font-bold text-afs-ink-900 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={rush}
            disabled={busy !== null}
            onChange={(e) => {
              const next = e.target.checked;
              setRush(next);
              post('rush', '/api/admin/command-center/set-rush', {
                quoteRequestId: job.id,
                // Explicit true/false. The route refuses anything else.
                isRush: next,
              });
            }}
            className="w-5 h-5"
          />
          This is a rush job
        </label>
        <p className="font-body text-[13px] text-afs-ink-700">
          {job.rushSource === 'customer_checkbox'
            ? 'The customer asked for rush when they submitted this.'
            : job.rushSource === 'admin_toggle'
              ? 'Rush was turned on here, by an admin.'
              : 'Rush is only ever set by the customer ticking it, or by you ticking it here. It is never worked out from a date or from what the note says.'}
        </p>
      </div>
    </section>
  );
}

const HEADINGS: Record<JobScreenData['stage'], string> = {
  new: 'The quote',
  quoted: 'Quote sent',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Done',
};

/**
 * Cents to dollars, in the one place this component does it.
 *
 * It is `lib/pricing/quote-math.ts`'s `formatCents` — imported rather than
 * re-implemented, so the figure on this screen, on the PDF and in the email are
 * formatted by the same function and cannot disagree over a rounding.
 */
const money = formatCents;

/**
 * One line of the Approved checklist. The tick is driven by a real fact from
 * the database; an unticked line reads as "this has not happened", because that
 * is what it means.
 */
function Check({ done, label }: { done?: boolean; label: string }) {
  return (
    <p
      data-checked={done ? 'true' : 'false'}
      className={`font-body text-[15px] ${done ? 'text-afs-green-ink font-bold' : 'text-afs-ink-700'}`}
    >
      <span aria-hidden="true">{done ? '✓ ' : '· '}</span>
      <span className="sr-only">{done ? 'Done: ' : 'Not done yet: '}</span>
      {label}
    </p>
  );
}

function Sunk({ children }: { children: React.ReactNode }) {
  return <div className="bg-afs-bg-light-raised rounded-lg p-3.5 flex flex-col gap-1.5">{children}</div>;
}

