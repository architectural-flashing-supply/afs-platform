import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STOCK_TYPES = ['stock', 'fabricated', 'special_order'] as const;
type StockTypeInput = (typeof STOCK_TYPES)[number];

interface StockUpdateInput {
  stockType?: string;
  leadTimeDays?: number;
}

function isStockType(value: string): value is StockTypeInput {
  return (STOCK_TYPES as readonly string[]).includes(value);
}

/**
 * SPEC_LIVE_INVENTORY.md §3 — per-row save from the admin ProductStockTable.
 * No audit log: the spec explicitly calls this signal not financially sensitive.
 */
export async function PATCH(request: NextRequest, { params }: { params: { productId: string } }): Promise<NextResponse> {
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
    const body = raw as StockUpdateInput;

    const fields: Record<string, unknown> = {};
    if (body.stockType !== undefined) {
      if (typeof body.stockType !== 'string' || !isStockType(body.stockType)) {
        return NextResponse.json({ error: 'Invalid stock type.' }, { status: 400 });
      }
      fields.stock_type = body.stockType;
    }
    if (body.leadTimeDays !== undefined) {
      if (!Number.isInteger(body.leadTimeDays) || body.leadTimeDays < 0) {
        return NextResponse.json({ error: 'Lead time must be a whole number of days.' }, { status: 400 });
      }
      fields.lead_time_days = body.leadTimeDays;
    }
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const { data: product } = await supabase.from('products').select('id').eq('id', params.productId).maybeSingle();
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const { error: updateError } = await supabase.from('products').update(fields).eq('id', params.productId);
    if (updateError) {
      console.error('[Inventory Product Update Error]', updateError);
      return NextResponse.json({ error: 'Could not save this row. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Inventory Product Route Error]', error);
    return NextResponse.json({ error: 'Could not save this row. Please try again.' }, { status: 500 });
  }
}
