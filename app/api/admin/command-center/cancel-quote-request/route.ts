import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const quoteRequestId = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).quoteRequestId : null;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: quoteRequest, error: qrError } = await admin
      .from('quote_requests')
      .select('id, status')
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (qrError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }
    if ((quoteRequest as { status: string }).status !== 'submitted') {
      return NextResponse.json({ error: 'Quote request is not pending approval.' }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from('quote_requests')
      .update({ status: 'cancelled' })
      .eq('id', quoteRequestId);
    if (updateError) {
      return NextResponse.json({ error: 'Could not cancel request.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'cancel_quote_request',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      afterValue: { status: 'cancelled' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Command Center Cancel Quote Request Error]', error);
    return NextResponse.json({ error: 'Could not cancel request. Please try again.' }, { status: 500 });
  }
}
