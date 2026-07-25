import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';

/**
 * Employee PWA Photos tab (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §3
 * Screen 4). The file itself is already uploaded to the 'gbp-photos' storage
 * bucket by the client before this is called (per §3's flow and this route's
 * own accepted body) — this only records the queue entry. gbp_photo_queue's
 * own RLS (operator_insert_own_photos, 007_delivery_tracking.sql §3) would
 * cover this insert for a real operator session, but the service-role client
 * is used anyway to match every other operator-gated write in this codebase
 * (auth verified via the session client above, write via admin client).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { storageKey, caption } = raw as Record<string, unknown>;
    if (typeof storageKey !== 'string' || !storageKey.trim()) {
      return NextResponse.json({ error: 'storageKey is required.' }, { status: 400 });
    }
    const captionValue = typeof caption === 'string' && caption.trim() ? caption.trim() : null;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('gbp_photo_queue')
      .insert({
        queued_by: auth.userId,
        storage_key: storageKey,
        caption: captionValue,
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[GBP Queue Error]', error);
      return NextResponse.json({ error: 'Could not queue this photo. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ queued: true, id: data.id as string });
  } catch (error) {
    console.error('[GBP Queue Route Error]', error);
    return NextResponse.json({ error: 'Could not queue this photo. Please try again.' }, { status: 500 });
  }
}
