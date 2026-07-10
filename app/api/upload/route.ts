import { NextRequest, NextResponse } from 'next/server';

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
];

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif'
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

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

    // Return success with file info for now
    // Supabase Storage upload will be added when buckets are configured
    return NextResponse.json({
      uploadId:   crypto.randomUUID(),
      filename:   file.name,
      fileType:   ext,
      fileSizeBytes: file.size,
      status:     'uploaded',
    });

  } catch (error) {
    console.error('[Upload Error]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}