import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';
import { toInvoiceRow } from '@/lib/data/invoices';
import { generateInvoicePDF } from './invoice-pdf';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export interface SendInvoiceEmailResult {
  success: boolean;
  error?: string;
  invoiceNumber?: string;
}

/**
 * Shared by POST /api/orders/[id]/dispatch (fires automatically as part of
 * dispatch), POST /api/invoices/[id]/send (manual resend from the CRM
 * Invoices tab), and the shop-job-completion automation
 * (lib/utils/shop-job-completion.ts) — all three need to generate and email
 * the same PDF, just from different trigger points. Never throws — matches
 * the notification failure-must-not-block-order-flow rule every other send
 * in this codebase already follows.
 *
 * `trackingUrl` is optional and additive — the dispatch route already sends
 * its own separate tracking email, so its call (and the CRM resend route's)
 * omit it and keep today's exact output. Passing it renders the same
 * `ctaButton` pattern the dispatch email already uses, just inside this
 * template.
 */
export async function sendInvoiceEmail(orderId: string, trackingUrl?: string): Promise<SendInvoiceEmailResult> {
  const admin = createAdminClient();

  const { data: orderRaw, error: orderError } = await admin
    .from('orders')
    .select('id, order_number, total, payment_method, net_terms, created_at, invoice_paid_at, user_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !orderRaw) {
    return { success: false, error: 'Order not found.' };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', orderRaw.user_id)
    .maybeSingle();

  const invoice = toInvoiceRow(orderRaw);

  if (!profile?.email) {
    await admin.from('notifications').insert({
      order_id: orderId,
      user_id: orderRaw.user_id,
      channel: 'email',
      type: 'invoice_sent',
      recipient: '',
      status: 'failed',
      error: 'Customer has no email on file.',
    });
    return { success: false, error: 'Customer has no email on file.', invoiceNumber: invoice.invoiceNumber };
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateInvoicePDF(orderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate invoice PDF.';
    await admin.from('notifications').insert({
      order_id: orderId,
      user_id: orderRaw.user_id,
      channel: 'email',
      type: 'invoice_sent',
      recipient: profile.email,
      status: 'failed',
      error: message,
    });
    return { success: false, error: message, invoiceNumber: invoice.invoiceNumber };
  }

  const html = baseEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px;">Your Invoice Is Attached</h1>
    <p style="margin:0 0 12px;">Hi ${profile.full_name ?? 'there'},</p>
    <p style="margin:0 0 12px;">
      Attached is invoice <strong>${invoice.invoiceNumber}</strong> for order
      <strong>${orderRaw.order_number}</strong>, totaling
      <strong>${currency.format(orderRaw.total)}</strong>.
    </p>
    ${trackingUrl ? ctaButton(trackingUrl, 'Track Your Delivery') : ''}
    <p style="margin:0;">Questions about this invoice? Just reply to this email.</p>
  `);

  const result = await sendEmail({
    to: profile.email,
    subject: `Your AFS Invoice #${invoice.invoiceNumber}`,
    html,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  await admin.from('notifications').insert({
    order_id: orderId,
    user_id: orderRaw.user_id,
    channel: 'email',
    type: 'invoice_sent',
    recipient: profile.email,
    status: result.success ? 'sent' : 'failed',
    error: result.success ? null : result.error,
  });

  return { success: result.success, error: result.error, invoiceNumber: invoice.invoiceNumber };
}
