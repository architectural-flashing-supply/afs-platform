import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate } from '@/lib/resend/templates/base';
import { isSourceTool } from '@/lib/data/quote-request-source-tool';
import { constraintsForQuoteLabels, getProfileConstraints } from '@/lib/data/product-profiles';
import { profileLabelsOf, readOrderValidatorItems } from '@/lib/order-validator/request-items';
import {
  acknowledgeableFindings,
  findingsForAudience,
  informationalFindings,
  validateOrder,
} from '@/lib/order-validator/validate';

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
  // Auto-generated bend/leg/radius/hem technical readout (afs-fl-012) —
  // present on "Custom FlashDraft Profile" items, kept as its own field
  // (rather than folded into the top-level `notes` string) so Command
  // Center's Pending Approval card can render it as a distinct block from
  // whatever the customer actually typed. See page.tsx's buildBendSummary
  // and lib/data/pending-quote-requests.ts's describeLineItem.
  geometrySummary?: string | null;
}

interface QuoteRequestResponse {
  requestId: string;
  requestNumber: string;
  /**
   * The order validator's view of what was just submitted (SPEC_AI_ORDER_VALIDATOR.md
   * section 6's "redundant but authoritative — do not trust client" server-side pass).
   *
   * ADDITIVE AND NON-BLOCKING, deliberately. The gate the spec designs is at
   * Step 2 -> Next, where the customer can still fix a dimension; by the time a
   * submission reaches here the only useful thing to do with a finding is to
   * tell them AFS will be in touch about it, which is what the confirmation
   * screen does. Blocking here would refuse requests this route has always
   * accepted, on thresholds half of which are still unconfirmed assumptions.
   *
   * Errors are deliberately excluded from the payload: an impossible dimension
   * printed on a confirmation screen is not actionable, and the submission has
   * already been accepted. They are counted and logged for the estimator
   * instead.
   */
  validation?: PostSubmitValidation;
}

interface PostSubmitValidation {
  counts: { error: number; warn: number; info: number };
  notes: { field: string; message: string }[];
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

/**
 * Runs the order validator over an accepted submission.
 *
 * NEVER THROWS AND NEVER BLOCKS. It runs after the insert has already succeeded,
 * so by construction it cannot affect whether a quote request is accepted — the
 * one property that matters here (ARCHITECTURE.md section 9's posture for the
 * confirmation email, applied to the same place for the same reason).
 *
 * It writes ONE structured server line when there is anything to say, which is
 * the whole of this feature's observability: there is no column to persist a
 * finding into, and this run may not apply a migration, so the admin review
 * screen recomputes instead. That turns out to be the better design anyway — a
 * stored finding would be frozen against the rule config it was written under,
 * and half those thresholds are still assumptions that will change when Steve
 * confirms them.
 */
async function validateSubmission(
  admin: ReturnType<typeof createAdminClient>,
  rawItems: unknown,
  requestNumber: string
): Promise<PostSubmitValidation | undefined> {
  try {
    const items = readOrderValidatorItems(rawItems);
    if (items.length === 0) return undefined;

    const catalog = await getProfileConstraints(admin);
    const constraints = [...catalog, ...constraintsForQuoteLabels(catalog, profileLabelsOf(items))];
    const result = validateOrder({ items, constraints });
    if (result.findings.length === 0) return undefined;

    const codes = [...new Set(result.findings.map((finding) => finding.code))].join(',');
    console.error(
      `[Order Validator] request=${requestNumber} errors=${result.counts.error} warns=${result.counts.warn} infos=${result.counts.info} codes=${codes}`
    );

    const visible = findingsForAudience(result.findings, 'customer');
    return {
      counts: result.counts,
      notes: [...acknowledgeableFindings(visible), ...informationalFindings(visible)].map((finding) => ({
        field: finding.field,
        message: finding.message,
      })),
    };
  } catch (error) {
    console.error('[Order Validator] post-submission validation failed', error);
    return undefined;
  }
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
    // RUSH: THE CUSTOMER CHECKBOX, AND NOTHING ELSE.
    // `body.isRush === true` is the literal state of the toggle on
    // app/quote/page.tsx. Nothing here looks at requestedDelivery, at `notes`,
    // or at any keyword — rush is never inferred (Command Center V2 prompt
    // v2-02). Migration 034's quote_requests_rush_needs_explicit_source CHECK
    // enforces that in the database: is_rush = true without a rush_source of
    // 'customer_checkbox' or 'admin_toggle' is REFUSED by Postgres, so this
    // route has to name its source to write a rush at all.
    const isRush = body.isRush === true;
    const rushSource = isRush ? 'customer_checkbox' : null;
    const notes = typeof body.notes === 'string' ? body.notes : null;
    // Selected color name from the McElroy/PAC-CLAD color chart, or (for
    // Anodized aluminum, until a PAC-CLAD anodized chart exists) free text,
    // set by the ColorField/FinishColorField flow on the Quote Builder,
    // FlashDraft, and Blueprint Takeoff AI surfaces when the
    // request's material requires one (afs-cv-002). Written into
    // quote_requests.color (migration 017).
    const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null;
    // The required Finish choice ("Anodized" or "Painted") for a request
    // whose material is in the 'aluminum' category (afs-jf-002) — supersedes
    // afs-cv-002's ruling that aluminum always used the PAC-CLAD chart.
    // null for every other material category; the McElroy/painted-steel
    // path never had a finish concept before this and still doesn't. Written
    // into quote_requests.finish (migration 018).
    const finish = typeof body.finish === 'string' && body.finish.trim() ? body.finish.trim() : null;
    // Job-identity intake fields (migration 018, afs-jf-000) — optional on
    // every submission surface (afs-jf-003). Written into
    // quote_requests.client_business_name / .client_name / .po_number /
    // .requested_by. `poNumber` was already collected by the Quote Builder
    // (app/quote/page.tsx's "PO Number" field, sent as `poNumber` in this
    // same body) but silently dropped here — this is also the fix for that
    // pre-existing gap, not just new plumbing for the other three fields.
    const clientBusinessName =
      typeof body.clientBusinessName === 'string' && body.clientBusinessName.trim() ? body.clientBusinessName.trim() : null;
    const clientName = typeof body.clientName === 'string' && body.clientName.trim() ? body.clientName.trim() : null;
    const poNumber = typeof body.poNumber === 'string' && body.poNumber.trim() ? body.poNumber.trim() : null;
    const requestedBy = typeof body.requestedBy === 'string' && body.requestedBy.trim() ? body.requestedBy.trim() : null;
    // job_name (migration 019, afs-jf-004/afs-jf-005) — the project/job name,
    // distinct from client_name (contact) and client_business_name (company).
    const jobName = typeof body.jobName === 'string' && body.jobName.trim() ? body.jobName.trim() : null;
    // Reuses the pre-existing quote_requests.requested_delivery DATE column
    // (001_initial_schema.sql) rather than adding a new one — see migration
    // 019's header comment for the full reuse decision. Previously
    // unpopulated by every submission surface despite being read at
    // approve-quote-request/route.ts to seed machine_jobs.due_date.
    const requestedDelivery =
      typeof body.requestedDelivery === 'string' && body.requestedDelivery.trim() ? body.requestedDelivery.trim() : null;
    // Every real front-end submission path (FlashDraft, the Quote Builder,
    // the Blueprint Takeoff AI upload flow) sends its own token here — the
    // Configurator did too before its elimination (hpd-002); its historical
    // token is still recognized, see lib/data/quote-request-source-tool.ts
    // for the full
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
      rush_source: rushSource,
      rush_set_at: isRush ? new Date().toISOString() : null,
      notes,
      color,
      finish,
      client_business_name: clientBusinessName,
      client_name: clientName,
      po_number: poNumber,
      requested_by: requestedBy,
      job_name: jobName,
      requested_delivery: requestedDelivery,
      status: 'submitted',
      source_tool: sourceTool,
      // ARRIVES AS A NEW JOB ON THE WORKBENCH (Command Center V2, prompt
      // v2-02). Every source funnels through this route — FlashDraft, the
      // quote builder and the Blueprint Takeoff upload — and they all land in
      // the New lane. Written explicitly rather than leaning on migration
      // 032's column DEFAULT, so the lane a submission lands in is visible at
      // the insert instead of being a property of the schema.
      job_stage: 'new',
      stage_changed_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[Quote Request Insert Error]', insertError);
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
    }

    // --- Order validator (SPEC_AI_ORDER_VALIDATOR.md §6's server-side pass) ---
    // After the insert, so it cannot affect whether the submission was accepted.
    const validation = await validateSubmission(admin, items, requestNumber);

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

    const response: QuoteRequestResponse = { requestId, requestNumber, validation };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Quote Request Error]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}
