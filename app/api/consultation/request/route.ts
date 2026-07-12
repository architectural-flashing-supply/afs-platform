import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ACCEPTED_EXTENSIONS = ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 3;

const TOPICS = ['Custom Profile', 'Material Selection', 'Spec Review', 'Budget Estimate', 'Other'];
const PREFERRED_CONTACTS = ['Phone', 'Email', 'Video call'];
const PREFERRED_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PREFERRED_TIMES = ['Morning', 'Afternoon'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_');
}

function parseListField(value: FormDataEntryValue | null, allowed: string[]): string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && allowed.includes(v));
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const firmName = (formData.get('firmName') as string | null)?.trim() || null;
    const email = (formData.get('email') as string | null)?.trim() ?? '';
    const phone = (formData.get('phone') as string | null)?.trim() || null;
    const projectName = (formData.get('projectName') as string | null)?.trim() || null;
    const projectType = (formData.get('projectType') as string | null)?.trim() || null;
    const projectLocation = (formData.get('projectLocation') as string | null)?.trim() || null;
    const estimatedBidDate = (formData.get('estimatedBidDate') as string | null)?.trim() || null;
    const topic = (formData.get('topic') as string | null)?.trim() ?? '';
    const description = (formData.get('description') as string | null)?.trim() ?? '';
    const preferredContact = (formData.get('preferredContact') as string | null)?.trim() || null;
    const timeZone = (formData.get('timeZone') as string | null)?.trim() || null;

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!TOPICS.includes(topic)) {
      return NextResponse.json({ error: 'Select a valid topic.' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Describe what you need help with.' }, { status: 400 });
    }
    if (preferredContact && !PREFERRED_CONTACTS.includes(preferredContact)) {
      return NextResponse.json({ error: 'Select a valid contact preference.' }, { status: 400 });
    }

    const preferredDays = parseListField(formData.get('preferredDays'), PREFERRED_DAYS);
    const preferredTimes = parseListField(formData.get('preferredTimes'), PREFERRED_TIMES);

    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Upload at most ${MAX_FILES} files.` }, { status: 400 });
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${file.name} exceeds the 25MB limit.` },
          { status: 400 }
        );
      }
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `${ext.toUpperCase()} is not supported. Accepted: PDF, DWG, DXF, PNG, JPG, TIFF.` },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();
    const requestId = crypto.randomUUID();

    const attachmentKeys: string[] = [];
    for (const file of files) {
      const storageKey = `consultation/${requestId}/${sanitizeFilename(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: storageError } = await admin.storage
        .from('documents')
        .upload(storageKey, buffer, { contentType: file.type || 'application/octet-stream', upsert: false });

      if (storageError) {
        console.error('[Consultation Upload Error]', storageError);
        return NextResponse.json({ error: 'File upload failed. Please try again.' }, { status: 500 });
      }
      attachmentKeys.push(storageKey);
    }

    const noteLines = [
      estimatedBidDate ? `Estimated bid date: ${estimatedBidDate}` : null,
      timeZone ? `Time zone: ${timeZone}` : null,
      description,
    ].filter(Boolean);

    const { error: insertError } = await admin.from('consultation_requests').insert({
      id: requestId,
      user_id: user?.id ?? null,
      name,
      firm_name: firmName,
      email,
      phone,
      project_name: projectName,
      project_type: projectType,
      project_location: projectLocation,
      topic,
      description: noteLines.join('\n\n'),
      attachment_keys: attachmentKeys,
      preferred_contact: preferredContact,
      preferred_days: preferredDays,
      preferred_times: preferredTimes,
      status: 'new',
    });

    if (insertError) {
      console.error('[Consultation Insert Error]', insertError);
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ id: requestId });
  } catch (error) {
    console.error('[Consultation Request Error]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}
