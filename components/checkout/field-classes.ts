/**
 * The checkout form's field classes, shared by `app/checkout/page.tsx` and
 * `components/checkout/PoNumberField.tsx`.
 *
 * These two strings were module-level constants inside `app/checkout/page.tsx`
 * until the PO Number input was extracted into its own component (so that its
 * required and not-required renders could be asserted in isolation — see
 * `lib/checkout/po-number-field.render.test.ts`). Copying them into the
 * component would have left two strings that must stay identical with nothing
 * keeping them that way, and a silent divergence would show up as one field in
 * the form looking different from its neighbours.
 *
 * The values are unchanged from the originals. `afs-chrome-dim` does not appear
 * here: CLAUDE.md rule #18 bars it as a placeholder colour, and the real
 * placeholder text on these fields inherits from the browser's default styling
 * of `text-afs-chrome-high`, not from a dim token.
 */

export const CHECKOUT_INPUT_CLASS =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body';

export const CHECKOUT_LABEL_CLASS =
  'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';
