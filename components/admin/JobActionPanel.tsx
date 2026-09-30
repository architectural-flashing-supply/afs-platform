'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JobScreenData } from '@/lib/data/job-screen';

/**
 * Column 3 of the Job screen: THE STAGE-SPECIFIC ACTION, per the approved
 * prototype's `actionPanel` (lines 347–375).
 *
 * ONE PRIMARY ACTION PER STAGE, and every piece of feedback is a full sentence
 * in plain English. No status codes, no toast that disappears before it has
 * been read, and nothing claimed that the server did not report.
 *
 * WHAT IS DELIBERATELY NOT HERE YET, and is said so on screen rather than
 * mocked: the priced quote table and the pre-written quote email (they need the
 * `price_book`, Phase 3 of docs/COMMAND_CENTER_V2_SPEC.md), the invoice
 * checklist items (there is no `invoices` table — §2.5, and it is the spec's
 * own top risk), and delivery scheduling (Phase 5). The prototype draws all
 * three; building fake versions of them here would put invented dollar amounts
 * in front of an estimator, which is the one thing CLAUDE.md's business-model
 * rules forbid outright.
 */

type Result = { tone: 'ok' | 'info' | 'error'; message: string } | null;

export default function JobActionPanel({ job }: { job: JobScreenData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [draft, setDraft] = useState<string>(job.followupDraft ?? '');
  const [rush, setRush] = useState<boolean>(job.isRush);

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
          <p className="font-body text-[15px] text-afs-ink-900">
            This job needs a quote. Pricing is not connected yet, so write and send the quote from
            Outlook for now, then record what happened here.
          </p>
          <Sunk>
            <Row label="Item" value={job.items.map((i) => `${i.profileType} × ${i.quantity}`).join('; ') || '—'} />
            <Row label="Send the quote to" value={job.customerEmail ?? 'No email on file'} />
          </Sunk>
          <p className="font-body text-[13px] text-afs-ink-700">
            The priced quote table and the pre-written quote email arrive with the price book. Until
            then this screen will not show a dollar amount it cannot calculate.
          </p>
        </>
      )}

      {job.stage === 'quoted' && (
        <>
          <Sunk>
            <p className="font-label font-bold text-afs-ink-900">
              Quote sent {job.quotedPhrase ?? 'recently'}
            </p>
            <p className="font-body text-[15px] text-afs-ink-700">
              Waiting for {job.contactFirstName} to approve.
            </p>
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
          <div className="bg-afs-green-soft rounded-lg p-3.5 flex flex-col gap-1.5">
            <p className="font-label font-bold text-afs-green-ink">
              ✓ Customer approved {job.approvedPhrase ?? 'recently'}
              {job.approvalChannel === 'phone' ? ' — recorded by phone' : ''}
            </p>
            <p className="font-body text-[13px] text-afs-ink-700">
              The invoice step is not built yet: there is no invoices table in the database. It is
              listed as the first risk in the build spec and is Phase 3 work.
            </p>
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
      {job.stage === 'new' || job.stage === 'quoted' ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => post('phone', '/api/admin/command-center/approve-by-phone', { quoteRequestId: job.id })}
          className="min-h-14 text-[19px] w-full rounded-lg font-label font-bold bg-afs-crimson text-afs-chrome-high hover:bg-afs-crimson-hover disabled:opacity-70"
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

function Sunk({ children }: { children: React.ReactNode }) {
  return <div className="bg-afs-bg-light-raised rounded-lg p-3.5 flex flex-col gap-1.5">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="font-body text-[15px] text-afs-ink-900">
      <span className="text-afs-ink-700">{label}: </span>
      {value}
    </p>
  );
}
