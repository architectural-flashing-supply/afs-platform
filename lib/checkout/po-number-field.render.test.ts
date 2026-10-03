import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PoNumberField from '@/components/checkout/PoNumberField';
import { CHECKOUT_INPUT_CLASS, CHECKOUT_LABEL_CLASS } from '@/components/checkout/field-classes';
import { PO_NUMBER_MAX_LENGTH, PO_NUMBER_PLACEHOLDER, PO_REQUIRED_HINT } from './po-number';

/**
 * THE "NOTHING CHANGED FOR EVERYBODY ELSE" TEST.
 *
 * The hard constraint on this item is that a company WITHOUT
 * `companies.require_po` sees the checkout it has always seen. This file proves
 * it by server-rendering the real shipped component and comparing its markup,
 * character for character, against the markup the inline JSX in
 * `app/checkout/page.tsx` produced before the requirement existed.
 *
 * WHY A RENDER ASSERTION RATHER THAN A PLAYWRIGHT SCREENSHOT.
 * `app/checkout/page.tsx` is unreachable in a test without a live Supabase
 * project: its own `load()` demands a real `quotes` row with `status='sent'`
 * owned by the signed-in user, and `tests/e2e/README.md` records that no test
 * account exists in this repo. A Playwright comparison would report SKIPPED and
 * prove nothing. This runs, today, against the code that ships.
 *
 * The expected strings below are not hand-written guesses — they were captured
 * from an actual `renderToStaticMarkup` run and pasted in. If React changes its
 * attribute ordering or serialisation, this test fails loudly and a human reads
 * the diff, which is the correct outcome for a regression lock.
 */

/** A fixed, non-random value so a failure diff shows exactly one difference. */
const VALUE = 'PO-1';

function render(props: { required: boolean; disabled: boolean }): string {
  return renderToStaticMarkup(
    React.createElement(PoNumberField, {
      value: VALUE,
      onChange: () => undefined,
      required: props.required,
      disabled: props.disabled,
    })
  );
}

/**
 * The markup `app/checkout/page.tsx` produced for this field BEFORE this item,
 * reconstructed from the JSX at the commit this work started from (75118cb,
 * `app/checkout/page.tsx:412-425`):
 *
 *   <div>
 *     <label className={labelClass} htmlFor="po-number">
 *       PO Number <span className="normal-case text-afs-chrome-dim">(optional)</span>
 *     </label>
 *     <input id="po-number" type="text" value={poNumber}
 *            onChange={...} disabled={submitting}
 *            className={`${inputClass} font-data`} />
 *   </div>
 *
 * Built from the shared class constants rather than from pasted class strings,
 * so a class change shows up as a deliberate edit here instead of two literals
 * silently disagreeing.
 */
const PRE_CHANGE_MARKUP =
  `<div>` +
  `<label class="${CHECKOUT_LABEL_CLASS}" for="po-number">` +
  `PO Number <span class="normal-case text-afs-chrome-dim">(optional)</span>` +
  `</label>` +
  `<input id="po-number" type="text" class="${CHECKOUT_INPUT_CLASS} font-data" value="${VALUE}"/>` +
  `</div>`;

/**
 * The two attributes SPEC_PURCHASE_ORDER_INTEGRATION.md §2 adds to the field in
 * BOTH states ("Max: 50 characters", 'Placeholder: "e.g. PO-2026-04521"'), and
 * the only way the not-required render differs from PRE_CHANGE_MARKUP. Recorded
 * as assumption A3 in EES-OVN.07 §13.
 */
const SPEC_ADDED_ATTRIBUTES = ` maxLength="${PO_NUMBER_MAX_LENGTH}" placeholder="${PO_NUMBER_PLACEHOLDER}"`;

describe('PoNumberField — not required (companies.require_po = false)', () => {
  it('renders the pre-change markup exactly, once the two spec-mandated attributes are discounted', () => {
    // ARRANGE / ACT
    const markup = render({ required: false, disabled: false });

    // ASSERT — the whole point of the item: nothing else moved.
    expect(
      markup.replace(SPEC_ADDED_ATTRIBUTES, ''),
      'A company with no PO requirement must see the field it has always seen. Apart from SPEC §2\'s maxLength and placeholder, every tag, class, attribute and word must be byte-identical to what app/checkout/page.tsx rendered at 75118cb.'
    ).toBe(PRE_CHANGE_MARKUP);
  });

  it('adds exactly the two spec-mandated attributes and nothing else', () => {
    const markup = render({ required: false, disabled: false });

    expect(
      markup,
      'The not-required render must be the pre-change markup plus precisely maxLength and placeholder — if this fails while the test above passes, something was added in a second place.'
    ).toBe(
      // Anchored on `type="text" class="` so the insertion lands on the INPUT.
      // Anchoring on ` class="` alone matches the <label> first, which is the
      // wrong element and made this assertion fail while the exact-equality
      // test above passed.
      PRE_CHANGE_MARKUP.replace(' type="text" class="', ` type="text"${SPEC_ADDED_ATTRIBUTES} class="`)
    );
  });

  it('keeps the label reading "PO Number (optional)"', () => {
    const markup = render({ required: false, disabled: false });
    expect(
      markup.includes('PO Number <span class="normal-case text-afs-chrome-dim">(optional)</span>'),
      'The optional-state label wording and its qualifier span are pre-existing copy and must not be restyled by this item.'
    ).toBe(true);
  });

  it('emits no required attribute', () => {
    const markup = render({ required: false, disabled: false });
    expect(
      markup.includes('required'),
      'A customer with no company requirement must not get a browser-level required field. Markup was: ' + markup
    ).toBe(false);
  });

  it('emits no aria-required', () => {
    const markup = render({ required: false, disabled: false });
    expect(
      markup.includes('aria-required'),
      'Announcing an optional field as required would mislead a screen-reader user.'
    ).toBe(false);
  });

  it('renders no required hint', () => {
    const markup = render({ required: false, disabled: false });
    expect(
      markup.includes(PO_REQUIRED_HINT),
      `"${PO_REQUIRED_HINT}" must appear only for a company that actually has the requirement.`
    ).toBe(false);
  });

  it('renders no hint paragraph element at all', () => {
    const markup = render({ required: false, disabled: false });
    expect(
      markup.includes('po-number-hint'),
      'The hint element must be absent, not merely empty — an empty <p> would still take vertical space and shift the form.'
    ).toBe(false);
  });
});

describe('PoNumberField — required (companies.require_po = true)', () => {
  it('renders the full required-state markup', () => {
    const markup = render({ required: true, disabled: false });

    expect(
      markup,
      'The required state is the feature being added; this pins its exact rendered form.'
    ).toBe(
      `<div>` +
        `<label class="${CHECKOUT_LABEL_CLASS}" for="po-number">` +
        `Purchase Order Number <span aria-hidden="true">*</span>` +
        `</label>` +
        `<input id="po-number" type="text" required="" aria-required="true" aria-describedby="po-number-hint"` +
        ` maxLength="${PO_NUMBER_MAX_LENGTH}" placeholder="${PO_NUMBER_PLACEHOLDER}"` +
        ` class="${CHECKOUT_INPUT_CLASS} font-data" value="${VALUE}"/>` +
        `<p id="po-number-hint" class="font-body text-xs text-afs-chrome-mid mt-1.5">${PO_REQUIRED_HINT}</p>` +
        `</div>`
    );
  });

  it('uses SPEC §2\'s label "Purchase Order Number", not the optional-state wording', () => {
    const markup = render({ required: true, disabled: false });
    expect(
      markup.includes('Purchase Order Number'),
      'SPEC_PURCHASE_ORDER_INTEGRATION.md §2 fixes this label.'
    ).toBe(true);
    expect(
      markup.includes('(optional)'),
      'A required field must not still be labelled optional — that is the one contradiction a customer would act on.'
    ).toBe(false);
  });

  it('marks the field required for the browser and for assistive technology', () => {
    const markup = render({ required: true, disabled: false });
    expect(markup.includes('required=""'), 'SPEC §3: "PO field marked required in checkout".').toBe(true);
    expect(
      markup.includes('aria-required="true"'),
      'The requirement must be announced, not only enforced visually.'
    ).toBe(true);
  });

  it('renders SPEC §2\'s hint and ties it to the input with aria-describedby', () => {
    const markup = render({ required: true, disabled: false });
    expect(markup.includes(PO_REQUIRED_HINT), 'SPEC §2 mandates this hint when the field is required.').toBe(true);
    expect(
      markup.includes('aria-describedby="po-number-hint"'),
      'The hint explains WHY the field is required; a screen-reader user must receive it with the field, not adrift after it.'
    ).toBe(true);
  });

  it('hides the decorative asterisk from assistive technology, which already has aria-required', () => {
    const markup = render({ required: true, disabled: false });
    expect(
      markup.includes('<span aria-hidden="true">*</span>'),
      'The asterisk is a visual marker duplicating aria-required; announcing "star" as well is noise.'
    ).toBe(true);
  });
});

describe('PoNumberField — state comparison and shared attributes', () => {
  it('renders different markup in the two states, so the requirement is actually visible', () => {
    const optional = render({ required: false, disabled: false });
    const required = render({ required: true, disabled: false });
    expect(
      optional === required,
      'If both states rendered identically the requirement would be invisible to the customer and this whole feature would be server-side-only.'
    ).toBe(false);
  });

  it('caps length in both states, because the limit is about storage not policy', () => {
    for (const required of [false, true]) {
      const markup = render({ required, disabled: false });
      expect(
        markup.includes(`maxLength="${PO_NUMBER_MAX_LENGTH}"`),
        `maxLength must apply with required=${required}: the card path writes this value into Stripe PaymentIntent metadata, which is capped at 500 characters regardless of any company setting.`
      ).toBe(true);
    }
  });

  it('shows the spec placeholder in both states', () => {
    for (const required of [false, true]) {
      const markup = render({ required, disabled: false });
      expect(
        markup.includes(`placeholder="${PO_NUMBER_PLACEHOLDER}"`),
        `SPEC §2's placeholder is not conditional on the requirement (required=${required}).`
      ).toBe(true);
    }
  });

  it('keeps the id stable across states so existing selectors and labels still resolve', () => {
    for (const required of [false, true]) {
      const markup = render({ required, disabled: false });
      expect(
        markup.includes('id="po-number"') && markup.includes('for="po-number"'),
        `id and htmlFor must stay "po-number" (required=${required}) — the pre-existing value, which the label association and the E2E selectors depend on.`
      ).toBe(true);
    }
  });

  it('disables the input while the order is submitting, in both states', () => {
    for (const required of [false, true]) {
      const markup = render({ required, disabled: true });
      expect(
        markup.includes('disabled=""'),
        `The field must lock during submission (required=${required}), like every other field in checkout Section 1 — editing a PO mid-charge would store a value the customer did not confirm.`
      ).toBe(true);
    }
  });

  it('does not disable the input when not submitting', () => {
    const markup = render({ required: false, disabled: false });
    expect(
      markup.includes('disabled'),
      'The field must be editable in the normal state. Markup was: ' + markup
    ).toBe(false);
  });
});
