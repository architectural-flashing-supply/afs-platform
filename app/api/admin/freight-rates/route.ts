import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { toEffectiveDate } from '@/lib/freight/bands';
import {
  FREIGHT_MIGRATION_NAME,
  FREIGHT_NOT_INSTALLED_REASON,
  isRelationMissingError,
} from '@/lib/freight/db';
import { FREIGHT_SURCHARGE_LABELS } from '@/lib/freight/types';

/**
 * THE FREIGHT RATE TABLE, EDITABLE BY AN AFS ADMIN AT ANY TIME.
 *
 *   POST { action: 'add-zone',       name, note? }
 *   POST { action: 'retire-zone',    zoneId, retired: true|false }
 *   POST { action: 'add-band',       zoneId, minWeightLbs, maxWeightLbs? }
 *   POST { action: 'retire-band',    bandId, retired: true|false }
 *   POST { action: 'set-rate',       bandId, rateCents?, effectiveFrom?, note? }
 *   POST { action: 'set-surcharges', residentialCents?, liftgateCents?,
 *                                    freeFreightThresholdCents?, effectiveFrom?, note? }
 *
 * Deliberately shaped like `app/api/admin/price-book/route.ts`, down to the
 * auth check, the service-role write, the plain-English messages and the
 * un-retire-instead-of-duplicate behaviour — two admin screens that edit
 * versioned money should not behave differently for no reason.
 *
 * ================== NOTHING IS EVER OVERWRITTEN ==================
 *
 * `set-rate` and `set-surcharges` INSERT a new version row with its own start
 * date. They do not update the previous one — they could not: migration 039 puts
 * an append-only trigger on both tables. A quote already sent therefore keeps
 * the freight it was built on forever, and "the carrier raised its rates" is a
 * fact with a date on it rather than a silent mutation.
 *
 * ================== A BLANK IS NOT A ZERO ==================
 *
 * A money field omitted from the body, or sent as null or '', is stored as NULL.
 * It renders as a marked blank and it blocks the automatic estimate. Only an
 * explicit whole number of cents becomes a rate. There is deliberately no way
 * for this route to invent one: AFS's carrier and rate structures are checklist
 * #27-28 and every figure here has to come from a human.
 *
 * ================== WHY A 503 AND NOT A 500 ==================
 *
 * Migration 039 is written but NOT APPLIED, so on every deployment today these
 * tables do not exist. A generic 500 would send somebody looking for a bug. A
 * 503 naming the migration says exactly what is wrong and what to do, and
 * confirms that manual freight entry on the quote screen is unaffected.
 */

/** Cents from a JSON field. `undefined`/null/'' are blanks; anything else must be a real number. */
function centsField(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)) {
    return value;
  }
  throw new Error(`${label} must be a whole number of cents, or left blank. It is never assumed to be zero.`);
}

/** Pounds from a JSON field. Required when `allowBlank` is false. */
function poundsField(value: unknown, label: string, allowBlank: boolean): number | null {
  if (value === undefined || value === null || value === '') {
    if (allowBlank) return null;
    throw new Error(`${label} is required, as a whole number of pounds.`);
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)) {
    return value;
  }
  throw new Error(`${label} must be a whole number of pounds at or above zero.`);
}

function notInstalled(): NextResponse {
  return NextResponse.json({ error: FREIGHT_NOT_INSTALLED_REASON }, { status: 503 });
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
      .select('role')
      .eq('id', user.id)
      .single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const action = body.action;
    const admin = createAdminClient();

    // ------------------------------------------------------------- add a zone
    if (action === 'add-zone') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name === '') {
        return NextResponse.json({ error: 'A freight zone needs a name.' }, { status: 400 });
      }
      const note = typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null;

      const { data: existing, error: lookupError } = await admin
        .from('freight_zones')
        .select('id, retired_at')
        .eq('name', name)
        .maybeSingle();
      if (lookupError && isRelationMissingError(lookupError)) return notInstalled();

      if (existing) {
        const row = existing as { id: string; retired_at: string | null };
        if (row.retired_at) {
          // Bringing back a retired zone is un-retiring it, not a duplicate —
          // and its old bands and rates come back with it.
          await admin.from('freight_zones').update({ retired_at: null, retired_by: null }).eq('id', row.id);
          await logAdminAction({
            adminId: user.id,
            action: 'freight_unretire_zone',
            resourceType: 'freight_zone',
            resourceId: row.id,
            afterValue: { name },
          });
          return NextResponse.json({
            ok: true,
            zoneId: row.id,
            message: `"${name}" was retired — it is back, with its weight bands and rates intact.`,
          });
        }
        return NextResponse.json(
          { error: `"${name}" is already a freight zone.` },
          { status: 409 }
        );
      }

      const { data: maxRow } = await admin
        .from('freight_zones')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
      const nextOrder = (((maxRow ?? [])[0] as { display_order?: number } | undefined)?.display_order ?? 0) + 1;

      const { data: inserted, error } = await admin
        .from('freight_zones')
        .insert({ name, note, display_order: nextOrder, created_by: user.id })
        .select('id')
        .single();
      if (error && isRelationMissingError(error)) return notInstalled();
      if (error || !inserted) {
        console.error('[Freight Rates Error] add-zone', error);
        return NextResponse.json({ error: 'That zone could not be added. Please try again.' }, { status: 500 });
      }
      const zoneId = (inserted as { id: string }).id;

      await logAdminAction({
        adminId: user.id,
        action: 'freight_add_zone',
        resourceType: 'freight_zone',
        resourceId: zoneId,
        afterValue: { name, note },
      });

      return NextResponse.json({
        ok: true,
        zoneId,
        message: `"${name}" added. Add its weight bands next — nothing is priced until you fill the rates in.`,
      });
    }

    // ---------------------------------------------------------- retire a zone
    if (action === 'retire-zone') {
      const zoneId = body.zoneId;
      if (typeof zoneId !== 'string') {
        return NextResponse.json({ error: 'zoneId is required.' }, { status: 400 });
      }
      if (body.retired !== true && body.retired !== false) {
        return NextResponse.json({ error: 'retired must be exactly true or false.' }, { status: 400 });
      }
      const retired: boolean = body.retired;

      const { data: zone, error: lookupError } = await admin
        .from('freight_zones')
        .select('id, name, retired_at')
        .eq('id', zoneId)
        .maybeSingle();
      if (lookupError && isRelationMissingError(lookupError)) return notInstalled();
      if (!zone) {
        return NextResponse.json({ error: 'That freight zone could not be found.' }, { status: 404 });
      }
      const zoneRow = zone as { id: string; name: string; retired_at: string | null };

      const nowIso = new Date().toISOString();
      // Retiring never deletes: freight_estimates holds a foreign key to this
      // zone on every quote that ever used it.
      await admin
        .from('freight_zones')
        .update({ retired_at: retired ? nowIso : null, retired_by: retired ? user.id : null })
        .eq('id', zoneId);

      await logAdminAction({
        adminId: user.id,
        action: retired ? 'freight_retire_zone' : 'freight_unretire_zone',
        resourceType: 'freight_zone',
        resourceId: zoneId,
        beforeValue: { retiredAt: zoneRow.retired_at },
        afterValue: { retiredAt: retired ? nowIso : null },
      });

      return NextResponse.json({
        ok: true,
        message: retired
          ? `"${zoneRow.name}" is retired. It cannot price new work, and every quote that used it is untouched.`
          : `"${zoneRow.name}" is back, with its weight bands and rates intact.`,
      });
    }

    // ------------------------------------------------------------- add a band
    if (action === 'add-band') {
      const zoneId = body.zoneId;
      if (typeof zoneId !== 'string') {
        return NextResponse.json({ error: 'zoneId is required.' }, { status: 400 });
      }

      let minWeightLbs: number;
      let maxWeightLbs: number | null;
      try {
        const min = poundsField(body.minWeightLbs, 'The lower weight', false);
        if (min === null) throw new Error('The lower weight is required, as a whole number of pounds.');
        minWeightLbs = min;
        maxWeightLbs = poundsField(body.maxWeightLbs, 'The upper weight', true);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Those weights were not numbers.' },
          { status: 400 }
        );
      }

      if (maxWeightLbs !== null && maxWeightLbs <= minWeightLbs) {
        return NextResponse.json(
          {
            error:
              `A band from ${minWeightLbs.toLocaleString('en-US')} lb to ` +
              `${maxWeightLbs.toLocaleString('en-US')} lb can never hold a shipment, because its upper weight ` +
              `is not above its lower one. Raise the upper weight, or leave it empty to make this the top band.`,
          },
          { status: 400 }
        );
      }

      const { data: zone, error: zoneError } = await admin
        .from('freight_zones')
        .select('id, name')
        .eq('id', zoneId)
        .maybeSingle();
      if (zoneError && isRelationMissingError(zoneError)) return notInstalled();
      if (!zone) {
        return NextResponse.json({ error: 'That freight zone could not be found.' }, { status: 404 });
      }
      const zoneRow = zone as { id: string; name: string };

      const { data: siblingRows } = await admin
        .from('freight_rate_bands')
        .select('id, min_weight_lbs, max_weight_lbs, display_order, retired_at')
        .eq('zone_id', zoneId);
      const siblings = ((siblingRows ?? []) as {
        id: string;
        min_weight_lbs: number;
        max_weight_lbs: number | null;
        display_order: number;
        retired_at: string | null;
      }[]).filter((row) => row.retired_at === null);

      // The two cross-row rules a CHECK constraint cannot express. Caught here
      // with a sentence rather than left for the estimate to refuse later: the
      // person who can fix it is the one looking at this screen now.
      if (siblings.some((row) => row.min_weight_lbs === minWeightLbs)) {
        return NextResponse.json(
          {
            error:
              `"${zoneRow.name}" already has a band starting at ${minWeightLbs.toLocaleString('en-US')} lb. ` +
              `A shipment that weight would match two bands, so only one may start at each weight.`,
          },
          { status: 409 }
        );
      }
      if (maxWeightLbs === null && siblings.some((row) => row.max_weight_lbs === null)) {
        return NextResponse.json(
          {
            error:
              `"${zoneRow.name}" already has a band with no upper weight. A heavy shipment could fall in ` +
              `both and there would be no way to say which rate is right — give this one an upper weight.`,
          },
          { status: 409 }
        );
      }

      const nextOrder =
        siblings.reduce((max, row) => Math.max(max, row.display_order), 0) + 1;

      const { data: inserted, error } = await admin
        .from('freight_rate_bands')
        .insert({
          zone_id: zoneId,
          min_weight_lbs: minWeightLbs,
          max_weight_lbs: maxWeightLbs,
          display_order: nextOrder,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (error && isRelationMissingError(error)) return notInstalled();
      if (error || !inserted) {
        console.error('[Freight Rates Error] add-band', error);
        return NextResponse.json({ error: 'That band could not be added. Please try again.' }, { status: 500 });
      }
      const bandId = (inserted as { id: string }).id;

      await logAdminAction({
        adminId: user.id,
        action: 'freight_add_band',
        resourceType: 'freight_rate_band',
        resourceId: bandId,
        afterValue: { zoneId, zoneName: zoneRow.name, minWeightLbs, maxWeightLbs },
      });

      const described =
        maxWeightLbs === null
          ? `${minWeightLbs.toLocaleString('en-US')} lb and over`
          : `${minWeightLbs.toLocaleString('en-US')}–${(maxWeightLbs - 1).toLocaleString('en-US')} lb`;

      return NextResponse.json({
        ok: true,
        bandId,
        message: `${described} added to "${zoneRow.name}". Its rate is blank until you fill it in.`,
      });
    }

    // ---------------------------------------------------------- retire a band
    if (action === 'retire-band') {
      const bandId = body.bandId;
      if (typeof bandId !== 'string') {
        return NextResponse.json({ error: 'bandId is required.' }, { status: 400 });
      }
      if (body.retired !== true && body.retired !== false) {
        return NextResponse.json({ error: 'retired must be exactly true or false.' }, { status: 400 });
      }
      const retired: boolean = body.retired;

      const { data: band, error: lookupError } = await admin
        .from('freight_rate_bands')
        .select('id, min_weight_lbs, max_weight_lbs, retired_at')
        .eq('id', bandId)
        .maybeSingle();
      if (lookupError && isRelationMissingError(lookupError)) return notInstalled();
      if (!band) {
        return NextResponse.json({ error: 'That weight band could not be found.' }, { status: 404 });
      }
      const bandRow = band as {
        id: string;
        min_weight_lbs: number;
        max_weight_lbs: number | null;
        retired_at: string | null;
      };

      const nowIso = new Date().toISOString();
      await admin
        .from('freight_rate_bands')
        .update({ retired_at: retired ? nowIso : null, retired_by: retired ? user.id : null })
        .eq('id', bandId);

      await logAdminAction({
        adminId: user.id,
        action: retired ? 'freight_retire_band' : 'freight_unretire_band',
        resourceType: 'freight_rate_band',
        resourceId: bandId,
        beforeValue: { retiredAt: bandRow.retired_at },
        afterValue: { retiredAt: retired ? nowIso : null },
      });

      return NextResponse.json({
        ok: true,
        message: retired
          ? 'That band is retired. It cannot price new work, and every quote that used it is untouched.'
          : 'That band is back, with its old rates intact.',
      });
    }

    // -------------------------------------------------------------- set a rate
    if (action === 'set-rate') {
      const bandId = body.bandId;
      if (typeof bandId !== 'string') {
        return NextResponse.json({ error: 'bandId is required.' }, { status: 400 });
      }

      let rateCents: number | null;
      try {
        rateCents = centsField(body.rateCents, 'The freight rate');
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'That rate was not a number.' },
          { status: 400 }
        );
      }

      const effectiveFrom =
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.trim() !== ''
          ? toEffectiveDate(body.effectiveFrom.trim())
          : toEffectiveDate(new Date());

      const { data: band, error: bandError } = await admin
        .from('freight_rate_bands')
        .select('id, zone_id, min_weight_lbs, max_weight_lbs')
        .eq('id', bandId)
        .maybeSingle();
      if (bandError && isRelationMissingError(bandError)) return notInstalled();
      if (!band) {
        return NextResponse.json({ error: 'That weight band could not be found.' }, { status: 404 });
      }
      const bandRow = band as {
        id: string;
        zone_id: string;
        min_weight_lbs: number;
        max_weight_lbs: number | null;
      };

      // What the rate was before, for the audit entry's before-value. Read
      // rather than assumed: "it changed" is not a useful record without it.
      const { data: historyRows } = await admin
        .from('freight_rate_versions')
        .select('id, rate_cents, effective_from')
        .eq('band_id', bandId)
        .lte('effective_from', effectiveFrom)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      const previous = ((historyRows ?? [])[0] as
        | { id: string; rate_cents: number | null; effective_from: string }
        | undefined) ?? null;

      const { data: inserted, error } = await admin
        .from('freight_rate_versions')
        .insert({
          band_id: bandId,
          rate_cents: rateCents,
          effective_from: effectiveFrom,
          note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error && isRelationMissingError(error)) return notInstalled();
      if (error || !inserted) {
        // The unique (band_id, effective_from) is the likely cause, and saying
        // so beats "internal error" — it names exactly what to change.
        const duplicate = (error?.message ?? '').includes('freight_rate_versions_band_effective_key');
        if (duplicate) {
          return NextResponse.json(
            {
              error:
                `There is already a rate for this band starting ${effectiveFrom}. Pick a different start ` +
                `date — an existing rate is never overwritten, so a quote already sent keeps the freight ` +
                `it was built on.`,
            },
            { status: 409 }
          );
        }
        console.error('[Freight Rates Error] set-rate', error);
        return NextResponse.json({ error: 'That rate could not be saved. Please try again.' }, { status: 500 });
      }

      await logAdminAction({
        adminId: user.id,
        action: 'freight_set_rate',
        resourceType: 'freight_rate_band',
        resourceId: bandId,
        beforeValue: {
          rateCents: previous?.rate_cents ?? null,
          effectiveFrom: previous?.effective_from ?? null,
        },
        afterValue: { rateCents, effectiveFrom },
      });

      return NextResponse.json({
        ok: true,
        versionId: (inserted as { id: string }).id,
        effectiveFrom,
        message:
          rateCents === null
            ? `Saved as blank from ${effectiveFrom}. A blank is never treated as zero — this band will not ` +
              `produce an estimate until it has a rate.`
            : `Saved. This band uses that rate from ${effectiveFrom}. Quotes already sent keep the freight ` +
              `they were built on.`,
      });
    }

    // --------------------------------------------------------- set surcharges
    if (action === 'set-surcharges') {
      let residentialCents: number | null;
      let liftgateCents: number | null;
      let freeFreightThresholdCents: number | null;
      try {
        residentialCents = centsField(body.residentialCents, FREIGHT_SURCHARGE_LABELS.residentialCents);
        liftgateCents = centsField(body.liftgateCents, FREIGHT_SURCHARGE_LABELS.liftgateCents);
        freeFreightThresholdCents = centsField(
          body.freeFreightThresholdCents,
          FREIGHT_SURCHARGE_LABELS.freeFreightThresholdCents
        );
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'One of those amounts was not a number.' },
          { status: 400 }
        );
      }

      const effectiveFrom =
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.trim() !== ''
          ? toEffectiveDate(body.effectiveFrom.trim())
          : toEffectiveDate(new Date());

      const { data: previousRows, error: historyError } = await admin
        .from('freight_surcharge_versions')
        .select('id, residential_cents, liftgate_cents, free_freight_threshold_cents, effective_from')
        .lte('effective_from', effectiveFrom)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (historyError && isRelationMissingError(historyError)) return notInstalled();
      const previous = ((previousRows ?? [])[0] as
        | {
            id: string;
            residential_cents: number | null;
            liftgate_cents: number | null;
            free_freight_threshold_cents: number | null;
            effective_from: string;
          }
        | undefined) ?? null;

      const { data: inserted, error } = await admin
        .from('freight_surcharge_versions')
        .insert({
          residential_cents: residentialCents,
          liftgate_cents: liftgateCents,
          free_freight_threshold_cents: freeFreightThresholdCents,
          effective_from: effectiveFrom,
          note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error && isRelationMissingError(error)) return notInstalled();
      if (error || !inserted) {
        const duplicate = (error?.message ?? '').includes('freight_surcharge_versions_effective_key');
        if (duplicate) {
          return NextResponse.json(
            {
              error:
                `There are already surcharges starting ${effectiveFrom}. Pick a different start date — ` +
                `existing ones are never overwritten.`,
            },
            { status: 409 }
          );
        }
        console.error('[Freight Rates Error] set-surcharges', error);
        return NextResponse.json(
          { error: 'Those surcharges could not be saved. Please try again.' },
          { status: 500 }
        );
      }

      await logAdminAction({
        adminId: user.id,
        action: 'freight_set_surcharges',
        resourceType: 'freight_surcharge_version',
        resourceId: (inserted as { id: string }).id,
        beforeValue: {
          residentialCents: previous?.residential_cents ?? null,
          liftgateCents: previous?.liftgate_cents ?? null,
          freeFreightThresholdCents: previous?.free_freight_threshold_cents ?? null,
          effectiveFrom: previous?.effective_from ?? null,
        },
        afterValue: { residentialCents, liftgateCents, freeFreightThresholdCents, effectiveFrom },
      });

      return NextResponse.json({
        ok: true,
        versionId: (inserted as { id: string }).id,
        effectiveFrom,
        message:
          `Saved, from ${effectiveFrom}. Anything left blank stays blank — a blank surcharge is never ` +
          `treated as zero, so a job that needs it will ask you for the amount instead of quietly ` +
          `leaving it off.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    if (isRelationMissingError(error)) return notInstalled();
    console.error('[Freight Rates Error]', error);
    return NextResponse.json(
      { error: `Could not update the freight rates. Please try again. (${FREIGHT_MIGRATION_NAME})` },
      { status: 500 }
    );
  }
}
