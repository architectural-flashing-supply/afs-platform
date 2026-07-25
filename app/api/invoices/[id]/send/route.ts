import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { sendInvoiceEmail } from '@/lib/utils/invoice-email';

/**
 * Manual resend from the Command Center CRM's Invoices tab
 * (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §4/§7) — `id` is the order id,
 * same as everywhere else invoices are derived 1:1 from orders
 * (lib/data/invoices.ts). Reuses the exact send path the dispatch route
 * fires automatically, so a manual resend and an automatic dispatch email
 * are byte-for-byte the same invoice.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const result = await sendInvoiceEmail(params.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Could not send invoice.' }, { status: 400 });
    }

    // Best-effort — only meaningful when a delivery_notifications row
    // already exists for this order (a pickup order that was never
    // dispatched may not have one); a 0-row update is not an error.
    const admin = createAdminClient();
    await admin.from('delivery_notifications').update({ invoice_sent: true }).eq('order_id', params.id);

    return NextResponse.json({ sent: true, invoiceNumber: result.invoiceNumber });
  } catch (error) {
    console.error('[Invoice Send Route Error]', error);
    return NextResponse.json({ error: 'Could not send invoice. Please try again.' }, { status: 500 });
  }
}
