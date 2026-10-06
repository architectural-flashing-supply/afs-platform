import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminCaller } from '@/lib/email-intake/server';

/** Short-lived signed URL (60 s) for one stored email attachment. Admin only; the bucket itself is private. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getAdminCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const admin = createAdminClient();
  const { data: att } = await admin.from('email_attachments').select('storage_path, filename, content_type').eq('id', id).maybeSingle();
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: signed } = await admin.storage.from('email-attachments').createSignedUrl(att.storage_path, 60);
  if (!signed) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, filename: att.filename, contentType: att.content_type });
}
