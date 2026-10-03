/**
 * THE SALES TAX NEXUS STATES, EDITABLE BY AN ADMIN.
 *
 *   POST { action: 'add-state',     stateCode, basis, effectiveFrom, registrationId?, note?, collecting? }
 *   POST { action: 'update-state',  id, collecting?, basis?, registrationId?, effectiveFrom?, effectiveTo?, note? }
 *   POST { action: 'retire-state',  id }
 *   POST { action: 'restore-state', id }
 *   POST { action: 'resolve-review', id, note? }
 *
 * Shaped after app/api/admin/price-book/route.ts: one action discriminator, the
 * role re-checked here as well as in middleware, writes through the service-role
 * client, an `admin_audit_log` row after every mutation, and plain-English
 * messages that say what did and did not happen (CLAUDE.md rule #30).
 *
 * ================== THE LIST STARTS EMPTY, AND THAT IS NOT A BUG ==================
 *
 * AFS's nexus states are an open DATA BLOCKER (checklist #31) and must come from
 * its accountant. Until a state is added here, lib/tax/calculate.ts answers
 * `not_configured` — never "no tax owed" — and nothing is calculated or
 * collected. This route is how that blocker gets cleared, one state at a time.
 *
 * ================== RETIRE NEVER DELETES ==================
 *
 * `retire-state` closes the effective window and stops collection. The row stays,
 * so a tax calculation recorded months ago still has a readable basis. Same
 * reasoning as the price book's own `retire` action, which also never deletes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { expireCachedCalculations, resolveReview } from '@/lib/tax/db';
import { isIsoDateString, isNexusBasis, normalizeStateCode } from '@/lib/tax/nexus';
import { shopDateOnly } from '@/lib/delivery/business-days';
import { NEXUS_BASIS_LABELS } from '@/lib/tax/types';

/** An optional free-text field: trimmed, or null. A blank is never an empty string. */
function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * A strict boolean. `true`/`false` only — never a truthy coercion.
 *
 * The price-book route sets the precedent (`retired must be exactly true or
 * false`), and it matters more here: `collecting` decides whether AFS calculates
 * tax in a state at all, and `"false"` as a string is truthy.
 */
function strictBoolean(value: unknown, fallback: boolean): boolean | 'invalid' {
  if (value === undefined || value === null) return fallback;
  if (value === true || value === false) return value;
  return 'invalid';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ---- Auth, twice: the session, then the role ---------------------------
    // Middleware already guards /admin and /api/admin, but middleware can be
    // bypassed by misconfiguration or a future route change — the same reasoning
    // lib/admin/auth.ts records for every admin page.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to change the tax settings. Nothing was changed.' },
        { status: 401 }
      );
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only an administrator can change the tax settings. Nothing was changed.' },
        { status: 403 }
      );
    }

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const action = body.action;
    const admin = createAdminClient();
    const now = new Date();
    const today = shopDateOnly(now);

    // ------------------------------------------------------------ add a state
    if (action === 'add-state') {
      const stateCode = normalizeStateCode(
        typeof body.stateCode === 'string' ? body.stateCode : null
      );
      if (stateCode === null) {
        return NextResponse.json(
          {
            error:
              'That is not a two-letter state code (for example TX or CA). Nothing was added.',
          },
          { status: 400 }
        );
      }

      if (!isNexusBasis(body.basis)) {
        return NextResponse.json(
          {
            error:
              'Choose why AFS has nexus in that state: ' +
              Object.values(NEXUS_BASIS_LABELS).join(', ') +
              '. Nothing was added.',
          },
          { status: 400 }
        );
      }

      const effectiveFrom =
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.trim() !== ''
          ? body.effectiveFrom.trim()
          : today;
      if (!isIsoDateString(effectiveFrom)) {
        return NextResponse.json(
          { error: 'The start date must be a calendar date like 2026-10-03. Nothing was added.' },
          { status: 400 }
        );
      }

      const collecting = strictBoolean(body.collecting, true);
      if (collecting === 'invalid') {
        return NextResponse.json(
          { error: 'Whether AFS is collecting must be exactly true or false. Nothing was added.' },
          { status: 400 }
        );
      }

      // A duplicate is a 409 naming the state, never a 500 — the same treatment
      // the price book gives a duplicate material/gauge.
      const { data: existing } = await admin
        .from('tax_nexus_states')
        .select('id, collecting, effective_to')
        .eq('state_code', stateCode)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          {
            error:
              `${stateCode} is already in the nexus list. Edit that row instead of adding a second ` +
              'one — there is one row per state on purpose. Nothing was added.',
            existingId: (existing as { id: string }).id,
          },
          { status: 409 }
        );
      }

      const { data: inserted, error } = await admin
        .from('tax_nexus_states')
        .insert({
          state_code: stateCode,
          collecting,
          nexus_basis: body.basis,
          registration_id: optionalText(body.registrationId),
          effective_from: effectiveFrom,
          note: optionalText(body.note),
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .single();

      if (error || !inserted) {
        console.error('[Tax Nexus] add-state failed', error);
        return NextResponse.json(
          { error: 'That state could not be added. Nothing was changed — please try again.' },
          { status: 500 }
        );
      }

      const id = (inserted as { id: string }).id;

      // Any nexus change can alter a figure, so no cached figure survives it.
      // Strictly redundant — the nexus fingerprint is in the cache key — and done
      // anyway so the table holds no rows that look live but are unreachable.
      await expireCachedCalculations(admin, now);

      await logAdminAction({
        adminId: user.id,
        action: 'tax_nexus_add_state',
        resourceType: 'tax_nexus_state',
        resourceId: id,
        afterValue: {
          stateCode,
          collecting,
          basis: body.basis,
          effectiveFrom,
        },
      });

      return NextResponse.json({
        ok: true,
        id,
        message: collecting
          ? `${stateCode} added. AFS will calculate tax for ${stateCode} from ${effectiveFrom} once a tax provider is configured.`
          : `${stateCode} added, recorded as NOT collecting. No tax will be calculated for ${stateCode} until you mark it as collecting.`,
      });
    }

    // --------------------------------------------------------- update a state
    if (action === 'update-state') {
      const id = body.id;
      if (typeof id !== 'string' || id.trim() === '') {
        return NextResponse.json({ error: 'A state id is required. Nothing was changed.' }, { status: 400 });
      }

      const { data: existing } = await admin
        .from('tax_nexus_states')
        .select('id, state_code, collecting, nexus_basis, registration_id, effective_from, effective_to, note')
        .eq('id', id)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json(
          { error: 'That state is not in the nexus list. Nothing was changed.' },
          { status: 404 }
        );
      }
      const before = existing as {
        id: string;
        state_code: string;
        collecting: boolean;
        nexus_basis: string;
        registration_id: string | null;
        effective_from: string;
        effective_to: string | null;
        note: string | null;
      };

      const update: Record<string, unknown> = { updated_by: user.id, updated_at: now.toISOString() };

      if (body.collecting !== undefined) {
        const collecting = strictBoolean(body.collecting, before.collecting);
        if (collecting === 'invalid') {
          return NextResponse.json(
            { error: 'Whether AFS is collecting must be exactly true or false. Nothing was changed.' },
            { status: 400 }
          );
        }
        update.collecting = collecting;
      }

      if (body.basis !== undefined) {
        if (!isNexusBasis(body.basis)) {
          return NextResponse.json(
            { error: 'That is not a nexus reason this app knows. Nothing was changed.' },
            { status: 400 }
          );
        }
        update.nexus_basis = body.basis;
      }

      if (body.registrationId !== undefined) update.registration_id = optionalText(body.registrationId);
      if (body.note !== undefined) update.note = optionalText(body.note);

      if (body.effectiveFrom !== undefined) {
        const from = typeof body.effectiveFrom === 'string' ? body.effectiveFrom.trim() : '';
        if (!isIsoDateString(from)) {
          return NextResponse.json(
            { error: 'The start date must be a calendar date like 2026-10-03. Nothing was changed.' },
            { status: 400 }
          );
        }
        update.effective_from = from;
      }

      if (body.effectiveTo !== undefined) {
        if (body.effectiveTo === null || body.effectiveTo === '') {
          update.effective_to = null;
        } else {
          const to = typeof body.effectiveTo === 'string' ? body.effectiveTo.trim() : '';
          if (!isIsoDateString(to)) {
            return NextResponse.json(
              { error: 'The end date must be a calendar date like 2026-10-03, or left blank. Nothing was changed.' },
              { status: 400 }
            );
          }
          update.effective_to = to;
        }
      }

      // Caught here as well as by the database CHECK, so the admin gets a
      // sentence rather than a constraint-violation 500.
      const finalFrom = (update.effective_from as string | undefined) ?? before.effective_from;
      const finalTo =
        update.effective_to !== undefined
          ? (update.effective_to as string | null)
          : before.effective_to;
      if (finalTo !== null && finalTo < finalFrom) {
        return NextResponse.json(
          {
            error: `The end date (${finalTo}) is before the start date (${finalFrom}), so the row would apply on no day at all. Nothing was changed.`,
          },
          { status: 400 }
        );
      }

      const { error } = await admin.from('tax_nexus_states').update(update).eq('id', id);
      if (error) {
        console.error('[Tax Nexus] update-state failed', error);
        return NextResponse.json(
          { error: 'That change could not be saved. Nothing was changed — please try again.' },
          { status: 500 }
        );
      }

      await expireCachedCalculations(admin, now);

      await logAdminAction({
        adminId: user.id,
        action: 'tax_nexus_update_state',
        resourceType: 'tax_nexus_state',
        resourceId: id,
        beforeValue: {
          collecting: before.collecting,
          basis: before.nexus_basis,
          registrationId: before.registration_id,
          effectiveFrom: before.effective_from,
          effectiveTo: before.effective_to,
          note: before.note,
        },
        afterValue: update,
      });

      return NextResponse.json({
        ok: true,
        message: `${before.state_code} updated. Any tax figure calculated earlier has been set aside, so the next calculation uses the new settings.`,
      });
    }

    // ------------------------------------------------- retire / restore a state
    if (action === 'retire-state' || action === 'restore-state') {
      const id = body.id;
      if (typeof id !== 'string' || id.trim() === '') {
        return NextResponse.json({ error: 'A state id is required. Nothing was changed.' }, { status: 400 });
      }
      const retiring = action === 'retire-state';

      const { data: existing } = await admin
        .from('tax_nexus_states')
        .select('id, state_code, collecting, effective_from, effective_to')
        .eq('id', id)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json(
          { error: 'That state is not in the nexus list. Nothing was changed.' },
          { status: 404 }
        );
      }
      const before = existing as {
        state_code: string;
        collecting: boolean;
        effective_from: string;
        effective_to: string | null;
      };

      // RETIRING NEVER DELETES. The row and its window stay, so a calculation
      // recorded months ago still has a readable basis.
      //
      // The end date is `today` rather than now-minus-nothing, and it cannot be
      // earlier than the start — a state added and retired on the same day would
      // otherwise violate the window CHECK and surface as a 500.
      const effectiveTo = retiring
        ? today < before.effective_from
          ? before.effective_from
          : today
        : null;

      const { error } = await admin
        .from('tax_nexus_states')
        .update({
          collecting: retiring ? false : true,
          effective_to: effectiveTo,
          updated_by: user.id,
          updated_at: now.toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[Tax Nexus] retire/restore failed', error);
        return NextResponse.json(
          { error: 'That change could not be saved. Nothing was changed — please try again.' },
          { status: 500 }
        );
      }

      await expireCachedCalculations(admin, now);

      await logAdminAction({
        adminId: user.id,
        action: retiring ? 'tax_nexus_retire_state' : 'tax_nexus_restore_state',
        resourceType: 'tax_nexus_state',
        resourceId: id,
        beforeValue: { collecting: before.collecting, effectiveTo: before.effective_to },
        afterValue: { collecting: !retiring, effectiveTo },
      });

      return NextResponse.json({
        ok: true,
        message: retiring
          ? `${before.state_code} is retired as of ${effectiveTo}. No tax will be calculated for it from now on, and every tax figure already recorded is untouched.`
          : `${before.state_code} is back in the nexus list and collecting again.`,
      });
    }

    // ------------------------------------------------------- resolve a review
    if (action === 'resolve-review') {
      const id = body.id;
      if (typeof id !== 'string' || id.trim() === '') {
        return NextResponse.json(
          { error: 'A calculation id is required. Nothing was changed.' },
          { status: 400 }
        );
      }

      const ok = await resolveReview(admin, id, user.id, optionalText(body.note), now);
      if (!ok) {
        return NextResponse.json(
          { error: 'That could not be marked as reviewed. Nothing was changed — please try again.' },
          { status: 500 }
        );
      }

      await logAdminAction({
        adminId: user.id,
        action: 'tax_calculation_resolve_review',
        resourceType: 'tax_calculation',
        resourceId: id,
        afterValue: { reviewedBy: user.id, note: optionalText(body.note) },
      });

      return NextResponse.json({
        ok: true,
        message: 'Marked as reviewed. The record of the failure is kept.',
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Nothing was changed.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Tax Nexus Error]', error);
    return NextResponse.json(
      { error: 'The tax settings could not be updated. Nothing was changed — please try again.' },
      { status: 500 }
    );
  }
}
