import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { appendLedger } from '@/lib/pricing/ledger';
import { priceBookChangeDelta, toEffectiveDate } from '@/lib/pricing/price-book';
import { getPriceBookHistory } from '@/lib/pricing/db';
import { toPriceBookVersion } from '@/lib/pricing/db';
import type { PriceBookVersion } from '@/lib/pricing/types';

/**
 * THE PRICE BOOK, EDITABLE BY STEVE AT ANY TIME.
 *
 *   POST   { action: 'add-row',    material, gauge }
 *   POST   { action: 'set-prices', itemId, effectiveFrom, sheetCost?, perBend?, perHem?, extras?, extrasNote?, note? }
 *   POST   { action: 'retire',     itemId, retired: true|false }
 *
 * ================== NOTHING IS EVER OVERWRITTEN ==================
 *
 * 'set-prices' INSERTS a new `price_book_versions` row with its own effective
 * date. It does not update the previous one — it could not: migration 035 puts
 * an append-only trigger on that table. An old quote therefore keeps the prices
 * it was built on, forever, and "the price book changed" is a fact with a date
 * on it rather than a silent mutation.
 *
 * ================== A BLANK IS NOT A ZERO ==================
 *
 * A field omitted from the body, or sent as null or '', is stored as NULL. It
 * renders as a marked blank and it blocks quote issuance. Only an explicit
 * number becomes a price. There is deliberately no way for this route to invent
 * one — see lib/pricing/quote-math.ts.
 *
 * Every change writes a `price_book_change` row into the pricing ledger, as old
 * value -> new value, because that is one of the inputs dynamic pricing will
 * learn from.
 */

/** Cents from a JSON field. `undefined`/null/'' are blanks; anything else must be a real number. */
function centsField(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)) return value;
  throw new Error(`${label} must be a whole number of cents, or left blank. It is never assumed to be zero.`);
}

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

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const action = body.action;
    const admin = createAdminClient();

    // ---------------------------------------------------------------- add a row
    if (action === 'add-row') {
      const material = typeof body.material === 'string' ? body.material.trim() : '';
      const gauge = typeof body.gauge === 'string' ? body.gauge.trim() : '';
      if (material === '' || gauge === '') {
        return NextResponse.json({ error: 'A price book row needs both a material and a gauge.' }, { status: 400 });
      }

      const { data: existing } = await admin
        .from('price_book_items')
        .select('id, retired_at')
        .eq('material', material)
        .eq('gauge', gauge)
        .maybeSingle();
      if (existing) {
        const row = existing as { id: string; retired_at: string | null };
        if (row.retired_at) {
          // Bringing back a retired row is un-retiring it, not a duplicate.
          await admin.from('price_book_items').update({ retired_at: null, retired_by: null }).eq('id', row.id);
          return NextResponse.json({
            ok: true,
            itemId: row.id,
            message: `${material} ${gauge} was retired — it is back in the price book, with its old prices intact.`,
          });
        }
        return NextResponse.json(
          { error: `${material} ${gauge} is already in the price book.` },
          { status: 409 }
        );
      }

      const { data: maxRow } = await admin
        .from('price_book_items')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
      const nextOrder = (((maxRow ?? [])[0] as { display_order?: number } | undefined)?.display_order ?? 0) + 1;

      const { data: inserted, error } = await admin
        .from('price_book_items')
        .insert({ material, gauge, display_order: nextOrder, created_by: user.id })
        .select('id')
        .single();
      if (error || !inserted) {
        return NextResponse.json({ error: 'That row could not be added. Please try again.' }, { status: 500 });
      }
      const itemId = (inserted as { id: string }).id;

      await logAdminAction({
        adminId: user.id,
        action: 'price_book_add_row',
        resourceType: 'price_book_item',
        resourceId: itemId,
        afterValue: { material, gauge },
      });

      return NextResponse.json({
        ok: true,
        itemId,
        message: `${material} ${gauge} added. Its prices are blank until you fill them in.`,
      });
    }

    // ------------------------------------------------------------- set prices
    if (action === 'set-prices') {
      const itemId = body.itemId;
      if (typeof itemId !== 'string') {
        return NextResponse.json({ error: 'itemId is required.' }, { status: 400 });
      }

      let sheetCost: number | null;
      let perBend: number | null;
      let perHem: number | null;
      let extras: number | null;
      try {
        sheetCost = centsField(body.sheetCostCents, 'Sheet cost');
        perBend = centsField(body.perBendCents, 'Per bend');
        perHem = centsField(body.perHemCents, 'Per hem');
        extras = centsField(body.extrasCents, 'Extras');
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'One of those prices was not a number.' },
          { status: 400 }
        );
      }

      const effectiveFrom =
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.trim() !== ''
          ? toEffectiveDate(body.effectiveFrom.trim())
          : toEffectiveDate(new Date());

      const { data: item } = await admin
        .from('price_book_items')
        .select('id, material, gauge')
        .eq('id', itemId)
        .maybeSingle();
      if (!item) {
        return NextResponse.json({ error: 'That price book row could not be found.' }, { status: 404 });
      }
      const itemRow = item as { id: string; material: string; gauge: string };

      const history = await getPriceBookHistory(admin, itemId);
      const previous: PriceBookVersion | null =
        history.find((v) => v.effectiveFrom <= effectiveFrom) ?? null;

      const { data: inserted, error } = await admin
        .from('price_book_versions')
        .insert({
          item_id: itemId,
          sheet_cost_cents: sheetCost,
          per_bend_cents: perBend,
          per_hem_cents: perHem,
          extras_cents: extras,
          extras_note: typeof body.extrasNote === 'string' && body.extrasNote.trim() !== '' ? body.extrasNote.trim() : null,
          effective_from: effectiveFrom,
          note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null,
          created_by: user.id,
        })
        .select(
          'id, item_id, sheet_cost_cents, per_bend_cents, per_hem_cents, extras_cents, extras_note, effective_from, note, created_by, created_at'
        )
        .single();

      if (error || !inserted) {
        // The unique (item_id, effective_from) is the likely cause, and saying
        // so beats "internal error" — it tells Steve exactly what to change.
        const duplicate = (error?.message ?? '').includes('price_book_versions_item_effective_key');
        return NextResponse.json(
          {
            error: duplicate
              ? `There is already a price for ${itemRow.material} ${itemRow.gauge} starting ${effectiveFrom}. ` +
                `Pick a different start date — an existing price is never overwritten.`
              : 'Those prices could not be saved. Please try again.',
          },
          { status: duplicate ? 409 : 500 }
        );
      }

      const next = toPriceBookVersion(inserted as Parameters<typeof toPriceBookVersion>[0]);
      const delta = priceBookChangeDelta(previous, next);

      await appendLedger(admin, {
        eventType: 'price_book_change',
        source: 'admin_ui',
        actorId: user.id,
        actorEmail,
        actorRole: 'admin',
        material: itemRow.material,
        gauge: itemRow.gauge,
        priceBookVersionIds: [next.id],
        effectiveDate: effectiveFrom,
        oldValue: delta.old as unknown as Record<string, unknown>,
        newValue: delta.new as unknown as Record<string, unknown>,
        note: next.note,
      });

      await logAdminAction({
        adminId: user.id,
        action: 'price_book_set_prices',
        resourceType: 'price_book_item',
        resourceId: itemId,
        beforeValue: delta.old as unknown as Record<string, unknown>,
        afterValue: delta.new as unknown as Record<string, unknown>,
      });

      return NextResponse.json({
        ok: true,
        versionId: next.id,
        effectiveFrom,
        message:
          `Saved. ${itemRow.material} ${itemRow.gauge} uses these prices from ${effectiveFrom}. ` +
          `Quotes already sent keep the prices they were built on.`,
      });
    }

    // ----------------------------------------------------------------- retire
    if (action === 'retire') {
      const itemId = body.itemId;
      if (typeof itemId !== 'string') {
        return NextResponse.json({ error: 'itemId is required.' }, { status: 400 });
      }
      if (body.retired !== true && body.retired !== false) {
        return NextResponse.json({ error: 'retired must be exactly true or false.' }, { status: 400 });
      }
      const retired: boolean = body.retired;

      const { data: item } = await admin
        .from('price_book_items')
        .select('id, material, gauge, retired_at')
        .eq('id', itemId)
        .maybeSingle();
      if (!item) {
        return NextResponse.json({ error: 'That price book row could not be found.' }, { status: 404 });
      }
      const itemRow = item as { id: string; material: string; gauge: string; retired_at: string | null };

      const nowIso = new Date().toISOString();
      await admin
        .from('price_book_items')
        // Retiring never deletes: the row and every price it ever had stay, so
        // an old quote still resolves.
        .update({ retired_at: retired ? nowIso : null, retired_by: retired ? user.id : null })
        .eq('id', itemId);

      await logAdminAction({
        adminId: user.id,
        action: retired ? 'price_book_retire_row' : 'price_book_unretire_row',
        resourceType: 'price_book_item',
        resourceId: itemId,
        beforeValue: { retiredAt: itemRow.retired_at },
        afterValue: { retiredAt: retired ? nowIso : null },
      });

      return NextResponse.json({
        ok: true,
        message: retired
          ? `${itemRow.material} ${itemRow.gauge} is retired. It cannot start a new quote, and every old quote that used it is untouched.`
          : `${itemRow.material} ${itemRow.gauge} is back in the price book, with its old prices intact.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('[Price Book Error]', error);
    return NextResponse.json({ error: 'Could not update the price book. Please try again.' }, { status: 500 });
  }
}
