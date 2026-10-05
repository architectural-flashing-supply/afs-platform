/**
 * WHAT REVISION NUMBER DOES THIS SAVE WRITE? One rule, in one place.
 *
 * This was an inline ternary inside a 4,800-line component —
 * `asDuplicate || !savedProfileId ? 1 : revision + 1` — and it was WRONG for
 * eighteen months of feature growth without anything being able to say so,
 * because there was nothing to point a test at. It is a pure function now for
 * exactly that reason.
 *
 * THE BUG IT HAD. `!savedProfileId` was standing in for "this is a brand-new
 * profile with no history". That held until "Modify in FlashDraft" (Part 1,
 * migration 027), which deliberately sets `savedProfileId` to NULL so the first
 * save is an INSERT and a LOCKED original can never be overwritten. From then
 * on the same expression also matched every modified draft, and each one was
 * written as revision 1 — while `loadForModify` had set the component's
 * `revision` to the source's + 1, so the lineage banner said "rev 5" and the
 * info panel said "Revision: 5" over a row that said 1. The screen and the
 * database disagreed in public.
 *
 * REVISION IS LINEAGE DEPTH. Four independent places in this codebase already
 * said so before this function existed:
 *
 *   - migration 027's own comment — "deleting an original must never delete the
 *     REVISIONS drawn from it";
 *   - `loadForModify`'s comment — "sourceProfileId + revision are carried so the
 *     new row records what it was modified from and AT WHICH REVISION";
 *   - the lineage banner, which prints it;
 *   - the profile info panel, which prints it.
 *
 * The saved row was the only outlier, so the row is what changed.
 *
 * THE TEST IS ANCESTRY, NOT INSERT-VS-UPDATE. That is the whole correction:
 * whether a write is an INSERT or an UPDATE is a storage detail, and it stopped
 * tracking "does this drawing have a history" the moment a modified draft began
 * inserting on purpose.
 */

export interface RevisionInput {
  /** The number currently on screen — whatever the load path worked out. */
  revision: number;
  /** This draft's OWN row, if it has one. Null means the save is an INSERT. */
  savedProfileId: string | null;
  /** The profile this draft was opened FROM, via "Modify in FlashDraft". */
  sourceProfileId: string | null;
  /** "Save as a copy" — a separate copy the user asked for. */
  asDuplicate: boolean;
}

export function nextRevisionNumber({
  revision,
  savedProfileId,
  sourceProfileId,
  asDuplicate,
}: RevisionInput): number {
  // SANITISED ONCE, UP FRONT, for every branch that uses it.
  //
  // `revision` reaches here from `dimensions->>'revision'` in a JSONB column
  // with no constraint behind it, so "a number" is a hope rather than a
  // guarantee. The check is `Number.isFinite` BEFORE flooring, because
  // `Math.max(1, Math.floor(x))` does NOT sanitise NaN — `Math.floor(NaN)` is
  // NaN and `Math.max(1, NaN)` is NaN, so the naive form would write NaN into
  // the saved row. That was this file's own first draft, caught by its own
  // test; the same trap applies to the re-save branch below, which is why this
  // is here and not inside one `if`.
  const current = Number.isFinite(revision) ? Math.max(1, Math.floor(revision)) : 1;

  // A duplicate is a separate copy, not the next revision of anything. This
  // branch is deliberately unchanged from the original expression — it was
  // never the defect, and quietly altering it would have been a second change
  // riding along with the fix.
  if (asDuplicate) return 1;

  // Re-saving your own row advances the count.
  if (savedProfileId) return current + 1;

  // An INSERT with ancestry: a modified draft. KEEP the number loadForModify
  // worked out from the source — resetting it here is the bug this file exists
  // to prevent.
  if (sourceProfileId) return current;

  // An INSERT with no ancestry: a genuinely new drawing.
  return 1;
}
