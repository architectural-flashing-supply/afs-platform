import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

interface QuoteRequestLineItem {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  quantity: number;
}

interface CustomBend {
  leftLegMm: number;
  rightLegMm: number;
  bendAngleDegrees: number;
  radiusMm: number;
}

const MM_PER_INCH = 25.4;
const DEFAULT_DIMENSIONS_IN = { width: 12, legA: 2, legB: 2 };

function describeItem(item: QuoteRequestLineItem): string {
  const parts = [item.profileType];
  if (item.material) parts.push(item.material);
  if (item.gauge) parts.push(item.gauge);
  return parts.join(' — ');
}

// quote_requests.line_items only ever carries width/height/legA/legB, never
// a real bend angle — same 90°-corner assumption already used for the 3D
// Profile Viewer's upload-page preview (app/upload/page.tsx's
// buildBendsFromItem / lib/utils/profile-svg.ts). A wrong guess here still
// can't reach the physical machine unreviewed: the Machine Bridge's
// mandatory human-review gate (staged_for_review) requires a person to
// verify the generated file before it's copied to the machine's live folder.
function buildBendsFromItem(item: QuoteRequestLineItem): { bends: CustomBend[]; blankWidthMm: number } {
  const legAIn = item.legA ?? DEFAULT_DIMENSIONS_IN.legA;
  const legBIn = item.legB ?? DEFAULT_DIMENSIONS_IN.legB;
  const widthIn = item.width ?? item.height ?? DEFAULT_DIMENSIONS_IN.width;

  const legAMm = legAIn * MM_PER_INCH;
  const legBMm = legBIn * MM_PER_INCH;
  const widthMm = widthIn * MM_PER_INCH;

  const bends: CustomBend[] = [
    { leftLegMm: legAMm, rightLegMm: 0, bendAngleDegrees: 90, radiusMm: 0 },
    { leftLegMm: widthMm, rightLegMm: legBMm, bendAngleDegrees: 90, radiusMm: 0 },
  ];

  return { bends, blankWidthMm: legAMm + widthMm + legBMm };
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

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const quoteRequestId = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).quoteRequestId : null;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }

    const { data: quoteRequest, error: qrError } = await supabase
      .from('quote_requests')
      .select('id, user_id, line_items, is_rush, notes, status')
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (qrError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }
    const qr = quoteRequest as {
      id: string;
      user_id: string | null;
      line_items: QuoteRequestLineItem[] | null;
      is_rush: boolean;
      notes: string | null;
      status: string;
    };
    if (qr.status !== 'submitted') {
      return NextResponse.json({ error: 'Quote request is not pending approval.' }, { status: 409 });
    }

    const items = qr.line_items ?? [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'Quote request has no line items.' }, { status: 400 });
    }

    const profileName =
      items.length === 1
        ? describeItem(items[0])
        : `${describeItem(items[0])} (+${items.length - 1} more item${items.length - 1 === 1 ? '' : 's'})`;
    const quantity = Math.max(1, Math.round(items.reduce((sum, item) => sum + (item.quantity || 0), 0)));
    const material = items[0]?.material ?? null;
    const gauge = items[0]?.gauge ?? null;

    // Only the first item's geometry is mapped into a bend program — a
    // multi-item request needs per-item bend setup in Design Studio/
    // FlashDraft before it's actually ready for the machine, flagged below
    // rather than silently collapsing multiple real parts into one shape.
    const { bends, blankWidthMm } = buildBendsFromItem(items[0]);
    const multiItemNote =
      items.length > 1
        ? `NOTE: this request has ${items.length} line items — only "${items[0].profileType}" geometry was mapped automatically. Remaining items need manual bend-program setup before fabrication.`
        : null;
    const combinedNotes = [qr.notes, multiItemNote].filter(Boolean).join('\n\n') || null;

    const now = new Date().toISOString();

    const { data: insertedJob, error: insertError } = await supabase
      .from('machine_jobs')
      .insert({
        quote_request_id: quoteRequestId,
        profile_name: profileName,
        material,
        gauge,
        quantity,
        blank_width_mm: blankWidthMm,
        custom_bends: bends,
        is_rush: qr.is_rush,
        notes: combinedNotes,
        status: 'approved_for_machine',
        requested_by: qr.user_id,
        approved_by: user.id,
        approved_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    if (insertError || !insertedJob) {
      console.error('[Command Center Approve Quote Request Error]', insertError);
      return NextResponse.json({ error: 'Could not create machine job.' }, { status: 500 });
    }
    const machineJobId = (insertedJob as { id: string }).id;

    const { error: updateError } = await supabase
      .from('quote_requests')
      .update({ status: 'reviewing', reviewed_at: now })
      .eq('id', quoteRequestId);
    if (updateError) {
      return NextResponse.json(
        { error: 'Machine job created, but could not update the quote request status.' },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminId: user.id,
      action: 'approve_quote_request_to_machine',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      afterValue: { status: 'reviewing', machineJobId },
    });

    return NextResponse.json({ ok: true, machineJobId });
  } catch (error) {
    console.error('[Command Center Approve Quote Request Error]', error);
    return NextResponse.json({ error: 'Could not approve request. Please try again.' }, { status: 500 });
  }
}
