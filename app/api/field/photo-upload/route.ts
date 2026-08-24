import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FIELD_PHOTO_ACCEPTED_EXTENSIONS, FIELD_PHOTO_MAX_SIZE_BYTES } from '@/lib/field/field-photo-limits';

// Metadata-only route: issues a Supabase Storage signed upload URL, same
// bypass-the-4.5MB-serverless-body-limit mechanics as app/api/upload/route.ts
// (the Blueprint Takeoff flow). Deliberately targets the 'documents' bucket
// (SPEC_SUPABASE_INTEGRATION.md §2), not 'blueprints' — a jobsite photo isn't
// a drawing headed for AI takeoff extraction, and this flow never calls
// /api/takeoff on it (afs-fl-002; see SESSION_STATE.md for the full storage
// decision). The row still lands in takeoff_uploads so it can be linked from
// quote_requests.upload_id exactly like a real takeoff upload would be —
// only the bucket differs.
export interface FieldPhotoSignResponse {
  uploadId: string;
  storageKey: string;
  token: string;
  status: 'pending';
}

interface FieldPhotoSignRequestBody {
  filename: string;
  fileSize: number;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'contractor' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as FieldPhotoSignRequestBody | null;
    if (!body?.filename || typeof body.fileSize !== 'number') {
      return NextResponse.json({ error: 'filename and fileSize are required' }, { status: 400 });
    }

    if (body.fileSize > FIELD_PHOTO_MAX_SIZE_BYTES) {
      return NextResponse.json({
        error: `Photo exceeds ${FIELD_PHOTO_MAX_SIZE_BYTES / 1024 / 1024}MB limit. Your file is ${(body.fileSize / 1024 / 1024).toFixed(1)}MB.`
      }, { status: 400 });
    }

    const ext = '.' + (body.filename.split('.').pop()?.toLowerCase() ?? '');
    if (!FIELD_PHOTO_ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        error: `${ext.toUpperCase()} is not supported. Accepted: JPG, PNG, WEBP, HEIC.`
      }, { status: 400 });
    }

    const uploadId = crypto.randomUUID();
    const sanitizedFilename = sanitizeFilename(body.filename);
    const storageKey = `documents/field-photos/${user.id}/${uploadId}/${sanitizedFilename}`;

    const admin = createAdminClient();

    const { data: signed, error: signError } = await admin.storage
      .from('documents')
      .createSignedUploadUrl(storageKey);

    if (signError || !signed) {
      console.error('[Field Photo Upload Sign Error]', signError);
      return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
    }

    const { error: insertError } = await admin
      .from('takeoff_uploads')
      .insert({
        id: uploadId,
        user_id: user.id,
        storage_key: storageKey,
        file_name: body.filename,
        file_type: ext,
        file_size_bytes: body.fileSize,
        status: 'pending',
      });

    if (insertError) {
      console.error('[Field Photo Upload Insert Error]', insertError);
      return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
    }

    const response: FieldPhotoSignResponse = {
      uploadId,
      storageKey,
      token: signed.token,
      status: 'pending',
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Field Photo Upload Sign Error]', error);
    return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
  }
}
