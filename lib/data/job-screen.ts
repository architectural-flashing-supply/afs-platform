/**
 * THE JOB SCREEN — three columns, as the approved prototype draws them
 * (docs/design/command-center-v2-prototype.html: `requestPanel`,
 * `profilePanel`, `actionPanel`, `steps`).
 *
 *   1. The request, exactly as the customer sent it, alongside
 *      "What the AI read" with confidence highlighting.
 *   2. The profile, this customer's past profiles, and Open in FlashDraft.
 *   3. A stage-specific action panel.
 *
 * WHAT THIS MODULE WILL NOT DO: invent a reading. If a job arrived as a
 * FlashDraft drawing the customer specified themselves, there IS no AI
 * extraction behind it, and the panel says so rather than running the submitted
 * spec through a confidence badge it never earned. `aiRead` is null in that
 * case, deliberately.
 *
 * EGRESS: `geometryImage` (a base64 PNG data URI on FlashDraft line items,
 * regularly over 100KB) is NOT read. The drawing is rendered from the real
 * `points` as an inline SVG path instead, and past-profile thumbnails are
 * lazy-loaded one at a time from the pre-existing
 * /api/admin/command-center/profile-thumbnail/[id] route.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isJobStage, type JobStage } from '@/lib/data/job-stage';
import {
  buildAiReadRows,
  hasUnsureRows,
  isTakeoffConfidence,
  type AiReadRow,
  type TakeoffConfidence,
  type TakeoffReadItem,
} from '@/lib/ai/takeoff-confidence';
import { sourceArrivalLabel, sourceIconKey, type SourceIconKey } from '@/lib/data/quote-request-source-tool';
import { shopSubStateFromJobStatuses, shopSubStateLabel, type ShopSubState } from '@/lib/data/workbench';
import { waitingPhrase } from '@/lib/utils/waiting-time';
import { geometryFingerprint } from '@/lib/flashdraft/geometry-fingerprint';
import {
  flashDraftButtonHint,
  flashDraftButtonLabel,
  flashDraftJobHref,
  handoffCorrectionFromItem,
  isTraceableImageType,
  type JobHandoffCorrection,
  type JobHandoffKind,
} from '@/lib/flashdraft/job-handoff';
import { getResolvedPriceBook, getRushPolicyBook } from '@/lib/pricing/db';
import {
  evaluateRushLeadTime,
  rushPolicyInForce,
  type RushLeadTime,
  type RushPolicy,
} from '@/lib/pricing/rush-policy';
import { shopDateOnly } from '@/lib/delivery/business-days';
import { quoteFromPriceBook } from '@/lib/pricing/quote-math';
import { toQuoteItemInputs, type JobLineItemGeometry } from '@/lib/pricing/quote-inputs';
import { officeInvoiceEmail } from '@/lib/data/office';
import type { QuoteLine, QuoteResult } from '@/lib/pricing/types';

/** Same 15-minute window as lib/data/pending-quote-requests.ts. */
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 900;

/** How many of a customer's past profiles the prototype's thumbnail grid shows. */
export const PAST_PROFILE_LIMIT = 8;

export interface JobLineItem {
  profileType: string;
  material: string | null;
  gauge: string | null;
  quantity: number;
  lengthFt: number | null;
  /** Real drawn geometry, world inches. Used to render an SVG — no base64. */
  points: { x: number; y: number }[] | null;
  geometrySummary: string | null;
}

export interface PastProfile {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * WHERE "DESIGN IN FLASHDRAFT" GOES — and it now always goes somewhere.
 *
 * THIS USED TO BE A DEAD END MOST OF THE TIME. The link was
 * `?modifyProfile=<saved_configurations.id>`, resolved by matching the job's
 * `geometry_fingerprint` against the customer's saved profiles. That only
 * exists when the customer ALSO saved their drawing as a profile, so a job
 * carrying perfectly good geometry on its own line item got a `needbox` reading
 * "Open in FlashDraft is not available here" — and a field-app job, which
 * carries a photograph and no geometry at all, got the same dead end with no
 * way forward but drawing it from memory on a blank canvas somewhere else.
 *
 * The link is now keyed on the QUOTE REQUEST, which every job has
 * (lib/flashdraft/job-handoff.ts), and the three `kind`s say honestly what the
 * estimator will find when they arrive:
 *
 *   'geometry'  — the order's drawing, loaded and editable.
 *   'reference' — a blank canvas with the customer's photo behind it to trace.
 *   'metadata'  — a blank canvas with the order's specification filled in.
 *
 * NOTHING IS INVENTED to promote a job up that list. `matchedProfileName` is
 * still resolved by fingerprint and still shown, because "this is the same
 * shape as a profile you already have" is worth knowing — but it is now
 * information beside the button rather than the thing that decides whether
 * there is one.
 */
export interface FlashDraftLink {
  href: string;
  label: string;
  hint: string;
  kind: JobHandoffKind;
  /** The saved profile this job's drawing matches, if any. Informational. */
  matchedProfileName: string | null;
  /** Who last corrected this line in FlashDraft, and when. Never invented. */
  correction: JobHandoffCorrection | null;
}

export interface JobScreenData {
  id: string;
  requestNumber: string;
  stage: JobStage;
  /** null when this job was cancelled — the page says so rather than 404ing. */
  archived: boolean;

  customerName: string;
  customerCompany: string | null;
  contactFirstName: string;
  customerEmail: string | null;

  sourceLabel: string;
  sourceIcon: SourceIconKey;
  sourceTool: string | null;

  /** The customer's own words, verbatim. Never rewritten. */
  customerNote: string | null;
  jobName: string | null;
  poNumber: string | null;
  color: string | null;
  finish: string | null;
  requestedDelivery: string | null;
  submittedPhrase: string | null;

  items: JobLineItem[];
  totalQuantity: number;

  /** null when nothing AI-extracted this job. See this file's header. */
  aiRead: {
    rows: AiReadRow[];
    anyUnsure: boolean;
    overallConfidence: TakeoffConfidence | null;
    processingNotes: string | null;
    /**
     * TRUE ONLY WHEN A PARSER ITEM REALLY IS A LINE OF THIS ORDER.
     *
     * `takeoff_uploads.result_items` and `quote_requests.line_items` are two
     * different arrays: the first is what the AI read out of the upload, the
     * second is what the request carries. They correspond one-to-one in the
     * ordinary case and NOT AT ALL for a field-app job, which arrives with
     * `line_items = []` however many items the parser found.
     *
     * A per-line "Fix in FlashDraft" is therefore only offered when the counts
     * match. Otherwise every per-line link would resolve to the same line and
     * silently claim to be fixing a different one.
     */
    perItemAddressable: boolean;
  } | null;

  /** The uploaded drawing/photo this job arrived with, if any. Lazy-rendered. */
  attachment: { url: string | null; fileName: string; fileType: string } | null;

  pastProfiles: PastProfile[];
  flashDraftLink: FlashDraftLink;

  isRush: boolean;
  rushSource: string | null;

  approvalChannel: string | null;
  approvedPhrase: string | null;
  quotedPhrase: string | null;
  sentPhrase: string | null;
  deliveredPhrase: string | null;

  pathfinderProfileIds: string[];
  sendStatus: 'failed' | 'unconfirmed' | null;
  sendError: string | null;

  shopSubState: ShopSubState;
  shopSubStateLabel: string;

  followupDraft: string | null;

  /**
   * THE PRICED QUOTE, or exactly why it cannot be priced yet (v2-03).
   *
   * Built from the price book AS IT STANDS NOW, for the `new` stage's quote
   * table. It is a PREVIEW -- nothing is written and no dollar amount reaches
   * a customer from it. When the price book has a blank the job needs, this
   * carries the plain-English problems instead of a total, and the Send quote
   * button is disabled. There is deliberately no path here that produces a
   * number from an unfilled cell.
   */
  quotePreview: QuoteResult | null;

  /**
   * THE RUSH SIDE OF THE QUOTE, for a rush job only (`null` otherwise, and no
   * query is made for a standard job).
   *
   * It carries the POLICY rather than a computed surcharge, deliberately:
   * `JobActionPanel` re-totals in the browser as the estimator edits Qty, so it
   * has to work the surcharge out again from the edited subtotal — with the
   * SAME `evaluateRushSurcharge` the server uses when Send is pressed. One
   * function, both sides, so the figure on screen and the figure emailed cannot
   * disagree.
   *
   * The LEAD TIME is computed here, on the server, because "today" has to be
   * the shop's date and not the browser's (CLAUDE.md rule #24).
   */
  rushQuote: {
    policy: RushPolicy | null;
    /** Non-null when `rush_policies` could not be read. Plain English. */
    policyUnavailable: string | null;
    leadTime: RushLeadTime;
  } | null;

  /** The quote that was actually issued, once one has been. */
  issuedQuote: {
    id: string;
    number: string;
    revision: number;
    totalCents: number;
    status: string;
    sentAt: string | null;
    sentTo: string | null;
    /** How the Approve link stands: still live, spent, or run out. */
    approveLink: 'live' | 'used' | 'expired' | 'none';
  } | null;

  /** The invoice the quote became on approval. */
  invoice: {
    id: string;
    number: string;
    totalCents: number;
    issuedAt: string;
    officeEmailedTo: string | null;
    officeEmailedAt: string | null;
    paidAt: string | null;
  } | null;

  /** Where an approved invoice is copied automatically. */
  officeEmail: string;
}

interface RawItem {
  profileType?: string | null;
  material?: string | null;
  gauge?: string | null;
  quantity?: number | null;
  lengthFt?: number | null;
  points?: { x: number; y: number }[] | null;
  geometrySummary?: string | null;
}

const JOB_COLUMNS =
  'id, request_number, user_id, guest_email, line_items, is_rush, rush_source, notes, ' +
  'job_name, po_number, color, finish, requested_delivery, submitted_at, quoted_at, ' +
  'source_tool, upload_id, job_stage, stage_changed_at, approved_at, approval_channel, ' +
  'sent_to_machine_at, done_at, pathfinder_profile_ids, send_status, send_error, followup_draft';

export async function getJobScreen(
  supabase: SupabaseClient,
  id: string,
  now: Date = new Date()
): Promise<JobScreenData | null> {
  const { data, error } = await supabase.from('quote_requests').select(JOB_COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    request_number: string;
    user_id: string | null;
    guest_email: string | null;
    line_items: RawItem[] | null;
    is_rush: boolean;
    rush_source: string | null;
    notes: string | null;
    job_name: string | null;
    po_number: string | null;
    color: string | null;
    finish: string | null;
    requested_delivery: string | null;
    submitted_at: string;
    quoted_at: string | null;
    source_tool: string | null;
    upload_id: string | null;
    job_stage: string | null;
    stage_changed_at: string | null;
    approved_at: string | null;
    approval_channel: string | null;
    sent_to_machine_at: string | null;
    done_at: string | null;
    pathfinder_profile_ids: string[] | null;
    send_status: string | null;
    send_error: string | null;
    followup_draft: string | null;
  };

  // Customer.
  let customerName = row.guest_email ?? 'Guest';
  let customerCompany: string | null = null;
  let customerEmail: string | null = row.guest_email;
  if (row.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company, email')
      .eq('id', row.user_id)
      .maybeSingle();
    const p = profile as { full_name: string | null; company: string | null; email: string | null } | null;
    customerName = (p?.full_name ?? '').trim() || row.guest_email || 'Customer';
    customerCompany = (p?.company ?? '').trim() || null;
    customerEmail = p?.email ?? null;
  }

  const items: JobLineItem[] = (row.line_items ?? []).map((i) => ({
    profileType: (i.profileType ?? '').trim() || 'Custom profile',
    material: i.material ?? null,
    gauge: i.gauge ?? null,
    quantity: Number(i.quantity) > 0 ? Math.round(Number(i.quantity)) : 0,
    lengthFt: i.lengthFt ?? null,
    points: Array.isArray(i.points) && i.points.length >= 2 ? i.points : null,
    geometrySummary: i.geometrySummary ?? null,
  }));

  // "What the AI read" — only when something actually read it.
  let aiRead: JobScreenData['aiRead'] = null;
  let attachment: JobScreenData['attachment'] = null;
  if (row.upload_id) {
    const { data: upload } = await supabase
      .from('takeoff_uploads')
      .select('result_items, overall_confidence, processing_notes, storage_key, file_name, file_type')
      .eq('id', row.upload_id)
      .maybeSingle();
    const u = upload as {
      result_items: TakeoffReadItem[] | null;
      overall_confidence: string | null;
      processing_notes: string | null;
      storage_key: string;
      file_name: string;
      file_type: string;
    } | null;
    if (u) {
      const resultItems = Array.isArray(u.result_items) ? u.result_items : [];
      if (resultItems.length > 0) {
        const rows = buildAiReadRows(resultItems);
        aiRead = {
          rows,
          anyUnsure: hasUnsureRows(rows),
          overallConfidence: isTakeoffConfidence(u.overall_confidence) ? u.overall_confidence : null,
          processingNotes: u.processing_notes,
          perItemAddressable: resultItems.length > 0 && resultItems.length === items.length,
        };
      }
      // Service role: the point is cross-customer admin access, which RLS
      // correctly denies to the admin's own session. Same pattern as
      // lib/data/pending-quote-requests.ts.
      const bucket = u.storage_key.split('/')[0];
      const { data: signed } = await createAdminClient()
        .storage.from(bucket)
        .createSignedUrl(u.storage_key, ATTACHMENT_SIGNED_URL_TTL_SECONDS);
      attachment = { url: signed?.signedUrl ?? null, fileName: u.file_name, fileType: u.file_type };
    }
  }

  // This customer's past profiles. Names and dates only — the thumbnails are
  // fetched one at a time by the client as they come into view.
  let pastProfiles: PastProfile[] = [];
  if (row.user_id) {
    const { data: saved } = await supabase
      .from('saved_configurations')
      .select('id, name, created_at')
      .eq('user_id', row.user_id)
      .order('created_at', { ascending: false })
      .limit(PAST_PROFILE_LIMIT);
    pastProfiles = ((saved ?? []) as { id: string; name: string | null; created_at: string }[]).map((s) => ({
      id: s.id,
      name: (s.name ?? '').trim() || 'Untitled profile',
      createdAt: s.created_at,
    }));
  }

  // "Design in FlashDraft" — see FlashDraftLink's own comment above.
  //
  // The ITEM INDEX is the first line that carries drawn geometry, or 0. An
  // order with one drawn line and three described ones should open the drawn
  // one; an order with none opens the first line, which is the one the
  // estimator is about to draw.
  const drawnIndex = items.findIndex((i) => i.points !== null);
  const handoffIndex = drawnIndex >= 0 ? drawnIndex : 0;
  const drawnItem = drawnIndex >= 0 ? items[drawnIndex] : undefined;

  // An image the customer sent is something to trace; a PDF or a HEIC is not.
  // ONE predicate, shared with the API route that actually serves the image, so
  // the label here cannot promise a photo the canvas will not show.
  const hasTraceableImage = !!attachment?.url && isTraceableImageType(attachment.fileType);
  const handoffKind: JobHandoffKind = drawnItem?.points
    ? 'geometry'
    : hasTraceableImage
      ? 'reference'
      : 'metadata';

  // Still resolved through geometry_fingerprint, still never guessed — but now
  // it decorates the button instead of gating it.
  let matchedProfileName: string | null = null;
  if (drawnItem?.points) {
    const fingerprint = geometryFingerprint({ points: drawnItem.points });
    if (fingerprint) {
      let q = supabase
        .from('saved_configurations')
        .select('id, name')
        .eq('geometry_fingerprint', fingerprint)
        .order('created_at', { ascending: false })
        .limit(1);
      if (row.user_id) q = q.eq('user_id', row.user_id);
      const { data: match } = await q;
      const hit = ((match ?? []) as { id: string; name: string | null }[])[0];
      if (hit) matchedProfileName = (hit.name ?? '').trim() || 'Untitled profile';
    }
  }

  const flashDraftLink: FlashDraftLink = {
    href: flashDraftJobHref(row.id, handoffIndex),
    label: flashDraftButtonLabel(handoffKind, row.source_tool),
    hint: flashDraftButtonHint(handoffKind, row.source_tool),
    kind: handoffKind,
    matchedProfileName,
    correction: handoffCorrectionFromItem((row.line_items ?? [])[handoffIndex] ?? null),
  };

  // Shop sub-state from the real machine_jobs rows.
  const { data: jobs } = await supabase.from('machine_jobs').select('status').eq('quote_request_id', row.id);
  const shopSub = shopSubStateFromJobStatuses(((jobs ?? []) as { status: string }[]).map((j) => j.status));

  const stage: JobStage = isJobStage(row.job_stage) ? row.job_stage : 'new';

  // ---- The priced quote, and the invoice it became -----------------------
  //
  // The PREVIEW is only built for the stage that can act on it. Once a quote
  // has been issued, the figures that matter are the ones on the issued
  // document -- re-pricing an already-sent quote against today's price book
  // would show the admin a number the customer never saw.
  let quotePreview: QuoteResult | null = null;
  if (stage === 'new' || stage === 'quoted') {
    const priceBook = await getResolvedPriceBook(supabase, now);
    quotePreview = quoteFromPriceBook(
      toQuoteItemInputs((row.line_items ?? []) as JobLineItemGeometry[]),
      priceBook
    );
  }

  // ---- The rush side, for a rush job only --------------------------------
  //
  // ONLY FOR A RUSH JOB, so a standard job costs no extra query: there is
  // nothing a rush policy could say about it. `getRushPolicyBook` never throws,
  // so a deployment without migration 039 applied surfaces its reason as the
  // sentence the panel prints rather than taking this screen down.
  //
  // THE LEAD TIME IS DECIDED HERE and not in the browser, because "today" has
  // to be the shop's own date. Vercel runs in UTC and Burnet is Central, so a
  // Tuesday-evening comparison worked out from the browser or the raw server
  // clock would be a day out (CLAUDE.md rule #24's second hazard).
  let rushQuote: JobScreenData['rushQuote'] = null;
  if (row.is_rush) {
    const today = shopDateOnly(now);
    const book = await getRushPolicyBook(supabase);
    const policy = rushPolicyInForce(book.policies, today);
    rushQuote = {
      policy,
      policyUnavailable: book.unavailable,
      leadTime: evaluateRushLeadTime(
        { isRush: true, requestedDelivery: row.requested_delivery, today },
        policy
      ),
    };
  }

  const { data: quoteRows } = await supabase
    .from('quotes')
    .select('id, quote_number, revision, total_cents, status, sent_at, customer_email')
    .eq('request_id', row.id)
    .order('revision', { ascending: false })
    .limit(1);
  const latestQuote = ((quoteRows ?? []) as {
    id: string;
    quote_number: string;
    revision: number;
    total_cents: number | null;
    status: string;
    sent_at: string | null;
    customer_email: string | null;
  }[])[0];

  let issuedQuote: JobScreenData['issuedQuote'] = null;
  if (latestQuote) {
    const { data: tokens } = await supabase
      .from('quote_approval_tokens')
      .select('used_at, expires_at')
      .eq('quote_id', latestQuote.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const token = ((tokens ?? []) as { used_at: string | null; expires_at: string }[])[0];
    const approveLink: 'live' | 'used' | 'expired' | 'none' = !token
      ? 'none'
      : token.used_at
        ? 'used'
        : new Date(token.expires_at).getTime() < now.getTime()
          ? 'expired'
          : 'live';
    issuedQuote = {
      id: latestQuote.id,
      number: latestQuote.quote_number,
      revision: latestQuote.revision,
      totalCents: latestQuote.total_cents ?? 0,
      status: latestQuote.status,
      sentAt: latestQuote.sent_at,
      sentTo: latestQuote.customer_email,
      approveLink,
    };
  }

  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_cents, issued_at, office_emailed_to, office_emailed_at, paid_at')
    .eq('quote_request_id', row.id)
    .order('issued_at', { ascending: false })
    .limit(1);
  const invoiceRow = ((invoiceRows ?? []) as {
    id: string;
    invoice_number: string;
    total_cents: number;
    issued_at: string;
    office_emailed_to: string | null;
    office_emailed_at: string | null;
    paid_at: string | null;
  }[])[0];

  return {
    id: row.id,
    requestNumber: row.request_number,
    stage,
    archived: row.job_stage === null,
    customerName,
    customerCompany,
    // First name only — "Hi Mike," is how the prototype's quote email opens.
    contactFirstName: customerName.trim().split(/\s+/)[0] || 'there',
    customerEmail,
    sourceLabel: sourceArrivalLabel(row.source_tool),
    sourceIcon: sourceIconKey(row.source_tool),
    sourceTool: row.source_tool,
    customerNote: row.notes?.trim() ? row.notes.trim() : null,
    jobName: row.job_name,
    poNumber: row.po_number,
    color: row.color,
    finish: row.finish,
    requestedDelivery: row.requested_delivery,
    submittedPhrase: waitingPhrase(row.submitted_at, now),
    items,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    aiRead,
    attachment,
    pastProfiles,
    flashDraftLink,
    isRush: row.is_rush === true,
    rushSource: row.rush_source,
    approvalChannel: row.approval_channel,
    approvedPhrase: waitingPhrase(row.approved_at, now),
    quotedPhrase: waitingPhrase(row.quoted_at, now),
    sentPhrase: waitingPhrase(row.sent_to_machine_at, now),
    deliveredPhrase: waitingPhrase(row.done_at, now),
    pathfinderProfileIds: (row.pathfinder_profile_ids ?? []).filter(Boolean),
    sendStatus: row.send_status === 'failed' || row.send_status === 'unconfirmed' ? row.send_status : null,
    sendError: row.send_error,
    shopSubState: shopSub,
    shopSubStateLabel: shopSubStateLabel(shopSub),
    followupDraft: row.followup_draft,
    quotePreview,
    rushQuote,
    issuedQuote,
    invoice: invoiceRow
      ? {
          id: invoiceRow.id,
          number: invoiceRow.invoice_number,
          totalCents: invoiceRow.total_cents,
          issuedAt: invoiceRow.issued_at,
          officeEmailedTo: invoiceRow.office_emailed_to,
          officeEmailedAt: invoiceRow.office_emailed_at,
          paidAt: invoiceRow.paid_at,
        }
      : null,
    officeEmail: officeInvoiceEmail(),
  };
}

/**
 * An SVG path for a drawn cross-section, from the real points.
 *
 * Deliberately NOT a reimplementation of FlashDraft's renderer: this is a
 * scale-to-fit polyline for a read-only preview, which is all three of the
 * prototype's drawing slots need. Bend radii, hems and dimension labels are
 * FlashDraft's job, and "Open in FlashDraft" is one click away.
 */
export function pointsToSvgPath(points: { x: number; y: number }[], size = 100, pad = 10): string | null {
  if (!points || points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);
  if (!Number.isFinite(span) || span <= 0) return null;
  const scale = (size - pad * 2) / span;
  // Centre the smaller axis so a tall thin profile is not pinned to one edge.
  const offX = pad + (size - pad * 2 - spanX * scale) / 2;
  const offY = pad + (size - pad * 2 - spanY * scale) / 2;
  const round = (n: number) => Math.round(n * 100) / 100;
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(offX + (p.x - minX) * scale)} ${round(offY + (p.y - minY) * scale)}`)
    .join(' ');
}
