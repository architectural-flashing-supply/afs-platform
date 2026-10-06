/**
 * THE SHOP CALLOUT CONTRACT — one shape, shared by the authoring canvas, the
 * API and the shop floor.
 *
 * CLAUDE.md rule #17's lesson, applied: the confidence vocabulary was written
 * twice and drifted, so it now lives in one module both producer and consumer
 * import. A callout crosses three surfaces (FlashDraft, two API routes, Shop
 * View) and a local `type Status = 'exact' | ...` in any of them is the same
 * drift. Everything about a callout's shape is here.
 */
import type { CalloutAnchorStatus } from './geometry';

/** The note's own limit. Postgres enforces it too (migration 051). */
export const NOTE_MAX_CHARS = 280;

/**
 * A callout as every reader sees it.
 *
 * `number` is 1..n by creation order and is DERIVED, never stored — see
 * `numberCallouts`. `anchorStatus` is derived too, against whatever geometry
 * the reader is holding.
 */
export interface ShopCallout {
  id: string;
  /** 1..n by creation order, assigned by numberCallouts(). */
  number: number;
  note: string;
  /** Who typed it, for the shop to read. Falls back to the email, then to "AFS". */
  authorName: string;
  createdAt: string;
  updatedAt: string;
  /** The stored anchor, all in inches. */
  segmentIndex: number;
  segmentCount: number;
  t: number;
  segA: { x: number; y: number };
  segB: { x: number; y: number };
  anchor: { x: number; y: number };
  tail: { dx: number; dy: number };
  /** Last persisted orphan state. The live truth is `anchorStatus` below. */
  orphaned: boolean;
  /** Where it resolves against the geometry THIS reader is holding. */
  anchorStatus: CalloutAnchorStatus;
  /** The tip in inches, or null when orphaned. */
  tip: { x: number; y: number } | null;
}

/** What the shop floor is handed for one job. */
export interface ShopCalloutSet {
  /** Numbered, creation order, soft-deleted rows already gone. */
  callouts: ShopCallout[];
  /** The profile the arrows are drawn on, in inches. Empty when none is stored. */
  points: { x: number; y: number }[];
  /**
   * TRUE WHEN THE NOTES COULD NOT BE READ — which is NOT the same as there
   * being none, and the difference is the whole reason this field exists.
   *
   * Found live on 2026-10-06, before the migration had been applied anywhere
   * but a local cluster: the read failed, returned an empty list, and every
   * surface rendered a confident "No shop notes on this job." An operator
   * would have run a job believing there was nothing to read.
   *
   * An empty list means nobody wrote one. This flag means nobody could tell.
   * Every reader must say so out loud and must never render the empty state
   * while it is true.
   */
  unreadable: boolean;
}

/** The sentence every surface uses when the notes could not be read. */
export const CALLOUTS_UNREADABLE_MESSAGE =
  'Shop notes could not be read, so none are shown. If this job has notes from Steve you are not seeing them — check with the office before running it.';

/**
 * The banner sentence, in one place.
 *
 * Reid's words, kept verbatim rather than paraphrased — an operator learns the
 * shape of a warning and a reworded one reads as a different warning. Returns
 * null at zero, because "0 shop notes" is a banner that trains people to
 * ignore banners.
 */
export function shopCalloutBanner(count: number): string | null {
  if (count <= 0) return null;
  return `${count} shop note${count === 1 ? '' : 's'} from Steve — read before running`;
}

/** The accessible, colour-free label every note carries alongside the red. */
export const SHOP_NOTE_LABEL = 'SHOP NOTE';

/**
 * 1..n BY CREATION ORDER, COMPUTED IN ONE PLACE.
 *
 * Both surfaces call this, so the number beside an arrow and the number beside
 * a note in the panel cannot disagree. Sorting is by `created_at` and then by
 * `id`, because two callouts inserted inside the same millisecond would
 * otherwise number differently on two reads of the same data and the panel's
 * "click 2 to highlight arrow 2" would point at a different arrow each time.
 */
export function numberCallouts<T extends { id: string; createdAt: string }>(rows: T[]): (T & { number: number })[] {
  return [...rows]
    .sort((a, b) => {
      const at = a.createdAt.localeCompare(b.createdAt);
      return at !== 0 ? at : a.id.localeCompare(b.id);
    })
    .map((row, i) => ({ ...row, number: i + 1 }));
}
