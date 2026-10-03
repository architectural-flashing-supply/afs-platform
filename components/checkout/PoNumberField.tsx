import { CHECKOUT_INPUT_CLASS, CHECKOUT_LABEL_CLASS } from './field-classes';
import { PO_NUMBER_MAX_LENGTH, PO_NUMBER_PLACEHOLDER, PO_REQUIRED_HINT } from '@/lib/checkout/po-number';

/**
 * The Purchase Order Number input in checkout Section 1 (Delivery
 * Information) — SPEC_PURCHASE_ORDER_INTEGRATION.md §2's placement.
 *
 * WHY THIS IS ITS OWN COMPONENT. The whole promise of this feature is that a
 * company WITHOUT `companies.require_po` sees the checkout it has always seen.
 * `app/checkout/page.tsx` cannot be rendered in a test — it needs Stripe
 * Elements, `next/navigation`, and a real `quotes` row with `status='sent'`
 * owned by the signed-in user. Extracted and kept free of hooks, this field
 * server-renders, so `lib/checkout/po-number-field.render.test.ts` asserts its
 * exact markup in BOTH states and pins the not-required one to the markup that
 * shipped before the requirement existed.
 *
 * It is presentational on purpose: no `useState`, no fetching, no Stripe. The
 * `required` flag is resolved from `companies.require_po` by the page and
 * passed in; the real enforcement is server-side in
 * `app/api/checkout/create-intent/route.ts`, never here.
 *
 * TWO DELIBERATE DIFFERENCES from the pre-extraction inline JSX, both in both
 * states, both recorded in EES-OVN.07 §13 as assumptions A3 and A4:
 *   - `maxLength` and `placeholder` are now set, because SPEC §2 specifies both
 *     and because an uncapped value overflows Stripe's 500-character metadata
 *     limit on the card path.
 *   - The field renders for Pickup as well as Ship. It used to live inside the
 *     Ship branch, which is why a Pickup customer never saw it — and would have
 *     made a required PO impossible to supply at all.
 */
export interface PoNumberFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** `companies.require_po` for the checking-out customer's company. */
  required: boolean;
  disabled: boolean;
}

export default function PoNumberField({ value, onChange, required, disabled }: PoNumberFieldProps) {
  return (
    <div>
      <label className={CHECKOUT_LABEL_CLASS} htmlFor="po-number">
        {required ? (
          <>
            Purchase Order Number <span aria-hidden="true">*</span>
          </>
        ) : (
          <>
            PO Number <span className="normal-case text-afs-chrome-dim">(optional)</span>
          </>
        )}
      </label>
      <input
        id="po-number"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        aria-required={required ? 'true' : undefined}
        aria-describedby={required ? 'po-number-hint' : undefined}
        maxLength={PO_NUMBER_MAX_LENGTH}
        placeholder={PO_NUMBER_PLACEHOLDER}
        className={`${CHECKOUT_INPUT_CLASS} font-data`}
      />
      {required ? (
        <p id="po-number-hint" className="font-body text-xs text-afs-chrome-mid mt-1.5">
          {PO_REQUIRED_HINT}
        </p>
      ) : null}
    </div>
  );
}
