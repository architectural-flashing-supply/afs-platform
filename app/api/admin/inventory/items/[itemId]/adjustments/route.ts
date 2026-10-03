import { NextRequest, NextResponse } from 'next/server';
import {
  INVENTORY_ITEM_SELECT,
  NOT_PROVISIONED_MESSAGE,
  getInventoryAdjustments,
  isNotProvisionedError,
  mapAdjustmentRow,
  mapItemRow,
  type InventoryAdjustmentSource,
  type InventoryItemSource,
} from '@/lib/data/inventory';
import { applyAdjustment, isAdjustmentKind } from '@/lib/inventory/stock-math';
import { isUuid, readJsonObject, requireInventoryAdmin } from '@/lib/inventory/route-guard';

/**
 * LIVE INVENTORY — one item's adjustment history, and applying an adjustment.
 *
 * THIS IS THE ONLY WAY A QUANTITY EVER CHANGES. Not because the other routes
 * politely decline, but because migration 039's
 * `inventory_items_quantities_through_ledger` trigger refuses any other write
 * to `qty_on_hand` / `qty_reserved` at the database — including from the
 * service role — unless the transaction-local flag that
 * `inventory_apply_adjustment()` sets around its own UPDATE is on.
 *
 * ================ WHO DECIDES WHETHER AN ADJUSTMENT IS LEGAL ================
 *
 * `lib/inventory/stock-math.ts`, and nothing else. This route reads the item,
 * hands the current quantities to `applyAdjustment`, and on refusal answers 422
 * carrying THAT MODULE'S OWN SENTENCE — so the message the user reads is
 * written by the one place that owns the rule, and there is no second wording
 * of "you cannot reserve more than is available" anywhere in the codebase.
 *
 * ================ WHY IT IS AN RPC AND NOT TWO WRITES ================
 *
 * The quantity change and the ledger insert must happen together. As two
 * PostgREST calls, either the number moves and the log row is lost, or the log
 * row claims a change that was rejected. `inventory_apply_adjustment()` does
 * both in one transaction with the item row locked, and refuses if the
 * quantities moved under us (409) — see migration 039 §4. It is handed the
 * already-computed result, so it does not own a second copy of the math.
 *
 * ================ IDEMPOTENCY ================
 *
 * `clientRequestId` is REQUIRED. An adjustment other than a count is a DELTA,
 * so a double-clicked Apply or a fetch the browser retried would apply it
 * twice — and a receipt of 40 sheets recorded as 80 is a wrong number nobody
 * would notice until a count disagreed. The function returns the original row
 * for a repeated id, and a UNIQUE index backs that up even if the function's
 * early return were ever removed.
 */

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { itemId: string };
}

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const guard = await requireInventoryAdmin();
  if (!guard.ok) return guard.response;

  if (!isUuid(params.itemId)) {
    return NextResponse.json({ error: 'That is not an inventory item id.' }, { status: 400 });
  }

  try {
    const load = await getInventoryAdjustments(guard.actor.supabase, params.itemId);
    if (load.state === 'not_provisioned') {
      return NextResponse.json({ state: 'not_provisioned', adjustments: [], truncated: false });
    }
    if (load.state === 'error') {
      return NextResponse.json({ state: 'error', error: load.message, adjustments: [], truncated: false }, { status: 500 });
    }
    return NextResponse.json({ state: 'ready', adjustments: load.rows, truncated: load.truncated });
  } catch (error) {
    console.error('[Inventory Adjustments GET]', error);
    return NextResponse.json(
      { state: 'error', error: 'Could not read this history.', adjustments: [], truncated: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const guard = await requireInventoryAdmin();
  if (!guard.ok) return guard.response;
  const { supabase, adminId } = guard.actor;

  if (!isUuid(params.itemId)) {
    return NextResponse.json({ error: 'That is not an inventory item id.' }, { status: 400 });
  }

  try {
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!isAdjustmentKind(body.kind)) {
      return NextResponse.json({ error: 'Choose what kind of adjustment this is.' }, { status: 400 });
    }
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount)) {
      return NextResponse.json({ error: 'Enter an amount as a number.' }, { status: 400 });
    }
    if (typeof body.reason !== 'string' || body.reason.trim().length < 3) {
      // The reason is not optional, and a database CHECK says the same thing.
      // An adjustment log without reasons records that a number moved and
      // nothing about why, which is most of the value gone.
      return NextResponse.json({ error: 'Say why, in a few words. Every adjustment records a reason.' }, { status: 400 });
    }
    if (!isUuid(body.clientRequestId)) {
      return NextResponse.json(
        { error: 'This request is missing its one-time id, so it cannot be applied safely. Reload and try again.' },
        { status: 400 }
      );
    }
    const reason = body.reason.trim();

    const { data: itemRaw, error: readError } = await supabase
      .from('inventory_items')
      .select(INVENTORY_ITEM_SELECT)
      .eq('id', params.itemId)
      .maybeSingle();

    if (readError) {
      if (isNotProvisionedError(readError)) {
        return NextResponse.json({ error: NOT_PROVISIONED_MESSAGE, state: 'not_provisioned' }, { status: 503 });
      }
      console.error('[Inventory Adjustments POST read]', readError);
      return NextResponse.json({ error: 'Could not read this item. Nothing was changed.' }, { status: 500 });
    }
    if (!itemRaw) {
      return NextResponse.json({ error: 'That inventory item no longer exists.' }, { status: 404 });
    }

    const item = mapItemRow(itemRaw as unknown as InventoryItemSource);
    if (item.retiredAt !== null) {
      return NextResponse.json(
        { error: 'This item has been retired, so its quantities cannot change. Its history is still readable.' },
        { status: 409 }
      );
    }

    const outcome = applyAdjustment(
      { onHand: item.onHand, reserved: item.reserved, reorderPoint: item.reorderPoint },
      { kind: body.kind, amount: body.amount, unit: item.stockUnit }
    );

    if (!outcome.ok) {
      // 422, not 400: the request was well formed and the rule refused it. The
      // sentence is stock-math.ts's own, so there is exactly one wording of
      // each of these rules in the whole codebase.
      return NextResponse.json({ error: outcome.reason }, { status: 422 });
    }

    // IDEMPOTENCY, CHECKED BEFORE ANYTHING IS ATTEMPTED. A double-clicked
    // Apply arrives as two sequential requests, which is the case that actually
    // happens, and this answers the second one exactly: nothing was applied
    // again, and it says so. The function's own check (migration 039 §4) and
    // the UNIQUE index behind it remain the backstop for the rarer case of two
    // genuinely concurrent copies of the same request, where one wins and the
    // other is handed the same row rather than applying the delta twice.
    const { data: replayRaw } = await supabase
      .from('inventory_adjustments')
      .select(
        'id, item_id, kind, source, delta_on_hand, counted_on_hand, delta_reserved, on_hand_after, reserved_after, reason, created_at, profiles(full_name)'
      )
      .eq('item_id', params.itemId)
      .eq('client_request_id', body.clientRequestId)
      .maybeSingle();

    if (replayRaw) {
      return NextResponse.json({
        adjustment: mapAdjustmentRow(replayRaw as unknown as InventoryAdjustmentSource),
        item,
        alreadyApplied: true,
        message: 'This adjustment had already been applied. Nothing was applied again.',
      });
    }

    const { data, error } = await supabase
      .rpc('inventory_apply_adjustment', {
        p_item_id: params.itemId,
        p_kind: body.kind,
        p_delta_on_hand: outcome.deltaOnHand,
        p_counted_on_hand: outcome.countedOnHand,
        p_delta_reserved: outcome.deltaReserved,
        // What we read a moment ago. The function compares these to the LOCKED
        // row with IS NOT DISTINCT FROM and refuses if another admin moved the
        // number in between — the delta above was computed against a quantity
        // that would no longer exist.
        p_expected_on_hand: item.onHand,
        p_expected_reserved: item.reserved,
        p_on_hand_after: outcome.onHandAfter,
        p_reserved_after: outcome.reservedAfter,
        p_reason: reason,
        p_adjusted_by: adminId,
        p_client_request_id: body.clientRequestId,
      })
      .single();

    if (error) {
      if (isNotProvisionedError(error)) {
        return NextResponse.json({ error: NOT_PROVISIONED_MESSAGE, state: 'not_provisioned' }, { status: 503 });
      }
      // 40001 is the serialization_failure the function raises when the
      // expectation did not hold. It is not a fault — it is two people working
      // at once, and the answer is to reload rather than to retry blindly,
      // because the delta was computed against a quantity that has changed.
      if (error.code === '40001') {
        return NextResponse.json(
          { error: 'This item changed while you were working on it. Nothing was applied. Reload and try again.' },
          { status: 409 }
        );
      }
      if (error.code === '22003') {
        return NextResponse.json({ error: 'That number is too large to store.' }, { status: 422 });
      }
      console.error('[Inventory Adjustments POST rpc]', error);
      return NextResponse.json({ error: 'Could not apply this adjustment. Nothing was changed.' }, { status: 500 });
    }

    const adjustment = mapAdjustmentRow({
      ...(data as unknown as Omit<InventoryAdjustmentSource, 'profiles'>),
      // The RPC returns the ledger row itself, which has no joined profile. The
      // acting admin is the session's own admin by construction — the function
      // refuses any other actor — so there is nothing to look up.
      profiles: null,
    });

    // Read the item back so the client renders the quantities the DATABASE
    // holds, not the ones this route computed. If the two ever disagreed —
    // a CHECK constraint firing, a concurrent change — showing the computed
    // pair would be showing a number that is not stored anywhere.
    const { data: afterRaw } = await supabase
      .from('inventory_items')
      .select(INVENTORY_ITEM_SELECT)
      .eq('id', params.itemId)
      .maybeSingle();

    return NextResponse.json({
      adjustment,
      item: afterRaw ? mapItemRow(afterRaw as unknown as InventoryItemSource) : null,
      alreadyApplied: false,
    });
  } catch (error) {
    console.error('[Inventory Adjustments POST]', error);
    return NextResponse.json({ error: 'Could not apply this adjustment. Nothing was changed.' }, { status: 500 });
  }
}
