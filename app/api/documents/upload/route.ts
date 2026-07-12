import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Context A — Project Document Vault. See SPEC_DOCUMENT_UPLOAD.md §2.
const ACCEPTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.txt', '.rtf',
  '.dwg', '.dxf',
  '.png', '.jpg', '.jpeg', '.tiff',
  '.xlsx', '.csv',
  '.zip',
];

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = (formData.get('projectId') as string | null)?.trim() || null;
    const folderName = (formData.get('folderName') as string | null)?.trim() || null;
    const description = (formData.get('description') as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File exceeds 100MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.` },
        { status: 400 }
      );
    }
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `${ext.toUpperCase()} is not supported in the document vault.` },
        { status: 400 }
      );
    }

    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!project) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      }
    }

    const docId = crypto.randomUUID();
    const sanitizedFilename = sanitizeFilename(file.name);
    const storageKey = `documents/${user.id}/${projectId ?? 'general'}/${docId}-${sanitizedFilename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();

    const { error: storageError } = await admin.storage
      .from('documents')
      .upload(storageKey, buffer, { contentType: file.type || 'application/octet-stream', upsert: false });

    if (storageError) {
      console.error('[Document Upload Storage Error]', storageError);
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
    }

    const { error: insertError } = await admin.from('vault_documents').insert({
      id: docId,
      user_id: user.id,
      project_id: projectId,
      folder_name: folderName,
      filename: sanitizedFilename,
      original_filename: file.name,
      file_type: ext,
      file_size_bytes: file.size,
      storage_key: storageKey,
      description,
    });

    if (insertError) {
      console.error('[Document Upload Insert Error]', insertError);
      return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
    }

    return NextResponse.json({
      document: {
        id: docId,
        filename: sanitizedFilename,
        storageKey,
        fileType: ext,
        fileSizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Document Upload Error]', error);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
