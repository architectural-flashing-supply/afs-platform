import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UPLOAD_ACCEPTED_EXTENSIONS, UPLOAD_MAX_SIZE_BYTES } from '@/lib/utils/upload-limits';

// Metadata-only route: issues a Supabase Storage signed upload URL so the
// browser can PUT the file bytes directly to Storage, never through this
// (or any) Vercel serverless function. Vercel's serverless functions have a
// hard, unconfigurable 4.5MB request body limit — well under this app's
// 50MB business limit — so no file bytes can ever pass through an API route
// here. Real size/page-count enforcement happens in /api/takeoff once the
// server downloads the actual uploaded bytes from Storage; fileSize here is
// only the client's claim, used for an early, friendlier rejection.
export interface SignUploadResponse {
  uploadId: string;
  storageKey: string;
  token: string;
  status: 'pending';
}

interface SignUploadRequestBody {
  filename: string;
  fileSize: number;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as SignUploadRequestBody | null;

    if (!body?.filename || typeof body.fileSize !== 'number') {
      return NextResponse.json({ error: 'filename and fileSize are required' }, { status: 400 });
    }

    if (body.fileSize > UPLOAD_MAX_SIZE_BYTES) {
      return NextResponse.json({
        error: `File exceeds ${UPLOAD_MAX_SIZE_BYTES / 1024 / 1024}MB limit. Your file is ${(body.fileSize / 1024 / 1024).toFixed(1)}MB.`
      }, { status: 400 });
    }

    const ext = '.' + (body.filename.split('.').pop()?.toLowerCase() ?? '');
    if (!UPLOAD_ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        error: `${ext.toUpperCase()} is not supported. Accepted: DWG, DXF, PDF, PNG, JPG, TIFF.`
      }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const uploadId = crypto.randomUUID();
    const sanitizedFilename = sanitizeFilename(body.filename);
    const storageKey = `blueprints/${userId ?? 'guest'}/${uploadId}/${sanitizedFilename}`;

    const admin = createAdminClient();

    const { data: signed, error: signError } = await admin.storage
      .from('blueprints')
      .createSignedUploadUrl(storageKey);

    if (signError || !signed) {
      console.error('[Upload Sign Error]', signError);
      return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
    }

    const { error: insertError } = await admin
      .from('takeoff_uploads')
      .insert({
        id: uploadId,
        user_id: userId,
        storage_key: storageKey,
        file_name: body.filename,
        file_type: ext,
        file_size_bytes: body.fileSize,
        status: 'pending',
      });

    if (insertError) {
      console.error('[Upload Sign Insert Error]', insertError);
      return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
    }

    const response: SignUploadResponse = {
      uploadId,
      storageKey,
      token: signed.token,
      status: 'pending',
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Upload Sign Error]', error);
    return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
  }
}
