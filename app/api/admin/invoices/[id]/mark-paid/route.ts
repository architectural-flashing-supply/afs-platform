import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';
import { resolveInvoice } from '@/lib/data/invoices';
import { appendLedger, ledgerTestTag } from '@/lib/pricing/ledger';

/**
 * MARK AN INVOICE PAID. `id` resolves to either kind — a real `invoices` row
 * (migration 035) or an order id, the convention this route already used.
 *
 * A real invoice being paid writes an `invoice_paid` row into the append-only
 * pricing ledger. That is the other half of the outcome data dynamic pricing
 * needs: knowing a quote was approved is not the same as knowing it was paid.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const admin = createAdminClient();
    const resolved = await resolveInvoice(admin, params.id);
    const nowIso = new Date().toISOString();

    if (resolved.kind === 'invoice') {
      const record = resolved.record;
      if (record.paid_at) {
        return NextResponse.json({ error: 'This invoice is already marked paid.' }, { status: 409 });
      }

      const { error: updateError } = await admin
        .from('invoices')
        .update({ paid_at: nowIso, status: 'paid', updated_at: nowIso })
        .eq('id', record.id);
      if (updateError) {
        console.error('[Mark Invoice Paid Error]', updateError);
        return NextResponse.json({ error: 'Could not mark this invoice paid. Please try again.' }, { status: 500 });
      }

      let testTag: string | null = null;
      if (record.quote_request_id) {
        const { data: job } = await admin
          .from('quote_requests')
          .select('job_name')
          .eq('id', record.quote_request_id)
          .maybeSingle();
        testTag = ledgerTestTag((job as { job_name?: string | null } | null)?.job_name ?? null);
      }

      await appendLedger(admin, {
        eventType: 'invoice_paid',
        source: 'admin_ui',
        occurredAt: nowIso,
        actorId: auth.userId,
        actorRole: 'admin',
        quoteRequestId: record.quote_request_id,
        quoteId: record.quote_id,
        invoiceId: record.id,
        customerId: record.user_id,
        customerLabel: record.customer_company ?? record.customer_name ?? record.customer_email,
        amountCents: record.total_cents,
        timeToDecisionSeconds: Math.round(
          (new Date(nowIso).getTime() - new Date(record.issued_at).getTime()) / 1000
        ),
        payload: { invoiceNumber: record.invoice_number },
        testTag,
      });

      await logAdminAction({
        adminId: auth.userId,
        action: 'mark_invoice_paid',
        resourceType: 'invoice',
        resourceId: record.id,
        afterValue: { paidAt: nowIso, invoiceNumber: record.invoice_number },
      });

      return NextResponse.json({ paid: true, paidAt: nowIso, invoiceNumber: record.invoice_number });
    }

    if (resolved.kind === 'none') {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const order = resolved.order as unknown as { id: string; invoice_paid_at: string | null };
    if (order.invoice_paid_at) {
      return NextResponse.json({ error: 'This invoice is already marked paid.' }, { status: 409 });
    }

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
