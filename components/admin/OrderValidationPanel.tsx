/**
 * THE ESTIMATOR'S VIEW of the order validator — admin scope.
 *
 * A server component with no client JavaScript: it renders a computed result and
 * has nothing to interact with. `buildAdminReview` is where the containment
 * lives (it never throws), because `components/ui/PanelErrorBoundary.tsx` cannot
 * catch a throw during a server render — its own header says it catches render
 * errors in a CLIENT subtree.
 *
 * WHAT MAKES THIS DIFFERENT FROM THE CUSTOMER'S VIEW, and why both exist:
 *   - It shows EVERY finding, including the admin-scope ones a customer must not
 *     see: how many strips come off a sheet, which pieces need splicing, and
 *     which profiles AFS holds no dimension data for.
 *   - It shows each finding's stable CODE, so an estimator can quote it in a
 *     message to Steve without retyping the prose.
 *   - It DISCLOSES WHICH THRESHOLDS ARE STILL GUESSES. That is the part that
 *     matters: an estimator reading "this leg is too short to form" is entitled
 *     to know whether the minimum behind it is confirmed shop capability or a
 *     placeholder nobody has signed off.
 *
 * WHY IT IS NOT ON THE COMMAND CENTER JOB SCREEN. `/admin/command-center/job/<id>`
 * is one of the 54 states under the whole-screen pixel gate (CLAUDE.md rule #34),
 * which diffs the live app against the committed v7 prototype. A panel v7 does
 * not have would fail that gate by design, and correctly so. Putting it there is
 * a v7 design change — prototype first, then the gate — not a code change. This
 * screen, `/admin/quote-requests/[id]`, is the pre-V2 admin quote review, is in
 * neither the pixel manifest nor `lib/data/admin-nav.ts`, and is reachable from
 * `/admin`, `/admin/settings` and the dashboard.
 *
 * COLOURS. This screen is gunmetal, so every status TEXT uses the
 * `afs-*-on-dark` family — `afs-crimson` as text on `afs-bg-raised` measures
 * 1.42:1 (CLAUDE.md rule #29). The fill colours appear only as borders and
 * chips, where the 3:1 boundary rule applies.
 */

import { buildAdminReview } from '@/lib/order-validator/admin-review';
import type { OrderValidatorItem, ProfileConstraints, ValidationSeverity } from '@/lib/order-validator/types';

const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  error: 'Cannot fabricate',
  warn: 'Confirm',
  info: 'Note',
};

/**
 * THE CHIP'S BORDER IS THE SAME COLOUR AS ITS TEXT, and that is measured.
 *
 * The obvious choice is the fill colour — `border-afs-crimson`,
 * `border-afs-info` — and it does not work on gunmetal: against
 * `afs-bg-raised` (#363C4A) those measure **1.71:1** and **2.34:1** against the
 * 3:1 non-text rule, so the chip would have no visible outline. The `*-on-dark`
 * family measures 6.78:1 and better there. Rule #29's reasoning applies to a
 * boundary exactly as it does to text: on a dark surface the fix is lighter, and
 * there is no darker red that helps.
 */
const SEVERITY_CHIP: Record<ValidationSeverity, string> = {
  error: 'border-afs-danger-on-dark text-afs-danger-on-dark',
  warn: 'border-afs-warning-on-dark text-afs-warning-on-dark',
  info: 'border-afs-info-on-dark text-afs-info-on-dark',
};

function itemLabel(item: OrderValidatorItem | undefined, index: number): string {
  const named = typeof item?.profileName === 'string' ? item.profileName.trim() : '';
  if (named !== '') return named;
  const type = typeof item?.profileType === 'string' ? item.profileType.trim() : '';
  if (type !== '') return type;
  return `Line ${index + 1}`;
}

export default function OrderValidationPanel({
  items,
  constraints,
}: {
  items: readonly OrderValidatorItem[];
  constraints: readonly ProfileConstraints[];
}) {
  const review = buildAdminReview(items, constraints);

  // Grouped by line item so a multi-item request reads as a list of lines rather
  // than a flat list of complaints.
  const byItem = new Map<number, typeof review.findings>();
  for (const finding of review.findings) {
    const existing = byItem.get(finding.itemIndex);
    if (existing) existing.push(finding);
    else byItem.set(finding.itemIndex, [finding]);
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-afs-border flex items-center justify-between gap-4">
        <span className="font-heading text-sm uppercase tracking-wide text-afs-chrome-mid">
          Fabrication Check
        </span>
        {review.checked && (
          <span className="font-data text-xs text-afs-chrome-mid">
            {review.counts.error} cannot fabricate · {review.counts.warn} to confirm · {review.counts.info} notes
          </span>
        )}
      </div>

      <div className="p-6">
        {!review.checked ? (
          /* CLAUDE.md rule #30's wording rule: say what did NOT happen. */
          <p className="font-body text-sm text-afs-warning-on-dark">
            The fabrication check could not be run on this request. Nothing about the request has changed and
            nothing has been sent anywhere — the dimensions below are exactly as the customer submitted them.
          </p>
        ) : review.findings.length === 0 ? (
          <div>
            <p className="font-body text-sm text-afs-success-on-dark">
              Nothing to flag on {review.itemCount === 1 ? 'this line' : `these ${review.itemCount} lines`}.
            </p>
            {/*
              A clean panel has to be distinguishable from a panel that checked
              nothing, which is why the coverage is stated rather than implied.
            */}
            <p className="font-body text-xs text-afs-chrome-mid mt-1.5">
              Checked dimension ranges on {review.itemsWithRanges} of {review.itemCount}
              {review.itemCount === 1 ? ' line' : ' lines'}, plus geometry, hem and sheet-size checks on all of
              them.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {[...byItem.entries()].map(([itemIndex, findings]) => (
              <li key={itemIndex}>
                <p className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid mb-2">
                  {itemLabel(items[itemIndex], itemIndex)}
                </p>
                <ul className="flex flex-col gap-2">
                  {findings.map((finding, index) => (
                    <li key={`${finding.code}-${finding.field}-${index}`} className="flex items-start gap-3">
                      <span
                        className={`font-label text-[10px] uppercase tracking-wide border rounded-sm px-1.5 py-0.5 shrink-0 ${SEVERITY_CHIP[finding.severity]}`}
                      >
                        {SEVERITY_LABEL[finding.severity]}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-body text-sm text-afs-chrome-high">{finding.message}</span>
                        <span className="font-data text-[10px] text-afs-chrome-mid">
                          {finding.field} · {finding.code}
                          {finding.source === 'ai' ? ' · automated review, not an AFS rule' : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {review.assumedLimits.length > 0 && (
          <details className="mt-6 border-t border-afs-border pt-4">
            <summary className="font-label text-xs uppercase tracking-wide text-afs-warning-on-dark cursor-pointer">
              {review.assumedLimits.length} of these limits are not confirmed yet
            </summary>
            <ul className="flex flex-col gap-2 mt-3">
              {review.assumedLimits.map((limit) => (
                <li key={limit.key}>
                  <p className="font-body text-xs text-afs-chrome-high">{limit.label}</p>
                  <p className="font-body text-xs text-afs-chrome-silver">{limit.basis}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
