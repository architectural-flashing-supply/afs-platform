import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ReorderResponse {
  sessionId: string;
  redirectUrl: string;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('order_line_items')
      .select('id')
      .eq('order_id', params.id);

    if (lineItemsError || !lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: 'This order has no items to reorder.' }, { status: 400 });
    }

    const response: ReorderResponse = {
      sessionId: crypto.randomUUID(),
      redirectUrl: `/quote?step=4&from_order=${params.id}`,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Reorder Error]', error);
    return NextResponse.json({ error: 'Reorder failed. Please try again.' }, { status: 500 });
  }
}
