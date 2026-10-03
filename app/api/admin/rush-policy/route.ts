import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { appendLedger } from '@/lib/pricing/ledger';
import { toEffectiveDate } from '@/lib/pricing/price-book';
import { getRushPolicyBook } from '@/lib/pricing/db';
import {
  RUSH_SURCHARGE_TYPE_LABELS,
  formatRushPolicySentence,
  parseRushPolicyInput,
  rushPolicyInForce,
  type RushPolicy,
} from '@/lib/pricing/rush-policy';

/**
 * THE RUSH POLICY, SET BY AN ADMIN AND BY NOBODY ELSE.
 *
 *   POST { action: 'set-policy', name, surchargeType,
 *          surchargePercentBp?, surchargeCents?, minimumLeadTimeDays?,
 *          effectiveFrom?, note? }
 *
 * ================== NOTHING IS EVER OVERWRITTEN ==================
 *
 * INSERT ONLY. There is no UPDATE, no DELETE and no upsert in this file, and
 * there could not be: migration 039 puts the same append-only trigger on
 * `rush_policies` that migration 035 puts on `price_book_versions`, so Postgres
 * refuses both regardless of what this route tried. Changing the rush policy
 * means a new row with a new effective date — so a quote issued last month
 * keeps the surcharge it was built on, forever.
 *
 * ================== A BLANK IS NOT A ZERO, AND NOT STORABLE ==================
 *
 * `parseRushPolicyInput` refuses a half-made decision outright: choosing
 * "a percentage of the job" and leaving the percentage empty is a 400, not a
 * stored NULL. The screen must not be able to create a policy that looks set
 * and is unpriced on every quote forever. Every refusal is a sentence naming
 * the field, because "Steve, fill in the percentage" is actionable and
 * "validation error" is not.
 *
 * ================== THE SURCHARGE IS NEVER CUSTOMER-FACING ==================
 *
 * This route is admin-only twice over: a 403 here unless `profiles.role` is
 * 'admin', and migration 039's RLS grants `rush_policies` to `is_admin()` and
 * to nobody else, with no customer policy at all. A rush rate a customer could
 * read is a price before the formal quote, which CLAUDE.md's business model
 * forbids.
 *
 * ================== IT RECORDS THE CHANGE IN TWO PLACES ==================
 *
 * An `admin_audit_log` row (who changed it, from what, to what) and a
 * `pricing_ledger` row, because a rush surcharge IS a price and rule #20 says
 * every price change lands in the dataset dynamic pricing will learn from. The
 * ledger `event_type` is the existing `'price_book_change'` — verified against
 * migration 035's `pricing_ledger_event_type_check`, which permits exactly
 * eight values and would refuse a new one. Inventing a `'rush_policy_change'`
 * type would need a migration applied to `pricing_ledger`'s CHECK, which this
 * work may not do; `old_value`/`new_value` carry a `rushPolicy` key instead, so
 * the row is unambiguous about what kind of price moved.
 *
 * NEITHER RECORD CAN UNDO A SAVED POLICY. Both are written after the insert and
 * a failure in either is reported in the message, never as a 500 that would
 * imply nothing was saved.
 */

/** What the two history records carry, so "from what, to what" is one shape. */
function ledgerShape(policy: RushPolicy | null): Record<string, unknown> | null {
  if (policy === null) return null;
  return {
    rushPolicy: {
      id: policy.id,
      name: policy.name,
      surchargeType: policy.surchargeType,
      surchargePercentBp: policy.surchargePercentBp,
      surchargeCents: policy.surchargeCents,
      minimumLeadTimeDays: policy.minimumLeadTimeDays,
      effectiveFrom: policy.effectiveFrom,
    },
  };
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
    if (body.action !== 'set-policy') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const today = toEffectiveDate(new Date());
    const parsed = parseRushPolicyInput(body, today);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const draft = parsed.draft;

    const admin = createAdminClient();

    // What was in force BEFORE, so the history records a real "from".
    // `getRushPolicyBook` never throws, so a missing table surfaces as the
    // sentence below rather than as a 500 — and in that state there is nothing
    // to save into, which is worth saying plainly.
    const before = await getRushPolicyBook(admin);
    if (before.unavailable !== null) {
      return NextResponse.json({ error: before.unavailable }, { status: 503 });
    }
    const previous = rushPolicyInForce(before.policies, draft.effectiveFrom);

    const { data: inserted, error } = await admin
      .from('rush_policies')
      .insert({
        name: draft.name,
        surcharge_type: draft.surchargeType,
        surcharge_percent_bp: draft.surchargePercentBp,
        surcharge_cents: draft.surchargeCents,
        minimum_lead_time_days: draft.minimumLeadTimeDays,
        effective_from: draft.effectiveFrom,
        note: draft.note,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('[Rush Policy] insert failed', error);
      return NextResponse.json(
        { error: 'That rush policy could not be saved, so nothing was changed. Please try again.' },
        { status: 500 }
      );
    }
    const policyId = (inserted as { id: string }).id;

    // Re-read so the history and the message describe the row as the database
    // really holds it, rather than as the request described it.
    const after = await getRushPolicyBook(admin);
    const saved = after.policies.find((p) => p.id === policyId) ?? null;

    // `appendLedger` reports rather than throws (it returns `{ ok, error }`),
    // so this reads its answer instead of catching one. The policy IS saved by
    // this point: saying what did not happen beats a 500 that would have an
    // admin enter the whole thing a second time.
    const ledger = await appendLedger(admin, {
      eventType: 'price_book_change',
      source: 'admin_ui',
      actorId: user.id,
      actorEmail,
      actorRole: 'admin',
      effectiveDate: draft.effectiveFrom,
      oldValue: ledgerShape(previous),
      newValue: ledgerShape(saved),
      note: draft.note,
    });
    const noteForSteve = ledger.ok
      ? ''
      : ' The pricing history row could not be written, but the policy itself is saved.';

    // Never throws either (lib/admin/audit.ts), for the same reason.
    await logAdminAction({
      adminId: user.id,
      action: 'rush_policy_set',
      resourceType: 'rush_policy',
      resourceId: policyId,
      beforeValue: ledgerShape(previous),
      afterValue: ledgerShape(saved),
    });

    const inForceToday = rushPolicyInForce(after.policies, today);
    const startsLater = draft.effectiveFrom > today;

    return NextResponse.json({
      ok: true,
      policyId,
      effectiveFrom: draft.effectiveFrom,
      surchargeType: draft.surchargeType,
      surchargeTypeLabel: RUSH_SURCHARGE_TYPE_LABELS[draft.surchargeType],
      inForceToday: formatRushPolicySentence(inForceToday, after.unavailable),
      message:
        (startsLater
          ? `Saved. "${draft.name}" starts on ${draft.effectiveFrom}, so quotes sent before then are unchanged.`
          : `Saved. "${draft.name}" applies to rush quotes from ${draft.effectiveFrom}. ` +
            'Quotes already sent keep the surcharge they were built on.') + noteForSteve,
    });
  } catch (error) {
    console.error('[Rush Policy Error]', error);
    return NextResponse.json(
      { error: 'Could not change the rush policy. Nothing was changed. Please try again.' },
      { status: 500 }
    );
  }
}
