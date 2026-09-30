/**
 * THE ONE CONFIDENCE PATTERN. Do not write a second one.
 *
 * `app/api/takeoff/route.ts` has produced per-field AI confidence since it was
 * built: its system prompt (line ~78, "Confidence: high, medium, or low") makes
 * the model return, per extracted item, a `confidence` of `high | medium | low`
 * and an `aiNote` saying where the value came from or why it is uncertain, plus
 * one `overallConfidence` for the whole read. `app/api/field/photo-upload`
 * returns the same shape, and both persist it to
 * `takeoff_uploads.result_items` / `.overall_confidence`.
 *
 * The Command Center V2 Job screen's "What the AI read" panel highlights the
 * fields the AI is less sure about. That highlight IS this confidence — prompt
 * v2-02's instruction is to reuse this pattern rather than invent a second
 * one — so the type, the threshold and the row-building all live here, and
 * both the producer (the takeoff route) and the consumer (the Job screen)
 * import them. There is nowhere for the two to drift apart.
 *
 * The threshold is `confidence !== 'high'` — matching the approved prototype's
 * `.unsure` highlight, which is on any field the AI qualified rather than only
 * the ones it flagged 'low'. A 'medium' reading is exactly the kind a human
 * should check before it becomes a price.
 */

export type TakeoffConfidence = 'high' | 'medium' | 'low';

export function isTakeoffConfidence(value: unknown): value is TakeoffConfidence {
  return value === 'high' || value === 'medium' || value === 'low';
}

/** The prototype's `.unsure` rule, in one place. */
export function isUnsure(confidence: unknown): boolean {
  return isTakeoffConfidence(confidence) ? confidence !== 'high' : true;
}

/**
 * The fields of a takeoff result item that "What the AI read" displays. A
 * superset exists in app/upload/page.tsx's TakeoffItem (which also carries
 * roof-panel-only fields); this is deliberately the reading-panel's subset, so
 * the Job screen does not take a dependency on a page component.
 */
export interface TakeoffReadItem {
  profileType?: string | null;
  material?: string | null;
  gauge?: string | null;
  finish?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt?: number | null;
  quantity?: number | null;
  unit?: string | null;
  confidence?: unknown;
  aiNote?: string | null;
}

/** One line of the "What the AI read" definition list. */
export interface AiReadRow {
  term: string;
  value: string;
  /** True -> render with the amber `.unsure` highlight. */
  unsure: boolean;
  /** The model's own note about this item, shown under the row when present. */
  note: string | null;
}

function dim(label: string, value: number | null | undefined, unit = 'in'): string | null {
  return value === null || value === undefined ? null : `${label} ${value} ${unit}`;
}

/**
 * Turns a stored takeoff result into the panel's rows.
 *
 * A field the AI did NOT read is omitted rather than rendered as "null" — the
 * panel is "what the AI read", and a blank is not a reading. Every row inherits
 * its ITEM's confidence, because that is the granularity the model actually
 * reports at; claiming per-field confidence the model never gave would be
 * inventing precision.
 */
export function buildAiReadRows(items: TakeoffReadItem[]): AiReadRow[] {
  const rows: AiReadRow[] = [];
  items.forEach((item, index) => {
    const unsure = isUnsure(item.confidence);
    const note = item.aiNote?.trim() ? item.aiNote.trim() : null;
    const prefix = items.length > 1 ? `Item ${index + 1}: ` : '';

    const push = (term: string, value: string | null) => {
      if (value === null || value.trim() === '') return;
      rows.push({ term: `${prefix}${term}`, value, unsure, note });
    };

    push('Profile', item.profileType ?? null);
    push('Material', item.material ?? null);
    push('Gauge', item.gauge ?? null);
    push('Finish', item.finish ?? null);
    const dims = [
      dim('W', item.width),
      dim('H', item.height),
      dim('Leg A', item.legA),
      dim('Leg B', item.legB),
    ].filter((s): s is string => s !== null);
    push('Dimensions', dims.length ? dims.join(', ') : null);
    push('Length', item.lengthFt === null || item.lengthFt === undefined ? null : `${item.lengthFt} ft`);
    push(
      'Quantity',
      item.quantity === null || item.quantity === undefined
        ? null
        : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    );
  });
  return rows;
}

/** The sentence under the list, shown only when something really is highlighted. */
export const UNSURE_FOOTNOTE =
  'Highlighted items are ones the AI is less sure about. Check them before sending.';

export function hasUnsureRows(rows: AiReadRow[]): boolean {
  return rows.some((r) => r.unsure);
}
