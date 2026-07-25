import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const admin = createAdminClient();
    const { data: photo } = await admin.from('gbp_photo_queue').select('id, status').eq('id', params.id).maybeSingle();
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from('gbp_photo_queue')
      .update({ status: 'rejected', reviewed_at: nowIso, reviewed_by: auth.userId })
      .eq('id', params.id);
    if (updateError) {
      console.error('[GBP Reject Error]', updateError);
      return NextResponse.json({ error: 'Could not reject this photo. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: auth.userId,
      action: 'reject_gbp_photo',
      resourceType: 'gbp_photo_queue',
      resourceId: params.id,
      beforeValue: { status: photo.status },
      afterValue: { status: 'rejected' },
    });

    return NextResponse.json({ status: 'rejected' });
  } catch (error) {
    console.error('[GBP Reject Route Error]', error);
    return NextResponse.json({ error: 'Could not reject this photo. Please try again.' }, { status: 500 });
  }
}
