import { describe, it, expect } from 'vitest';
import {
  JOB_STAGES,
  JOB_STAGE_LABELS,
  JOB_STAGE_SUBLABELS,
  isJobStage,
  stageIndex,
  planStageTransition,
  type JobStage,
} from './job-stage';

describe('job stage model', () => {
  it('has exactly the five stages the CHECK constraint allows, in ladder order', () => {
    expect(JOB_STAGES).toEqual(['new', 'quoted', 'approved', 'shop', 'done']);
  });

  it('labels every stage', () => {
    for (const stage of JOB_STAGES) {
      expect(JOB_STAGE_LABELS[stage]).toBeTruthy();
      expect(JOB_STAGE_SUBLABELS[stage]).toBeTruthy();
    }
  });

  it('recognises only real stages', () => {
    for (const stage of JOB_STAGES) expect(isJobStage(stage)).toBe(true);
    for (const bad of ['submitted', 'reviewing', 'cancelled', 'New', '', null, undefined, 3]) {
      expect(isJobStage(bad)).toBe(false);
    }
  });

  it('places archived (null) off the ladder', () => {
    expect(stageIndex(null)).toBe(-1);
    expect(stageIndex('new')).toBe(0);
    expect(stageIndex('done')).toBe(4);
  });
});

describe('planStageTransition — forward moves', () => {
  it('allows every single step up the ladder', () => {
    const steps: [JobStage, JobStage][] = [
      ['new', 'quoted'],
      ['quoted', 'approved'],
      ['approved', 'shop'],
      ['shop', 'done'],
    ];
    for (const [from, to] of steps) {
      expect(planStageTransition(from, to)).toEqual({ outcome: 'advance', to });
    }
  });

  it('allows skipping rungs, because real workflows skip them', () => {
    // Customer approves over the phone: no `quoted` step ever happens.
    expect(planStageTransition('new', 'approved')).toEqual({ outcome: 'advance', to: 'approved' });
    // Today's single "Approve & Send to Machine" click does new -> shop.
    expect(planStageTransition('new', 'shop')).toEqual({ outcome: 'advance', to: 'shop' });
    expect(planStageTransition('quoted', 'shop')).toEqual({ outcome: 'advance', to: 'shop' });
  });
});

describe('planStageTransition — same stage is a no-op, not a failure', () => {
  // This is the regression guard for the defect diagnosed 2026-09-30: a
  // second click on "Approve & Send to Machine" returned 409 "Quote request
  // is not pending approval." and read as a failure.
  it('returns noop with a plain-English message for every stage', () => {
    for (const stage of JOB_STAGES) {
      const result = planStageTransition(stage, stage);
      expect(result.outcome).toBe('noop');
      if (result.outcome !== 'noop') throw new Error('unreachable');
      expect(result.message.length).toBeGreaterThan(10);
      // Plain English for a non-technical reader: no status codes, no
      // column names, no jargon.
      expect(result.message).not.toMatch(/409|status|job_stage|quote_requests/i);
    }
  });

  it('says nothing was sent again when the job is already at the machine', () => {
    const result = planStageTransition('shop', 'shop');
    if (result.outcome !== 'noop') throw new Error('expected noop');
    expect(result.message).toMatch(/already been sent to the machine/i);
    expect(result.message).toMatch(/nothing was sent again/i);
  });
});

describe('planStageTransition — refusals', () => {
  it('refuses every backward move', () => {
    for (let i = 0; i < JOB_STAGES.length; i++) {
      for (let j = 0; j < i; j++) {
        const result = planStageTransition(JOB_STAGES[i], JOB_STAGES[j]);
        expect(result.outcome, `${JOB_STAGES[i]} -> ${JOB_STAGES[j]}`).toBe('refused');
      }
    }
  });

  it('names both stages in plain English when refusing a backward move', () => {
    const result = planStageTransition('shop', 'new');
    if (result.outcome !== 'refused') throw new Error('expected refused');
    expect(result.message).toContain('In the shop');
    expect(result.message).toContain('New');
  });

  it('refuses to move a cancelled job at all', () => {
    for (const stage of JOB_STAGES) {
      const result = planStageTransition(null, stage);
      expect(result.outcome).toBe('refused');
      if (result.outcome !== 'refused') throw new Error('unreachable');
      expect(result.message).toMatch(/cancelled/i);
    }
  });

  it('refuses a value that is not a stage at all', () => {
    const result = planStageTransition('new', 'reviewing' as JobStage);
    expect(result.outcome).toBe('refused');
  });

  it('covers every ordered pair of stages with a defined outcome', () => {
    // No hole in the matrix: 25 pairs, each classified.
    const outcomes = JOB_STAGES.flatMap((from) =>
      JOB_STAGES.map((to) => planStageTransition(from, to).outcome)
    );
    expect(outcomes).toHaveLength(25);
    expect(outcomes.filter((o) => o === 'noop')).toHaveLength(5);
    expect(outcomes.filter((o) => o === 'advance')).toHaveLength(10);
    expect(outcomes.filter((o) => o === 'refused')).toHaveLength(10);
  });
});
