/**
 * FROM A JOB'S LINE ITEM TO THE THREE NUMBERS THE PRICE BOOK NEEDS: the blank
 * width, the bend count and the hem count.
 *
 * All three come from the REAL GEOMETRY the customer drew, when there is any.
 * `quote_requests.line_items[].points` is FlashDraft's own polyline in world
 * inches, and the blank width is its girth — the sum of the segment lengths,
 * which is exactly what
 * app/api/admin/command-center/approve-quote-request/route.ts already measures
 * to build `machine_jobs.blank_width_mm`. Measuring it the same way here means
 * the number on the quote and the number sent to the Thalmann cannot disagree.
 *
 * WHEN THERE IS NO DRAWING, THIS RETURNS null RATHER THAN A DEFAULT. The
 * approve route has a fallback-geometry path with stand-in leg dimensions, and
 * that is right for a machine profile a human will check before bending. It is
 * wrong for a price: a quote built on a stand-in width is a made-up number with
 * a dollar sign on it, and the quote maths refuses it in plain English instead.
 */

export interface JobLineItemGeometry {
  profileType?: string | null;
  profileName?: string | null;
  material?: string | null;
  gauge?: string | null;
  quantity?: number | null;
  lengthFt?: number | null;
  points?: { x: number; y: number }[] | null;
  hemStart?: unknown;
  hemEnd?: unknown;
  /** Only read when there are no `points` — see below. */
  legA?: number | null;
  legB?: number | null;
  width?: number | null;
  height?: number | null;
}

/** Girth of the drawn profile, in inches, or null when nothing was drawn. */
export function blankWidthInFromPoints(points: { x: number; y: number }[] | null | undefined): number | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) {
      return null;
    }
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total > 0 ? total : null;
}

/**
 * Bends are the INTERIOR vertices of the polyline: a 3-point profile is one
 * bend, a 4-point profile is two. The two endpoints are free ends, not folds —
 * the same reading lib/flashdraft/geometry.ts uses.
 */
export function bendCountFromPoints(points: { x: number; y: number }[] | null | undefined): number {
  if (!Array.isArray(points) || points.length < 3) return 0;
  return points.length - 2;
}

/** 0, 1 or 2 — a profile has at most one hem at each free end. */
export function hemCountOf(item: JobLineItemGeometry): number {
  return (item.hemStart ? 1 : 0) + (item.hemEnd ? 1 : 0);
}

/** How the line reads on the quote. The customer's own name for it wins. */
export function describeQuoteLine(item: JobLineItemGeometry): string {
  const named = typeof item.profileName === 'string' ? item.profileName.trim() : '';
  if (named !== '') return named;
  const type = typeof item.profileType === 'string' ? item.profileType.trim() : '';
  return type !== '' ? type : 'Custom profile';
}

export interface QuoteItemInputLike {
  description: string;
  material: string | null;
  gauge: string | null;
  blankWidthIn: number | null;
  bendCount: number;
  hemCount: number;
  lengthFt: number | null;
  quantity: number;
}

/** One line item, turned into the measurable facts the price book prices. */
export function toQuoteItemInput(item: JobLineItemGeometry): QuoteItemInputLike {
  return {
    description: describeQuoteLine(item),
    material: typeof item.material === 'string' && item.material.trim() !== '' ? item.material.trim() : null,
    gauge: typeof item.gauge === 'string' && item.gauge.trim() !== '' ? item.gauge.trim() : null,
    blankWidthIn: blankWidthInFromPoints(item.points),
    bendCount: bendCountFromPoints(item.points),
    hemCount: hemCountOf(item),
    lengthFt: typeof item.lengthFt === 'number' && Number.isFinite(item.lengthFt) ? item.lengthFt : null,
    quantity: Math.max(0, Math.round(typeof item.quantity === 'number' ? item.quantity : 0)),
  };
}

export function toQuoteItemInputs(items: readonly JobLineItemGeometry[] | null | undefined): QuoteItemInputLike[] {
  if (!Array.isArray(items)) return [];
  return items.map(toQuoteItemInput);
}
