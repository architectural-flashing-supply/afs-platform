/**
 * THE LABEL MAPS — the one place the English lives.
 *
 * `FREIGHT_SURCHARGE_LABELS` is read by three things that must agree: the rate
 * editor's form, every 400 the rate route returns for a malformed amount, and
 * the surcharge blanks warning. `FREIGHT_SURCHARGE_FIELDS` is the iteration
 * order all three use.
 *
 * So the drift this suite guards is specific: a field added to one and not the
 * other. That produces a form with an unlabelled box, or a validation error
 * naming a field the form does not show — neither of which any other test in
 * this directory would notice, because the estimator never reads a label.
 */
import { describe, expect, it } from 'vitest';
import {
  FREIGHT_BASIS_LABELS,
  FREIGHT_SURCHARGE_FIELDS,
  FREIGHT_SURCHARGE_LABELS,
} from './types';

describe('FREIGHT_SURCHARGE_LABELS and FREIGHT_SURCHARGE_FIELDS cannot drift apart', () => {
  it('lists exactly the three configurable surcharge fields, in form order', () => {
    expect(
      [...FREIGHT_SURCHARGE_FIELDS],
      'These three and no others are configurable: the residential surcharge (#29), the liftgate ' +
        'upcharge (#88) and the free freight threshold (#30). A fourth appearing here without a ' +
        'migration behind it would be a form box with nowhere to save to.'
    ).toEqual(['residentialCents', 'liftgateCents', 'freeFreightThresholdCents']);
  });

  it('gives every iterated field a label', () => {
    for (const field of FREIGHT_SURCHARGE_FIELDS) {
      expect(
        FREIGHT_SURCHARGE_LABELS[field],
        `${field} is iterated by the editor and the rate route but has no label, so it would render ` +
          `an unlabelled money box and return a validation error naming nothing.`
      ).toBeTruthy();
    }
  });

  it('has no label for a field nothing iterates', () => {
    expect(
      Object.keys(FREIGHT_SURCHARGE_LABELS).sort(),
      'A label with no field behind it is English for something that cannot be set, which is how a ' +
        'half-removed feature leaves a trace in the UI.'
    ).toEqual([...FREIGHT_SURCHARGE_FIELDS].sort());
  });

  it('names the money in each label, since every one of them is a dollar amount', () => {
    expect(FREIGHT_SURCHARGE_LABELS.residentialCents, 'Reads as a surcharge.').toBe(
      'Residential delivery surcharge'
    );
    expect(FREIGHT_SURCHARGE_LABELS.liftgateCents, 'Reads as an upcharge.').toBe(
      'Liftgate service upcharge'
    );
    expect(
      FREIGHT_SURCHARGE_LABELS.freeFreightThresholdCents,
      'Reads as a threshold, not a surcharge — it is the one field that REDUCES freight, and labelling ' +
        'it like the other two would invite somebody to type a surcharge into it.'
    ).toBe('Free freight threshold');
  });
});

describe('FREIGHT_BASIS_LABELS covers all three bases', () => {
  it('labels every basis the audit record can carry', () => {
    expect(
      Object.keys(FREIGHT_BASIS_LABELS).sort(),
      'A basis with no label would render blank in the audit trail, which is the one place the ' +
        'provenance of a freight figure is supposed to be legible.'
    ).toEqual(['estimate', 'manual', 'override']);
  });

  it('distinguishes a calculated figure from a changed one from a hand-entered one', () => {
    expect(FREIGHT_BASIS_LABELS.estimate, 'The table produced it, untouched.').toBe(
      'Calculated from the rate table'
    );
    expect(
      FREIGHT_BASIS_LABELS.override,
      'The table produced one and a human replaced it — the label has to say BOTH happened, or the ' +
        'record reads as if the table produced the final figure.'
    ).toBe('Calculated, then changed by hand');
    expect(
      FREIGHT_BASIS_LABELS.manual,
      'And the hand-entered case has to say there was no rate, so nobody reads it as an override of ' +
        'something.'
    ).toBe('Entered by hand (no rate available)');
  });
});
