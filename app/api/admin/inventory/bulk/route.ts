import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STOCK_TYPES = ['stock', 'fabricated', 'special_order'] as const;
type StockTypeInput = (typeof STOCK_TYPES)[number];

interface BulkStockInput {
  material?: string;
  stockType?: string;
}

function isStockType(value: string): value is StockTypeInput {
  return (STOCK_TYPES as readonly string[]).includes(value);
}

/**
 * SPEC_LIVE_INVENTORY.md §3 — "Set all [material] products to: [dropdown]" bulk
 * update, for commodity scarcity events where a whole material goes to
 * special_order. No audit log, same reasoning as the per-row PATCH route.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as BulkStockInput;

    if (!body.material || typeof body.material !== 'string') {
      return NextResponse.json({ error: 'Material is required.' }, { status: 400 });
    }
    if (!body.stockType || typeof body.stockType !== 'string' || !isStockType(body.stockType)) {
      return NextResponse.json({ error: 'Invalid stock type.' }, { status: 400 });
    }

    const { data: material } = await supabase.from('materials').select('id').eq('name', body.material).maybeSingle();
    if (!material) {
      return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
    }

    const { error: updateError, count } = await supabase
      .from('products')
      .update({ stock_type: body.stockType }, { count: 'exact' })
      .eq('material_id', material.id);

    if (updateError) {
      console.error('[Inventory Bulk Update Error]', updateError);
      return NextResponse.json({ error: 'Could not apply the bulk update. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: count ?? 0 });
  } catch (error) {
    console.error('[Inventory Bulk Route Error]', error);
    return NextResponse.json({ error: 'Could not apply the bulk update. Please try again.' }, { status: 500 });
  }
}
