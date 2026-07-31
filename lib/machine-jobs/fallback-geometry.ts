// Shared by app/api/admin/command-center/approve-quote-request/route.ts (which
// builds the actual machine_jobs.custom_bends) and
// lib/data/pending-quote-requests.ts (which needs to warn an admin *before*
// they click Approve, on the Pending Approval card itself) — both need the
// exact same "will this item's geometry be a fabricated 12"/2"/2" guess"
// test, so it lives in one place rather than two copies that could drift.
export interface FallbackGeometryLineItem {
  points?: { x: number; y: number }[] | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
}

// Mirrors buildBendsFromItem's own branch condition in approve-quote-request/
// route.ts: real FlashDraft-drawn points always win. Otherwise, any of
// legA/legB/width(-or-height) being missing means the route substitutes a
// hardcoded placeholder for that field.
export function usesFallbackGeometry(item: FallbackGeometryLineItem): boolean {
  if (item.points && item.points.length >= 2) return false;
  const legAMissing = item.legA == null;
  const legBMissing = item.legB == null;
  const widthMissing = item.width == null && item.height == null;
  return legAMissing || legBMissing || widthMissing;
}
