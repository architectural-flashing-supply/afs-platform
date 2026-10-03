/**
 * THE ENGINE. Pure, deterministic, and the only place that decides whether a
 * quote request can go forward.
 *
 * DETERMINISM IS A REQUIREMENT, NOT A NICETY. The same drawing is validated
 * three times on its way through this platform — live in the Quote Builder as
 * the customer types, again on the server when they press Next, and again on the
 * admin review screen when an estimator opens it. If those three could disagree,
 * the customer would be told one thing and the estimator another about the same
 * piece of metal. So: no clock, no random source, no I/O, no mutation of the
 * input, and an explicit sort rather than whatever order the rules happened to
 * append in.
 *
 * WHAT IS AUTHORITATIVE. `blocked` is computed from DETERMINISTIC errors only.
 * SPEC_AI_ORDER_VALIDATOR.md section 5 would have had the AI layer's errors block an
 * advance; this build deliberately does not, because model output is unverified
 * and refusing a fabricable order is as expensive a mistake as missing an
 * impossible one. `withAdvisories` is the only way an AI finding enters a
 * result, and it cannot change `blocked`.
 */

import { ALL_RULES, type RuleContext } from './rules';
import { profileLabelKey, resolveLimits, type OrderValidatorLimits } from './limits';
import type {
  OrderValidatorItem,
  OrderValidatorResult,
  ProfileConstraints,
  ValidationAudience,
  ValidationFinding,
} from './types';

export interface OrderValidatorInput {
  items: readonly OrderValidatorItem[];
  /**
   * Resolved `product_profiles` rows. Matched to each item by its free-text
   * profile label — see `matchConstraints`. An empty list is legitimate: a guest
   * cannot read `product_profiles` (its RLS requires a session), so the live
   * client-side pass may have none, and the rules that need ranges simply do not
   * run while `OV_PROFILE_CONSTRAINTS_UNKNOWN` records that for the estimator.
   */
  constraints?: readonly ProfileConstraints[];
  /** Overrides on the limits table. Omitted = the documented defaults. */
  limits?: Partial<OrderValidatorLimits>;
}

/**
 * Rule evaluation order, as an index, so the sort below can reproduce it.
 * Built once at module load from `ALL_RULES` — the single source of the order.
 */
const RULE_ORDER = new Map(ALL_RULES.map((rule, index) => [rule.code, index]));

/**
 * Which `product_profiles` row this item's profile label refers to, or null.
 *
 * Matched on the normalised label against both the row's `name` and its `slug`,
 * because the three submission surfaces disagree: the Quote Builder sends
 * display labels ('Window / Door Flashing'), FlashDraft sends 'Custom FlashDraft
 * Profile', and an admin-side caller may already hold the slug. Alias
 * resolution for the labels that differ by more than punctuation lives with the
 * reader, in `lib/data/product-profiles.ts` — this is the last-mile exact match,
 * not a fuzzy search, because a wrong profile row means wrong dimension limits.
 */
function matchConstraints(
  item: OrderValidatorItem,
  constraints: readonly ProfileConstraints[]
): ProfileConstraints | null {
  const key = profileLabelKey(item.profileType);
  if (key === '') return null;
  return (
    constraints.find((row) => profileLabelKey(row.name) === key || profileLabelKey(row.slug) === key) ?? null
  );
}

function sortFindings(findings: ValidationFinding[]): ValidationFinding[] {
  return [...findings].sort((a, b) => {
    if (a.itemIndex !== b.itemIndex) return a.itemIndex - b.itemIndex;
    const orderA = RULE_ORDER.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const orderB = RULE_ORDER.get(b.code) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.field !== b.field) return a.field < b.field ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });
}

function countBySeverity(findings: readonly ValidationFinding[]): OrderValidatorResult['counts'] {
  return {
    error: findings.filter((f) => f.severity === 'error').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
}

function summarise(findings: ValidationFinding[]): OrderValidatorResult {
  const sorted = sortFindings(findings);
  const blockers = sorted.filter((f) => f.severity === 'error' && f.source === 'deterministic');
  return {
    findings: sorted,
    counts: countBySeverity(sorted),
    blocked: blockers.length > 0,
    blockedForCustomer: blockers.some((f) => f.audience === 'customer'),
  };
}

/**
 * Validate a whole quote request. Every rule runs against every item; nothing
 * short-circuits, because a customer fixing one problem should be told about the
 * rest in the same pass rather than discovering them one press of Next at a
 * time.
 */
export function validateOrder(input: OrderValidatorInput): OrderValidatorResult {
  const limits = resolveLimits(input.limits);
  const constraints = input.constraints ?? [];
  const items = Array.isArray(input.items) ? input.items : [];

  const findings: ValidationFinding[] = [];
  items.forEach((item, itemIndex) => {
    const context: RuleContext = {
      item,
      itemIndex,
      constraints: matchConstraints(item, constraints),
      limits,
    };
    for (const rule of ALL_RULES) {
      findings.push(...rule.run(context));
    }
  });

  return summarise(findings);
}

/**
 * The findings a given reader may see.
 *
 * Admin scope is a SUPERSET of customer scope — an estimator always sees exactly
 * what the customer was shown, plus the internal detail — so this is the only
 * place either audience is resolved, and `audience: 'admin'` can never reach a
 * customer surface by being forgotten somewhere else.
 */
export function findingsForAudience(
  findings: readonly ValidationFinding[],
  audience: ValidationAudience
): ValidationFinding[] {
  if (audience === 'admin') return [...findings];
  return findings.filter((finding) => finding.audience === 'customer');
}

/** The subset a UI renders as blocking. */
export function blockingFindings(findings: readonly ValidationFinding[]): ValidationFinding[] {
  return findings.filter((finding) => finding.severity === 'error');
}

/** The subset a UI renders as needing acknowledgement. */
export function acknowledgeableFindings(findings: readonly ValidationFinding[]): ValidationFinding[] {
  return findings.filter((finding) => finding.severity === 'warn');
}

/** The subset a UI renders as context. */
export function informationalFindings(findings: readonly ValidationFinding[]): ValidationFinding[] {
  return findings.filter((finding) => finding.severity === 'info');
}

/**
 * Fold advisory findings into a deterministic result.
 *
 * THE CLAMP IS THE POINT. Whatever severity an advisory arrives with, it leaves
 * as `warn` or `info`, and `blocked`/`blockedForCustomer` are carried over from
 * the deterministic pass untouched. An advisory layer that could block would be
 * a model with a veto over a fabricable order.
 */
export function withAdvisories(
  result: OrderValidatorResult,
  advisories: readonly ValidationFinding[]
): OrderValidatorResult {
  if (advisories.length === 0) return result;
  const clamped: ValidationFinding[] = advisories.map((advisory) => ({
    ...advisory,
    source: 'ai',
    severity: advisory.severity === 'info' ? 'info' : 'warn',
  }));
  const merged = sortFindings([...result.findings, ...clamped]);
  return {
    findings: merged,
    counts: countBySeverity(merged),
    blocked: result.blocked,
    blockedForCustomer: result.blockedForCustomer,
  };
}

/**
 * Findings for one line item — what the Quote Builder needs to decorate the
 * input the customer is typing into right now.
 */
export function findingsForItem(
  findings: readonly ValidationFinding[],
  itemIndex: number
): ValidationFinding[] {
  return findings.filter((finding) => finding.itemIndex === itemIndex);
}

/**
 * The single most serious finding against one field, or null.
 *
 * `error` outranks `warn` outranks `info`, and within a severity the first in
 * the engine's own order wins — so an input shows the message a customer should
 * act on first rather than the last one appended.
 */
export function worstFindingForField(
  findings: readonly ValidationFinding[],
  itemIndex: number,
  field: ValidationFinding['field']
): ValidationFinding | null {
  const rank: Record<ValidationFinding['severity'], number> = { error: 0, warn: 1, info: 2 };
  const candidates = findings.filter((f) => f.itemIndex === itemIndex && f.field === field);
  if (candidates.length === 0) return null;
  return candidates.reduce((worst, candidate) => (rank[candidate.severity] < rank[worst.severity] ? candidate : worst));
}
