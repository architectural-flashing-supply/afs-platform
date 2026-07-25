import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';
import { postPhotoToGbp, isGbpConfigured } from '@/lib/integrations/google-business';

/** Storage bucket photos are queued into by app/api/gbp/queue/route.ts. */
const GBP_PHOTOS_BUCKET = 'gbp-photos';

/** Route path + behavior per SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §7's route table. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    if (!isGbpConfigured()) {
      return NextResponse.json(
        { error: 'Google Business Profile not configured. Add credentials in /admin/settings/integrations.' },
        { status: 503 }
      );
    }

    const admin = createAdminClient();
    const { data: photo } = await admin
      .from('gbp_photo_queue')
      .select('id, status, storage_key')
      .eq('id', params.id)
      .maybeSingle();
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
    }
    if (photo.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved photos can be posted to Google Business.' }, { status: 409 });
    }

    // Google's Media API fetches the photo itself from `sourceUrl` — a
    // signed Storage URL is the "download" step, not bytes proxied through
    // this route.
    const { data: signed, error: signError } = await admin.storage
      .from(GBP_PHOTOS_BUCKET)
      .createSignedUrl(photo.storage_key as string, 3600);
    if (signError || !signed?.signedUrl) {
      console.error('[GBP Post Signed URL Error]', signError);
      return NextResponse.json({ error: 'Could not access the queued photo in storage.' }, { status: 500 });
    }

    const result = await postPhotoToGbp(signed.signedUrl);
    if (result.status !== 'posted') {
      return NextResponse.json({ error: result.message }, { status: result.status === 'not_configured' ? 503 : 502 });
    }

    const nowIso = new Date().toISOString();
    await admin.from('gbp_photo_queue').update({ status: 'posted', posted_at: nowIso }).eq('id', params.id);

    await logAdminAction({
      adminId: auth.userId,
      action: 'post_gbp_photo',
      resourceType: 'gbp_photo_queue',
      resourceId: params.id,
      beforeValue: { status: photo.status },
      afterValue: { status: 'posted' },
    });

    return NextResponse.json({ posted: true });
  } catch (error) {
    console.error('[GBP Post Route Error]', error);
    return NextResponse.json({ error: 'Could not post this photo. Please try again.' }, { status: 500 });
  }
}
