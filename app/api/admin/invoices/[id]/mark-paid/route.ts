import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';

/** id param is the order id — invoices have no separate id, same convention as /api/invoices/[id]/send. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const admin = createAdminClient();

    const { data: order } = await admin.from('orders').select('id, invoice_paid_at').eq('id', params.id).maybeSingle();
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    if (order.invoice_paid_at) {
      return NextResponse.json({ error: 'This invoice is already marked paid.' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from('orders')
      .update({ invoice_paid_at: nowIso, updated_at: nowIso })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Mark Invoice Paid Error]', updateError);
      return NextResponse.json({ error: 'Could not mark this invoice paid. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: auth.userId,
      action: 'mark_invoice_paid',
      resourceType: 'order',
      resourceId: params.id,
      afterValue: { invoicePaidAt: nowIso },
    });

    return NextResponse.json({ paid: true, paidAt: nowIso });
  } catch (error) {
    console.error('[Mark Invoice Paid Route Error]', error);
    return NextResponse.json({ error: 'Could not mark this invoice paid. Please try again.' }, { status: 500 });
  }
}
