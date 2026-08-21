import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate } from '@/lib/resend/templates/base';
import { isSourceTool } from '@/lib/data/quote-request-source-tool';

interface QuoteRequestItemInput {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  finish?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
  unit?: string;
  confidence?: string;
  aiNote?: string | null;
  // Raw FlashDraft-drawn geometry ({x, y, radius?} per point), stored as-is
  // in line_items so "My Saved Profiles" (app/studio/draft/page.tsx) can
  // reload the exact drawn shape later instead of reconstructing it.
  points?: { x: number; y: number; radius?: number }[];
}

interface QuoteRequestResponse {
  requestId: string;
  requestNumber: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidItem(item: unknown): item is QuoteRequestItemInput {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.profileType === 'string' &&
    i.profileType.trim().length > 0 &&
    typeof i.lengthFt === 'number' &&
    i.lengthFt > 0 &&
    typeof i.quantity === 'number' &&
    i.quantity > 0
  );
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
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const rawItems = body.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: 'At least one item is required.' }, { status: 400 });
    }

    const items = rawItems.filter(isValidItem);
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Each item requires a profile type, length, and quantity.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const guestEmail = typeof body.guestEmail === 'string' ? body.guestEmail.trim() : '';
    if (!user && !EMAIL_PATTERN.test(guestEmail)) {
      return NextResponse.json(
        { error: 'Sign in or provide a valid email to submit a quote request.' },
        { status: 400 }
      );
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId : null;
    const jobsiteAddress = body.jobsiteAddress ?? null;
    const isRush = body.isRush === true;
    const notes = typeof body.notes === 'string' ? body.notes : null;
    // Every real front-end submission path (FlashDraft, the Configurator,
    // the Quote Builder, the Blueprint Takeoff AI upload flow) sends its own
    // token here — see lib/data/quote-request-source-tool.ts for the full
    // list. Anything missing or unrecognized falls back to 'unknown' rather
    // than trusting an arbitrary client-supplied string into the column.
    const sourceTool = isSourceTool(body.sourceTool) ? body.sourceTool : 'unknown';

    const admin = createAdminClient();
    const requestNumber = await nextRequestNumber(admin);
    const requestId = crypto.randomUUID();

    const { error: insertError } = await admin.from('quote_requests').insert({
      id: requestId,
      request_number: requestNumber,
      user_id: user?.id ?? null,
      guest_email: user ? null : guestEmail,
      project_id: projectId,
      line_items: items,
      jobsite_address: jobsiteAddress,
      is_rush: isRush,
      notes,
      status: 'submitted',
      source_tool: sourceTool,
    });

    if (insertError) {
      console.error('[Quote Request Insert Error]', insertError);
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
    }

    // --- Customer confirmation email (never blocks the response; ARCHITECTURE.md §9) ---
    let recipientEmail = guestEmail;
    let recipientName: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle();
      recipientEmail = (profile?.email as string | undefined) ?? '';
      recipientName = (profile?.full_name as string | undefined) ?? null;
    }

    if (recipientEmail) {
      const itemCount = items.length;
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: `We've Received Your Quote Request #${requestNumber}`,
        html: baseEmailTemplate(`
          <h1 style="font-size:20px;margin:0 0 16px;">Quote Request Received</h1>
          <p style="margin:0 0 12px;">Hi ${recipientName ?? 'there'},</p>
          <p style="margin:0 0 12px;">We've received your quote request <strong>#${requestNumber}</strong>
          with ${itemCount} item${itemCount === 1 ? '' : 's'}. An AFS estimator is reviewing it now and
          will follow up with a formal quote.</p>
        `),
      });
      await admin.from('notifications').insert({
        user_id: user?.id ?? null,
        channel: 'email',
        type: 'quote_request_received',
        recipient: recipientEmail,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.success ? null : emailResult.error,
      });
    }

    const response: QuoteRequestResponse = { requestId, requestNumber };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Quote Request Error]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}
