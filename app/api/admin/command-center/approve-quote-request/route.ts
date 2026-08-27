import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { MATERIAL_SHORTHAND } from '@/lib/data/catalog';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate } from '@/lib/resend/templates/base';
import { usesFallbackGeometry } from '@/lib/machine-jobs/fallback-geometry';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import {
  pushProfileToPathfinder,
  AFS_MACHINE_CATALOG_ID,
  type MachineProfile,
  type PathfinderProfile,
} from '@/lib/integrations/pathfinder-edge';
import { flashDraftToMachineProfile, type FlashDraftHemInput } from '@/lib/integrations/flashdraft-to-pathfinder';
import { generateProfileSVG, slugToProfileType } from '@/lib/utils/profile-svg';
import { insertShopProfileLibraryRecord } from '@/lib/data/shop-profile-library';

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
  lengthFt?: number | null;
  quantity: number;
  // Present on "Custom FlashDraft Profile" items submitted from
  // app/studio/draft/page.tsx — the real drawn geometry (world inches) and
  // its per-bend-point radii, in the same order buildBendsFromPoints below
  // expects.
  points?: FlashDraftPoint[] | null;
  bendRadiiIn?: number[] | null;
  // Also present on FlashDraft-submitted items (page.tsx's
  // submitQuoteRequest) — was captured in quote_requests.line_items all
  // along but never read by this route until now, which is exactly why
  // hems never reached PathfinderEdge as real features.
  hemStart?: FlashDraftHemInput | null;
  hemEnd?: FlashDraftHemInput | null;
  // Data-URI PNG snapshot of FlashDraft's own canvas at submit time (see
  // page.tsx's submitQuoteRequest) — reused as-is for
  // shop_profile_library.geometry_svg (afs-sv-009) below. Only present on
  // FlashDraft-submitted items; older rows submitted before afs-sv-009
  // simply have no snapshot to reuse.
  geometryImage?: string | null;
  // The user-set FlashDraft canvas profile name (app/studio/draft/page.tsx's
  // `profileName` state), only present when the user actually renamed it
  // away from the "Untitled Profile" default (afs-jf-003) — see
  // page.tsx's submitQuoteRequest, which omits this field entirely
  // otherwise. When absent/blank, this route falls back to describeItem()
  // exactly as it did before this field existed.
  profileName?: string | null;
  // Auto-generated bend/leg/radius/hem technical readout (afs-fl-012) —
  // present on "Custom FlashDraft Profile" items only (see page.tsx's
  // buildBendSummary and lib/data/pending-quote-requests.ts's
  // describeLineItem, which already surface this on the admin Pending
  // Approval card). Never present on field_photo_quote items, which have
  // no FlashDraft geometry at all. Used by composeShopFloorNotes below
  // (afs-fl-015) to restore this onto machine_jobs.notes and
  // shop_profile_library.account_notes independently of qr.notes, which
  // afs-fl-012 narrowed to customer-typed text only.
  geometrySummary?: string | null;
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

// SHARED PathfinderEdge-title fallback (afs-jf-006) for every submission
// surface that funnels through this route (FlashDraft, Configurator, Quote
// Builder, Blueprint Takeoff AI upload all push line items through
// itemBuilds below) — not FlashDraft-specific. Mirrors
// app/studio/draft/page.tsx's buildFallbackProfileName composition
// (short-material + gauge, then first-present-of Job Name / Business Name
// / Client Name, then PO Number as "PO <number>", blanks dropped, no
// dangling separators) but duplicated rather than imported, per this
// codebase's established client-page/server-route duplication precedent
// (see flashdraft-to-pathfinder.ts's own header comment). No timestamp
// fallback here (unlike the client-side generator): item.profileType is a
// required, always-non-blank field, so when item.material has no
// MATERIAL_SHORTHAND entry and no identity field is present, the
// composition still can't come back empty — item.profileType alone stands
// in for the material+gauge segment in that case, judged an acceptable
// last resort rather than inventing a server-side timestamp source.
function describeItem(item: QuoteRequestLineItem, identity: JobIdentityFields): string {
  const shortMaterial = item.material ? (MATERIAL_SHORTHAND[item.material] ?? item.material) : null;
  const materialGauge = shortMaterial
    ? [shortMaterial, item.gauge || null].filter(Boolean).join(' ')
    : item.profileType;
  const identitySegment = identity.jobName || identity.clientBusinessName || identity.clientName || null;
  const poSegment = identity.poNumber ? `PO ${identity.poNumber}` : null;
  return [materialGauge, identitySegment, poSegment]
    .filter((s): s is string => !!s && s.trim() !== '')
    .join(' - ');
}

// The user-set FlashDraft name if present and non-blank, otherwise the same
// generated describeItem() fallback used before this field existed
// (afs-jf-003) — the two send paths do not share an identical concept of
// "user-set name," so this route's own real data (item.profileName, only
// ever populated for FlashDraft-submitted line items) drives this, not any
// assumption borrowed from send-to-pathfinder's client-side state.
function resolveItemProfileName(item: QuoteRequestLineItem, identity: JobIdentityFields): string {
  return item.profileName?.trim() || describeItem(item, identity);
}

// Restores the auto-generated bend/leg/radius/hem geometry readout onto the
// shop-floor-visible notes fields (machine_jobs.notes, read by the external
// afs-machine-bridge project; shop_profile_library.account_notes, rendered
// by ShopViewBoard.tsx under "Account Notes") without putting it back into
// qr.notes itself — afs-fl-012 deliberately narrowed qr.notes to
// customer-typed text only, and that must stay true (it's also what's
// echoed back to the customer). Same \n\n-joined-lines convention already
// used by app/api/contact/route.ts's descriptionLines and
// app/api/consultation/request/route.ts's noteLines for combining a
// human-typed field with auto-generated text into one free-text column.
// Called once per line item, using that item's own geometrySummary — since
// this route already creates one machine_jobs/shop_profile_library row per
// line item (see the per-item loop below), each row naturally gets only the
// geometry for the item it actually describes rather than every item's
// geometry mixed into every row. field_photo_quote items never carry
// geometrySummary (they're not FlashDraft profiles), so this is a no-op for
// them: customerNotes passes through unchanged, exactly as before this fix.
function composeShopFloorNotes(customerNotes: string | null, geometrySummary: string | null | undefined): string | null {
  const lines = [customerNotes?.trim() || null, geometrySummary?.trim() || null].filter(
    (s): s is string => !!s
  );
  return lines.length ? lines.join('\n\n') : null;
}

function distanceIn(a: FlashDraftPoint, b: FlashDraftPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function wrapDeg(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

// SIGNED INTERIOR angle at `curr`, in degrees, range (-180, 180] — same
// fix, same formula, same evidence as lib/integrations/flashdraft-to-
// pathfinder.ts's bendAngleAt (see that file's comment for the full
// derivation, the supplement-swap evidence from profileId 32912069, why
// the prior turn-angle revision's confirmation via profileId 32911527
// didn't actually discriminate the two models, and why the staircase
// test (32911526) stays UNEVALUATED, not re-explained by this revision).
// `interiorSigned` is the raw signed interior angle (cross-product-
// equivalent atan2-difference sign logic, unchanged); `turn` is the now-
// superseded second revision's output, kept as an explicit intermediate
// step for traceability; final formula is `sign(turn) * (180 -
// abs(turn))`, with `turn === 0` (dead-straight, no bend) special-cased
// to return 180 directly since `Math.sign(0) === 0` would otherwise
// wrongly collapse it to 0 (the opposite degenerate case, a hairpin
// fold — which is the correct, intentional output at `abs(turn) = 180`).
// Duplicated (not imported) since this lives in a server route module —
// same reasoning as the rest of this codebase's client-page/server-route
// duplication precedent.
function bendAngleFromPoints(prev: FlashDraftPoint, curr: FlashDraftPoint, next: FlashDraftPoint): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  if ((v1.x === 0 && v1.y === 0) || (v2.x === 0 && v2.y === 0)) return 0;
  const interiorSigned = wrapDeg(((Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)) * 180) / Math.PI);
  const turn = wrapDeg(interiorSigned + 180);
  if (turn === 0) return 180;
  return Math.sign(turn) * (180 - Math.abs(turn));
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
// machine's live folder. `usedFallbackGeometry` mirrors
// usesFallbackGeometry() exactly (same points-first, then
// legA/legB/width-or-height check) so the flag written to the created
// machine_jobs row always agrees with what was actually built here.
function buildBendsFromItem(
  item: QuoteRequestLineItem
): { bends: CustomBend[]; blankWidthMm: number; usedFallbackGeometry: boolean } {
  if (item.points && item.points.length >= 2) {
    const { bends, blankWidthMm } = buildBendsFromPoints(item.points, item.bendRadiiIn);
    return { bends, blankWidthMm, usedFallbackGeometry: false };
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

  return { bends, blankWidthMm: legAMm + widthMm + legBMm, usedFallbackGeometry: usesFallbackGeometry(item) };
}

// Job-identity intake fields + finish (migration 018, afs-jf-003) — carried
// on the parent quote_requests row (one set per request, not per line
// item), so every line item's MachineProfile gets the same values.
// jobName (migration 019, afs-jf-004) added by afs-jf-006 — used only by
// describeItem's fallback-title priority chain below, not pushed into
// MachineProfile/composeDescription (out of scope of this task, see
// pathfinder-edge.ts's own composeDescription comment).
interface JobIdentityFields {
  clientBusinessName: string | null;
  clientName: string | null;
  poNumber: string | null;
  requestedBy: string | null;
  finish: string | null;
  jobName: string | null;
}

// Builds the MachineProfile pushProfileToPathfinder expects for one line
// item. Real FlashDraft-drawn items (real points) go through the exact
// same adapter FlashDraft's own "Send to PathfinderEdge" button uses —
// including hemStart/hemEnd, so a hem drawn in FlashDraft and submitted
// through a quote request now reaches PathfinderEdge as a real feature,
// not just a blank-width number. Fallback-geometry items (legA/legB/width,
// no real points) have no hem concept — hems can only be created via
// FlashDraft's own canvas hem popup, which requires real drawn points to
// exist first — so they're built directly from the same bends/blankWidthMm
// already computed for the machine_jobs row, just reshaped into
// MachineProfileBend's stepNumber-indexed rows. Either way, this does not
// re-derive bend math — buildBendsFromItem (real points path indirectly,
// via the adapter's own identical formulas) or the already-computed
// bends/blankWidthMm (fallback path) are the single source of truth.
function buildMachineProfileForItem(
  item: QuoteRequestLineItem,
  profileName: string,
  bends: CustomBend[],
  blankWidthMm: number,
  identity: JobIdentityFields
): MachineProfile {
  if (item.points && item.points.length >= 2) {
    const thicknessIn = gaugeToThicknessMm(item.gauge) / MM_PER_INCH;
    return flashDraftToMachineProfile({
      profileName,
      points: item.points,
      material: item.material ?? null,
      thicknessIn,
      hemStart: item.hemStart ?? null,
      hemEnd: item.hemEnd ?? null,
      clientBusinessName: identity.clientBusinessName,
      clientName: identity.clientName,
      poNumber: identity.poNumber,
      requestedBy: identity.requestedBy,
      finish: identity.finish,
    });
  }

  return {
    id: 'quote-request-item',
    nameEn: profileName,
    profileNumber: `QR-${Date.now().toString(36).toUpperCase()}`,
    blankWidthMm,
    bends: bends.map((b, i) => ({
      stepNumber: i + 1,
      leftLegMm: b.leftLegMm,
      rightLegMm: b.rightLegMm,
      bendAngleDegrees: b.bendAngleDegrees,
      radiusMm: b.radiusMm,
    })),
    hemStart: null,
    hemEnd: null,
    clientBusinessName: identity.clientBusinessName,
    clientName: identity.clientName,
    poNumber: identity.poNumber,
    requestedBy: identity.requestedBy,
    finish: identity.finish,
  };
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// shop_profile_library.geometry_svg (afs-sv-009) must be the exact profile
// visual the submitting tool already shows — never a newly invented
// rendering. Two real sources exist:
//   - FlashDraft-drawn items (item.points present): item.geometryImage is a
//     canvas.toDataURL() snapshot of FlashDraft's own <canvas>, captured
//     client-side at submit time (page.tsx's submitQuoteRequest) since this
//     server route has no canvas to read from. Used as-is.
//   - Everything else (Configurator-submitted items: profileType +
//     width/height/legA/legB, no points): rendered server-side via
//     lib/utils/profile-svg.ts's generateProfileSVG — the exact same
//     function app/configure/page.tsx and app/upload/page.tsx already call
//     to draw this profile. Wrapped in a data URI so the admin table can
//     always just <img src={geometry_svg} /> regardless of which branch
//     produced it.
// A profileType this codebase has no known renderer for (e.g. a Quote
// Builder or Blueprint Takeoff AI item using a free-form label
// slugToProfileType doesn't recognize) yields null rather than a guessed
// diagram.
function buildGeometrySvg(item: QuoteRequestLineItem): string | null {
  if (item.points && item.points.length >= 2) {
    return item.geometryImage ?? null;
  }

  const profileType = slugToProfileType(item.profileType);
  if (!profileType) return null;

  const svg = generateProfileSVG({
    profileType,
    width: item.width ?? null,
    height: item.height ?? null,
    legA: item.legA ?? null,
    legB: item.legB ?? null,
  });
  return svgToDataUri(svg);
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
      .select(
        'id, user_id, guest_email, line_items, is_rush, notes, status, requested_delivery, source_tool, color, client_business_name, client_name, po_number, requested_by, finish, job_name'
      )
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (qrError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }
    const qr = quoteRequest as {
      id: string;
      user_id: string | null;
      guest_email: string | null;
      line_items: QuoteRequestLineItem[] | null;
      is_rush: boolean;
      notes: string | null;
      status: string;
      requested_delivery: string | null;
      source_tool: string | null;
      // McElroy/PAC-CLAD color name selected at intake (afs-cv-002) —
      // carried onto every shop_profile_library row this route writes
      // below (afs-cv-003).
      color: string | null;
      // Job-identity intake fields (migration 018, afs-jf-000) + the
      // required Anodized/Painted finish choice (afs-jf-002) — carried onto
      // every machine_jobs push (PathfinderEdge description) and every
      // shop_profile_library row this route writes below (afs-jf-003).
      client_business_name: string | null;
      client_name: string | null;
      po_number: string | null;
      requested_by: string | null;
      finish: string | null;
      // job_name (migration 019, afs-jf-004) — added to this select by
      // afs-jf-006, used only by describeItem's fallback-title priority
      // chain (see JobIdentityFields.jobName above).
      job_name: string | null;
    };
    if (qr.status !== 'submitted') {
      return NextResponse.json({ error: 'Quote request is not pending approval.' }, { status: 409 });
    }

    const items = qr.line_items ?? [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'Quote request has no line items.' }, { status: 400 });
    }

    const identity: JobIdentityFields = {
      clientBusinessName: qr.client_business_name,
      clientName: qr.client_name,
      poNumber: qr.po_number,
      requestedBy: qr.requested_by,
      finish: qr.finish,
      jobName: qr.job_name,
    };

    // Resolved once, reused both for the shop_profile_library rows written
    // per line item below and for the customer notification sent at the
    // end of this route — same profile fetch, just hoisted so it's not
    // duplicated at both call sites.
    let recipientEmail: string | null = null;
    let recipientName: string | null = null;
    let recipientCompany: string | null = null;
    let recipientPhone: string | null = null;
    if (qr.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, company')
        .eq('id', qr.user_id)
        .maybeSingle();
      recipientEmail = (profile?.email as string | undefined) ?? null;
      recipientName = (profile?.full_name as string | undefined) ?? null;
      recipientCompany = (profile?.company as string | undefined) ?? null;
      recipientPhone = (profile?.phone as string | undefined) ?? null;
    } else {
      recipientEmail = qr.guest_email;
    }

    // One machine_jobs row PER LINE ITEM, each pushed to PathfinderEdge for
    // real as part of approval — replaces the prior hard block on
    // multi-item requests (this route used to flatly reject with a 422;
    // see git history). Build every item's profile data and push every one
    // to PathfinderEdge BEFORE writing anything to the database: if any
    // item's push fails, return immediately with nothing inserted and
    // quote_requests.status untouched, so the admin can retry the same
    // click rather than being left with a job that looks approved but
    // never actually reached PathfinderEdge.
    const itemBuilds = items.map((item, i) => {
      const baseName = resolveItemProfileName(item, identity);
      const profileName = items.length > 1 ? `${baseName} (item ${i + 1} of ${items.length})` : baseName;
      const { bends, blankWidthMm, usedFallbackGeometry } = buildBendsFromItem(item);
      const machineProfile = buildMachineProfileForItem(item, profileName, bends, blankWidthMm, identity);
      return {
        item,
        profileName,
        quantity: Math.max(1, Math.round(item.quantity || 0)),
        bends,
        blankWidthMm,
        usedFallbackGeometry,
        machineProfile,
      };
    });

    const pathfinderResults: PathfinderProfile[] = [];
    for (const build of itemBuilds) {
      const result = await pushProfileToPathfinder(build.machineProfile, AFS_MACHINE_CATALOG_ID);
      if (result.status !== 'connected') {
        await logAdminAction({
          adminId: user.id,
          action: 'approve_quote_request_pathfinder_failed',
          resourceType: 'quote_request',
          resourceId: quoteRequestId,
          afterValue: {
            profileName: build.profileName,
            pathfinderStatus: result.status,
            pathfinderMessage: result.message,
          },
        });
        return NextResponse.json(
          { error: `Could not push "${build.profileName}" to PathfinderEdge: ${result.message}` },
          { status: 502 }
        );
      }
      pathfinderResults.push(result);
    }

    const now = new Date().toISOString();
    const machineJobIds: string[] = [];
    for (let i = 0; i < itemBuilds.length; i++) {
      const build = itemBuilds[i];
      const { data: insertedJob, error: insertError } = await supabase
        .from('machine_jobs')
        .insert({
          quote_request_id: quoteRequestId,
          profile_name: build.profileName,
          material: build.item.material ?? null,
          gauge: build.item.gauge ?? null,
          quantity: build.quantity,
          blank_width_mm: build.blankWidthMm,
          custom_bends: build.bends,
          used_fallback_geometry: build.usedFallbackGeometry,
          is_rush: qr.is_rush,
          notes: composeShopFloorNotes(qr.notes, build.item.geometrySummary),
          status: 'approved_for_machine',
          // The real, intended behavior change this prompt exists for —
          // confirmed explicitly with Reid (2026-08-18): every job
          // created here now reaches PathfinderEdge for real as part of
          // approval (pushed above, before this insert), not the Machine
          // Bridge's .ds1/human-review path. See migration
          // 015_machine_jobs_delivery_method.sql for the column and its
          // prior 'machine_bridge' default, which this intentionally
          // changes.
          delivery_method: 'pathfinder_edge',
          requested_by: qr.user_id,
          approved_by: user.id,
          approved_at: now,
          updated_at: now,
        })
        .select('id')
        .single();
      if (insertError || !insertedJob) {
        console.error('[Command Center Approve Quote Request Error]', insertError);
        return NextResponse.json(
          {
            error:
              machineJobIds.length > 0
                ? `${machineJobIds.length} of ${itemBuilds.length} machine_jobs rows were created (and all ${itemBuilds.length} profiles already pushed to PathfinderEdge) before this insert failed. Check machine_jobs and PathfinderEdge catalog ${AFS_MACHINE_CATALOG_ID} manually before retrying — do not re-approve blindly.`
                : 'Could not create machine job.',
          },
          { status: 500 }
        );
      }
      const machineJobId = (insertedJob as { id: string }).id;
      machineJobIds.push(machineJobId);

      await logAdminAction({
        adminId: user.id,
        action: 'approve_quote_request_to_machine',
        resourceType: 'machine_job',
        resourceId: machineJobId,
        afterValue: {
          status: 'approved_for_machine',
          deliveryMethod: 'pathfinder_edge',
          pathfinderCatalogId: AFS_MACHINE_CATALOG_ID,
          pathfinderProfileId: pathfinderResults[i].profileId,
          pathfinderMessage: pathfinderResults[i].message,
        },
      });

      // Shop-floor record of this send (afs-sv-009) — one row per line
      // item, same as the machine_jobs row it's paired with.
      await insertShopProfileLibraryRecord(supabase, {
        quoteRequestId,
        machineJobId,
        profileName: build.profileName,
        customerName: recipientName ?? qr.guest_email ?? null,
        company: recipientCompany,
        customerEmail: recipientEmail,
        customerPhone: recipientPhone,
        accountNotes: composeShopFloorNotes(qr.notes, build.item.geometrySummary),
        material: build.item.material ?? null,
        gauge: build.item.gauge ?? null,
        color: qr.color,
        clientBusinessName: identity.clientBusinessName,
        clientName: identity.clientName,
        poNumber: identity.poNumber,
        requestedBy: identity.requestedBy,
        finish: identity.finish,
        quantity: build.quantity,
        lengthFt: build.item.lengthFt ?? null,
        dueDate: qr.requested_delivery,
        geometryPoints: build.item.points ?? null,
        geometrySvg: buildGeometrySvg(build.item),
        sourceTool: qr.source_tool,
        pathfinderProfileId: pathfinderResults[i].profileId,
      });
    }

    const { error: updateError } = await supabase
      .from('quote_requests')
      .update({ status: 'reviewing', reviewed_at: now })
      .eq('id', quoteRequestId);
    if (updateError) {
      return NextResponse.json(
        {
          error:
            'Machine job(s) created and pushed to PathfinderEdge, but could not update the quote request status.',
        },
        { status: 500 }
      );
    }

    // --- Customer notification: job approved / moved to production (never blocks; ARCHITECTURE.md §9) ---
    if (recipientEmail) {
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: 'Your AFS Quote Request Has Been Approved',
        html: baseEmailTemplate(`
          <h1 style="font-size:20px;margin:0 0 16px;">Your Job Has Been Approved</h1>
          <p style="margin:0 0 12px;">Hi ${recipientName ?? 'there'},</p>
          <p style="margin:0 0 12px;">Your quote request has been approved and moved into production
          scheduling. We'll be in touch with a formal quote soon.</p>
        `),
      });
      await supabase.from('notifications').insert({
        user_id: qr.user_id,
        channel: 'email',
        type: 'job_approved',
        recipient: recipientEmail,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.success ? null : emailResult.error,
      });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'approve_quote_request_to_machine_summary',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      afterValue: { status: 'reviewing', machineJobIds },
    });

    return NextResponse.json({ ok: true, machineJobIds });
  } catch (error) {
    console.error('[Command Center Approve Quote Request Error]', error);
    return NextResponse.json({ error: 'Could not approve request. Please try again.' }, { status: 500 });
  }
}
