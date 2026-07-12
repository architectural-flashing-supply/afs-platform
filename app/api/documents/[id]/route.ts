import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
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
      .select('id, user_id, storage_key')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { error: storageError } = await admin.storage.from('documents').remove([doc.storage_key]);
    if (storageError) {
      console.error('[Document Delete Storage Error]', storageError);
    }

    const { error: deleteError } = await admin.from('vault_documents').delete().eq('id', params.id);
    if (deleteError) {
      console.error('[Document Delete Error]', deleteError);
      return NextResponse.json({ error: 'Could not delete document. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Document Delete Error]', error);
    return NextResponse.json({ error: 'Could not delete document. Please try again.' }, { status: 500 });
  }
}
