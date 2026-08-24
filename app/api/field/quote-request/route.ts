import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Dedicated insert path for the contractor camera-to-quote flow
// (afs-fl-002) — deliberately NOT the shared app/api/quote-requests/route.ts,
// which hard-rejects a submission with zero line items (isValidItem/
// rawItems.length checks). This flow is photo-only by design: a two-tap
// capture-and-send with no configurator/drawing-tool item entry, so
// quote_requests.line_items is inserted as an explicit `[]` (the column is
// NOT NULL). An AFS estimator adds real line items once they open the photo.
//
// No auth required (afs-fl-007) — /field/contractor is an anonymous guest
// flow per SPEC_PHOTO_TO_QUOTE_AI.md, same guestEmail pattern as
// app/api/quote-requests/route.ts: a signed-in user's request is tied to
// their account, a signed-out visitor must supply a valid email instead.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldQuoteRequestBody {
  uploadId?: string | null;
  clientBusinessName?: string | null;
  jobName?: string | null;
  clientName?: string | null;
  poNumber?: string | null;
  notes?: string | null;
  guestEmail?: string;
}

interface FieldQuoteRequestResponse {
  requestId: string;
  requestNumber: string;
}

function trimmedOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function nextRequestNumber(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AFS-QR-${year}-`;

  const { data } = await admin
    .from('quote_requests')
    .select('request_number')
    .like('request_number', `${prefix}%`)
    .order('request_number', { ascending: false })
    .limit(1);

  const last = data?.[0]?.request_number as string | undefined;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as FieldQuoteRequestBody;

    const guestEmail = typeof body.guestEmail === 'string' ? body.guestEmail.trim() : '';
    if (!userId && !EMAIL_PATTERN.test(guestEmail)) {
      return NextResponse.json(
        { error: 'Sign in or provide a valid email to submit a quote request.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    let uploadId: string | null = null;

    if (typeof body.uploadId === 'string' && body.uploadId) {
      // Only accept an uploadId this user (or, for a guest, this same
      // guest-owned row) actually created — prevents attaching someone
      // else's takeoff_uploads row by guessing a UUID.
      const ownershipQuery = admin.from('takeoff_uploads').select('id').eq('id', body.uploadId);
      const { data: upload } = await (userId ? ownershipQuery.eq('user_id', userId) : ownershipQuery.is('user_id', null)).maybeSingle();

      if (!upload) {
        return NextResponse.json({ error: 'Photo upload not found.' }, { status: 400 });
      }

      // Confirms the client's signed PUT to Storage actually landed before
      // this row is treated as final — mirrors the 'pending' -> real-status
      // transition app/api/takeoff/route.ts does for the Blueprint Takeoff
      // flow, minus the AI processing step this flow never runs.
      await admin
        .from('takeoff_uploads')
        .update({ status: 'uploaded', updated_at: new Date().toISOString() })
        .eq('id', body.uploadId);

      uploadId = body.uploadId;
    }

    const requestNumber = await nextRequestNumber(admin);
    const requestId = crypto.randomUUID();

    const { error: insertError } = await admin.from('quote_requests').insert({
      id: requestId,
      request_number: requestNumber,
      user_id: userId,
      guest_email: userId ? null : guestEmail,
      project_id: null,
      line_items: [],
      jobsite_address: null,
      is_rush: false,
      upload_id: uploadId,
      notes: trimmedOrNull(body.notes),
      client_business_name: trimmedOrNull(body.clientBusinessName),
      client_name: trimmedOrNull(body.clientName),
      po_number: trimmedOrNull(body.poNumber),
      job_name: trimmedOrNull(body.jobName),
      status: 'submitted',
      source_tool: 'field_photo_quote',
    });

    if (insertError) {
      console.error('[Field Quote Request Insert Error]', insertError);
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
    }

    const response: FieldQuoteRequestResponse = { requestId, requestNumber };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Field Quote Request Error]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}
