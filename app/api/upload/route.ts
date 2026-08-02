import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif'
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PAGES = 100;

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({
        error: `File exceeds 50MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`
      }, { status: 400 });
    }

    // Validate extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        error: `${ext.toUpperCase()} is not supported. Accepted: DWG, DXF, PDF, PNG, JPG, TIFF.`
      }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const uploadId = crypto.randomUUID();
    const sanitizedFilename = sanitizeFilename(file.name);
    const storageKey = `blueprints/${userId ?? 'guest'}/${uploadId}/${sanitizedFilename}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    if (ext === '.pdf') {
      let pageCount: number;
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } catch (pdfError) {
        console.error('[Upload PDF Parse Error]', pdfError);
        return NextResponse.json({
          error: 'Could not read this PDF. It may be corrupted or password-protected.'
        }, { status: 400 });
      }

      if (pageCount > MAX_PAGES) {
        return NextResponse.json({
          error: `PDF exceeds ${MAX_PAGES} page limit. Your file has ${pageCount} pages.`
        }, { status: 400 });
      }
    }

    const admin = createAdminClient();

    const { error: storageError } = await admin.storage
      .from('blueprints')
      .upload(storageKey, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      console.error('[Upload Storage Error]', storageError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { error: insertError } = await admin
      .from('takeoff_uploads')
      .insert({
        id: uploadId,
        user_id: userId,
        storage_key: storageKey,
        file_name: file.name,
        file_type: ext,
        file_size_bytes: file.size,
        status: 'uploaded',
      });

    if (insertError) {
      console.error('[Upload Insert Error]', insertError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({
      uploadId,
      storageKey,
      status: 'uploaded',
    });

  } catch (error) {
    console.error('[Upload Error]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
