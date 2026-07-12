import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.heic'];
const MAX_SIZE = 25 * 1024 * 1024; // 25MB — SCHEMA.md "orders" bucket limit

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_');
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
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

    const { data: orderRaw } = await supabase.from('orders').select('id, order_number, user_id').eq('id', params.id).maybeSingle();
    if (!orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const notifyCustomer = formData.get('notifyCustomer') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File exceeds 25MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.` },
        { status: 400 }
      );
    }
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `${ext.toUpperCase()} is not a supported image type.` }, { status: 400 });
    }

    const photoId = crypto.randomUUID();
    const sanitizedFilename = sanitizeFilename(file.name);
    const storageKey = `orders/${params.id}/${photoId}-${sanitizedFilename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();

    const { error: storageError } = await admin.storage
      .from('orders')
      .upload(storageKey, buffer, { contentType: file.type || 'image/jpeg', upsert: false });
    if (storageError) {
      console.error('[Pre-Ship Photo Storage Error]', storageError);
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
    }

    const { error: insertError } = await admin.from('order_attachments').insert({
      id: photoId,
      order_id: params.id,
      attachment_type: 'pre_ship_photo',
      filename: sanitizedFilename,
      storage_key: storageKey,
      file_size_bytes: file.size,
      uploaded_by: user.id,
      uploaded_by_role: 'admin',
      is_visible_to_customer: true,
    });
    if (insertError) {
      console.error('[Pre-Ship Photo Insert Error]', insertError);
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
    }

    await admin.from('orders').update({ shop_photo_url: storageKey, updated_at: new Date().toISOString() }).eq('id', params.id);

    // Notification failure must never block the upload (ARCHITECTURE.md §9).
    if (notifyCustomer) {
      try {
        const { data: customerProfile } = await admin.from('profiles').select('email').eq('id', orderRaw.user_id).single();
        await admin.from('notifications').insert({
          order_id: params.id,
          user_id: orderRaw.user_id,
          channel: 'email',
          type: 'preship_photo_uploaded',
          recipient: (customerProfile?.email as string | undefined) ?? '',
          status: 'sent',
        });
      } catch (notifyError) {
        console.error('[Pre-Ship Photo Notification Error]', notifyError);
      }
    }

    await logAdminAction({
      adminId: user.id,
      action: 'upload_preship_photo',
      resourceType: 'order',
      resourceId: params.id,
      afterValue: { filename: sanitizedFilename, notifiedCustomer: notifyCustomer },
    });

    const { data: signed } = await admin.storage.from('orders').createSignedUrl(storageKey, 900);

    return NextResponse.json({
      attachment: {
        id: photoId,
        filename: sanitizedFilename,
        attachmentType: 'pre_ship_photo',
        isVisibleToCustomer: true,
        createdAt: new Date().toISOString(),
        signedUrl: signed?.signedUrl ?? null,
      },
    });
  } catch (error) {
    console.error('[Pre-Ship Photo Route Error]', error);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
