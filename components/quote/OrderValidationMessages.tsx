'use client';

/**
 * THE CUSTOMER'S SIDE OF THE ORDER VALIDATOR — SPEC_AI_ORDER_VALIDATOR.md section 5.
 *
 * Three pieces, each with one job:
 *   - `FieldValidationMessage`  the line under an input, with the input's own
 *                               border colour decided by `fieldBorderClass`.
 *   - `ValidationErrorBanner`   blocks the advance; says what cannot be made.
 *   - `ValidationWarningBanner` offers "Acknowledge and Continue".
 *
 * WHY THE ACKNOWLEDGEMENT IS KEYED BY MESSAGE AND RESET ON EDIT. The spec says
 * "User must explicitly acknowledge each warning". If an acknowledgement
 * survived the edit that invalidated it, a customer could accept "24 inches in
 * 22 ga is at the upper limit", change the width to 40 inches, and walk past a
 * warning they never read. The Quote Builder clears the set whenever a dimension
 * changes; this component only renders what it is told is outstanding.
 *
 * COLOURS. SPEC section 5 names `bg-afs-warning-ghost` and
 * `border-[var(--afs-border-crimson)]`. NEITHER EXISTS — `app/globals.css`
 * defines `--afs-crimson-ghost`, `--afs-amber-ghost` and `--afs-success-ghost`
 * and no warning-ghost or border-crimson at all. This uses the banner idiom
 * roughly twenty existing components already use
 * (`bg-[var(--afs-crimson-ghost)] border border-afs-crimson`), with the amber
 * ghost for warnings. Recorded as discrepancy D4 in
 * EES-OVN.04-ORDER-VALIDATOR.md.
 *
 * This surface is gunmetal, so no status FILL colour is used as text — rule #29.
 */

import type { ValidationMessage } from '@/lib/order-validator/api-shape';
import type { ValidationField, ValidationSeverity } from '@/lib/order-validator/types';

/**
 * The input's own border. Returned as a class so the caller can concatenate it
 * onto the shared `inputClass` rather than this component having to own the
 * whole field.
 *
 * NOT `border-afs-crimson`, AND MEASURED RATHER THAN ASSUMED. The step-2 inputs
 * are `bg-afs-bg-overlay` sitting on a panel that is also `bg-afs-bg-overlay`,
 * so a field's border is the only thing separating the two — and `afs-crimson`
 * against `#4E5568` measures **1.15:1**, with `afs-warning` at 2.47:1, against
 * the 3:1 non-text rule. SPEC section 2 asks for "red border on input"; at 1.15:1 there
 * would have been no visible border at all, which is the one thing this is for.
 *
 * `afs-danger-on-dark` and `afs-warning-on-dark` both measure 4.57:1 there. This
 * is CLAUDE.md rule #29 applied to a boundary rather than to text: on a dark
 * surface the signal has to get lighter, because there is no darker red that
 * helps.
 */
export function fieldBorderClass(severity: ValidationSeverity | null): string {
  if (severity === 'error') return 'border-afs-danger-on-dark';
  if (severity === 'warn') return 'border-afs-warning-on-dark';
  return '';
}

/**
 * The message under one input.
 *
 * Error text is `afs-danger-on-dark` and warning text `afs-warning-on-dark`,
 * not `afs-crimson`/`afs-warning`: those are FILL colours and measure 1.42:1
 * and 3.67:1 as text on gunmetal (CLAUDE.md rule #29). The border above is a
 * boundary, which is the 3:1 rule, and the fill colours are correct there.
 */
export function FieldValidationMessage({ finding }: { finding: ValidationMessage | null }) {
  if (!finding) return null;
  const tone =
    finding.severity === 'error'
      ? 'text-afs-danger-on-dark'
      : finding.severity === 'warn'
        ? 'text-afs-warning-on-dark'
        : 'text-afs-info-on-dark';
  return (
    <p className={`font-body text-xs mt-1.5 ${tone}`} role={finding.severity === 'error' ? 'alert' : undefined}>
      {finding.message}
    </p>
  );
}

export function ValidationErrorBanner({
  findings,
  onRevise,
}: {
  findings: ValidationMessage[];
  onRevise: (field: ValidationField) => void;
}) {
  if (findings.length === 0) return null;
  return (
    <div
      className="bg-[var(--afs-crimson-ghost)] border border-afs-crimson rounded px-4 py-3 mt-6"
      role="alert"
      aria-live="assertive"
      data-testid="order-validator-errors"
    >
      <p className="font-heading text-sm uppercase tracking-wide text-afs-chrome-high mb-2">
        {findings.length === 1 ? 'This cannot be fabricated as specified' : 'These cannot be fabricated as specified'}
      </p>
      <ul className="flex flex-col gap-2">
        {findings.map((finding, index) => (
          <li key={`${finding.field}-${index}`} className="font-body text-sm text-afs-chrome-high">
            {finding.message}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onRevise(findings[0].field)}
        className="mt-3 bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 py-2 rounded text-xs transition-colors"
      >
        Revise Dimensions
      </button>
    </div>
  );
}

export function ValidationWarningBanner({
  findings,
  onAcknowledge,
}: {
  findings: ValidationMessage[];
  onAcknowledge: () => void;
}) {
  if (findings.length === 0) return null;
  const fromAi = findings.some((finding) => finding.fromAi);
  return (
    <div
      className="bg-[var(--afs-amber-ghost)] border border-afs-warning rounded px-4 py-3 mt-6"
      role="status"
      aria-live="polite"
      data-testid="order-validator-warnings"
    >
      <p className="font-heading text-sm uppercase tracking-wide text-afs-chrome-high mb-2">
        Worth confirming before you continue
      </p>
      <ul className="flex flex-col gap-2">
        {findings.map((finding, index) => (
          <li key={`${finding.field}-${index}`} className="font-body text-sm text-afs-chrome-high">
            {finding.message}
          </li>
        ))}
      </ul>
      {/*
        Said plainly when any of these came from the advisory model rather than
        from one of AFS's own rules. A customer is entitled to know which of the
        two they are reading, and an AI observation presented with a rule's
        authority is the thing this label exists to prevent.
      */}
      {/*
        chrome-high, not chrome-silver. Composited over bg-afs-bg-overlay, the
        amber ghost resolves to #625E5D, where chrome-silver measures 4.13:1 —
        under the 4.5:1 body-text rule. CLAUDE.md rule #23's point exactly: the
        right placeholder-ish colour is decided by the surface, not by the token
        name, and a 12% tint IS a different surface. White measures 6.41:1 here;
        this line reads as secondary because it is smaller, not because it is
        dimmer.
      */}
      {fromAi && (
        <p className="font-body text-xs text-afs-chrome-high mt-2">
          Some of these are suggestions from an automated review. AFS will confirm everything before quoting.
        </p>
      )}
      <button
        type="button"
        onClick={onAcknowledge}
        className="mt-3 bg-afs-btn-secondary hover:bg-afs-bg-overlay text-afs-chrome-high font-label font-semibold px-4 py-2 rounded text-xs transition-colors"
      >
        Acknowledge and Continue
      </button>
    </div>
  );
}

/**
 * The quiet notes — a profile that goes to engineering before it is quoted, and
 * anything else that needs no action. Never blocks and never asks to be
 * acknowledged, so it is not a banner.
 */
export function ValidationInfoNotes({ findings }: { findings: ValidationMessage[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 mt-6" data-testid="order-validator-infos">
      {findings.map((finding, index) => (
        <li key={`${finding.field}-${index}`} className="font-body text-xs text-afs-info-on-dark">
          {finding.message}
        </li>
      ))}
    </ul>
  );
}
