/**
 * THE ADMIN REVIEW VIEW of a submitted quote request's line items.
 *
 * RECOMPUTED ON READ, NEVER STORED. There is no column holding a validation
 * result and there deliberately is not going to be one: half the thresholds
 * behind these findings are still unconfirmed assumptions
 * (lib/order-validator/limits.ts), so a finding written at submission time would
 * be frozen against a rule config that has since changed, and an estimator would
 * be reading a refusal AFS no longer makes. Recomputing costs nothing — the
 * engine is pure — and is always current.
 *
 * THIS FUNCTION NEVER THROWS. It is called during the server render of
 * `/admin/quote-requests/[id]`, where `components/ui/PanelErrorBoundary.tsx`
 * cannot help: that boundary catches render errors in a CLIENT subtree, as its
 * own header says, and a throw in a server component takes the whole route to
 * its `error.tsx` instead. So containment has to be here, and the panel renders
 * an honest "could not be checked" instead of the estimator losing the quote
 * form beside it (CLAUDE.md rule #30 — say what did not happen).
 */

import {
  LIMIT_PROVENANCE,
  assumedLimitKeys,
  type LimitProvenance,
  type OrderValidatorLimits,
} from './limits';
import { findingsForAudience, validateOrder } from './validate';
import type { OrderValidatorItem, OrderValidatorResult, ProfileConstraints, ValidationFinding } from './types';

export interface AssumedLimitDisclosure {
  key: keyof OrderValidatorLimits;
  label: string;
  basis: string;
  provenance: LimitProvenance;
}

export interface AdminReviewFindings {
  /** False when the check could not be made at all. Rendered as such. */
  checked: boolean;
  /** Admin scope: every finding, including the internal-only ones. */
  findings: ValidationFinding[];
  counts: OrderValidatorResult['counts'];
  blocked: boolean;
  itemCount: number;
  /**
   * How many line items had a `product_profiles` row behind them. Shown so a
   * clean panel can be told apart from a panel that checked nothing — "nothing
   * to flag" has to mean something was looked at.
   */
  itemsWithRanges: number;
  assumedLimits: AssumedLimitDisclosure[];
}

/** The unconfirmed thresholds, as data for the panel to list. */
export function assumedLimitDisclosures(): AssumedLimitDisclosure[] {
  return assumedLimitKeys().map((key) => ({
    key,
    label: LIMIT_PROVENANCE[key].label,
    basis: LIMIT_PROVENANCE[key].basis,
    provenance: LIMIT_PROVENANCE[key].provenance,
  }));
}

function countItemsWithRanges(
  items: readonly OrderValidatorItem[],
  findings: readonly ValidationFinding[]
): number {
  // An item with no resolved row produces exactly one
  // OV_PROFILE_CONSTRAINTS_UNKNOWN, so the complement is the count that had one.
  // Derived from the engine's own output rather than by re-running the match, so
  // the two cannot disagree about which items were covered.
  const withoutRanges = new Set(
    findings.filter((f) => f.code === 'OV_PROFILE_CONSTRAINTS_UNKNOWN').map((f) => f.itemIndex)
  );
  return items.length - withoutRanges.size;
}

export function buildAdminReview(
  items: readonly OrderValidatorItem[],
  constraints: readonly ProfileConstraints[]
): AdminReviewFindings {
  const assumedLimits = assumedLimitDisclosures();
  try {
    const result = validateOrder({ items, constraints });
    const findings = findingsForAudience(result.findings, 'admin');
    return {
      checked: true,
      findings,
      counts: result.counts,
      blocked: result.blocked,
      itemCount: items.length,
      itemsWithRanges: countItemsWithRanges(items, findings),
      assumedLimits,
    };
  } catch (error) {
    console.error('[Order Validator] admin review failed', error);
    return {
      checked: false,
      findings: [],
      counts: { error: 0, warn: 0, info: 0 },
      blocked: false,
      itemCount: items.length,
      itemsWithRanges: 0,
      assumedLimits,
    };
  }
}
