import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * THE ADMIN GATE FOR EVERY LIVE-INVENTORY ROUTE.
 *
 * Two checks, in this order, before any inventory data is read or written:
 * there is a session, and that session's profile is `role = 'admin'`. The same
 * shape the two existing `/api/admin/inventory/*` routes use, factored into one
 * place because six handlers need it and six copies is six chances to forget
 * the second check.
 *
 * It is NOT a replacement for the database: migration 039's RLS policies are
 * the real boundary, and every query below runs on the SESSION client so those
 * policies apply. This gate exists so a non-admin gets 401/403 and a sentence
 * instead of an empty result set that looks like "there is no inventory".
 *
 * Deliberately scoped to this feature rather than added to `lib/admin/`: this
 * run's rules say to make the smallest correct change, and nothing outside
 * these three route files needs it today.
 */

export interface InventoryActor {
  supabase: SupabaseClient;
  /** The acting admin's profile id. Taken from the session, NEVER from a body. */
  adminId: string;
}

export type GuardResult = { ok: true; actor: InventoryActor } | { ok: false; response: NextResponse };

export async function requireInventoryAdmin(): Promise<GuardResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, actor: { supabase, adminId: user.id } };
}

/**
 * Parse a JSON body without letting a malformed one become a 500.
 * Returns null for anything that is not a JSON object.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** A v4/v5-shaped UUID. Checked before a value reaches a uuid column. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * A finite number, or null, or `undefined` for "the caller did not mention it".
 * The three are different: `null` CLEARS a nullable column, `undefined` leaves
 * it alone, and conflating them is how a PATCH that meant to change the finish
 * silently wipes the reorder point.
 */
export type OptionalNumber = { ok: true; value: number | null | undefined } | { ok: false; error: string };

export function readOptionalNumber(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; exclusiveMin?: number }
): OptionalNumber {
  if (!(key in body)) return { ok: true, value: undefined };
  const raw = body[key];
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ok: false, error: `${key} must be a number, or null to clear it.` };
  }
  if (opts.exclusiveMin !== undefined && raw <= opts.exclusiveMin) {
    return { ok: false, error: `${key} must be greater than ${opts.exclusiveMin}.` };
  }
  if (opts.min !== undefined && raw < opts.min) {
    return { ok: false, error: `${key} cannot be less than ${opts.min}.` };
  }
  return { ok: true, value: raw };
}

/**
 * A trimmed string, or null, or undefined — same three-way distinction as
 * `readOptionalNumber`. An empty or whitespace-only string becomes `null`,
 * because migration 039's `inventory_items_finish_length` CHECK refuses a blank
 * that is not null, and a user clearing a field means null.
 */
export type OptionalText = { ok: true; value: string | null | undefined } | { ok: false; error: string };

export function readOptionalText(body: Record<string, unknown>, key: string, maxLength: number): OptionalText {
  if (!(key in body)) return { ok: true, value: undefined };
  const raw = body[key];
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: `${key} must be text, or null to clear it.` };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${key} cannot be longer than ${maxLength} characters.` };
  }
  return { ok: true, value: trimmed };
}

/**
 * Quantity field names that a create or an edit must REFUSE.
 *
 * A quantity moves only through an adjustment, which is the thing that writes
 * the ledger row. Migration 039's own trigger enforces this at the database, so
 * a quantity in a PATCH body would be refused there anyway — but it would come
 * back as a database error, and the honest answer to "you tried to set
 * qty_on_hand directly" is a 400 that names the right route. Both halves
 * matter: the trigger is the guarantee, this is the explanation.
 */
export const FORBIDDEN_QUANTITY_KEYS = ['qtyOnHand', 'qtyReserved', 'onHand', 'reserved', 'qty_on_hand', 'qty_reserved'];

export function rejectQuantityFields(body: Record<string, unknown>): string | null {
  const offender = FORBIDDEN_QUANTITY_KEYS.find((key) => key in body);
  if (!offender) return null;
  return `A quantity cannot be set directly. Record an adjustment instead — that is what writes the history (offending field: ${offender}).`;
}
