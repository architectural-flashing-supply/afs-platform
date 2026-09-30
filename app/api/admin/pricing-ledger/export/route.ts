import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { ledgerToCsv, LEDGER_CSV_COLUMNS } from '@/lib/pricing/ledger';

/**
 * THE PRICING HISTORY, AS A CSV. Admin only.
 *
 * It reads `pricing_ledger_real`, not `pricing_ledger` — the view that excludes
 * test-tagged rows — so an export can never hand somebody a spreadsheet with an
 * E2E run's numbers mixed into the real history.
 *
 * The column order and headers come from `LEDGER_CSV_COLUMNS`, the same
 * constant the import format in SCHEMA.md is written against, so an export can
 * be corrected and re-imported without a mapping step.
 *
 * ADMIN-ONLY, ABSOLUTELY. CLAUDE.md's business rule is that a customer sees a
 * price only on a formal quote or invoice; this file is every price AFS has
 * ever charged anybody, plus its cost basis.
 */
export const dynamic = 'force-dynamic';

/** A hard ceiling, so one click cannot try to stream the whole history at once. */
const MAX_ROWS = 20000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const eventType = searchParams.get('eventType');

    const admin = createAdminClient();
    let query = admin
      .from('pricing_ledger_real')
      .select(LEDGER_CSV_COLUMNS.map((c) => c.key).join(', '))
      .order('occurred_at', { ascending: false })
      .limit(MAX_ROWS);
    if (from) query = query.gte('occurred_at', from);
    if (to) query = query.lte('occurred_at', to);
    if (eventType) query = query.eq('event_type', eventType);

    const { data, error } = await query;
    if (error) {
      console.error('[Pricing Ledger Export] query failed', error);
      return NextResponse.json({ error: 'Could not build that export.' }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const csv = ledgerToCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);

    await logAdminAction({
      adminId: user.id,
      action: 'export_pricing_ledger',
      resourceType: 'pricing_ledger',
      resourceId: user.id,
      afterValue: { rows: rows.length, from, to, eventType, truncated: rows.length >= MAX_ROWS },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="AFS-pricing-history-${stamp}.csv"`,
        // Says out loud when the ceiling bit, rather than handing over a
        // silently truncated file that reads as complete.
        'X-AFS-Row-Count': String(rows.length),
        'X-AFS-Truncated': rows.length >= MAX_ROWS ? 'yes' : 'no',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Pricing Ledger Export Error]', error);
    return NextResponse.json({ error: 'Could not build that export.' }, { status: 500 });
  }
}
