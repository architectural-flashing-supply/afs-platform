import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * THE ADMIN RUSH TOGGLE — one of exactly TWO things in this codebase allowed to
 * make a job rush. The other is the customer's own checkbox at intake
 * (app/api/quote-requests/route.ts).
 *
 * RUSH IS NEVER INFERRED. Not from `requested_delivery`, not from the word
 * "ASAP" in a note, not from how long a job has been waiting. This route reads
 * ONE field — an explicit boolean the admin set by flipping a switch — and
 * refuses the request outright if that boolean is absent. There is deliberately
 * no "auto" mode and no default: a missing `isRush` is a 400, not a guess.
 *
 * The prohibition is also enforced below this code, in Postgres: migration
 * 034's `quote_requests_rush_needs_explicit_source` CHECK rejects
 * `is_rush = true` unless `rush_source` is 'customer_checkbox' or
 * 'admin_toggle'. Any future code that tried to infer rush would have to invent
 * a third source value, and the constraint has no room for one.
 *
 * Turning rush OFF clears the provenance with it, so a row can never claim it
 * is standard while still recording who made it urgent.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const quoteRequestId = body.quoteRequestId;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }
    // EXPLICIT OR NOTHING. `=== true` / `=== false` rather than a truthiness
    // check, so `"yes"`, `1`, `null` and a missing field are all refused
    // instead of being coerced into a decision nobody made.
    if (body.isRush !== true && body.isRush !== false) {
      return NextResponse.json(
        { error: 'isRush must be exactly true or false. Rush is never inferred.' },
        { status: 400 }
      );
    }
    const isRush: boolean = body.isRush;

    const admin = createAdminClient();
    const { data: found } = await admin
      .from('quote_requests')
      .select('id, is_rush, rush_source')
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (!found) return NextResponse.json({ error: 'That job could not be found.' }, { status: 404 });
    const before = found as { is_rush: boolean; rush_source: string | null };

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('quote_requests')
      .update({
        is_rush: isRush,
        rush_source: isRush ? 'admin_toggle' : null,
        rush_set_by: isRush ? user.id : null,
        rush_set_at: isRush ? now : null,
      })
      .eq('id', quoteRequestId);
    if (updateError) {
      console.error('[Set Rush Error]', updateError);
      return NextResponse.json({ error: 'Could not change the rush setting. Nothing was changed.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: isRush ? 'set_job_rush_on' : 'set_job_rush_off',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      beforeValue: { isRush: before.is_rush, rushSource: before.rush_source },
      afterValue: { isRush, rushSource: isRush ? 'admin_toggle' : null },
    });

    return NextResponse.json({
      ok: true,
      isRush,
      message: isRush
        ? 'Marked as rush. It now sits at the top of the shop queue. The Workbench order does not change.'
        : 'Rush turned off. This job is back on the standard timeline.',
    });
  } catch (error) {
    console.error('[Set Rush Error]', error);
    return NextResponse.json({ error: 'Could not change the rush setting. Please try again.' }, { status: 500 });
  }
}
