import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getJobScreen, pointsToSvgPath, type FlashDraftLink } from '@/lib/data/job-screen';
import { JOB_STAGES, JOB_STAGE_LABELS, stageIndex } from '@/lib/data/job-stage';
import { UNSURE_FOOTNOTE } from '@/lib/ai/takeoff-confidence';
import { flashDraftJobHref } from '@/lib/flashdraft/job-handoff';
import { SHOP_TIME_ZONE } from '@/lib/utils/waiting-time';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import JobActionPanel from '@/components/admin/JobActionPanel';
import PastProfileThumb from '@/components/admin/PastProfileThumb';
import SourceIcon from '@/components/admin/SourceIcon';
import PanelErrorBoundary from '@/components/ui/PanelErrorBoundary';
import V7Job from '@/components/admin/v7/V7Job';
import { isFixtureMode, type SearchParamValue } from '@/lib/fixtures/mode';
import { fixtureJob } from '@/lib/data/v7-view/job';

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
/**
 * v7 `stageStrip()`'s step states (prototype line 1300). A map to the WHOLE
 * className rather than a template: the contrast gate expands class maps but
 * counts a runtime template as `unresolved`, and CLAUDE.md rule #28 treats a
 * rising unresolved count as the gate going blind.
 */
const STEP_CLASS: Record<'done' | 'cur' | 'todo', string> = {
  done: 'step done',
  cur: 'step cur',
  todo: 'step',
};

/** v7's AI-read row, sure vs unsure. Same class-map reason as STEP_CLASS. */
const ROW_CLASS: Record<'sure' | 'unsure', string> = {
  sure: 'row',
  unsure: 'row unsure',
};

/**
 * "DESIGN IN FLASHDRAFT" — one component, rendered in all three places the
 * estimator might reach for it, so the label, the destination and the line item
 * it opens can never differ between them.
 *
 * `btn red` is v7's ONE action colour (CLAUDE.md rule #33: v7's block 3
 * redeclares `--red:#C8102E` and that is the only red the Command Center has).
 * No new token, no new colour, and no Tailwind utility on a v7 class — the
 * appearance comes entirely from the generated v7 CSS.
 */
function FlashDraftButton({ link, testId }: { link: FlashDraftLink; testId: string }) {
  return (
    <Link href={link.href} className="btn red" data-testid={testId}>
      {link.label}
    </Link>
  );
}

/**
 * The correction stamp, in the shop's own words rather than an ISO string —
 * and IN THE SHOP'S OWN TIME ZONE.
 *
 * This page is a SERVER component, so a bare `toLocaleString` formats in the
 * server's zone. Vercel runs in UTC and the shop is in Burnet, Texas, so a
 * correction made at 4pm Central would have been printed to Steve as 9pm or
 * 10pm on a screen with no offset on it. Same hazard CLAUDE.md rule #24 records
 * for delivery dates, and the same one clock answers it. (The matching banner
 * inside FlashDraft needs no zone: it renders in the browser, which is already
 * on shop time when Steve is the one looking.)
 */
function formatCorrectedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'an earlier date';
  return d.toLocaleString('en-US', {
    timeZone: SHOP_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function JobScreenPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, SearchParamValue>;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // FIXTURE MODE. v7's job ids are small integers (412, 409, …) and the live
  // ones are UUIDs, so this has to come BEFORE the UUID guard below or every
  // fixture job 404s. The guard itself is unchanged and still rejects anything
  // that is not a UUID on the live path.
  //
  // The live screen below keeps JobActionPanel, which really sends a quote and
  // really opens the one door to the machine (CLAUDE.md rule #14). v7's
  // equivalent pane has a "Pretend the customer approved" button in it. See
  // components/admin/v7/V7Job.tsx.
  if (isFixtureMode(searchParams)) {
    const view = fixtureJob(Number(params.id));
    if (!view) notFound();
    return (
      <LightWorkingArea>
        <V7Job view={view} />
      </LightWorkingArea>
    );
  }

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
        <Link href="/admin/command-center" className="crumb">
          &larr; Back to Workbench
        </Link>

        <div className="jh">
          <div>
            <h1 className="t">
              {job.customerCompany ?? job.customerName}: {job.items[0]?.profileType.toLowerCase() ?? 'job'}
            </h1>
            <p className="sub">
              {job.requestNumber}
              {job.jobName ? ` · ${job.jobName}` : ''}
              {job.isRush ? ' · RUSH' : ''}
            </p>
          </div>
          {/* The stage stepper, across all five stages. */}
          {/* v7 `stageStrip()` (line 1300): `.steps` of `.step`, with the
              stages already passed marked `done` and the current one `cur`.
              v7 writes it as a div of spans with ARIA roles; this keeps the
              real <ol>/<li>, which needs no roles to mean the same thing and
              is what the Workbench e2e asserts against. */}
          <ol aria-label="Job stage" className="steps">
            {JOB_STAGES.map((s, i) => (
              <li
                key={s}
                aria-current={i === currentIndex ? 'step' : undefined}
                className={STEP_CLASS[i === currentIndex ? 'cur' : i < currentIndex ? 'done' : 'todo']}
              >
                {JOB_STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
          {/* THE PROMINENT ONE. Beside the stage strip, at the top of the
              screen, so redesigning a profile the parser got wrong is reachable
              without scrolling past the parser's reading to find it. */}
          <FlashDraftButton link={job.flashDraftLink} testId="job-flashdraft-header" />
        </div>

        <div className="cols">
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
          <section className="pane">
            <h2>The request</h2>

            <p className="from">
              <span className="thumb">
                <SourceIcon icon={job.sourceIcon} />
              </span>
              <span>
                {job.sourceLabel} by{' '}
                <b>
                  {job.customerName}
                  {job.customerCompany ? `, ${job.customerCompany}` : ''}
                </b>
                {job.submittedPhrase ? `, ${job.submittedPhrase}` : ''}
              </span>
            </p>

            {drawingPath && !isPhotoSource && (
              <div className="plate">
                <svg viewBox="0 0 100 100" width="150" height="150" role="img" aria-label="The customer's drawing">
                  <path
                    d={drawingPath}
                    strokeWidth="3"
                    className="ln"
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
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <p className="hint">
                    {job.attachment.fileName} is attached but could not be opened right now.
                  </p>
                )}
                <p className="cap">{job.attachment.fileName}</p>
              </div>
            )}

            {job.customerNote ? (
              <blockquote className="mail">
                {job.customerNote}
              </blockquote>
            ) : (
              <p className="hint">The customer did not leave a note with this request.</p>
            )}

            {/* --- What the AI read ------------------------------------- */}
            <div className="read">
              <h3>What the AI read</h3>
            {job.aiRead ? (
              <>
                {job.aiRead.rows.map((r, i) => (
                  // v7 `readRows()` (line 1308): a `.row` of key, value and a
                  // confidence word, with `.row.unsure` marking anything the
                  // AI was not sure of. The vocabulary and the threshold are
                  // lib/ai/takeoff-confidence.ts's — rule #17's one pattern.
                  <div key={`${r.term}-${i}`} className={ROW_CLASS[r.unsure ? 'unsure' : 'sure']}>
                    <span className="k">{r.term}</span>
                    <span className="v" data-unsure={r.unsure ? 'true' : 'false'}>
                      {r.value}
                    </span>
                    {/* PER-LINE "FIX IN FLASHDRAFT", and three conditions have
                        to hold before it appears. The item is one the AI was
                        NOT sure about (`r.unsure`, which is
                        lib/ai/takeoff-confidence.ts's real per-item confidence,
                        never a value invented here); the parser's items really
                        do correspond to this order's lines; and this is the
                        item's first row, so one control appears per item rather
                        than one per field. The model reports confidence per
                        item, so the action is per item. */}
                    {r.unsure && r.firstOfItem && job.aiRead!.perItemAddressable ? (
                      <Link
                        href={flashDraftJobHref(job.id, r.itemIndex)}
                        className="btn red sm"
                        data-testid={`job-flashdraft-line-${r.itemIndex}`}
                      >
                        Fix in FlashDraft
                      </Link>
                    ) : (
                      <span className="sure">{r.unsure ? 'Check' : 'Sure'}</span>
                    )}
                  </div>
                ))}
                {job.aiRead.anyUnsure && <p className="note">{UNSURE_FOOTNOTE}</p>}
                {job.aiRead.processingNotes && (
                  <p className="note">The AI also noted: {job.aiRead.processingNotes}</p>
                )}
                {/* THE PARSER-TAKEOFF PANE'S OWN BUTTON. This is the half of
                    v7's side-by-side "original email beside this reading" that
                    the live app actually has — see docs/design/
                    V7_PIXEL_REPORT.md, where `source-sketch`/`source-photo` are
                    recorded as having NO LIVE ROUTE. Steve reads the parser's
                    output here, so this is where "the parser got it wrong"
                    needs an answer. */}
                <div className="bar">
                  <FlashDraftButton link={job.flashDraftLink} testId="job-flashdraft-takeoff" />
                </div>
                <p className="note">
                  If the reading above is wrong, redraw the profile instead of correcting it in
                  words. Saving in FlashDraft writes the corrected drawing back onto this job.
                </p>
              </>
            ) : (
              <p className="hint">
                No AI reading for this one — the customer specified it directly, so there is nothing
                for the AI to have guessed at. What they sent is above and the numbers below are
                theirs.
              </p>
            )}
            </div>
          </section>
          </PanelErrorBoundary>

          {/* ============ COLUMN 2 — THE PROFILE ============ */}
          <PanelErrorBoundary
            label="The profile"
            testId="job-panel-error-profile"
            guidance="Nothing was changed. The request and the action panel either side of this one still work, and Open in FlashDraft still shows the real drawing."
          >
          <section className="pane">
            <h2>The profile</h2>

            <div className="plate">
              {drawingPath ? (
                <svg viewBox="0 0 100 100" width="220" height="220" role="img" aria-label="Profile cross-section">
                  <path
                    d={drawingPath}
                    strokeWidth="3"
                    className="ln"
                  />
                </svg>
              ) : (
                <p className="cap">No drawn cross-section came with this job.</p>
              )}
            </div>

            {/* v7 `profilePane()` (line 1354) sets the profile's facts as a
                `dl.sp` — a two-column definition grid. The CSS selector is
                `dl.sp`, so this must be a real <dl>; a <div class="sp"> would
                match nothing and render unstyled. */}
            {job.items.map((item, i) => (
              <dl className="sp" key={i}>
                <dt>Item</dt>
                <dd>
                  {item.profileType} × {item.quantity}
                </dd>
                <dt>Material</dt>
                <dd>
                  {[item.gauge, item.material, item.lengthFt ? `${item.lengthFt} ft` : null, job.color, job.finish]
                    .filter(Boolean)
                    .join(', ') || 'No specification given'}
                </dd>
                {item.geometrySummary ? (
                  <>
                    <dt>Bends</dt>
                    <dd>{item.geometrySummary}</dd>
                  </>
                ) : null}
              </dl>
            ))}

            {/* THE PROFILE PANE'S OWN COPY OF THE BUTTON. v7 puts it inside
                `profStrip()` (prototype line 1340) right under the drawing,
                which is where an estimator looking at the shape reaches for
                it. The header carries the same action for someone who has
                already decided. Both are the one `flashDraftLink` — they
                cannot word or aim the action differently. */}
            <FlashDraftButton link={job.flashDraftLink} testId="job-flashdraft-profile" />
            <p className="hint">{job.flashDraftLink.hint}</p>
            {job.flashDraftLink.matchedProfileName && (
              <p className="hint">
                This shape matches a saved profile: <b>{job.flashDraftLink.matchedProfileName}</b>.
              </p>
            )}
            {job.flashDraftLink.correction && (
              <p className="hint" data-testid="job-flashdraft-corrected">
                Corrected in FlashDraft by{' '}
                <b>{job.flashDraftLink.correction.correctedByName ?? 'an admin'}</b> on{' '}
                {formatCorrectedAt(job.flashDraftLink.correction.correctedAt)}.
              </p>
            )}

            {/* v7 `.past` block (line 1356): a heading and a `.pt` row of
                drawing thumbnails. */}
            <div className="past">
              <h3>
                {(job.customerCompany ?? job.customerName).replace(/\s*\(.*\)$/, '')}&apos;s past
                profiles
              </h3>
              <div className="pt">
                {job.pastProfiles.length > 0 ? (
                  job.pastProfiles.map((p) => (
                    <PastProfileThumb key={p.id} id={p.id} name={p.name} />
                  ))
                ) : (
                  <span className="hint">No past profiles for this customer yet.</span>
                )}
              </div>
            </div>
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
