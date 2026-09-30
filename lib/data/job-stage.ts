/**
 * THE ONE JOB STAGE MODEL — Command Center V2.
 *
 * A `quote_requests` row IS the Job. Every source (FlashDraft, the field app,
 * the quote builder, and later inbound email) creates one, and `job_stage`
 * says which Workbench lane it sits in. See
 * docs/COMMAND_CENTER_V2_SPEC.md §2.2 and migration
 * 032_quote_requests_job_stage.sql.
 *
 * Stages are a LADDER, in this order:
 *
 *   new  ->  quoted  ->  approved  ->  shop  ->  done
 *
 * `job_stage = null` means archived — today that is a cancelled request. It is
 * off the Workbench entirely and is not a rung on the ladder.
 *
 * TRANSITION RULE, enforced here and called from the server:
 *   - forward is allowed, and may skip rungs. Skipping is a real workflow, not
 *     a shortcut: a customer who approves over the phone goes new -> approved
 *     without a `quoted` step, and today's single "Approve & Send to Machine"
 *     click takes a job from `new` to `shop` in one action.
 *   - same-stage is a NO-OP, not an error. This is the fix for the defect
 *     diagnosed 2026-09-30: a second click on "Approve & Send to Machine"
 *     returned `409 Quote request is not pending approval.` and read as a
 *     failure, when the truthful answer was "that already happened". A no-op
 *     has to be distinguishable from a failure, and this is what makes it so.
 *   - backward is REFUSED. Nothing in the approved flow walks a job back, and
 *     a silent backward move would un-send work that is already at the
 *     machine.
 *
 * This module is pure. It does no database access, so it is cheap to unit-test
 * exhaustively and it cannot be bypassed by a caller that forgets a query.
 */

export const JOB_STAGES = ['new', 'quoted', 'approved', 'shop', 'done'] as const;

export type JobStage = (typeof JOB_STAGES)[number];

/** `null` = archived/cancelled: off the Workbench, not on the ladder. */
export type JobStageValue = JobStage | null;

/** Plain-English lane names, as they read in the Workbench header. */
export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Done',
};

/** The one-line "what this lane means" sub-label from the approved design. */
export const JOB_STAGE_SUBLABELS: Record<JobStage, string> = {
  new: 'Needs a quote',
  quoted: 'Waiting on the customer',
  approved: 'Ready for the machine',
  shop: 'At the Thalmann',
  done: 'Delivered',
};

export function isJobStage(value: unknown): value is JobStage {
  return typeof value === 'string' && (JOB_STAGES as readonly string[]).includes(value);
}

/** Position on the ladder; -1 for anything that is not a stage. */
export function stageIndex(stage: JobStageValue): number {
  return stage === null ? -1 : JOB_STAGES.indexOf(stage);
}

export type StageTransition =
  /** Move the row to `to`. */
  | { outcome: 'advance'; to: JobStage }
  /** Already there. Do nothing, and say so in plain English. */
  | { outcome: 'noop'; message: string }
  /** Refuse. `message` is written for a non-technical reader. */
  | { outcome: 'refused'; message: string };

/**
 * The single place that decides whether a stage change is allowed.
 *
 * Every server route that moves a job MUST route its decision through this
 * function rather than writing `job_stage` directly, so "what is allowed" has
 * one definition instead of one per route.
 */
export function planStageTransition(from: JobStageValue, to: JobStage): StageTransition {
  if (!isJobStage(to)) {
    return { outcome: 'refused', message: `"${String(to)}" is not a job stage.` };
  }

  if (from === null) {
    return {
      outcome: 'refused',
      message: 'This job was cancelled, so it cannot be moved. Start a new job instead.',
    };
  }

  if (from === to) {
    return { outcome: 'noop', message: noopMessage(to) };
  }

  if (stageIndex(to) < stageIndex(from)) {
    return {
      outcome: 'refused',
      message:
        `This job is already at "${JOB_STAGE_LABELS[from]}". ` +
        `It cannot go back to "${JOB_STAGE_LABELS[to]}".`,
    };
  }

  return { outcome: 'advance', to };
}

function noopMessage(stage: JobStage): string {
  switch (stage) {
    case 'new':
      return 'This job is already waiting for a quote. Nothing changed.';
    case 'quoted':
      return 'The quote has already been sent to the customer. Nothing was sent again.';
    case 'approved':
      return 'This job is already approved and ready for the machine. Nothing changed.';
    case 'shop':
      return 'This job has already been sent to the machine. Nothing was sent again.';
    case 'done':
      return 'This job is already finished and delivered. Nothing changed.';
  }
}

export { noopMessage as jobStageNoopMessage };
