import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// CAD/BIM Library download flow — see SPEC_DOCUMENT_UPLOAD.md §5.
// Distinct from /api/documents/{id}/download (vault documents): this route
// reads cad_library_files, logs the download, and increments download_count.
const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to download technical drawings.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { fileId?: string } | null;
    const fileId = body?.fileId;
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    const { data: file } = await supabase
      .from('cad_library_files')
      .select('id, storage_key, download_count')
      .eq('id', fileId)
      .eq('is_active', true)
      .maybeSingle();

    if (!file) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: signed, error: signError } = await admin.storage
      .from('cad-library')
      .createSignedUrl(file.storage_key, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) {
      console.error('[CAD Download Error]', signError);
      return NextResponse.json({ error: 'Could not generate download link.' }, { status: 500 });
    }

    await admin.from('cad_download_log').insert({ file_id: file.id, user_id: user.id });
    await admin
      .from('cad_library_files')
      .update({ download_count: (file.download_count ?? 0) + 1 })
      .eq('id', file.id);

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[CAD Download Error]', error);
    return NextResponse.json({ error: 'Could not generate download link.' }, { status: 500 });
  }
}
