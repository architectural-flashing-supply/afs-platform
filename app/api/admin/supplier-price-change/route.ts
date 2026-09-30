import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { appendLedger } from '@/lib/pricing/ledger';
import { parseDollarsToCents } from '@/lib/pricing/quote-math';
import { toEffectiveDate } from '@/lib/pricing/price-book';

/**
 * "LOG A SUPPLIER PRICE CHANGE" — Settings.
 *
 * Supplier, material, old cost, new cost, effective date, a note, and an
 * optional attached file (the supplier's letter or emailed PDF). It writes ONE
 * `supplier_price_change` row into the append-only pricing ledger.
 *
 * ================== THE SAME ROW THE MAIL PARSER WILL WRITE ==================
 *
 * Phase 4's deferred Outlook mail parser has to be able to record these
 * automatically. It writes the IDENTICAL shape — same event type, same columns
 * — with `source: 'mail_parser'` instead of `'admin_ui'` and `external_ref` set
 * to the Graph `internetMessageId`, which the unique index
 * `uq_pricing_ledger_external_ref` uses to make re-running the parser over the
 * same mailbox idempotent. Nothing in the table or in lib/pricing/ledger.ts has
 * to change for it; that is why the shape is being agreed now rather than when
 * the parser lands.
 *
 * ================== THE ATTACHMENT ==================
 *
 * multipart/form-data. The file goes into the private `documents` bucket under
 * `supplier-price-changes/`, and only its PATH is stored on the ledger row —
 * never its bytes, and never a base64 data URI, which would put a megabyte of
 * PDF into every ledger query. A failed upload does NOT lose the price change:
 * the row is written either way and says the attachment did not save.
 */
export const dynamic = 'force-dynamic';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'message/rfc822'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorEmail = (adminProfile as { email?: string | null })?.email ?? user.email ?? null;

    const form = await request.formData();
    const text = (key: string): string => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };

    const supplierName = text('supplierName');
    const material = text('material');
    if (supplierName === '' || material === '') {
      return NextResponse.json(
        { error: 'A supplier name and a material are both needed — without them the change cannot be used later.' },
        { status: 400 }
      );
    }

    const oldCost = parseDollarsToCents(text('oldCost'));
    const newCost = parseDollarsToCents(text('newCost'));
    if (oldCost === 'invalid' || newCost === 'invalid') {
      return NextResponse.json({ error: 'Those costs need to be dollar amounts, like 240 or 240.50.' }, { status: 400 });
    }
    if (newCost === null) {
      return NextResponse.json({ error: 'The new cost is the point of the record — please fill it in.' }, { status: 400 });
    }

    const effectiveRaw = text('effectiveDate');
    let effectiveDate: string;
    try {
      effectiveDate = effectiveRaw === '' ? toEffectiveDate(new Date()) : toEffectiveDate(effectiveRaw);
    } catch {
      return NextResponse.json({ error: 'That effective date could not be read.' }, { status: 400 });
    }

    const gauge = text('gauge') || null;
    const note = text('note') || null;

    // ---- The optional attachment -----------------------------------------
    const admin = createAdminClient();
    let attachmentPath: string | null = null;
    let attachmentProblem: string | null = null;
    const file = form.get('attachment');
    if (file && typeof file !== 'string' && file.size > 0) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        attachmentProblem = 'The attachment was larger than 10 MB, so it was not saved. The price change was.';
      } else if (file.type && !ALLOWED_TYPES.includes(file.type)) {
        attachmentProblem = `A ${file.type} file cannot be attached here, so it was not saved. The price change was.`;
      } else {
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'notice';
        const path = `supplier-price-changes/${effectiveDate}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await admin.storage
          .from('documents')
          .upload(path, Buffer.from(await file.arrayBuffer()), {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
        if (uploadError) {
          console.error('[Supplier Price Change] attachment upload failed', uploadError);
          attachmentProblem = 'The attachment did not upload, so only the figures were recorded.';
        } else {
          attachmentPath = path;
        }
      }
    }

    const appended = await appendLedger(admin, {
      eventType: 'supplier_price_change',
      source: 'admin_ui',
      actorId: user.id,
      actorEmail,
      actorRole: 'admin',
      material,
      gauge,
      supplierName,
      oldCostCents: oldCost,
      newCostCents: newCost,
      effectiveDate,
      attachmentPath,
      note,
      payload: { recordedBy: 'settings_form' },
    });
    if (!appended.ok) {
      return NextResponse.json(
        { error: 'That price change could not be recorded. Please try again.' },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminId: user.id,
      action: 'log_supplier_price_change',
      resourceType: 'pricing_ledger',
      resourceId: user.id,
      afterValue: { supplierName, material, gauge, oldCost, newCost, effectiveDate, attachmentPath },
    });

    const direction =
      oldCost === null
        ? 'Recorded'
        : newCost > oldCost
          ? `Recorded a rise of $${((newCost - oldCost) / 100).toFixed(2)}`
          : newCost < oldCost
            ? `Recorded a fall of $${((oldCost - newCost) / 100).toFixed(2)}`
            : 'Recorded (no change in cost)';

    return NextResponse.json({
      ok: true,
      message:
        `${direction} for ${supplierName} — ${material}${gauge ? ` ${gauge}` : ''}, from ${effectiveDate}.` +
        (attachmentProblem ? ` ${attachmentProblem}` : attachmentPath ? ' The file is attached to it.' : ''),
      attachmentPath,
    });
  } catch (error) {
    console.error('[Supplier Price Change Error]', error);
    return NextResponse.json({ error: 'Could not record that price change. Please try again.' }, { status: 500 });
  }
}
