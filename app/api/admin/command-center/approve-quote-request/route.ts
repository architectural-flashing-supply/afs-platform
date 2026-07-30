import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

interface FlashDraftPoint {
  x: number;
  y: number;
  radius?: number | null;
}

interface QuoteRequestLineItem {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  quantity: number;
  // Present on "Custom FlashDraft Profile" items submitted from
  // app/studio/draft/page.tsx — the real drawn geometry (world inches) and
  // its per-bend-point radii, in the same order buildBendsFromPoints below
  // expects.
  points?: FlashDraftPoint[] | null;
  bendRadiiIn?: number[] | null;
}

interface CustomBend {
  leftLegMm: number;
  rightLegMm: number;
  bendAngleDegrees: number;
  radiusMm: number;
  // Only populated on the real-geometry path below — no source of real
  // per-bend up/down data exists yet, so this is a best-effort alternation,
  // not measured. See ds1-generator.js's own note that direction has no
  // real source in the schema; this starts filling that gap.
  direction?: 'up' | 'down';
}

const MM_PER_INCH = 25.4;
const DEFAULT_DIMENSIONS_IN = { width: 12, legA: 2, legB: 2 };

function describeItem(item: QuoteRequestLineItem): string {
  const parts = [item.profileType];
  if (item.material) parts.push(item.material);
  if (item.gauge) parts.push(item.gauge);
  return parts.join(' — ');
}

function distanceIn(a: FlashDraftPoint, b: FlashDraftPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Interior bend angle at `curr`, in degrees (0-180) — the same dot-product
// formula as app/studio/draft/page.tsx's bendAngleAt and afs-machine-
// bridge's ds1-generator.js bendAngleFromPoints, duplicated (not imported)
// since the first lives in a 'use client' page component and the second in
// a separate standalone repo — same reasoning ds1-generator.js's own
// version documents for not importing across that repo boundary.
function bendAngleFromPoints(prev: FlashDraftPoint, curr: FlashDraftPoint, next: FlashDraftPoint): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Real per-bend geometry from FlashDraft's drawn points, converted from
// world inches to mm. One CustomBend per interior point (points[1] ..
// points[length-2]), matching machine_profile_bends' one-row-per-bend
// convention. bendRadiiIn is indexed exactly how FlashDraft itself builds
// it in page.tsx's submitQuoteRequest (bendRadiiIn[0] is points[1]'s
// radius, etc.) — missing entries default to 0 (obviously wrong to a human
// reviewer) rather than guessing a plausible-looking radius.
function buildBendsFromPoints(
  points: FlashDraftPoint[],
  bendRadiiIn: number[] | null | undefined
): { bends: CustomBend[]; blankWidthMm: number } {
  let blankWidthMm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    blankWidthMm += distanceIn(points[i], points[i + 1]) * MM_PER_INCH;
  }

  const bends: CustomBend[] = [];
  let up = true;
  for (let i = 1; i < points.length - 1; i++) {
    const radiusIn = bendRadiiIn?.[i - 1] ?? 0;
    bends.push({
      leftLegMm: distanceIn(points[i - 1], points[i]) * MM_PER_INCH,
      rightLegMm: distanceIn(points[i], points[i + 1]) * MM_PER_INCH,
      bendAngleDegrees: bendAngleFromPoints(points[i - 1], points[i], points[i + 1]),
      radiusMm: radiusIn * MM_PER_INCH,
      direction: up ? 'up' : 'down',
    });
    up = !up;
  }

  return { bends, blankWidthMm };
}

// quote_requests.line_items carries real drawn geometry (points/
// bendRadiiIn, world inches) for FlashDraft-submitted items — used
// whenever present. Older/non-FlashDraft items only ever carry
// width/height/legA/legB, never a real bend angle, so those still fall back
// to the generic 2-bend 90°-corner box assumption below (same one already
// used by the 3D Profile Viewer's upload-page preview — app/upload/
// page.tsx's buildBendsFromItem / lib/utils/profile-svg.ts). Either way, a
// wrong guess still can't reach the physical machine unreviewed: the
// Machine Bridge's mandatory human-review gate (staged_for_review) requires
// a person to verify the generated file before it's copied to the
// machine's live folder.
function buildBendsFromItem(item: QuoteRequestLineItem): { bends: CustomBend[]; blankWidthMm: number } {
  if (item.points && item.points.length >= 2) {
    return buildBendsFromPoints(item.points, item.bendRadiiIn);
  }

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
