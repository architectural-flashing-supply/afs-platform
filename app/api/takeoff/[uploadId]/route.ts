import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Debounced work-persistence save for the /upload results table (see
// app/upload/page.tsx). Writes the user's edited items into
// takeoff_uploads.confirmed_items so in-progress edits survive even if the
// browser's local draft (localStorage) is unavailable or cleared. Uses the
// admin client with no ownership check, matching the existing trust model in
// app/api/takeoff/route.ts's POST handler — a guest session has no auth
// token to check against, and knowledge of the uploadId (never guessable,
// a v4 UUID handed back only to the browser that created the upload) is the
// same bar POST already accepts for writing to this row.
interface ConfirmedItemsPatchBody {
  items: unknown[];
}

export async function PATCH(request: NextRequest, { params }: { params: { uploadId: string } }): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as ConfirmedItemsPatchBody | null;
    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('takeoff_uploads')
      .update({ confirmed_items: body.items, updated_at: new Date().toISOString() })
      .eq('id', params.uploadId);

    if (error) {
      console.error('[Takeoff Confirmed Items Error]', error);
      return NextResponse.json({ error: 'Could not save changes.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Takeoff Confirmed Items Error]', error);
    return NextResponse.json({ error: 'Could not save changes.' }, { status: 500 });
  }
}
