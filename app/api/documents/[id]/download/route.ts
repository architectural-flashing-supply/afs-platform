import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: doc } = await supabase
      .from('vault_documents')
      .select('id, user_id, storage_key, filename')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: signed, error } = await admin.storage
      .from('documents')
      .createSignedUrl(doc.storage_key, SIGNED_URL_TTL_SECONDS);

    if (error || !signed) {
      console.error('[Document Download Error]', error);
      return NextResponse.json({ error: 'Could not generate download link.' }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[Document Download Error]', error);
    return NextResponse.json({ error: 'Could not generate download link.' }, { status: 500 });
  }
}
