import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

/** Active/inactive toggle per keyword on the admin Bid Monitor dashboard. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
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
    if (!raw || typeof raw !== 'object' || typeof (raw as { isActive?: unknown }).isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { isActive } = raw as { isActive: boolean };

    const { data: existing } = await supabase.from('bid_keywords').select('id').eq('id', params.id).maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Keyword not found.' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('bid_keywords')
      .update({ is_active: isActive })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Bid Keyword Toggle Error]', updateError);
      return NextResponse.json({ error: 'Could not save change. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'toggle_bid_keyword',
      resourceType: 'bid_keyword',
      resourceId: params.id,
      afterValue: { isActive },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Bid Keyword Toggle Route Error]', error);
    return NextResponse.json({ error: 'Could not save change. Please try again.' }, { status: 500 });
  }
}
