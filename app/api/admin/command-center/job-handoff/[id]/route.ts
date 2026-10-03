import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import {
  flashDraftButtonLabel,
  handoffCorrectionFromItem,
  handoffGeometryFromItem,
  isHandoffHem,
  isHandoffPointArray,
  isTraceableImageType,
  type JobHandoffKind,
  type JobHandoffPayload,
  type JobHandoffReference,
} from '@/lib/flashdraft/job-handoff';

/**
 * BOTH HALVES OF THE JOB -> FLASHDRAFT HANDOFF, on one resource.
 *
 *   GET  — what FlashDraft loads: the line item's geometry if it has any, the
 *          image the customer sent if it does not, and the order's real
 *          metadata either way.
 *   POST — what FlashDraft writes back once an estimator has corrected it.
 *
 * ADMIN ONLY, CHECKED SERVER-SIDE, ON BOTH VERBS. The `?admin=1` flag in the
 * FlashDraft URL is a UI hint and grants nothing; this is the check. The
 * service-role client is then used deliberately — the whole point is reading
 * and writing ANOTHER customer's quote request, which RLS correctly refuses to
 * the admin's own session (same pattern as lib/data/pending-quote-requests.ts).
 *
 * THIS IS NOT A DOOR TO THE MACHINE. Nothing here imports
 * lib/integrations/pathfinder-edge.ts, nothing here touches `status`,
 * `job_stage`, `approved_at` or `approval_channel`, and correcting a drawing is
 * not an approval of anything. CLAUDE.md rule #14's one door stays the
 * Command Center approval routes, and the static single-door test enforces that
 * rather than this comment.
 *
 * RUSH IS UNTOUCHED (rule #15) and no price is computed or returned (the RFQ
 * rule at the top of CLAUDE.md) — an estimator correcting geometry is not
 * quoting it.
 */

/**
 * FORCE-DYNAMIC, AND IT IS A SECURITY PROPERTY HERE, NOT A PERFORMANCE ONE.
 *
 * Without it this GET was served from Next's route cache, and this spec's own
 * signed-out probe got **200 with another customer's job on it** — measured,
 * not theorised (tests/e2e/flashdraft-job-handoff.spec.ts, "refuses a caller
 * with no admin session"). The admin check ran once for the first, authorised
 * caller and every later request was answered from the cached body without
 * reaching it.
 *
 * This is the same hazard CLAUDE.md rule #22 records for the service-role
 * client one layer down — Next patches `fetch` and caches GETs — one layer up,
 * at the route. Every other admin read in this codebase that returns
 * per-session data already declares it (`profile-thumbnail/[id]`,
 * `shop-queue/drawing/[id]`, `typeahead`). Do not remove it, and do not add a
 * `revalidate` to soften it: a response carrying one customer's drawing must be
 * computed for the caller who asked, every time.
 */
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 900;

interface QuoteRequestRow {
  id: string;
  request_number: string;
  line_items: unknown;
  color: string | null;
  finish: string | null;
  po_number: string | null;
  job_name: string | null;
  client_name: string | null;
  client_business_name: string | null;
  requested_delivery: string | null;
  notes: string | null;
  source_tool: string | null;
  upload_id: string | null;
}

const ROW_COLUMNS =
  'id, request_number, line_items, color, finish, po_number, job_name, client_name, ' +
  'client_business_name, requested_delivery, notes, source_tool, upload_id';

/** Resolves the caller, or the response that refuses them. */
async function requireAdmin(): Promise<
  { ok: true; userId: string; name: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();
  const p = profile as { role?: string; full_name?: string | null } | null;
  if (p?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id, name: (p.full_name ?? '').trim() || user.email || 'An admin' };
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function lineItemsOf(row: QuoteRequestRow): Record<string, unknown>[] {
  return Array.isArray(row.line_items) ? (row.line_items as Record<string, unknown>[]) : [];
}

/**
 * The image the customer sent, as something to trace.
 *
 * The URL is minted HERE rather than carried from the Job screen because a
 * signed Storage URL expires; a link clicked twenty minutes after the page
 * rendered would otherwise open FlashDraft with a dead reference and no way to
 * tell that from "there was no photo".
 */
async function referenceFor(
  row: QuoteRequestRow,
  admin: ReturnType<typeof createAdminClient>
): Promise<JobHandoffReference | null> {
  if (!row.upload_id) return null;
  const { data: upload } = await admin
    .from('takeoff_uploads')
    .select('storage_key, file_name, file_type')
    .eq('id', row.upload_id)
    .maybeSingle();
  const u = upload as { storage_key: string; file_name: string; file_type: string } | null;
  if (!u?.storage_key) return null;

  // A PDF cannot be drawn into an <img>, and neither can a HEIC in Chrome, so
  // neither is offered as something to trace — see isTraceableImageType, which
  // is also the predicate the Job screen uses to pick the button's wording, so
  // the label cannot promise a photo the canvas will not show.
  if (!isTraceableImageType(u.file_type)) return null;

  const bucket = u.storage_key.split('/')[0];
  const { data: signed } = await admin.storage
    .from(bucket)
    .createSignedUrl(u.storage_key, SIGNED_URL_TTL_SECONDS);
  if (!signed?.signedUrl) return null;

  return {
    url: signed.signedUrl,
    fileName: u.file_name,
    fileType: u.file_type,
    caption:
      row.source_tool === 'field_photo_quote'
        ? 'Photo the crew sent from the field app. Trace it, then check every length against it.'
        : 'The drawing the customer attached. Trace it, then check every length against it.',
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
      return NextResponse.json({ error: 'Not a quote request id.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data } = await admin.from('quote_requests').select(ROW_COLUMNS).eq('id', params.id).maybeSingle();
    const row = data as QuoteRequestRow | null;
    if (!row) return NextResponse.json({ error: 'That job no longer exists.' }, { status: 404 });

    const items = lineItemsOf(row);
    const requested = Number(request.nextUrl.searchParams.get('item') ?? '0');
    // Clamped, not rejected: a stale link to item 3 of a request that now has
    // one item should open the one it has, not an error page.
    const itemIndex = Number.isInteger(requested) && requested > 0 ? Math.min(requested, Math.max(items.length - 1, 0)) : 0;
    const item = items[itemIndex] ?? null;

    const geometry = handoffGeometryFromItem(item);
    const reference = geometry ? null : await referenceFor(row, admin);
    const kind: JobHandoffKind = geometry ? 'geometry' : reference ? 'reference' : 'metadata';

    const profileType = item ? asString(item.profileType) : null;
    const payload: JobHandoffPayload = {
      quoteRequestId: row.id,
      requestNumber: row.request_number,
      itemIndex,
      itemCount: items.length,
      kind,
      // The customer's own name for the drawing when they gave one; otherwise
      // the profile type and the request number, which is at least true. Never
      // "Untitled" — an estimator looking at a list of saves needs to know
      // which order this came off, and `request_number` is NOT NULL so this
      // always names something real.
      profileName:
        (item ? asString(item.profileName) : null) ??
        [profileType, row.request_number].filter(Boolean).join(' · '),
      profileType,
      material: item ? asString(item.material) : null,
      gauge: item ? asString(item.gauge) : null,
      color: asString(row.color),
      finish: asString(row.finish),
      lengthFt: item ? asNumber(item.lengthFt) : null,
      quantity: item ? asNumber(item.quantity) : null,
      customerNote: asString(row.notes),
      jobInfo: {
        clientBusinessName: asString(row.client_business_name),
        clientName: asString(row.client_name),
        poNumber: asString(row.po_number),
        jobName: asString(row.job_name),
        requestedDeliveryDate: asString(row.requested_delivery),
      },
      geometry,
      reference,
      correction: handoffCorrectionFromItem(item),
      sourceTool: row.source_tool,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[Job Handoff GET Error]', error);
    return NextResponse.json(
      { error: 'Could not open this job in FlashDraft. Nothing was changed.' },
      { status: 500 }
    );
  }
}

/**
 * THE WRITE-BACK. The corrected geometry goes onto the line item it came from,
 * stamped with who corrected it and when.
 *
 * IT IS A MERGE, NOT A REPLACEMENT. The existing line item keeps every field it
 * already had — `unit`, `lengthFt`, `quantity`, whatever the customer's own
 * tool wrote — and only the geometry, the spec fields the estimator actually
 * changed, and the correction stamp are written over the top. A line item is
 * customer-submitted data; correcting the drawing on it is not licence to drop
 * the rest of what they sent.
 *
 * NO MIGRATION. `line_items` is JSONB with no constraint behind it, so the
 * correction stamp lives on the item alongside the geometry it describes. A
 * separate column would have to be per-request, and the correction is per-line.
 *
 * The read-modify-write is NOT atomic, and that is acceptable here in a way it
 * would not be for an approval: two estimators correcting the same line of the
 * same job at the same second is not a race this product has, and the loser's
 * work is still saved as its own profile in the Passport rather than lost. An
 * approval, by contrast, reaches a physical machine — which is why rule #14's
 * guard is a database check and this is not pretending to be one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
      return NextResponse.json({ error: 'Not a quote request id.' }, { status: 400 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    if (!isHandoffPointArray(body.points)) {
      return NextResponse.json(
        { error: 'The corrected profile has no drawn points, so there is nothing to write back.' },
        { status: 400 }
      );
    }
    const requestedIndex = asNumber(body.itemIndex) ?? 0;

    const admin = createAdminClient();
    const { data } = await admin.from('quote_requests').select(ROW_COLUMNS).eq('id', params.id).maybeSingle();
    const row = data as QuoteRequestRow | null;
    if (!row) return NextResponse.json({ error: 'That job no longer exists.' }, { status: 404 });

    const items = lineItemsOf(row);
    const itemIndex = Math.max(0, Math.min(Math.trunc(requestedIndex), Math.max(items.length - 1, 0)));
    // A field-app job arrives with line_items = [] by design (see
    // app/api/field/quote-request/route.ts). Correcting it CREATES the first
    // line rather than refusing — that is exactly the gap this feature exists
    // to close.
    const before = items[itemIndex] ?? {};

    const correctedAt = new Date().toISOString();
    const corrected: Record<string, unknown> = {
      ...before,
      points: body.points,
      hemStart: isHandoffHem(body.hemStart) ? body.hemStart : null,
      hemEnd: isHandoffHem(body.hemEnd) ? body.hemEnd : null,
      bendRadiiIn:
        Array.isArray(body.bendRadiiIn) && body.bendRadiiIn.every((n) => typeof n === 'number' && Number.isFinite(n))
          ? body.bendRadiiIn
          : null,
      profileType: asString(before.profileType) ?? 'Custom FlashDraft Profile',
      profileName: asString(body.profileName) ?? asString(before.profileName),
      material: asString(body.material) ?? asString(before.material),
      gauge: asString(body.gauge) ?? asString(before.gauge),
      // THE HUMAN-CORRECTED MARKER. Who, when, and which saved profile the
      // correction was saved as, so the drawing on the order can always be
      // traced back to the one in the Passport.
      correctedAt,
      correctedBy: auth.userId,
      correctedByName: auth.name,
      correctedProfileId: asString(body.savedProfileId),
    };

    const nextItems = items.slice();
    nextItems[itemIndex] = corrected;

    const { error } = await admin
      .from('quote_requests')
      .update({ line_items: nextItems })
      .eq('id', params.id);
    if (error) {
      console.error('[Job Handoff Writeback Error]', error);
      return NextResponse.json(
        { error: 'The corrected profile could not be saved back onto this job.' },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminId: auth.userId,
      action: 'quote_request.line_item_corrected_in_flashdraft',
      resourceType: 'quote_request',
      resourceId: params.id,
      beforeValue: { itemIndex, item: before },
      afterValue: { itemIndex, item: corrected },
    });

    return NextResponse.json({
      ok: true,
      itemIndex,
      correctedAt,
      correctedByName: auth.name,
      requestNumber: row.request_number,
      label: flashDraftButtonLabel('geometry', row.source_tool),
      message: `Saved back onto ${row.request_number} and marked corrected by ${auth.name}.`,
    });
  } catch (error) {
    console.error('[Job Handoff POST Error]', error);
    return NextResponse.json(
      { error: 'The corrected profile could not be saved back onto this job.' },
      { status: 500 }
    );
  }
}
