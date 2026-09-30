import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getJobScreen, pointsToSvgPath } from '@/lib/data/job-screen';
import { JOB_STAGES, JOB_STAGE_LABELS, stageIndex } from '@/lib/data/job-stage';
import { UNSURE_FOOTNOTE } from '@/lib/ai/takeoff-confidence';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import JobActionPanel from '@/components/admin/JobActionPanel';
import PastProfileThumb from '@/components/admin/PastProfileThumb';
import SourceIcon from '@/components/admin/SourceIcon';
import PanelErrorBoundary from '@/components/ui/PanelErrorBoundary';

/**
 * THE JOB SCREEN — three columns, exactly as the approved prototype draws them
 * (docs/design/command-center-v2-prototype.html, `jobView`).
 *
 *   LEFT   "The request"  — what the customer actually sent, plus
 *                           "What the AI read" with confidence highlighting.
 *   MIDDLE "The profile"  — the drawing, the spec, Open in FlashDraft, and this
 *                           customer's past profiles.
 *   RIGHT  the stage-specific action panel (JobActionPanel).
 *
 * The confidence highlighting is NOT a second confidence system: the amber
 * `.unsure` rule and the three-level vocabulary both come from
 * lib/ai/takeoff-confidence.ts, which is the pattern app/api/takeoff/route.ts
 * has produced since it was built and which that route now imports too. One
 * definition, one threshold, two consumers.
 */
export default async function JobScreenPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const job = await getJobScreen(supabase, params.id);
  if (!job) notFound();

  const currentIndex = stageIndex(job.stage);
  const drawnItem = job.items.find((i) => i.points !== null);
  const drawingPath = drawnItem?.points ? pointsToSvgPath(drawnItem.points, 100, 12) : null;
  const isPhotoSource = job.sourceTool === 'field_photo_quote';

  return (
    <LightWorkingArea>
      <div className="max-w-[1600px] mx-auto">
        <Link
          href="/admin/command-center"
          className="font-label font-semibold text-afs-crimson underline text-[15px]"
        >
          Back to Workbench
        </Link>

        <div className="flex justify-between items-end gap-4 flex-wrap my-4">
          <div>
            <h1 className="font-heading text-3xl text-afs-ink-900">
              {job.customerCompany ?? job.customerName}: {job.items[0]?.profileType.toLowerCase() ?? 'job'}
            </h1>
            <p className="font-body text-sm text-afs-ink-700 mt-1">
              {job.requestNumber}
              {job.jobName ? ` · ${job.jobName}` : ''}
              {job.isRush ? ' · RUSH' : ''}
            </p>
          </div>
          {/* The stage stepper, across all five stages. */}
          <ol aria-label="Job stage" className="flex gap-1.5 flex-wrap list-none m-0 p-0">
            {JOB_STAGES.map((s, i) => (
              <li
                key={s}
                aria-current={i === currentIndex ? 'step' : undefined}
                className={`rounded-full px-3 py-1.5 font-label text-sm font-semibold border ${
                  i === currentIndex
                    ? 'bg-afs-crimson border-afs-crimson text-afs-chrome-high'
                    : i < currentIndex
                      ? 'bg-afs-bg-light-raised border-afs-border-light text-afs-ink-700'
                      : 'bg-afs-bg-card border-afs-border-light text-afs-ink-900'
                }`}
              >
                {JOB_STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 grid-cols-1">
          {/* ============ COLUMN 1 — THE REQUEST ============ */}
          {/* F-06: each column is its own boundary. A thrown render in the
              profile drawing or the action panel must not take the request text
              with it — the estimator can still read what the customer asked for
              and, in column 3, still send the quote. */}
          <PanelErrorBoundary
            label="The request"
            testId="job-panel-error-request"
            guidance="Nothing was changed. The profile and the action panel beside this one still work; reload the page to try again."
          >
          <section className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3.5">
            <h2 className="font-heading text-2xl text-afs-ink-900">The request</h2>

            <p className="font-body text-sm text-afs-ink-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded bg-afs-bg-light-raised flex items-center justify-center shrink-0">
                <SourceIcon icon={job.sourceIcon} />
              </span>
              <span>
                {job.sourceLabel} by{' '}
                <b className="text-afs-ink-900">
                  {job.customerName}
                  {job.customerCompany ? `, ${job.customerCompany}` : ''}
                </b>
                {job.submittedPhrase ? `, ${job.submittedPhrase}` : ''}
              </span>
            </p>

            {drawingPath && !isPhotoSource && (
              <div className="bg-afs-bg-light-raised rounded-lg flex items-center justify-center min-h-[160px]">
                <svg viewBox="0 0 100 100" width="150" height="150" role="img" aria-label="The customer's drawing">
                  <path
                    d={drawingPath}
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="stroke-afs-ink-900"
                  />
                </svg>
              </div>
            )}

            {job.attachment && (
              <div className="flex flex-col gap-1.5">
                {job.attachment.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a
                  // short-lived Supabase signed URL cannot be optimised by
                  // next/image, which needs a stable configured host.
                  <img
                    src={job.attachment.url}
                    alt={`What the customer sent: ${job.attachment.fileName}`}
                    loading="lazy"
                    className="rounded-lg border border-afs-border-light max-h-64 object-contain bg-afs-bg-light-raised"
                  />
                ) : (
                  <p className="font-body text-[15px] text-afs-ink-700">
                    {job.attachment.fileName} is attached but could not be opened right now.
                  </p>
                )}
                <p className="font-body text-[13px] text-afs-ink-700">{job.attachment.fileName}</p>
              </div>
            )}

            {job.customerNote ? (
              <blockquote className="bg-afs-bg-light-raised rounded-lg p-3.5 font-body text-base text-afs-ink-900 m-0 whitespace-pre-wrap">
                {job.customerNote}
              </blockquote>
            ) : (
              <p className="font-body text-[15px] text-afs-ink-700">
                The customer did not leave a note with this request.
              </p>
            )}

            {/* --- What the AI read ------------------------------------- */}
            <h3 className="font-label text-[15px] font-bold text-afs-ink-900 mt-1">What the AI read</h3>
            {job.aiRead ? (
              <>
                <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 m-0 font-body text-[15px]">
                  {job.aiRead.rows.map((r, i) => (
                    <div key={`${r.term}-${i}`} className="contents">
                      <dt className="text-afs-ink-700">{r.term}</dt>
                      <dd
                        className={`m-0 font-semibold ${
                          r.unsure
                            ? 'bg-afs-amber-bg text-afs-amber-ink rounded px-2 py-0.5 justify-self-start'
                            : 'text-afs-ink-900'
                        }`}
                        data-unsure={r.unsure ? 'true' : 'false'}
                      >
                        {r.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {job.aiRead.anyUnsure && (
                  <p className="font-body text-[13px] text-afs-ink-700">{UNSURE_FOOTNOTE}</p>
                )}
                {job.aiRead.processingNotes && (
                  <p className="font-body text-[13px] text-afs-ink-700">
                    The AI also noted: {job.aiRead.processingNotes}
                  </p>
                )}
              </>
            ) : (
              <p className="font-body text-[15px] text-afs-ink-700">
                No AI reading for this one — the customer specified it directly, so there is nothing
                for the AI to have guessed at. What they sent is above and the numbers below are
                theirs.
              </p>
            )}
          </section>
          </PanelErrorBoundary>

          {/* ============ COLUMN 2 — THE PROFILE ============ */}
          <PanelErrorBoundary
            label="The profile"
            testId="job-panel-error-profile"
            guidance="Nothing was changed. The request and the action panel either side of this one still work, and Open in FlashDraft still shows the real drawing."
          >
          <section className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3.5">
            <h2 className="font-heading text-2xl text-afs-ink-900">The profile</h2>

            <div className="bg-afs-bg-light-raised rounded-lg flex items-center justify-center min-h-[240px]">
              {drawingPath ? (
                <svg viewBox="0 0 100 100" width="220" height="220" role="img" aria-label="Profile cross-section">
                  <path
                    d={drawingPath}
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="stroke-afs-ink-900"
                  />
                </svg>
              ) : (
                <p className="font-body text-[15px] text-afs-ink-700 p-4 text-center">
                  No drawn cross-section came with this job.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {job.items.map((item, i) => (
                <div key={i}>
                  <p className="font-label font-bold text-afs-ink-900">
                    {item.profileType} × {item.quantity}
                  </p>
                  <p className="font-body text-[15px] text-afs-ink-700">
                    {[item.gauge, item.material, item.lengthFt ? `${item.lengthFt} ft` : null, job.color, job.finish]
                      .filter(Boolean)
                      .join(', ') || 'No specification given'}
                  </p>
                  {item.geometrySummary && (
                    <p className="font-body text-[13px] text-afs-ink-700 whitespace-pre-wrap">
                      {item.geometrySummary}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {job.flashDraftLink.kind === 'modify' ? (
              <Link
                href={job.flashDraftLink.href}
                className="min-h-11 rounded-lg font-label font-bold flex items-center justify-center bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
              >
                Open in FlashDraft
              </Link>
            ) : (
              <p className="font-body text-[13px] text-afs-ink-700 bg-afs-bg-light-raised rounded-lg p-3">
                <b className="text-afs-ink-900">Open in FlashDraft is not available here. </b>
                {job.flashDraftLink.reason}
              </p>
            )}

            <h3 className="font-label text-[15px] font-bold text-afs-ink-900">
              {(job.customerCompany ?? job.customerName).replace(/\s*\(.*\)$/, '')}&apos;s past profiles
            </h3>
            {job.pastProfiles.length > 0 ? (
              <div className="grid grid-cols-4 gap-2.5">
                {job.pastProfiles.map((p) => (
                  <PastProfileThumb key={p.id} id={p.id} name={p.name} />
                ))}
              </div>
            ) : (
              <p className="font-body text-[15px] text-afs-ink-700">
                No past profiles for this customer yet.
              </p>
            )}
          </section>
          </PanelErrorBoundary>

          {/* ============ COLUMN 3 — THE ACTION ============ */}
          <PanelErrorBoundary
            label="The next step for this job"
            testId="job-panel-error-action"
            guidance="Nothing was sent and no quote, invoice or machine push happened. Reload the page before trying the action again."
          >
            <JobActionPanel job={job} />
          </PanelErrorBoundary>
        </div>
      </div>
    </LightWorkingArea>
  );
}
