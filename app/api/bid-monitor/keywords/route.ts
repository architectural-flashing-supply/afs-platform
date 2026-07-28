import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

// Matches bid_keywords.category's CHECK constraint (010_bid_monitor.sql).
const VALID_CATEGORIES = ['profile', 'material', 'division', 'trade'];

/** [+ Add Keyword] form on the admin Bid Monitor dashboard. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as { keyword?: unknown; category?: unknown };
    if (typeof body.keyword !== 'string' || body.keyword.trim().length === 0) {
      return NextResponse.json({ error: 'A keyword is required.' }, { status: 400 });
    }
    const category = typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category) ? body.category : null;

    const { data: inserted, error: insertError } = await supabase
      .from('bid_keywords')
      .insert({ keyword: body.keyword.trim(), category })
      .select('id, keyword, category, is_active, match_count')
      .single();

    if (insertError) {
      const isDuplicate = insertError.code === '23505';
      return NextResponse.json(
        { error: isDuplicate ? 'That keyword already exists.' : 'Could not add keyword. Please try again.' },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    await logAdminAction({
      adminId: user.id,
      action: 'add_bid_keyword',
      resourceType: 'bid_keyword',
      resourceId: inserted.id as string,
      afterValue: { keyword: body.keyword.trim(), category },
    });

    return NextResponse.json({
      keyword: {
        id: inserted.id as string,
        keyword: inserted.keyword as string,
        category: inserted.category as string | null,
        isActive: inserted.is_active as boolean,
        matchCount: inserted.match_count as number,
      },
    });
  } catch (error) {
    console.error('[Bid Keyword Create Error]', error);
    return NextResponse.json({ error: 'Could not add keyword. Please try again.' }, { status: 500 });
  }
}
