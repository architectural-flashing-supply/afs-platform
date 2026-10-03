import { NextRequest, NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/admin/audit';
import {
  INVENTORY_ITEM_SELECT,
  NOT_PROVISIONED_MESSAGE,
  isNotProvisionedError,
  mapItemRow,
  type InventoryItemSource,
} from '@/lib/data/inventory';
import { isStockUnit } from '@/lib/inventory/stock-math';
import {
  isUuid,
  readJsonObject,
  readOptionalNumber,
  readOptionalText,
  rejectQuantityFields,
  requireInventoryAdmin,
} from '@/lib/inventory/route-guard';

/**
 * LIVE INVENTORY — editing one item's DEFINITION, and retiring it.
 *
 * ================ WHAT A PATCH MAY AND MAY NOT CHANGE ================
 *
 * May: finish, coil width, reorder point, and — conditionally — the unit.
 * May NOT: a quantity. A quantity moves only through an adjustment, because an
 * adjustment is the thing that writes the ledger row. Migration 039's
 * `inventory_items_quantities_through_ledger` trigger refuses it at the
 * database, so this is a guarantee and not a convention; the 400 below exists
 * to explain, which a database error would not.
 *
 * ================ WHY DELETE IS RETIRE ================
 *
 * `inventory_adjustments` references this table ON DELETE RESTRICT, and
 * deleting the thing an append-only history is ABOUT would orphan that history.
 * So DELETE retires: `retired_at` / `retired_by` are set, the row leaves the
 * active list, its history stays readable, and its identity slot is freed so
 * the same item can be created again later (the identity index in migration 039
 * is partial on `retired_at IS NULL`). Same shape as `price_book_items`.
 */

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { itemId: string };
}

export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
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

    const quantityOffence = rejectQuantityFields(body);
    if (quantityOffence) {
      return NextResponse.json({ error: quantityOffence }, { status: 400 });
    }

    const finish = readOptionalText(body, 'finish', 120);
    if (!finish.ok) return NextResponse.json({ error: finish.error }, { status: 400 });

    const coilWidth = readOptionalNumber(body, 'coilWidthIn', { exclusiveMin: 0 });
    if (!coilWidth.ok) {
      return NextResponse.json({ error: 'Coil width must be a measurement greater than zero, or left blank.' }, { status: 400 });
    }

    const reorderPoint = readOptionalNumber(body, 'reorderPoint', { min: 0 });
    if (!reorderPoint.ok) {
      return NextResponse.json({ error: 'The reorder point must be zero or more, or left blank.' }, { status: 400 });
    }

    let stockUnit: string | undefined;
    if ('stockUnit' in body) {
      if (!isStockUnit(body.stockUnit)) {
        return NextResponse.json({ error: 'That is not a unit this item can be counted in.' }, { status: 400 });
      }
      stockUnit = body.stockUnit;
    }

    const { data: existingRaw, error: readError } = await supabase
      .from('inventory_items')
      .select(INVENTORY_ITEM_SELECT)
      .eq('id', params.itemId)
      .maybeSingle();

    if (readError) {
      if (isNotProvisionedError(readError)) {
        return NextResponse.json({ error: NOT_PROVISIONED_MESSAGE, state: 'not_provisioned' }, { status: 503 });
      }
      console.error('[Inventory Item PATCH read]', readError);
      return NextResponse.json({ error: 'Could not read this item. Nothing was saved.' }, { status: 500 });
    }
    if (!existingRaw) {
      return NextResponse.json({ error: 'That inventory item no longer exists.' }, { status: 404 });
    }

    const existing = mapItemRow(existingRaw as unknown as InventoryItemSource);
    if (existing.retiredAt !== null) {
      return NextResponse.json({ error: 'This item has been retired, so it cannot be edited.' }, { status: 409 });
    }

    // CHANGING THE UNIT UNDER EXISTING NUMBERS IS REFUSED, and this is the
    // important one. Every quantity on the row, and every quantity in its
    // ledger history, is expressed in the CURRENT unit. Switching sheets to
    // pounds would silently reinterpret all of them — nothing would look
    // broken, and every number would be wrong. The way to change the unit is a
    // new item.
    if (stockUnit !== undefined && stockUnit !== existing.stockUnit) {
      if (existing.onHand !== null || existing.reserved !== 0) {
        return NextResponse.json(
          {
            error:
              'This item already has quantities counted in ' +
              existing.stockUnit.replace('_', ' ') +
              '. Changing the unit would reinterpret them and its whole history. Create a separate item for the new unit instead.',
          },
          { status: 409 }
        );
      }
    }

    const fields: Record<string, unknown> = {};
    if (finish.value !== undefined) fields.finish = finish.value;
    if (coilWidth.value !== undefined) fields.coil_width_in = coilWidth.value;
    if (reorderPoint.value !== undefined) fields.reorder_point = reorderPoint.value;
    if (stockUnit !== undefined) fields.stock_unit = stockUnit;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }
    fields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('inventory_items')
      .update(fields)
      .eq('id', params.itemId)
      .is('retired_at', null)
      .select(INVENTORY_ITEM_SELECT)
      .single();

    if (error) {
      if (isNotProvisionedError(error)) {
        return NextResponse.json({ error: NOT_PROVISIONED_MESSAGE, state: 'not_provisioned' }, { status: 503 });
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Another item already has that material, gauge, finish, coil width and unit.' },
          { status: 409 }
        );
      }
      console.error('[Inventory Item PATCH]', error);
      return NextResponse.json({ error: 'Could not save this item. Nothing was changed.' }, { status: 500 });
    }

    const item = mapItemRow(data as unknown as InventoryItemSource);

    await logAdminAction({
      adminId,
      action: 'inventory_item_updated',
      resourceType: 'inventory_item',
      resourceId: item.id,
      beforeValue: {
        finish: existing.finish,
        coil_width_in: existing.coilWidthIn,
        reorder_point: existing.reorderPoint,
        stock_unit: existing.stockUnit,
      },
      afterValue: fields,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[Inventory Item PATCH]', error);
    return NextResponse.json({ error: 'Could not save this item. Nothing was changed.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const guard = await requireInventoryAdmin();
  if (!guard.ok) return guard.response;
  const { supabase, adminId } = guard.actor;

  if (!isUuid(params.itemId)) {
    return NextResponse.json({ error: 'That is not an inventory item id.' }, { status: 400 });
  }

  try {
    const retiredAt = new Date().toISOString();

    // Conditional on `retired_at IS NULL`, so two clicks cannot both "win" and
    // move the retirement timestamp. The second one selects nothing, and the
    // answer below is a plain sentence rather than a bare 409 — the same
    // courtesy CLAUDE.md rule #16 requires of an already-sent machine job.
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ retired_at: retiredAt, retired_by: adminId, updated_at: retiredAt })
      .eq('id', params.itemId)
      .is('retired_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      if (isNotProvisionedError(error)) {
        return NextResponse.json({ error: NOT_PROVISIONED_MESSAGE, state: 'not_provisioned' }, { status: 503 });
      }
      console.error('[Inventory Item DELETE]', error);
      return NextResponse.json({ error: 'Could not retire this item. Nothing was changed.' }, { status: 500 });
    }

    if (!data) {
      // Either it never existed or it was already retired. Distinguish them, so
      // the message is true rather than merely plausible.
      const { data: anyRow } = await supabase.from('inventory_items').select('id').eq('id', params.itemId).maybeSingle();
      if (!anyRow) {
        return NextResponse.json({ error: 'That inventory item no longer exists.' }, { status: 404 });
      }
      return NextResponse.json({ retired: true, message: 'This item was already retired. Nothing changed.' });
    }

    await logAdminAction({
      adminId,
      action: 'inventory_item_retired',
      resourceType: 'inventory_item',
      resourceId: params.itemId,
      afterValue: { retired_at: retiredAt, retired_by: adminId },
    });

    return NextResponse.json({
      retired: true,
      message: 'Retired. Its adjustment history is kept, and nothing was deleted.',
    });
  } catch (error) {
    console.error('[Inventory Item DELETE]', error);
    return NextResponse.json({ error: 'Could not retire this item. Nothing was changed.' }, { status: 500 });
  }
}
