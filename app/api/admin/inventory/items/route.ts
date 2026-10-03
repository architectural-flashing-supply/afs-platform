import { NextRequest, NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/admin/audit';
import {
  INVENTORY_ITEM_SELECT,
  NOT_PROVISIONED_MESSAGE,
  getInventoryItems,
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
 * LIVE INVENTORY — the item list, and creating an item.
 *
 * ADMIN ONLY, and nothing here is ever customer-facing: `specs/
 * SPEC_LIVE_INVENTORY.md` lets a customer see the three-value stock SIGNAL and
 * a lead-time range, and lets them see no quantity at all. The sibling routes
 * in this folder (`products/[productId]`, `bulk`) are that signal; this one is
 * the AFS-internal record of what metal is actually in the shop.
 *
 * A QUANTITY IS NEVER CREATED HERE. An item is born with `qty_on_hand = NULL`
 * ("nobody has counted this yet") and `qty_reserved = 0`, and the only way a
 * number ever appears is a `count` adjustment — the thing that writes the
 * ledger row. Migration 039's own trigger refuses an insert that arrives
 * carrying a quantity, so this is a guarantee rather than a convention; the
 * check below exists to answer with a sentence instead of a database error.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const guard = await requireInventoryAdmin();
  if (!guard.ok) return guard.response;

  try {
    const load = await getInventoryItems(guard.actor.supabase);
    if (load.state === 'not_provisioned') {
      return NextResponse.json({ state: 'not_provisioned', items: [] });
    }
    if (load.state === 'error') {
      return NextResponse.json({ state: 'error', error: load.message, items: [] }, { status: 500 });
    }
    return NextResponse.json({ state: 'ready', items: load.rows });
  } catch (error) {
    console.error('[Inventory Items GET Error]', error);
    return NextResponse.json({ state: 'error', error: 'Could not read the inventory.', items: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireInventoryAdmin();
  if (!guard.ok) return guard.response;
  const { supabase, adminId } = guard.actor;

  try {
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const quantityOffence = rejectQuantityFields(body);
    if (quantityOffence) {
      return NextResponse.json({ error: quantityOffence }, { status: 400 });
    }

    if (!isUuid(body.materialId)) {
      return NextResponse.json({ error: 'Choose a material.' }, { status: 400 });
    }
    if (!isUuid(body.gaugeId)) {
      return NextResponse.json({ error: 'Choose a gauge.' }, { status: 400 });
    }
    if (!isStockUnit(body.stockUnit)) {
      return NextResponse.json({ error: 'Choose how this item is counted.' }, { status: 400 });
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

    // THE GAUGE HAS TO BELONG TO THE MATERIAL. Both are valid UUIDs that exist
    // in their own tables, so the foreign keys are satisfied either way — a 20
    // oz COPPER gauge attached to an ALUMINIUM row would save cleanly and then
    // read as a real stock item that cannot be fabricated. The database cannot
    // see this; it is a cross-row rule, so it is checked here.
    const { data: gauge, error: gaugeError } = await supabase
      .from('gauges')
      .select('id, material_id, label')
      .eq('id', body.gaugeId)
      .maybeSingle();

    if (gaugeError) {
      if (isNotProvisionedError(gaugeError)) {
        return NextResponse.json({ state: 'not_provisioned', error: NOT_PROVISIONED_MESSAGE }, { status: 503 });
      }
      console.error('[Inventory Items POST gauge lookup]', gaugeError);
      return NextResponse.json({ error: 'Could not check that gauge. Nothing was created.' }, { status: 500 });
    }
    if (!gauge) {
      return NextResponse.json({ error: 'That gauge no longer exists.' }, { status: 404 });
    }
    if ((gauge as { material_id: string }).material_id !== body.materialId) {
      return NextResponse.json({ error: 'That gauge belongs to a different material.' }, { status: 400 });
    }

    const insert = {
      material_id: body.materialId,
      gauge_id: body.gaugeId,
      finish: finish.value ?? null,
      coil_width_in: coilWidth.value ?? null,
      stock_unit: body.stockUnit,
      reorder_point: reorderPoint.value ?? null,
      created_by: adminId,
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(insert)
      .select(INVENTORY_ITEM_SELECT)
      .single();

    if (error) {
      if (isNotProvisionedError(error)) {
        return NextResponse.json({ state: 'not_provisioned', error: NOT_PROVISIONED_MESSAGE }, { status: 503 });
      }
      // 23505 is the identity index in migration 039. The duplicate is a real
      // thing the user can act on, so it is named rather than reported as a
      // server fault.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'There is already an item for that material, gauge, finish, coil width and unit.' },
          { status: 409 }
        );
      }
      console.error('[Inventory Items POST Error]', error);
      return NextResponse.json({ error: 'Could not create the item. Nothing was saved.' }, { status: 500 });
    }

    const item = mapItemRow(data as unknown as InventoryItemSource);

    // The definition of an item is an admin edit, not a quantity movement, so
    // it belongs in admin_audit_log rather than in the inventory ledger — which
    // records quantity history and nothing else. logAdminAction never throws.
    await logAdminAction({
      adminId,
      action: 'inventory_item_created',
      resourceType: 'inventory_item',
      resourceId: item.id,
      afterValue: insert,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('[Inventory Items POST Error]', error);
    return NextResponse.json({ error: 'Could not create the item. Nothing was saved.' }, { status: 500 });
  }
}
