import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

// Matches bid_projects.status's CHECK constraint (010_bid_monitor.sql).
const VALID_STATUSES = ['new', 'reviewing', 'bidding', 'bid_submitted', 'won', 'lost', 'passed', 'expired'];

/** [Track] dropdown on the admin Bid Monitor dashboard — sets bid_projects.status. */
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
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { status } = raw as { status: unknown };
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('bid_projects')
      .select('id, status')
      .eq('id', params.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Bid project not found.' }, { status: 404 });
    }

    const update: Record<string, unknown> = { status };
    if (status === 'bid_submitted') update.bid_submitted_at = new Date().toISOString();
    if (status === 'won' || status === 'lost') update.result_at = new Date().toISOString();

    const { error: updateError } = await supabase.from('bid_projects').update(update).eq('id', params.id);
    if (updateError) {
      console.error('[Bid Project Status Update Error]', updateError);
      return NextResponse.json({ error: 'Could not save status change. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'update_bid_project_status',
      resourceType: 'bid_project',
      resourceId: params.id,
      beforeValue: { status: existing.status as string },
      afterValue: update,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Bid Project Status Route Error]', error);
    return NextResponse.json({ error: 'Could not save status change. Please try again.' }, { status: 500 });
  }
}
